import {execFile as execFileCallback} from "node:child_process";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {promisify} from "node:util";
import {afterEach, describe, expect, it} from "vitest";

import {
    canonicalJson,
    computeCandidateSetFingerprint,
    INITIATIVE_SCHEMA,
    INTAKE_SCHEMA,
    proposalFiles,
    SELECTION_SET_SCHEMA,
    sha256Hex,
    verifyInitiatives,
    verifyIntakesAndSelectionSets,
    verifyProposalFrontmatters,
    verifyTaskLineage,
} from "#scripts/ci/governance-workflow-contract";
import {createTestTmpRoot} from "@notnotype/neuro-book-test-support/tmp";

const execFile = promisify(execFileCallback);
const fixtureRoots: string[] = [];
const repositoryRoot = join(import.meta.dirname, "..", "..");

const NOW = new Date("2026-08-22T12:00:00Z");
const EXPIRES_AT = "2027-01-01T00:00:00Z";


async function createFixture(): Promise<string> {
    const repoRoot = await createTestTmpRoot("governance-workflow");
    fixtureRoots.push(repoRoot);
    return repoRoot;
}

async function writeText(repoRoot: string, relativePath: string, content: string): Promise<void> {
    await mkdir(dirname(join(repoRoot, relativePath)), {recursive: true});
    await writeFile(join(repoRoot, relativePath), content, "utf8");
}

async function readText(repoRoot: string, relativePath: string): Promise<string> {
    return readFile(join(repoRoot, relativePath), "utf8");
}

async function replaceAllInFile(repoRoot: string, relativePath: string, search: string, replacement: string): Promise<void> {
    const text = await readText(repoRoot, relativePath);
    await writeFile(join(repoRoot, relativePath), text.replaceAll(search, replacement), "utf8");
}

async function runCli(repoRoot: string, args: readonly string[]): Promise<{code: number; stdout: string}> {
    try {
        const result = await execFile("bun", ["scripts/cli/governance-handoff.ts", ...args, "--repo-root", repoRoot], {cwd: repositoryRoot});
        return {code: 0, stdout: result.stdout};
    } catch (error) {
        const failure = error as {code?: number | string; stdout?: string};
        return {code: Number(failure.code ?? 1), stdout: failure.stdout ?? ""};
    }
}

interface SelectionInput {
    intakeId: string;
    selectionSetId: string;
    intakeRevision: number;
    analysisRevision: number;
    candidateIds: readonly string[];
    allowedWorkKinds: readonly string[];
    actor?: string;
    expiresAt?: string | null;
}

