import {randomUUID} from "node:crypto";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import writerProfileDefinition from "../../../assets/workspace/.nbook/agent/profiles/builtin/writer.profile";
import {DEFAULT_WRITING_REFERENCE_PRESET} from "nbook/server/agent/profiles/writer-writing-reference";
import {DEFAULT_WRITING_STYLE_PRESET} from "nbook/server/agent/profiles/writer-writing-style";
import {createTestVariableAccessor} from "nbook/server/agent/variables/test-utils";
import {createTestRuntimeSession as testSession} from "nbook/server/agent/profiles/test/runtime-session";
import {normalizeAgentProfile} from "nbook/server/agent/profiles/define-agent-profile";
import {resolveRuntimeWorkspaceRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import {
    createIsolatedWorkspaceAssets,
    type IsolatedWorkspaceAssets,
} from "nbook/server/workspace-files/test-workspace-fixture";
import {
    CHAPTER_SETTLEMENT_CONFLICTS_SECTION,
    CHAPTER_SETTLEMENT_HEADING,
    CHAPTER_SETTLEMENT_NEW_FACTS_SECTION,
    CHAPTER_SETTLEMENT_UNRESOLVED_SECTION,
    parseChapterSettlement,
} from "./writer-settlement";

const writerProfile = normalizeAgentProfile(writerProfileDefinition);

/**
 * 「本章结算」写后结算表协议的契约锁（T0.1）。
 *
 * 锁两件事：
 * 1. writer profile 的系统提示词确实声明了结算块格式约定（主标题 + 三个小节名 +
 *    「事后上报，不是写作前置条件」的宪法第五条兼容声明）；
 * 2. 解析器对协议格式的行为稳定：三节齐全可解析、「- 无」不计入、
 *    没有结算块的旧交付返回 missing（向后兼容，不抛错）。
 *
 * e2e 侧的「mock 吐固定结算样例 → 交付消息可解析」由 `e2e/08-writer-settlement.spec.ts` 承担。
 */
describe("writer 写后结算块（本章结算）契约", () => {
    let assets: IsolatedWorkspaceAssets;

    beforeAll(async () => {
        assets = await createIsolatedWorkspaceAssets({purpose: "writer-settlement-contract-tests"});
    });

    afterAll(async () => {
        await assets.dispose();
    });

    it("writer profile 交付协议声明「## 本章结算」块格式约定", async () => {
        const projectSlug = `writer-settlement-${randomUUID()}`;
        const projectRoot = join(resolveRuntimeWorkspaceRoot(), projectSlug);
        await mkdir(projectRoot, {recursive: true});
        await writeFile(join(projectRoot, "project.yaml"), "kind: novel\ntitle: Writer Settlement\nsummary: \"\"\n", "utf8");
        try {
            const prepared = await writerProfile.prepare!({
                session: testSession({
                    profileKey: "writer",
                    currentProjectRoot: projectSlug,
                }),
                initial: {},
                settings: defaultWriterSettings(),
                invocation: {
                    message: "请根据本章 brief 写正文。",
                    payload: {
                        path: "manuscript/001-chapter/index.md",
                        chapterId: "42",
                        context: {
                            lorebookEntries: ["lorebook/character/hero/"],
                            readablePaths: [],
                        },
                    },
                    caller: {kind: "user"},
                },
                vars: createTestVariableAccessor(),
                catalog: {profiles: [], issues: []},
                skills: [],
            });
            const systemPrompt = prepared.systemPrompt ?? "";

            // 交付要求：结算块追加在 report_result.result 末尾。
            expect(systemPrompt).toContain("report_result.result");
            expect(systemPrompt).toContain("末尾按 <chapter_settlement> 约定追加");
            // 格式约定：主标题与三个小节名必须逐字一致（与解析器常量同源）。
            expect(systemPrompt).toContain(CHAPTER_SETTLEMENT_HEADING);
            expect(systemPrompt).toContain(CHAPTER_SETTLEMENT_NEW_FACTS_SECTION);
            expect(systemPrompt).toContain(CHAPTER_SETTLEMENT_CONFLICTS_SECTION);
            expect(systemPrompt).toContain(CHAPTER_SETTLEMENT_UNRESOLVED_SECTION);
            // 新增事实类别标签。
            expect(systemPrompt).toContain("[人物]");
            expect(systemPrompt).toContain("[物品]");
            expect(systemPrompt).toContain("[状态]");
            expect(systemPrompt).toContain("[时间]");
            // 宪法第五条兼容：事后上报，不是写作前置条件（不得要求 writer 动笔前输出意图级内容）。
            expect(systemPrompt).toContain("事后上报");
            expect(systemPrompt).toContain("不是写作前置条件");
            // 空小节的规范写法。
            expect(systemPrompt).toContain("- 无");
        } finally {
            await rm(projectRoot, {recursive: true, force: true});
        }
    });

    it("解析器锁定结算块格式：三节归类、「- 无」不计入、类别标签保留", () => {
        const delivery = [
            "已写入 manuscript/001-volume/001-chapter/index.md；润色 2 处。",
            "剧情总结：薇洛丝在星陨遗迹解开莉雅的封印，两人结伴离开。",
            "",
            CHAPTER_SETTLEMENT_HEADING,
            "",
            CHAPTER_SETTLEMENT_NEW_FACTS_SECTION,
            "- [人物] 莉雅首次登场，与薇洛丝在星陨遗迹相遇",
            "- [物品] 薇洛丝获得封印钥匙",
            "- [状态] 薇洛丝左手受伤",
            "- [时间] 本章结束时为复兴纪元 1 日 19:00",
            "",
            CHAPTER_SETTLEMENT_CONFLICTS_SECTION,
            "- 无",
            "",
            CHAPTER_SETTLEMENT_UNRESOLVED_SECTION,
            "- 莉雅对封印起源的说法尚未确认是否入 canon",
        ].join("\n");

        const parsed = parseChapterSettlement(delivery);
        expect(parsed.kind).toBe("present");
        if (parsed.kind !== "present") {
            return;
        }
        expect(parsed.raw.startsWith(CHAPTER_SETTLEMENT_HEADING)).toBe(true);
        expect(parsed.settlement.newFacts).toEqual([
            "[人物] 莉雅首次登场，与薇洛丝在星陨遗迹相遇",
            "[物品] 薇洛丝获得封印钥匙",
            "[状态] 薇洛丝左手受伤",
            "[时间] 本章结束时为复兴纪元 1 日 19:00",
        ]);
        // 「- 无」是空小节的规范写法，解析为空列表。
        expect(parsed.settlement.conflicts).toEqual([]);
        expect(parsed.settlement.unresolved).toEqual(["莉雅对封印起源的说法尚未确认是否入 canon"]);
    });

    it("解析器向后兼容：没有结算块的交付返回 missing，正文提及不算标题", () => {
        // 旧会话交付（R9/R7：无结算块的会话必须照常工作）。
        expect(parseChapterSettlement("已写入 manuscript/001/index.md。剧情总结：……。").kind).toBe("missing");
        expect(parseChapterSettlement("").kind).toBe("missing");
        // 正文行提到「本章结算」但没有标题格式，不算结算块。
        expect(parseChapterSettlement("这一章的本章结算稍后再说\n- [人物] 龙套").kind).toBe("missing");
    });

    it("解析器边界：结算块在下一个二级标题处结束；标题行允许行尾空白", () => {
        const delivery = [
            "已写入 manuscript/001/index.md。",
            "## 本章结算  ",
            "### 新增事实",
            "- [状态] 主角负伤",
            "### 与既有设定的冲突点",
            "- 无",
            "### 未确定项",
            "- 无",
            "## 附注",
            "- [人物] 这条不属于结算块",
        ].join("\n");

        const parsed = parseChapterSettlement(delivery);
        expect(parsed.kind).toBe("present");
        if (parsed.kind !== "present") {
            return;
        }
        expect(parsed.settlement.newFacts).toEqual(["[状态] 主角负伤"]);
        expect(parsed.settlement.conflicts).toEqual([]);
        expect(parsed.settlement.unresolved).toEqual([]);
    });
});

/**
 * 创建 writer profile 测试使用的默认 settings（与 writer-profile-contract.test.ts 同源）。
 */
function defaultWriterSettings() {
    return {
        customTopSystemPrompt: "",
        writingStylePreset: DEFAULT_WRITING_STYLE_PRESET,
        writingReferencePreset: DEFAULT_WRITING_REFERENCE_PRESET,
        narrativePerson: "third" as const,
        paragraphRhythm: "段落节奏偏短段分行。",
        wordCountControl: "2000-2600 字",
        polishingWorkflow: "使用 stop-slop 做自查。",
        adultStylePrompt: "",
        fileChangeAwareness: "minimal" as const,
    };
}
