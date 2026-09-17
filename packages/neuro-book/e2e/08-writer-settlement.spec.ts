import type {Page} from "@playwright/test";
import {expect, openE2eProject, test} from "./fixtures";
import {E2E_SETTLEMENT_MARKER} from "./e2e-env";
import {
    ensureAgentSession,
    sendAgentMessage,
    waitForAgentRunCompleted,
} from "./support/agent";
import {parseChapterSettlement} from "../server/agent/profiles/writer-settlement";

/**
 * T0.1 写后结算表协议的 E2E 行为锁：**交付消息可被解析出结算块结构**。
 *
 * 链路：用户消息带 `E2E_SETTLEMENT_MARKER` → Mock LLM 流式吐固定结算样例
 * （`E2E_SETTLEMENT_SAMPLE_TEXT`，模拟 writer 在 report_result.result 尾部按协议
 * 附「## 本章结算」块）→ 会话落盘 → 从 session recovery API 读回 assistant 交付
 * 消息**原文**（DOM 渲染会吃掉 markdown 标记，不能从气泡取）→ 用生产解析器
 * `parseChapterSettlement` 断言三节结构完整。
 *
 * 约束：不改产品代码；只依赖既有 e2e 基建（fixtures + support/agent + mock-llm）。
 */
test("08-1 写后结算块：mock 交付消息可解析出结算结构", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    await sendAgentMessage(page, `${E2E_SETTLEMENT_MARKER} 请交付本章正文，并按协议在交付消息尾部附上结算块。`);
    await waitForAgentRunCompleted(page, 90_000);

    const raw = await pollSettlementDeliveryText(page);
    expect(raw, "交付消息应包含「## 本章结算」主标题").toContain("## 本章结算");

    const parsed = parseChapterSettlement(raw);
    expect(parsed.kind).toBe("present");
    if (parsed.kind !== "present") {
        return;
    }
    // 新增事实：四个类别齐全。
    expect(parsed.settlement.newFacts.length).toBe(4);
    expect(parsed.settlement.newFacts.some((fact) => fact.startsWith("[人物] 莉雅"))).toBe(true);
    expect(parsed.settlement.newFacts.some((fact) => fact.startsWith("[物品]"))).toBe(true);
    expect(parsed.settlement.newFacts.some((fact) => fact.startsWith("[状态]"))).toBe(true);
    expect(parsed.settlement.newFacts.some((fact) => fact.startsWith("[时间]"))).toBe(true);
    // 「- 无」是空小节规范写法：解析为空列表，而不是 ["无"]。
    expect(parsed.settlement.conflicts).toEqual([]);
    // 未确定项保留原文条目。
    expect(parsed.settlement.unresolved).toEqual(["莉雅对封印起源的说法尚未与 lorebook 核对，是否入 canon 待确认"]);
});

/**
 * 轮询读取包含结算块的 assistant 交付消息原文。
 *
 * 运行结束与消息落盘之间可能有短暂延迟，这里按秒级退避重试；
 * 只在所有 session 的 assistant 条目里找含「## 本章结算」的最新交付
 * （整套 e2e 里只有本用例的消息会触发 mock 吐结算样例，不会认错会话）。
 */
async function pollSettlementDeliveryText(page: Page, timeoutMs = 30_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let lastError = "未找到包含「## 本章结算」的 assistant 交付消息";
    while (Date.now() < deadline) {
        try {
            const text = await findSettlementDeliveryText(page);
            if (text) {
                return text;
            }
        } catch (error) {
            lastError = `读取 session 交付消息失败: ${String(error)}`;
        }
        await page.waitForTimeout(1_000);
    }
    throw new Error(lastError);
}

/** 在全部 session 的 assistant 条目里找含「## 本章结算」的交付消息原文（找不到返回空串）。 */
async function findSettlementDeliveryText(page: Page): Promise<string> {
    const listResponse = await page.request.get("/api/agent/sessions?limit=200");
    expect(listResponse.ok(), "GET /api/agent/sessions 应成功").toBe(true);
    const list = await listResponse.json() as {items?: Array<{sessionId?: number}>};
    const sessionIds = (list.items ?? [])
        .map((item) => item.sessionId)
        .filter((id): id is number => typeof id === "number")
        .sort((a, b) => b - a);

    for (const sessionId of sessionIds) {
        const recoveryResponse = await page.request.get(`/api/agent/sessions/${sessionId}`);
        if (!recoveryResponse.ok()) {
            continue;
        }
        const recovery = await recoveryResponse.json() as {
            history?: {
                entries?: Array<{
                    type?: string;
                    content?: {preview?: string};
                }>;
            };
        };
        const entries = recovery.history?.entries ?? [];
        for (let index = entries.length - 1; index >= 0; index -= 1) {
            const entry = entries[index];
            const preview = entry?.type === "assistant" ? entry.content?.preview : undefined;
            if (typeof preview === "string" && preview.includes("## 本章结算")) {
                return preview;
            }
        }
    }
    return "";
}
