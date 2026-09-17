/**
 * 「本章结算」写后结算表协议（T0.1）——writer 交付消息尾部的结构化事实清点。
 *
 * 协议形态：**文本协议，不是 tool call**。writer 每完成一章，在 report_result.result
 * 文本末尾追加一个约定格式的 markdown 文本块，leader 在写后评审里**优先消费**该块，
 * 结算块未覆盖的方面才回读正文。选择文本协议的理由：
 * 1. mock LLM 不支持 tool_calls，e2e 才能锁定该约定；
 * 2. writer 工具面不加新工具（只读边界不动）；
 * 3. leader 直接在会话流里消费，无需新管线。
 *
 * 宪法兼容性：结算块是**事后上报**（对已写正文的如实清点），不要求 writer 在动笔前
 * 输出任何意图级内容（宪法第五条明文鼓励方向）。
 *
 * 本模块是协议标题与小节名的唯一常量来源 + 唯一解析实现：
 * - writer profile 的 `<chapter_settlement>` 段（交付格式约定）必须与这里一致；
 * - `writer-settlement-contract.test.ts` 用它锁定 profile 提示词与格式；
 * - `e2e/08-writer-settlement.spec.ts` 用它做端到端「交付消息可解析」断言。
 */

/** 结算块主标题（markdown 二级标题，行首出现即视为结算块起点）。 */
export const CHAPTER_SETTLEMENT_HEADING = "## 本章结算";

/** 「新增事实」小节标题（人物 / 物品 / 状态变化 / 时间推进）。 */
export const CHAPTER_SETTLEMENT_NEW_FACTS_SECTION = "### 新增事实";

/** 「与既有设定的冲突点」小节标题（writer 自己发现的冲突）。 */
export const CHAPTER_SETTLEMENT_CONFLICTS_SECTION = "### 与既有设定的冲突点";

/** 「未确定项」小节标题（临时起意、尚未确认是否入 canon 的内容）。 */
export const CHAPTER_SETTLEMENT_UNRESOLVED_SECTION = "### 未确定项";

/** 解析出的结算结构：三个小节各对应一个条目列表（条目为一句话事实文本，含类别标签）。 */
export type ChapterSettlement = {
    newFacts: string[];
    conflicts: string[];
    unresolved: string[];
};

/**
 * 解析结果：
 * - `missing`：交付消息里没有结算块（旧会话 / 未按协议输出的向后兼容场景——调用方
 *   应退回「重读正文」的老评审路径，绝不能把「没找到」当成「没有新事实」）；
 * - `present`：找到了结算块；`raw` 为从主标题起到文本结束的原文（含标题行）。
 */
export type ChapterSettlementParseResult =
    | {kind: "missing"}
    | {kind: "present"; settlement: ChapterSettlement; raw: string};

/** 结算块主标题行：`## 本章结算`（允许行尾空白；不允许更多 #）。 */
const SETTLEMENT_HEADING_LINE = /^#{2}\s*本章结算\s*$/;

/** 小节标题行：三级或更深标题，捕获标题文本。 */
const SECTION_HEADING_LINE = /^#{3,}\s*(.+?)\s*$/;

/** 更高级别的标题行（一级 / 二级）——结算块到此为止。 */
const BLOCK_TERMINATING_HEADING = /^#{1,2}\s/;

/** 列表条目行：`- xxx` 或 `* xxx`（允许缩进）。 */
const LIST_ITEM_LINE = /^[-*]\s+(.*)$/;

/**
 * 从一段交付消息文本中解析「## 本章结算」块。
 *
 * 容错口径（面向真实模型输出，宁宽松不误伤）：
 * - 主标题行允许行尾空白；小节按标题文本包含关键词归类（「新增事实」/「冲突」/「未确定」）；
 * - 条目行允许 `-` 或 `*` 前缀与缩进；空条目与「无」不计入（「- 无」表示该小节为空）；
 * - 结算块在下一个一级 / 二级标题处结束；没有小节标题的正文行被忽略；
 * - 没有结算块时返回 `{kind: "missing"}`，绝不抛错（向后兼容：旧会话照常工作）。
 */
export function parseChapterSettlement(text: string): ChapterSettlementParseResult {
    const lines = (text ?? "").split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => SETTLEMENT_HEADING_LINE.test(line));
    if (headingIndex < 0) {
        return {kind: "missing"};
    }

    const settlement: ChapterSettlement = {newFacts: [], conflicts: [], unresolved: []};
    let target: string[] | null = null;

    for (let index = headingIndex + 1; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (BLOCK_TERMINATING_HEADING.test(line)) {
            break;
        }
        const sectionMatch = SECTION_HEADING_LINE.exec(line);
        if (sectionMatch) {
            const sectionName = sectionMatch[1] ?? "";
            if (sectionName.includes("新增事实")) {
                target = settlement.newFacts;
            } else if (sectionName.includes("冲突")) {
                target = settlement.conflicts;
            } else if (sectionName.includes("未确定")) {
                target = settlement.unresolved;
            } else {
                target = null;
            }
            continue;
        }
        const itemMatch = LIST_ITEM_LINE.exec(line.trimStart());
        if (target && itemMatch) {
            const value = (itemMatch[1] ?? "").trim();
            // 「- 无」是协议规定的空小节写法，解析为空列表而不是 ["无"]。
            if (value.length > 0 && value !== "无") {
                target.push(value);
            }
        }
    }

    return {
        kind: "present",
        settlement,
        raw: lines.slice(headingIndex).join("\n"),
    };
}
