#!/usr/bin/env bun
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {stringify as stringifyYaml} from "yaml";

import {defaultRepoRoot, resolveTaskReadmePath} from "#scripts/ci/agent-governance-contract";
import {
    computeCandidateSetFingerprint,
    HANDOFF_CANDIDATE_STATUSES,
    HANDOFF_EDGES,
    HANDOFF_RESULT_SCHEMA,
    INTAKE_SCHEMA,
    isRecord,
    parseFrontmatterBlock,
    ROOT_INTAKE_ROOT,
    SELECTION_SET_SCHEMA,
    sha256Hex,
} from "#scripts/ci/governance-workflow-contract";

interface Args {
    values: Map<string, string>;
}

function parseArgs(argv: readonly string[]): Args {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            values.set(key, next);
            index += 1;
        } else {
            values.set(key, "true");
        }
    }
    return {values};
}

interface Result {
    ok: boolean;
    action: string;
    failures: string[];
    details: Record<string, unknown>;
}

function emit(action: string, ok: boolean, failures: string[], details: Record<string, unknown>, exitCode: number): never {
    console.log(JSON.stringify({schema: HANDOFF_RESULT_SCHEMA, ok, action, failures, details}, null, 2));
    process.exit(exitCode);
}

function fail(action: string, failures: string[], details: Record<string, unknown> = {}, exitCode = 1): never {
    emit(action, false, failures, details, exitCode);
}

function succeed(action: string, details: Record<string, unknown>): never {
    emit(action, true, [], details, 0);
}

/** 同目录 temp + rename；崩溃只留下可清理的 tmp 文件，目标要么旧要么新。 */
function atomicWrite(target: string, content: string): void {
    const tmp = `${target}.tmp-${String(process.pid)}`;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, target);
}

function readFrontmatterObject(path: string, label: string): {data: Record<string, unknown>; body: string} {
    if (!existsSync(path)) fail("load", [`${label} 不存在：${path}`]);
    const parsed = parseFrontmatterBlock(readFileSync(path, "utf8"));
    if (parsed === null) fail("load", [`${label} 缺少有效 frontmatter：${path}`]);
    return parsed;
}

function writeFrontmatterObject(path: string, data: Record<string, unknown>, body: string): void {
    atomicWrite(path, `---\n${stringifyYaml(data).trimEnd()}\n---\n${body.startsWith("\n") || body === "" ? body : `\n${body}`}`);
}

/** CLI id 参数只允许安全字符：阻断路径穿越与任意路径写入。 */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function requireId(args: Args, key: string, action: string): string {
    const value = requireFlag(args, key, action);
    if (!SAFE_ID.test(value) || value.includes("..")) fail(action, [`--${key} 含非法字符（仅允许 [A-Za-z0-9._-]，且不得包含 ..）：${value}`]);
    return value;
}

function requireFlag(args: Args, key: string, action: string): string {
    const value = args.values.get(key);
    if (value === undefined || value === "") fail(action, [`缺少必需参数 --${key}`]);
    return value;
}

function requireInt(args: Args, key: string, action: string): number {
    const raw = requireFlag(args, key, action);
    const value = Number(raw);
    if (!Number.isInteger(value)) fail(action, [`--${key} 必须是整数：${raw}`]);
    return value;
}

function optionalFlag(args: Args, key: string): string {
    return args.values.get(key) ?? "";
}

interface CandidateRecord {
    id: string;
    status: string;
    relations: Array<Record<string, unknown>>;
    humanDecision: string | null;
    raw: Record<string, unknown>;
}

interface IntakeDoc {
    data: Record<string, unknown>;
    body: string;
    path: string;
    candidates: Map<string, CandidateRecord>;
}