function buildSelection(input: SelectionInput): Record<string, unknown> {
    const sorted = [...input.candidateIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    return {
        schema: SELECTION_SET_SCHEMA,
        selectionSetId: input.selectionSetId,
        intakeId: input.intakeId,
        intakeRevision: input.intakeRevision,
        analysisRevision: input.analysisRevision,
        status: "confirmed",
        candidateIds: [...sorted],
        candidateSetFingerprint: computeCandidateSetFingerprint(sorted),
        decision: {
            kind: "user-selection",
            recordedAt: "2026-08-22T09:00:00Z",
            expiresAt: input.expiresAt === undefined ? EXPIRES_AT : input.expiresAt,
            scope: {allowedWorkKinds: [...input.allowedWorkKinds], sideEffectClass: "repo-local"},
        },
    };
}

function serializeSelection(selection: Record<string, unknown>): string {
    return `---\n${JSON.stringify(selection, null, 2)}\n---\n`;
}

async function seedBatchIntake(repoRoot: string, candidates: ReadonlyArray<{id: string; status: string; humanDecision?: string}>, revision = 3, rawItemCount = candidates.length): Promise<void> {
    const items = candidates.map((candidate, index) => ({uri: "local://paste.md", startLine: index + 1, endLine: index + 1, sha256: sha256Hex(candidate.id), rawItem: index + 1}));
    const intake = {
        schema: INTAKE_SCHEMA,
        id: "paste-1",
        mode: "batch",
        status: "triaged",
        revision,
        rawItemCount,
        deduplicatedCandidateCount: candidates.length,
        candidates: candidates.map((candidate, index) => ({
            id: candidate.id,
            status: candidate.status,
            markers: [],
            relations: [],
            humanDecision: candidate.humanDecision ?? null,
            source: {items: [items[index]]},
        })),
    };
    await writeText(repoRoot, ".agents/intake/paste-1/README.md", `---\n${JSON.stringify(intake, null, 2)}\n---\n`);
    await writeText(repoRoot, ".agents/intake/paste-1/selections/sel-001.md", serializeSelection(buildSelection({
        intakeId: "paste-1",
        selectionSetId: "sel-001",
        intakeRevision: revision,
        analysisRevision: 1,
        candidateIds: candidates.map((candidate) => candidate.id),
        allowedWorkKinds: ["bugfix"],
    })));
}

async function openAllCandidates(repoRoot: string): Promise<void> {
    await replaceAllInFile(repoRoot, ".agents/intake/paste-1/README.md", '"status": "closed"', '"status": "triaged"');
}

function pmLeaderArgs(overrides: Record<string, string> = {}): string[] {
    return [
        "pm-leader",
        "--intake", "paste-1",
        "--selection-set", overrides.selectionSet ?? "sel-001",
        "--intake-revision", overrides.intakeRevision ?? "3",
        "--expected-revision", overrides.expectedRevision ?? "3",
        "--candidate-set-fingerprint", overrides.fingerprint ?? computeCandidateSetFingerprint(["candidate-001", "candidate-002"]),
    ];
}

afterEach(async () => {
    await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe("candidate set fingerprint", () => {
    it("对排序后的候选集稳定，且检测成员替换", () => {
        expect(computeCandidateSetFingerprint(["candidate-002", "candidate-001"])).toBe(computeCandidateSetFingerprint(["candidate-001", "candidate-002"]));
        expect(computeCandidateSetFingerprint(["candidate-001"])).not.toBe(computeCandidateSetFingerprint(["candidate-002"]));
    });
});

describe("proposal frontmatter migration", () => {
    it("缺 frontmatter、正文状态行与 governance 非人类接受分别失败", async () => {
        const repoRoot = await createFixture();
        await writeText(repoRoot, "docs/proposals/p-010-no-frontmatter.md", "# T\n\n正文\n");
        await writeText(repoRoot, "docs/proposals/p-011-body-status.md", "---\nschema: nbook.proposal/v1\nid: P-011\nkind: behavior\nstatus: draft\ncreatedAt: 2026-08-01T00:00:00Z\nupdatedAt: 2026-08-01T00:00:00Z\n---\n\n# T\n\n状态：draft\n");
        await writeText(repoRoot, "docs/proposals/p-012-gov-self-accepted.md", "---\nschema: nbook.proposal/v1\nid: P-012\nkind: governance\nstatus: accepted\ncreatedAt: 2026-08-01T00:00:00Z\nupdatedAt: 2026-08-01T00:00:00Z\ndecision:\n    by: pm\n---\n\n# T\n");
        const failures = verifyProposalFrontmatters(repoRoot);
        expect(failures).toContainEqual(expect.stringContaining("p-010-no-frontmatter.md"));
        expect(failures).toContainEqual(expect.stringContaining("正文仍双写状态行"));
        expect(failures).toContainEqual(expect.stringContaining("必须由人类确认"));
    });

    it("文件名未携带 ID 前缀时失败；归档提案不在迁移范围", async () => {
        const repoRoot = await createFixture();
        await writeText(repoRoot, "docs/proposals/wrong-name.md", "---\nschema: nbook.proposal/v1\nid: P-013\nkind: behavior\nstatus: draft\ncreatedAt: 2026-08-01T00:00:00Z\nupdatedAt: 2026-08-01T00:00:00Z\n---\n\n# T\n");
        expect(verifyProposalFrontmatters(repoRoot)).toContainEqual(expect.stringContaining("文件名未携带 ID 前缀"));
        const names = proposalFiles(repositoryRoot).map((file) => file.replaceAll("\\", "/").split("/").pop());
        expect(names).toContain("p-005-development-workflow-governance.md");
        expect(names).not.toContain("documentation-information-architecture.md");
    });
});

describe("intake and selection static checks", () => {
    it("覆盖缺失、乱序候选集与指纹不一致分别失败", async () => {
        const repoRoot = await createFixture();
        await seedBatchIntake(repoRoot, [{id: "candidate-001", status: "triaged"}, {id: "candidate-002", status: "triaged"}], 3, 3);
        expect(verifyIntakesAndSelectionSets(repoRoot)).toContainEqual(expect.stringContaining("rawItem=3"));

        const selectionPath = ".agents/intake/paste-1/selections/sel-001.md";
        const text = await readText(repoRoot, selectionPath);
        const unsorted = text.replace('"candidate-001",\n    "candidate-002"', '"candidate-002",\n    "candidate-001"');
        expect(unsorted).not.toBe(text);
        await writeFile(join(repoRoot, selectionPath), unsorted, "utf8");
        const tampered = verifyIntakesAndSelectionSets(repoRoot);
        expect(tampered).toContainEqual(expect.stringContaining("必须按稳定 ID 排序"));

        // 篡改 fingerprint 必须被静态校验拦截。
        await writeFile(join(repoRoot, selectionPath), text.replace('"candidateSetFingerprint"', '"candidateSetFingerprintX"'), "utf8");
        expect(verifyIntakesAndSelectionSets(repoRoot)).toContainEqual(expect.stringContaining("candidateSetFingerprint 与排序候选集不一致"));
    });
});

describe("initiative dag", () => {
    it("phase 自环失败且合法依赖通过", async () => {
        const repoRoot = await createFixture();
        const base = {schema: INITIATIVE_SCHEMA, id: "wf-alpha", status: "active", revision: 1};
        const cyclic = {...base, phases: [{id: "A", status: "in-progress", dependsOn: ["B"], tasks: []}, {id: "B", status: "pending", dependsOn: ["A"], tasks: []}]};
        await writeText(repoRoot, ".agents/initiatives/wf-alpha/README.md", `---\n${JSON.stringify(cyclic, null, 2)}\n---\n`);
        expect(verifyInitiatives(repoRoot)).toContainEqual(expect.stringContaining("依赖图存在环"));

        const linear = {...base, phases: [{id: "A", status: "pending", dependsOn: [], tasks: []}, {id: "B", status: "pending", dependsOn: ["A"], tasks: []}]};
        await writeText(repoRoot, ".agents/initiatives/wf-alpha/README.md", `---\n${JSON.stringify(linear, null, 2)}\n---\n`);
        expect(verifyInitiatives(repoRoot)).toEqual([]);
    });
});

describe("task lineage uniqueness", () => {
    it("同组合重复登记或越界 workKind 失败", async () => {
        const repoRoot = await createFixture();
        await seedBatchIntake(repoRoot, [{id: "candidate-001", status: "triaged"}]);
        const frontmatter = "---\nschema: nbook.task/v1\ntaskId: 200-a\nrevision: 1\nstatus: planned\nlineage:\n    intakeId: paste-1\n    selectionSetId: sel-001\n    candidateId: candidate-001\n    workKind: bugfix\n---\n\n# A\n";
        await writeText(repoRoot, ".agents/tasks/200-a/README.md", frontmatter);
        await writeText(repoRoot, ".agents/tasks/200-b/README.md", frontmatter);
        expect(verifyTaskLineage(repoRoot)).toContainEqual(expect.stringContaining("组合重复"));

        await rm(join(repoRoot, ".agents/tasks/200-b/README.md"));
        await writeText(repoRoot, ".agents/tasks/200-b/README.md", frontmatter.replace("workKind: bugfix", "workKind: release"));
        expect(verifyTaskLineage(repoRoot)).toContainEqual(expect.stringContaining("超出 selection scope"));
    });
});

describe("governance handoff cli", () => {
    async function seedHandoffFixture(): Promise<string> {
        const repoRoot = await createFixture();
        await seedBatchIntake(repoRoot, [{id: "candidate-001", status: "triaged"}, {id: "candidate-002", status: "closed"}]);
        // resolveTaskReadmePath 依赖 ownership manifest 存在；空清单即启用根 Task 解析。
        await writeText(repoRoot, ".agents/tasks/ownership.json", `${JSON.stringify({schema: "nbook.task-ownership/v1", ownerRoot: "packages/neuro-book/.agents/tasks", taskCount: 0, fileCount: 0, tasks: []}, null, 2)}\n`);
        await writeText(repoRoot, ".agents/tasks/300-a/README.md", "---\nschema: nbook.task/v1\ntaskId: 300-a\nrevision: 1\nstatus: planned\n---\n\n# A\n");
        return repoRoot;
    }

    it("happy path：journal 承载交接、selection 文件保持不变、重放幂等", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        const before = await readText(repoRoot, ".agents/intake/paste-1/selections/sel-001.md");
        const first = await runCli(repoRoot, pmLeaderArgs());
        expect(first.code).toBe(0);
        expect(await readText(repoRoot, ".agents/intake/paste-1/selections/sel-001.md")).toBe(before);
        expect(await readText(repoRoot, ".agents/intake/paste-1/journal/sel-001-handoff.json")).toContain("handed-off");

        const replay = await runCli(repoRoot, pmLeaderArgs());
        expect(replay.code).toBe(0);
        expect(replay.stdout).toContain("\"idempotent\": true");
    });

    it("三方 revision 不一致时以冲突码拒绝", async () => {
        const repoRoot = await seedHandoffFixture();
        expect((await runCli(repoRoot, pmLeaderArgs({expectedRevision: "2"}))).code).toBe(2);
        expect((await runCli(repoRoot, pmLeaderArgs({intakeRevision: "2"}))).code).toBe(2);
    });

    it("closed 候选阻止整体交接，放开后成功", async () => {
        const repoRoot = await seedHandoffFixture();
        const rejected = await runCli(repoRoot, pmLeaderArgs());
        expect(rejected.code).toBe(1);
        expect(rejected.stdout).toContain("candidate-002 status=closed");
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);
    });

    it("claim 写入 lineage 与 promoted；崩溃重试收敛不重复；跨 selection 冲突拒绝", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);

        const claimArgs = ["claim", "--intake", "paste-1", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"];
        const claimed = await runCli(repoRoot, claimArgs);
        expect(claimed.code).toBe(0);

        const taskReadme = await readText(repoRoot, ".agents/tasks/300-a/README.md");
        expect(taskReadme).toContain("candidateId: candidate-001");
        expect(taskReadme).toContain("revision: 2");
        const intakeText = await readText(repoRoot, ".agents/intake/paste-1/README.md");
        expect(intakeText.match(/status: promoted/gu) ?? []).toHaveLength(1);

        // 模拟 ledger 提交后、侧效应前的崩溃：重置 lineage 与 promoted 后重跑必须收敛。
        await writeText(repoRoot, ".agents/tasks/300-a/README.md", "---\nschema: nbook.task/v1\ntaskId: 300-a\nrevision: 1\nstatus: planned\n---\n\n# A\n");
        await replaceAllInFile(repoRoot, ".agents/intake/paste-1/README.md", '"status": "promoted"', '"status": "triaged"');
        const recovered = await runCli(repoRoot, claimArgs);
        expect(recovered.code).toBe(0);
        expect(JSON.parse(recovered.stdout).details.converged).toBe(true);
        expect(await readText(repoRoot, ".agents/tasks/300-a/README.md")).toContain("candidateId: candidate-001");

        // 第二个 selection set 选择同候选同工作类型：幂等键拦截（不同 set 视为冲突）。
        await writeText(repoRoot, ".agents/intake/paste-1/selections/sel-002.md", serializeSelection(buildSelection({intakeId: "paste-1", selectionSetId: "sel-002", intakeRevision: 3, analysisRevision: 1, candidateIds: ["candidate-001"], allowedWorkKinds: ["bugfix"]})));
        const noHandoff = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-002", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"]);
        expect(noHandoff.code).toBe(1);
        expect(noHandoff.stdout).toContain("尚未完成 PM → Leader 交接");

        // 构造与 sel-002 字段一致的伪造交接 journal：门禁放行后，ledger 幂等键仍拦截跨 set 重复 claim。
        const forgedJournal = {
            schema: "nbook.handoff-journal/v1",
            action: "pm-leader",
            status: "handed-off",
            selectionSetId: "sel-002",
            intakeRevision: 3,
            candidateIds: ["candidate-001"],
            fingerprint: computeCandidateSetFingerprint(["candidate-001"]),
            at: new Date().toISOString(),
        };
        await writeText(repoRoot, ".agents/intake/paste-1/journal/sel-002-handoff.json", `${JSON.stringify(forgedJournal, null, 2)}\n`);
        const conflict = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-002", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"]);
        expect(conflict.code).toBe(1);
        expect(conflict.stdout).toContain("幂等键冲突");
    });

    it("scope 越界的 workKind 以冲突码拒绝", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);
        const result = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "release", "--task", "300-a"]);
        expect(result.code).toBe(2);
        expect(result.stdout).toContain("超出人类授权 scope");
    });

    it("SAFE_ID 拒绝路径穿越 id", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);
        const result = await runCli(repoRoot, ["claim", "--intake", "../../etc", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"]);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain("含非法字符");
    });

    it("claims.json 损坏时 fail-closed 拒绝 claim", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);
        await writeText(repoRoot, ".agents/intake/paste-1/claims.json", "{broken json");
        const result = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"]);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain("fail-closed");
    });

    it("过期 expiresAt 时 claim 以 exit 2 拒绝", async () => {
        const repoRoot = await createFixture();
        await seedBatchIntake(repoRoot, [{id: "candidate-001", status: "triaged"}]);
        await writeText(repoRoot, ".agents/intake/paste-1/selections/sel-001.md", serializeSelection(buildSelection({
            intakeId: "paste-1", selectionSetId: "sel-001", intakeRevision: 3, analysisRevision: 1,
            candidateIds: ["candidate-001"], allowedWorkKinds: ["bugfix"], expiresAt: "2026-08-01T00:00:00Z",
        })));
        // 先手动写 journal（跳过 pm-leader 的过期拒绝）
        const journalDir = ".agents/intake/paste-1/journal";
        await writeText(repoRoot, `${journalDir}/sel-001-handoff.json`, JSON.stringify({schema: "nbook.handoff-journal/v1", action: "pm-leader", status: "handed-off", selectionSetId: "sel-001", intakeRevision: 3, candidateIds: ["candidate-001"], fingerprint: computeCandidateSetFingerprint(["candidate-001"]), at: "2026-08-01T00:00:00Z"}));
        const result = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "bugfix", "--task", "300-a"]);
        expect(result.code).toBe(2);
        expect(result.stdout).toContain("已过期");
    });

    it("--reuse-task 目标不存在时拒绝", async () => {
        const repoRoot = await seedHandoffFixture();
        await openAllCandidates(repoRoot);
        expect((await runCli(repoRoot, pmLeaderArgs())).code).toBe(0);
        const result = await runCli(repoRoot, ["claim", "--intake", "paste-1", "--selection-set", "sel-001", "--candidate", "candidate-001", "--work-kind", "bugfix", "--reuse-task", "999-nonexistent"]);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain("目标不存在");
    });

    it("task 形态 CAS 成功递增 revision；过期与非法边拒绝", async () => {
        const repoRoot = await seedHandoffFixture();
        const ok = await runCli(repoRoot, ["task", "--from", "leader", "--to", "tasker", "--task", "300-a", "--expected-revision", "1"]);
        expect(ok.code).toBe(0);
        expect(await readText(repoRoot, ".agents/tasks/300-a/README.md")).toContain("revision: 2");
        expect((await runCli(repoRoot, ["task", "--from", "leader", "--to", "tasker", "--task", "300-a", "--expected-revision", "1"])).code).toBe(2);
        const badEdge = await runCli(repoRoot, ["task", "--from", "pm", "--to", "leader", "--task", "300-a", "--expected-revision", "2"]);
        expect(badEdge.code).toBe(1);
        expect(badEdge.stdout).toContain("必须使用 intake 形态");
    });
});
