import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {beforeEach, afterEach, describe, expect, it} from "vitest";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";
import {
    buildRetrievalCandidateList,
    createRetrievalCandidatesTools,
    renderRetrievalCandidateList,
    resolveConfirmedLorebookEntries,
    tokenizeRetrievalQuery,
    MAX_EXCERPT_CHARS,
    MAX_SUMMARY_CHARS,
    RETRIEVAL_CANDIDATE_LIST_VERSION,
    type RetrievalCandidate,
    type RetrievalCandidateList,
} from "nbook/server/agent/tools/retrieval-candidates";

/**
 * T0.3 验收：
 * ① 候选清单结构稳定（path / 摘要 / 来源）；
 * ② 确认后的 handoff 数据形状与现行 `context.lorebookEntries` 完全兼容；
 * 附带：分词、enabled=false 排除、排序稳定性、边界长度、渲染格式。
 */

const LONG_TEXT = "这是一段很长的摘要。".repeat(60);

async function writeNode(root: string, relativeDir: string, frontmatter: Record<string, unknown>, body = "正文内容。"): Promise<void> {
    const dir = join(root, relativeDir);
    await mkdir(dir, {recursive: true});
    const fm = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${typeof value === "object" && value !== null ? JSON.stringify(value) : JSON.stringify(String(value))}`)
        .join("\n");
    await writeFile(join(dir, "index.md"), `---\n${fm}\n---\n\n${body}\n`, "utf-8");
}

async function writeManuscript(root: string, relativeFile: string, body: string): Promise<void> {
    const target = join(root, relativeFile);
    await mkdir(join(target, ".."), {recursive: true});
    await writeFile(target, `# 章节\n\n${body}\n`, "utf-8");
}