function loadIntake(repoRoot: string, intakeId: string, action: string): IntakeDoc {
    const path = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "README.md");
    if (!existsSync(path)) fail(action, [`Intake 不存在：${intakeId}`]);
    const parsed = readFrontmatterObject(path, "Intake");
    if (parsed.data.schema !== INTAKE_SCHEMA) fail(action, [`Intake schema 无效：${intakeId}`]);
    const candidates = new Map<string, CandidateRecord>();
    for (const entry of Array.isArray(parsed.data.candidates) ? parsed.data.candidates : []) {
        if (!isRecord(entry) || typeof entry.id !== "string") continue;
        candidates.set(entry.id, {
            id: entry.id,
            status: String(entry.status ?? ""),
            relations: Array.isArray(entry.relations) ? entry.relations.filter(isRecord) : [],
            humanDecision: typeof entry.humanDecision === "string" ? entry.humanDecision : null,
            raw: entry,
        });
    }
    return {data: parsed.data, body: parsed.body, path, candidates};
}
/** handoff journal 是纯 JSON 运行态记录；解析失败或 schema 不符时返回 null 并已输出诊断。 */
function readHandoffJournal(path: string, action: string): Record<string, unknown> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
        fail(action, [`handoff journal 不是合法 JSON：${path}`]);
    }
    if (!isRecord(parsed)) {
        fail(action, [`handoff journal 必须是对象：${path}`]);
    }
    const record = parsed as Record<string, unknown>;
    if (record.schema !== "nbook.handoff-journal/v1") {
        fail(action, [`handoff journal schema 无效：${String(record.schema)}`]);
    }
    return record;
}


function loadSelection(repoRoot: string, intakeId: string, selectionSetId: string, action: string): {data: Record<string, unknown>; body: string; path: string} {
    const path = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "selections", `${selectionSetId}.md`);
    if (!existsSync(path)) fail(action, [`Selection set 不存在：${selectionSetId}`]);
    const parsed = readFrontmatterObject(path, "Selection set");
    if (parsed.data.schema !== SELECTION_SET_SCHEMA) fail(action, [`Selection set schema 无效：${selectionSetId}`]);
    return {...parsed, path};
}

interface Ledger {
    schema: string;
    claims: Array<Record<string, unknown>>;
}

function loadLedger(path: string, action: string): Ledger {
    if (!existsSync(path)) return {schema: "nbook.claim-ledger/v1", claims: []};
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
        fail(action, [`claim ledger 不是合法 JSON，fail-closed 拒绝：${path}`]);
    }
    if (!isRecord(parsed) || parsed.schema !== "nbook.claim-ledger/v1" || !Array.isArray(parsed.claims)) {
        fail(action, [`claim ledger 结构无效（schema 或 claims 缺失），fail-closed 拒绝：${path}`]);
    }
    return {schema: "nbook.claim-ledger/v1", claims: parsed.claims.filter(isRecord)};
}

function claimKey(intakeId: string, candidateId: string, workKind: string): string {
    return `${intakeId}|${candidateId}|${workKind}`;
}

/** 解析 duplicate-of 候选链（≤5 层），返回 canonical 候选与其已登记 claim。 */
function resolveCanonicalClaim(intakeId: string, intake: IntakeDoc, candidateId: string, ledger: Ledger, workKind: string): {canonicalId: string; existing: Record<string, unknown> | null; failure: string | null} {
    let current = candidateId;
    for (let depth = 0; depth < 5; depth += 1) {
        const candidate = intake.candidates.get(current);
        if (candidate === undefined) return {canonicalId: current, existing: null, failure: `候选不存在：${current}`};
        const duplicateOf = candidate.relations.find((relation) => relation.kind === "duplicate-of" && relation.targetType === "candidate");
        if (duplicateOf === undefined) {
            const existing = ledger.claims.find((entry) => entry.key === claimKey(intakeId, current, workKind)) ?? null;
            return {canonicalId: current, existing, failure: null};
        }
        current = String(duplicateOf.targetId);
    }
    return {canonicalId: current, existing: null, failure: `duplicate-of 链超过 5 层：${candidateId}`};
}

function pmLeader(repoRoot: string, args: Args): never {
    const action = "pm-leader";
    const intakeId = requireId(args, "intake", action);
    const selectionSetId = requireId(args, "selection-set", action);
    const expectedRevision = requireInt(args, "expected-revision", action);
    const intakeRevisionArg = requireInt(args, "intake-revision", action);
    const fingerprintArg = requireFlag(args, "candidate-set-fingerprint", action);

    const intake = loadIntake(repoRoot, intakeId, action);
    const selection = loadSelection(repoRoot, intakeId, selectionSetId, action);

    const currentRevision = Number(intake.data.revision);
    const selectionRevision = Number(selection.data.intakeRevision);
    if (selectionRevision !== intakeRevisionArg) {
        fail(action, [`--intake-revision 与 selection set 绑定 revision 不一致：selection=${String(selectionRevision)} 参数=${String(intakeRevisionArg)}`], {}, 2);
    }
    if (expectedRevision !== currentRevision) {
        fail(action, [`Intake revision 已过期：当前=${String(currentRevision)} 期望=${String(expectedRevision)}`], {}, 2);
    }
    if (selectionRevision !== currentRevision) {
        fail(action, [`selection set 绑定 revision 与当前 Intake 不一致：selection=${String(selectionRevision)} 当前=${String(currentRevision)}`], {}, 2);
    }

    const candidateIds = Array.isArray(selection.data.candidateIds) ? selection.data.candidateIds.map(String) : [];
    const recomputed = computeCandidateSetFingerprint(candidateIds);
    if (fingerprintArg !== recomputed || selection.data.candidateSetFingerprint !== recomputed) {
        fail(action, [`candidate-set-fingerprint 不一致：期望 ${recomputed}`]);
    }


    const journalDir = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "journal");
    const journalPath = join(journalDir, `${selectionSetId}-handoff.json`);

    if (String(selection.data.status ?? "") !== "confirmed") fail(action, [`selection set 状态不允许交接：${String(selection.data.status ?? "")}`]);
    const pmDecision = isRecord(selection.data.decision) ? selection.data.decision : {};
    const pmExpiresAt = typeof pmDecision.expiresAt === "string" && pmDecision.expiresAt.length > 0 ? pmDecision.expiresAt : null;
    if (pmExpiresAt !== null && Date.now() > Date.parse(pmExpiresAt)) {
        fail(action, [`人类授权已过期，交接拒绝：expiresAt=${String(pmExpiresAt)}`], {}, 2);
    }

    const gateFailures: string[] = [];
    for (const candidateId of candidateIds) {
        const candidate = intake.candidates.get(candidateId);
        if (candidate === undefined) {
            gateFailures.push(`候选不存在：${candidateId}`);
            continue;
        }
        if (!HANDOFF_CANDIDATE_STATUSES.has(candidate.status)) {
            gateFailures.push(`候选状态不允许交接：${candidateId} status=${candidate.status}`);
            continue;
        }
        if (candidate.status === "needs-decision" && (candidate.humanDecision === null || candidate.humanDecision.trim().length === 0)) {
            gateFailures.push(`needs-decision 候选缺少人类决策记录：${candidateId}`);
        }
    }
    if (gateFailures.length > 0) fail(action, gateFailures);

    // 重放与首次路径共享同一 fail-closed 校验：journal 字段必须与当前 selection 完全一致。
    if (existsSync(journalPath)) {
        const record = readHandoffJournal(journalPath, action);
        const journalCandidates = record !== null && Array.isArray(record.candidateIds) ? record.candidateIds.map(String) : [];
        if (record !== null
            && record.action === "pm-leader"
            && record.status === "handed-off"
            && record.selectionSetId === selectionSetId
            && Number(record.intakeRevision ?? 0) === currentRevision
            && String(record.fingerprint ?? "") === recomputed
            && journalCandidates.join("\u0000") === candidateIds.join("\u0000")) {
            succeed(action, {intakeId, selectionSetId, idempotent: true, candidateIds, journalAt: String(record.at ?? "")});
        }
        fail(action, [`handoff journal 与当前 selection 不一致，拒绝重放：${selectionSetId}`]);
    }

    mkdirSync(journalDir, {recursive: true});
    const journal = {
        schema: "nbook.handoff-journal/v1",
        action: "pm-leader",
        selectionSetId,
        status: "handed-off",
        intakeRevision: currentRevision,
        candidateIds,
        fingerprint: recomputed,
        at: new Date().toISOString(),
    };
    atomicWrite(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    succeed(action, {intakeId, selectionSetId, handedOff: candidateIds, journalAt: journal.at});
}