describe("retrieval candidates", () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "nbook-retrieval-candidates-test-"));
        await writeNode(root, "lorebook/character/liya", {
            title: "莉雅",
            type: "character",
            status: "active",
            summary: "封印之匙的守护者，银发少女。",
            retrieval: {enabled: true, trigger: "莉雅、封印之匙或神殿相关剧情出现时"},
        });
        await writeNode(root, "lorebook/character/brandon", {
            title: "布兰登",
            type: "character",
            status: "active",
            summary: "商队护卫，忠诚的老兵。",
            retrieval: {enabled: true, trigger: "商队或护卫剧情出现时"},
        });
        await writeNode(root, "lorebook/item/seal-key", {
            title: "封印钥匙",
            type: "item",
            status: "draft",
            summary: "开启旧神殿封印的钥匙，来源不明。",
            retrieval: {enabled: true, trigger: "封印或钥匙相关剧情出现时"},
        });
        await writeNode(root, "lorebook/location/old-temple", {
            title: "旧神殿",
            type: "location",
            status: "active",
            summary: "封印所在地的废弃神殿。",
            retrieval: {enabled: false, trigger: "封印相关剧情出现时"},
        });
        await writeNode(root, "lorebook/note/long-summary", {
            title: "长摘要节点",
            type: "note",
            status: "active",
            summary: LONG_TEXT,
            retrieval: {enabled: true, trigger: "莉雅相关剧情出现时"},
        });
        await writeManuscript(root, "manuscript/001-volume/001-chapter/index.md", "莉雅握着封印钥匙走进旧神殿，银发在月光下闪光。");
        await writeManuscript(root, "manuscript/001-volume/002-chapter/index.md", "商队在山谷里扎营，布兰登擦着他的剑。");
    });

    afterEach(async () => {
        await rm(root, {recursive: true, force: true});
    });

    it("分词：CJK 出 bigram，拉丁词保留，去重并去标点", () => {
        expect(tokenizeRetrievalQuery("莉雅 封印之匙, seal!")).toEqual(["莉雅", "封印", "印之", "之匙", "seal"]);
        expect(tokenizeRetrievalQuery("a？")).toEqual([]);
        expect(tokenizeRetrievalQuery("丽")).toEqual(["丽"]);
    });

    it("候选清单结构稳定：path / 摘要 / 来源 / 相关性 / 稳定排序", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅 封印",
        });
        expect(list.version).toBe(RETRIEVAL_CANDIDATE_LIST_VERSION);
        expect(list.query).toBe("莉雅 封印");
        expect(list.candidates.length).toBeGreaterThan(0);

        for (const candidate of list.candidates) {
            expect(candidate.candidateId).toMatch(/^(lb|ms)-\d+$/);
            expect(candidate.path.length).toBeGreaterThan(0);
            expect(typeof candidate.summary).toBe("string");
            expect(candidate.summary.length).toBeGreaterThan(0);
            expect(candidate.summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS + 1);
            expect(candidate.summary).not.toMatch(/[\r\n\t]/);
            expect(candidate.relevance).toBeGreaterThan(0);
            expect(candidate.relevance).toBeLessThanOrEqual(1);
            expect(candidate.matchedTerms.length).toBeGreaterThan(0);
        }

        const lorebook = list.candidates.filter((candidate) => candidate.source === "lorebook-entry");
        const manuscript = list.candidates.filter((candidate) => candidate.source === "manuscript-fragment");
        for (const candidate of lorebook) {
            expect(candidate.path.startsWith("lorebook/")).toBe(true);
            expect(candidate.path.endsWith("/")).toBe(true);
            expect(candidate.excerpt).toBeNull();
            expect(candidate.excerptLine).toBeNull();
        }
        for (const candidate of manuscript) {
            expect(candidate.path.startsWith("manuscript/")).toBe(true);
            expect(candidate.path.endsWith(".md")).toBe(true);
            expect(candidate.excerpt).not.toBeNull();
            expect(candidate.excerpt!.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS + 1);
            expect(candidate.excerptLine).toBeGreaterThanOrEqual(1);
        }

        // 排序：组内相关性降序，同分 path 升序。
        expectPathsSorted(lorebook);
        expectPathsSorted(manuscript);
        // candidateId 组内从 1 连续递增。
        lorebook.forEach((candidate, index) => {
            expect(candidate.candidateId).toBe(`lb-${String(index + 1)}`);
        });
        manuscript.forEach((candidate, index) => {
            expect(candidate.candidateId).toBe(`ms-${String(index + 1)}`);
        });
    });

    it("retrieval.enabled=false 的节点不进候选，即使 trigger 命中", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "封印",
        });
        expect(list.candidates.some((candidate) => candidate.path === "lorebook/location/old-temple/")).toBe(false);
    });

    it("状态非 active 的候选带风险说明；frontmatter 命中来自 title/summary/trigger", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "封印",
        });
        const sealKey = list.candidates.find((candidate) => candidate.path === "lorebook/item/seal-key/");
        expect(sealKey).toBeDefined();
        expect(sealKey!.risk).toContain("draft");
        const liya = list.candidates.find((candidate) => candidate.path === "lorebook/character/liya/");
        expect(liya).toBeDefined();
        expect(liya!.risk).toBeNull();
    });

    it("无命中时返回空候选与 note", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "量子计算机",
        });
        expect(list.candidates).toEqual([]);
        expect(list.note).toContain("lorebook");
    });

    it("limit 生效且摘要/节选有界", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅",
            limit: 1,
        });
        expect(list.candidates.filter((candidate) => candidate.source === "lorebook-entry").length).toBeLessThanOrEqual(1);
        const longSummary = list.candidates.find((candidate) => candidate.path === "lorebook/note/long-summary/");
        if (longSummary) {
            expect(longSummary.summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS + 1);
            expect(longSummary.summary.endsWith("…")).toBe(true);
        }
    });

    it("includeManuscript=false 时不扫正文", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅",
            includeManuscript: false,
        });
        expect(list.candidates.some((candidate) => candidate.source === "manuscript-fragment")).toBe(false);
        expect(list.manuscriptScanned).toBe(0);
    });

    it("确认协议：candidateIds 输出与 context.lorebookEntries 同形（string[]），顺序保持、去重", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅 封印",
        });
        const lb1 = requireCandidate(list, "lb-1");
        const ms1 = list.candidates.find((candidate) => candidate.candidateId.startsWith("ms-"));
        expect(ms1).toBeDefined();

        const confirmed = resolveConfirmedLorebookEntries(list, {
            candidateIds: [lb1.candidateId, ms1!.candidateId, lb1.candidateId],
        });
        // 完全兼容现行 writer handoff：纯 path 字符串数组。
        expect(confirmed.lorebookEntries).toEqual([lb1.path, ms1!.path]);
        for (const entry of confirmed.lorebookEntries) {
            expect(typeof entry).toBe("string");
        }
        expect(confirmed.rejected).toEqual([]);
    });

    it("确认协议：未知 candidateId 抛错（不静默丢弃用户确认）", async () => {
        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅",
        });
        expect(() => resolveConfirmedLorebookEntries(list, {candidateIds: ["lb-999"]})).toThrow(/未知的候选 ID/);
    });

    it("确认协议：手填 path 校验与 lorebook 目录规范化", () => {
        const list: RetrievalCandidateList = {
            version: RETRIEVAL_CANDIDATE_LIST_VERSION,
            query: "q",
            candidates: [],
            lorebookScanned: 0,
            manuscriptScanned: 0,
            note: null,
        };
        const confirmed = resolveConfirmedLorebookEntries(list, {
            paths: [
                "lorebook/character/liya",
                "./lorebook/character/liya/",
                "manuscript/001-volume/001-chapter/index.md",
                "../evil",
                "C:/evil",
                "/absolute",
                "workspace/other/lorebook/x",
                "",
            ],
        });
        expect(confirmed.lorebookEntries).toEqual([
            "lorebook/character/liya/",
            "manuscript/001-volume/001-chapter/index.md",
        ]);
        expect(confirmed.rejected.map((item) => item.value)).toEqual([
            "../evil",
            "C:/evil",
            "/absolute",
            "workspace/other/lorebook/x",
            "",
        ]);
    });

    it("渲染：空候选与有候选两种格式都稳定", async () => {
        const empty = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "量子计算机",
        });
        expect(renderRetrievalCandidateList(empty)).toContain("没有命中候选");

        const list = await buildRetrievalCandidateList({
            root: absoluteFsPath(root),
            query: "莉雅 封印",
        });
        const rendered = renderRetrievalCandidateList(list);
        expect(rendered).toContain("[lb-1] ");
        expect(rendered).toContain("摘要：");
        expect(rendered).toContain("确认后的 path 才放入 writer 的 context.lorebookEntries");
    });

    it("工具定义：key / 只读标记 / 无 session 入口抛错", async () => {
        const tools = createRetrievalCandidatesTools();
        expect(tools).toHaveLength(1);
        const tool = tools[0]!;
        expect(tool.key).toBe("retrieval_candidates");
        expect(tool.mutatesWorkspace).toBeFalsy();
        expect(tool.execute).toBeDefined();
        await expect(tool.execute!("x", {})).rejects.toThrow(/必须在 agent session workspace 内执行/);
    });
});

function expectPathsSorted(candidates: RetrievalCandidate[]): void {
    for (let index = 1; index < candidates.length; index += 1) {
        const previous = candidates[index - 1]!;
        const current = candidates[index]!;
        if (previous.relevance === current.relevance) {
            expect(previous.path.localeCompare(current.path, "zh-Hans-CN")).toBeLessThanOrEqual(0);
        } else {
            expect(previous.relevance).toBeGreaterThan(current.relevance);
        }
    }
}

function requireCandidate(list: RetrievalCandidateList, candidateId: string): RetrievalCandidate {
    const candidate = list.candidates.find((item) => item.candidateId === candidateId);
    if (!candidate) {
        throw new Error(`测试夹具未产生 ${candidateId}：${JSON.stringify(list.candidates.map((item) => item.candidateId))}`);
    }
    return candidate;
}