function claim(repoRoot: string, args: Args): never {
    const action = "claim";
    const intakeId = requireId(args, "intake", action);
    const selectionSetId = requireId(args, "selection-set", action);
    const candidateId = requireId(args, "candidate", action);
    const workKind = requireId(args, "work-kind", action);
    const reuseTask = args.values.get("reuse-task") ?? "";
    const taskArg = optionalFlag(args, "task");
    const taskExpectedRevision = args.values.get("task-expected-revision");
    const initiativeId = args.values.get("initiative") ?? "";
    const phaseId = args.values.get("phase") ?? "";
    const initiativeExpectedRevision = args.values.get("initiative-expected-revision");

    const intake = loadIntake(repoRoot, intakeId, action);
    const selection = loadSelection(repoRoot, intakeId, selectionSetId, action);

    // revision 失效同时阻止新的交接与候选 claim：来源映射或候选内容变更后旧授权不可用。
    const currentIntakeRevision = Number(intake.data.revision);
    if (Number(selection.data.intakeRevision) !== currentIntakeRevision) {
        fail(action, [`Intake revision 已变化，selection set 失效：selection=${String(selection.data.intakeRevision)} 当前=${String(currentIntakeRevision)}`], {}, 2);
    }

    const candidateIds = Array.isArray(selection.data.candidateIds) ? selection.data.candidateIds.map(String) : [];
    if (!candidateIds.includes(candidateId)) fail(action, [`候选不在 selection set 内：${candidateId}`]);

    // selection set 不可变：是否已交接由 handoff journal 判定，字段必须与当前 selection 完全一致。
    const handoffJournalPath = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "journal", `${selectionSetId}-handoff.json`);
    if (!existsSync(handoffJournalPath)) {
        fail(action, [`selection set 尚未完成 PM → Leader 交接：${selectionSetId}`]);
    }
    const handoffRecord = readHandoffJournal(handoffJournalPath, action);
    const journalCandidates = handoffRecord !== null && Array.isArray(handoffRecord.candidateIds) ? handoffRecord.candidateIds.map(String) : [];
    if (handoffRecord === null
        || handoffRecord.action !== "pm-leader"
        || handoffRecord.status !== "handed-off"
        || handoffRecord.selectionSetId !== selectionSetId
        || Number(handoffRecord.intakeRevision ?? 0) !== Number(selection.data.intakeRevision)
        || String(handoffRecord.fingerprint ?? "") !== computeCandidateSetFingerprint(candidateIds)
        || journalCandidates.join("\u0000") !== candidateIds.join("\u0000")) {
        fail(action, [`handoff journal 无效或与 selection 不一致：${selectionSetId}`]);
    }
    const decision = isRecord(selection.data.decision) ? selection.data.decision : {};
    const scope = isRecord(decision.scope) ? decision.scope : {};
    const allowedWorkKinds = Array.isArray(scope.allowedWorkKinds) ? scope.allowedWorkKinds.map(String) : [];
    if (!allowedWorkKinds.includes(workKind)) {
        fail(action, [`workKind 超出人类授权 scope：${workKind}（允许：${allowedWorkKinds.join(", ")}）`], {}, 2);
    }
    const expiresAt = typeof decision.expiresAt === "string" && decision.expiresAt.length > 0 ? decision.expiresAt : null;
    if (expiresAt !== null && Date.now() > Date.parse(expiresAt)) {
        fail(action, [`人类授权已过期，claim 拒绝：expiresAt=${String(expiresAt)}`], {}, 2);
    }

    const ledgerPath = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "claims.json");
    const ledger = loadLedger(ledgerPath, action);
    const key = claimKey(intakeId, candidateId, workKind);

    const existing = ledger.claims.find((entry) => entry.key === key);
    // 自重放（同 key）与真复用（duplicate-of 链指向其他已 claim 候选）必须区分：
    // 自重放沿用 ledger 的原始 taskId 收敛侧效应，不得当作既有对象复用而跳过 lineage。
    const selfReplay = existing !== undefined;
    let effectiveTaskId = "";
    let reusedFrom = "";
    let canonicalCandidateId = candidateId;
    if (selfReplay && existing !== undefined) {
        if (String(existing.selectionSetId ?? "") !== selectionSetId || String(existing.taskId ?? "") === "") {
            fail(action, [`claim 幂等键冲突：${key} 已由 selectionSet=${String(existing.selectionSetId)} task=${String(existing.taskId)} 登记`]);
        }
        effectiveTaskId = String(existing.taskId);
        if (taskArg !== "" && taskArg !== effectiveTaskId) {
            fail(action, [`重试参数与已登记 claim 不一致：task=${effectiveTaskId}`]);
        }
    } else if (!selfReplay) {
        const resolution = resolveCanonicalClaim(intakeId, intake, candidateId, ledger, workKind);
        if (resolution.failure !== null) fail(action, [resolution.failure]);
        if (resolution.existing !== null && resolution.canonicalId !== candidateId) {
            effectiveTaskId = String(resolution.existing.taskId ?? "");
            reusedFrom = resolution.canonicalId;
            canonicalCandidateId = resolution.canonicalId;
            if (effectiveTaskId === "") fail(action, [`canonical 候选已有 claim 但缺少 taskId：${resolution.canonicalId}`]);
        } else if (reuseTask !== "") {
            effectiveTaskId = reuseTask;
        } else if (taskArg !== "") {
            effectiveTaskId = taskArg;
        } else {
            fail(action, ["需要 --task（新建工作）或 --reuse-task <id>（复用既有对象）"]);
        }
    }

    const candidate = intake.candidates.get(candidateId);
    if (candidate === undefined) fail(action, [`候选不存在：${candidateId}`]);
    const duplicateTaskRelation = candidate.relations.find((relation) => relation.kind === "duplicate" && relation.targetType === "task");
    if (duplicateTaskRelation !== undefined && effectiveTaskId !== String(duplicateTaskRelation.targetId)) {
        fail(action, [`候选与既有 Task 构成 duplicate，必须 --reuse-task ${String(duplicateTaskRelation.targetId)}`]);
    }
    if (!HANDOFF_CANDIDATE_STATUSES.has(candidate.status) && candidate.status !== "promoted") {
        fail(action, [`候选状态不允许 claim：${candidateId} status=${candidate.status}`]);
    }

    // reuse-task 与 task 路径同等校验：目标必须存在且 lineage 未指向其他候选。
    if (reusedFrom === "" && reuseTask !== "") {
        const resolvedReuse = resolveTaskReadmePath(repoRoot, effectiveTaskId);
        if (resolvedReuse.path === null) fail(action, [`--reuse-task 目标不存在：${effectiveTaskId}`]);
        const reuseParsed = parseFrontmatterBlock(readFileSync(resolvedReuse.path, "utf8"));
        if (reuseParsed !== null && isRecord(reuseParsed.data.lineage)
            && String(reuseParsed.data.lineage.candidateId ?? "") !== candidateId
            && String(reuseParsed.data.lineage.candidateId ?? "") !== canonicalCandidateId) {
            fail(action, [`--reuse-task 目标已被其他候选 claim：${effectiveTaskId}`]);
        }
    }

    // journal 先行：ledger 提交后任何崩溃都可通过重跑 claim 收敛侧效应。
    const journalDir = join(resolve(repoRoot, ROOT_INTAKE_ROOT), intakeId, "journal");
    mkdirSync(journalDir, {recursive: true});
    const journalPath = join(journalDir, `${sha256Hex(key).slice(0, 16)}-claim.json`);
    if (!existsSync(journalPath)) {
        const journal = {schema: "nbook.handoff-journal/v1", action: "claim", key, selectionSetId, candidateId, workKind, taskId: effectiveTaskId, at: new Date().toISOString()};
        atomicWrite(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    }

    if (existing === undefined) {
        ledger.claims.push({
            schema: "nbook.claim-ledger/v1",
            key,
            intakeId,
            selectionSetId,
            candidateId,
            canonicalCandidateId,
            workKind,
            taskId: effectiveTaskId,
            reusedFrom: reusedFrom === "" ? null : reusedFrom,
            status: "claimed",
            claimedAt: new Date().toISOString(),
        });
        atomicWrite(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    }

    const needsLineageConvergence = selfReplay || (reusedFrom === "" && taskArg !== "");
    if (needsLineageConvergence) {
        const resolved = resolveTaskReadmePath(repoRoot, effectiveTaskId);
        if (resolved.path === null) fail(action, [`目标 Task 不存在：${effectiveTaskId}`]);
        const parsed = readFrontmatterObject(resolved.path, "Task");
        if (isRecord(parsed.data.lineage) && String(parsed.data.lineage.candidateId ?? "") !== candidateId) {
            fail(action, [`Task 已被其他候选 claim：${effectiveTaskId}`]);
        }
        if (!isRecord(parsed.data.lineage)) {
            const revision = Number(parsed.data.revision);
            if (!Number.isInteger(revision)) fail(action, [`Task 缺少整数 revision，无法 CAS：${effectiveTaskId}`]);
            if (taskExpectedRevision !== undefined && Number(taskExpectedRevision) !== revision) {
                fail(action, [`Task revision 已过期：当前=${String(revision)} 期望=${String(taskExpectedRevision)}`], {}, 2);
            }
            parsed.data.lineage = {intakeId, selectionSetId, candidateId, workKind};
            parsed.data.revision = revision + 1;
            parsed.data.updatedAt = new Date().toISOString();
            writeFrontmatterObject(resolved.path, parsed.data, parsed.body);
        }
    }

    if (initiativeId !== "" && phaseId !== "") {
        const initiativePath = join(resolve(repoRoot, ".agents/initiatives"), initiativeId, "README.md");
        if (!existsSync(initiativePath)) fail(action, [`Initiative 不存在：${initiativeId}`]);
        const parsed = readFrontmatterObject(initiativePath, "Initiative");
        const revision = Number(parsed.data.revision);
        if (!Number.isInteger(revision)) fail(action, [`Initiative 缺少整数 revision：${initiativeId}`]);
        if (initiativeExpectedRevision !== undefined && Number(initiativeExpectedRevision) !== revision) {
            fail(action, [`Initiative revision 已过期：当前=${String(revision)} 期望=${String(initiativeExpectedRevision)}`], {}, 2);
        }
        const phases = Array.isArray(parsed.data.phases) ? parsed.data.phases.filter(isRecord) : [];
        const phase = phases.find((entry) => entry.id === phaseId);
        if (phase === undefined) fail(action, [`Phase 不存在：${initiativeId} ${phaseId}`]);
        const tasks = Array.isArray(phase.tasks) ? phase.tasks.map(String) : [];
        if (!tasks.includes(effectiveTaskId)) {
            phase.tasks = [...tasks, effectiveTaskId];
            parsed.data.revision = revision + 1;
            parsed.data.updatedAt = new Date().toISOString();
            writeFrontmatterObject(initiativePath, parsed.data, parsed.body);
        }
    }

    // promoted 只能由成功 claim 写入；崩溃后重跑时已是 promoted 则收敛为 no-op。
    if (candidate.status !== "promoted") {
        candidate.raw.status = "promoted";
        writeFrontmatterObject(intake.path, intake.data, intake.body);
        const persisted = parseFrontmatterBlock(readFileSync(intake.path, "utf8"));
        const persistedCandidates = persisted !== null && Array.isArray(persisted.data.candidates) ? persisted.data.candidates : [];
        const persistedCandidate = persistedCandidates.find((entry) => isRecord(entry) && entry.id === candidateId);
        if (!isRecord(persistedCandidate) || persistedCandidate.status !== "promoted") {
            fail(action, [`promoted 写入校验失败：${candidateId}`]);
        }
    }

    succeed(action, {
        intakeId,
        selectionSetId,
        candidateId,
        workKind,
        key,
        taskId: effectiveTaskId,
        reusedFrom: reusedFrom === "" ? null : reusedFrom,
        converged: existing !== undefined,
    });
}

function taskHandoff(repoRoot: string, args: Args): never {
    const action = "task";
    const from = requireFlag(args, "from", action);
    const to = requireFlag(args, "to", action);
    const taskId = requireId(args, "task", action);
    const expectedRevision = requireInt(args, "expected-revision", action);
    const edge = `${from}->${to}`;
    if (!HANDOFF_EDGES.has(edge)) fail(action, [`不允许的交接边：${edge}`]);
    if (edge === "pm->leader") fail(action, ["pm->leader 必须使用 intake 形态（--intake --selection-set ...）"]);

    const resolved = resolveTaskReadmePath(repoRoot, taskId);
    if (resolved.path === null) fail(action, [`Task 不存在：${taskId}`]);
    const parsed = readFrontmatterObject(resolved.path, "Task");
    const revision = Number(parsed.data.revision);
    if (!Number.isInteger(revision)) fail(action, [`Task 缺少整数 revision，无法 CAS：${taskId}`]);
    if (expectedRevision !== revision) {
        fail(action, [`Task revision 已过期：当前=${String(revision)} 期望=${String(expectedRevision)}`], {}, 2);
    }
    const status = String(parsed.data.status ?? "");
    if (status === "completed" || status === "abandoned") fail(action, [`Task 状态不允许交接：${taskId} status=${status}`]);

    const handoffs = Array.isArray(parsed.data.handoffs) ? parsed.data.handoffs.filter(isRecord) : [];
    handoffs.push({from, to, at: new Date().toISOString(), revisionBefore: revision});
    parsed.data.handoffs = handoffs;
    parsed.data.revision = revision + 1;
    parsed.data.updatedAt = new Date().toISOString();
    writeFrontmatterObject(resolved.path, parsed.data, parsed.body);

    succeed(action, {taskId, edge, revision: revision + 1});
}

const argv = process.argv.slice(2);
const subcommand = argv[0] ?? "";
const args = parseArgs(argv.slice(1));
const repoArgument = args.values.get("repo-root");
const repoRoot = resolve(repoArgument ?? defaultRepoRoot(import.meta.url));

switch (subcommand) {
    case "pm-leader":
        pmLeader(repoRoot, args);
        break;
    case "claim":
        claim(repoRoot, args);
        break;
    case "task":
        taskHandoff(repoRoot, args);
        break;
    default:
        fail(subcommand || "none", [
            "用法：governance:handoff <pm-leader|claim|task> [参数]",
            "pm-leader --intake <id> --selection-set <id> --intake-revision <n> --candidate-set-fingerprint <sha256> --expected-revision <n>",
            "claim --intake <id> --selection-set <id> --candidate <id> --work-kind <kind> (--task <id> [--task-expected-revision <n>] | --reuse-task <id>) [--initiative <id> --phase <id> [--initiative-expected-revision <n>]]",
            "task --from <role> --to <role> --task <id> --expected-revision <n>",
        ]);
}
