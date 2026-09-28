import {createHash} from "node:crypto";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {parse as parseYaml} from "yaml";

import {readTaskOwnershipManifest, resolveTaskReadmePath, APPLICATION_TASK_OWNER_ROOT, ROOT_TASK_OWNER_ROOT} from "#scripts/ci/agent-governance-contract";

export const PROPOSAL_SCHEMA = "nbook.proposal/v1";
export const INTAKE_SCHEMA = "nbook.intake/v1";
export const SELECTION_SET_SCHEMA = "nbook.selection-set/v1";
export const INITIATIVE_SCHEMA = "nbook.initiative/v1";
export const CLAIM_LEDGER_SCHEMA = "nbook.claim-ledger/v1";
export const HANDOFF_RESULT_SCHEMA = "nbook.handoff-result/v1";
export const PROPOSAL_KINDS = new Set(["behavior", "architecture", "governance"]);
export const PROPOSAL_STATUSES = new Set(["draft", "reviewing", "accepted", "rejected", "superseded"]);
export const CANDIDATE_STATUSES = new Set(["observed", "triaged", "needs-decision", "deferred", "promoted", "closed", "blocked"]);
export const RELATION_KINDS = new Set(["duplicate-of", "related-to", "duplicate", "related", "follow-up", "supersedes", "blocked-by"]);
export const RELATION_TARGET_TYPES = new Set(["candidate", "issue", "task", "proposal", "intake"]);
export const CANDIDATE_MARKERS = new Set(["low-priority", "doubtful"]);
export const SELECTION_STATUSES = new Set(["confirmed", "handed-off", "revoked", "expired"]);
export const INTAKE_STATUSES = new Set(["captured", "triaged", "promoted", "closed"]);
export const INITIATIVE_STATUSES = new Set(["planned", "active", "blocked", "completed", "abandoned"]);
export const PHASE_STATUSES = new Set(["pending", "ready", "in-progress", "blocked", "completed"]);
export const SIDE_EFFECT_CLASSES = new Set(["repo-local", "remote-write", "irreversible"]);
export const HANDOFF_CANDIDATE_STATUSES = new Set(["triaged", "needs-decision"]);
export const HANDOFF_EDGES = new Set([
    "pm->leader",
    "pm->human",
    "leader->tasker",
    "tasker->reviewer",
    "reviewer->leader",
    "leader->human",
    "human->leader",
    "human->pm",
]);

export interface ParsedFrontmatter {
    data: Record<string, unknown>;
    body: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFrontmatterBlock(text: string): ParsedFrontmatter | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
    if (!match) return null;
    try {
        const value = parseYaml(match[1]) as unknown;
        if (!isRecord(value)) return null;
        return {data: value, body: text.slice(match[0].length)};
    } catch {
        return null;
    }
}

/** 稳定键序 JSON；同一逻辑对象在任何输入键序下产生同一哈希。 */
export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
    if (isRecord(value)) {
        const entries = Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}

export function sha256Hex(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

export function computeCandidateSetFingerprint(candidateIds: readonly string[]): string {
    return `sha256:${sha256Hex(canonicalJson([...candidateIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))))}`;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function isIsoDate(value: unknown): boolean {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}


export function proposalFiles(repoRoot: string): string[] {
    // 迁移合同只覆盖活跃提案；已归档正文按 Task 合同保持冻结，另行显式授权迁移。
    const roots = [
        resolve(repoRoot, "docs/proposals"),
        resolve(repoRoot, "packages/neuro-book/docs/proposals"),
    ];
    const files: string[] = [];
    for (const root of roots) {
        if (!existsSync(root)) continue;
        for (const entry of readdirSync(root, {withFileTypes: true})) {
            if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
                files.push(join(root, entry.name));
            }
        }
    }
    return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
export const ROOT_INTAKE_ROOT = ".agents/intake";

/** Proposal v1：frontmatter 是唯一机器状态真相源；governance / architecture 的 accepted 必须由人类确认。 */
export function verifyProposalFrontmatters(repoRoot: string): string[] {
    const failures: string[] = [];
    const seenIds = new Map<string, string>();
    for (const absolutePath of proposalFiles(repoRoot)) {
        const relativePath = absolutePath.slice(repoRoot.length + 1).replaceAll("\\", "/");
        const parsed = parseFrontmatterBlock(readFileSync(absolutePath, "utf8"));
        if (parsed === null) {
            failures.push(`Proposal 缺少有效 frontmatter（迁移合同）：${relativePath}`);
            continue;
        }
        const data = parsed.data;
        if (data.schema !== PROPOSAL_SCHEMA) failures.push(`Proposal frontmatter schema 无效：${relativePath}`);
        const id = typeof data.id === "string" ? data.id : "";
        if (!/^P-\d{3}$/u.test(id)) failures.push(`Proposal ID 无效（需要 P-NNN）：${relativePath}`);
        const expectedPrefix = `${id.toLowerCase()}-`;
        if (id !== "" && !basename(relativePath).startsWith(expectedPrefix)) {
            failures.push(`Proposal 文件名未携带 ID 前缀 ${expectedPrefix}：${relativePath}`);
        }
        const owner = seenIds.get(id);
        if (owner !== undefined) failures.push(`Proposal ID 重复：${id}（${owner} 与 ${relativePath}）`);
        if (id !== "") seenIds.set(id, relativePath);
        if (!PROPOSAL_KINDS.has(String(data.kind))) failures.push(`Proposal kind 无效：${relativePath}`);
        if (!PROPOSAL_STATUSES.has(String(data.status))) failures.push(`Proposal status 无效：${relativePath}`);
        if (!isIsoDate(data.createdAt)) failures.push(`Proposal createdAt 无效：${relativePath}`);
        if (!isIsoDate(data.updatedAt)) failures.push(`Proposal updatedAt 无效：${relativePath}`);
        if (/^状态：/um.test(parsed.body)) failures.push(`Proposal 正文仍双写状态行，违反 frontmatter 唯一真相源：${relativePath}`);
        const decision = isRecord(data.decision) ? data.decision : null;
        if (data.status === "accepted" && (data.kind === "governance" || data.kind === "architecture")) {
            if (decision === null || decision.by !== "human") {
                failures.push(`governance / architecture Proposal 的 accepted 必须由人类确认（decision.by=human）：${relativePath}`);
            }
        }
        if (decision !== null) {
            if (decision.by !== "human" && decision.by !== "pm") failures.push(`Proposal decision.by 无效：${relativePath}`);
            if (decision.by === "pm" && (typeof decision.rationale !== "string" || decision.rationale.trim().length === 0)) {
                failures.push(`PM 自主接受必须记录影响分析 rationale：${relativePath}`);
            }
        }
    }
    return failures;
}

function relationTargetExists(repoRoot: string, relation: Record<string, unknown>, relativePath: string, failures: string[]): void {
    const targetType = String(relation.targetType ?? "");
    const targetId = String(relation.targetId ?? "");
    if (targetType === "issue" && !/^#\d+$/u.test(targetId)) failures.push(`issue 关系目标必须是 #编号：${relativePath}`);
    if (targetType === "task") {
        if (resolveTaskReadmePath(repoRoot, targetId).path === null) failures.push(`task 关系目标不存在：${targetId}（${relativePath}）`);
    }
    if (targetType === "proposal") {
        const exists = proposalFiles(repoRoot).some((file) => basename(file).startsWith(`${targetId.toLowerCase()}-`));
        if (!exists) failures.push(`proposal 关系目标不存在：${targetId}（${relativePath}）`);
    }
    if (targetType === "intake" && !existsSync(resolve(repoRoot, ROOT_INTAKE_ROOT, targetId))) {
        failures.push(`intake 关系目标不存在：${targetId}（${relativePath}）`);
    }
}

function validateCandidate(repoRoot: string, candidate: unknown, relativePath: string, index: number, failures: string[]): Record<string, unknown> | null {
    const label = `${relativePath} candidates[${String(index)}]`;
    if (!isRecord(candidate)) {
        failures.push(`候选必须是对象：${label}`);
        return null;
    }
    const id = typeof candidate.id === "string" ? candidate.id : "";
    if (!/^candidate-\d{3,}$/u.test(id)) failures.push(`候选 ID 无效：${label}`);
    if (!CANDIDATE_STATUSES.has(String(candidate.status))) failures.push(`候选 status 无效：${label}`);
    for (const marker of asStringArray(candidate.markers)) {
        if (!CANDIDATE_MARKERS.has(marker)) failures.push(`候选 marker 无效：${label} ${marker}`);
    }
    const relations = Array.isArray(candidate.relations) ? candidate.relations : [];
    relations.forEach((relation, relationIndex) => {
        const relationLabel = `${label} relations[${String(relationIndex)}]`;
        if (!isRecord(relation)) {
            failures.push(`关系必须是对象：${relationLabel}`);
            return;
        }
        if (!RELATION_KINDS.has(String(relation.kind))) failures.push(`关系 kind 无效：${relationLabel}`);
        if (!RELATION_TARGET_TYPES.has(String(relation.targetType))) failures.push(`关系 targetType 无效：${relationLabel}`);
        if (typeof relation.targetId !== "string" || relation.targetId.trim().length === 0) failures.push(`关系缺少 targetId：${relationLabel}`);
        if (typeof relation.basis !== "string" || relation.basis.trim().length === 0) failures.push(`关系缺少匹配依据 basis：${relationLabel}`);
        const confidence = Number(relation.confidence);
        if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) failures.push(`关系 confidence 必须在 [0,1]：${relationLabel}`);
        if (RELATION_TARGET_TYPES.has(String(relation.targetType)) && String(relation.targetType) !== "candidate") {
            relationTargetExists(repoRoot, relation, relativePath, failures);
        }
    });
    return candidate;
}

function validateSelectionSet(selection: unknown, selectionRelative: string, intakeId: string, candidateIds: Set<string>, failures: string[]): void {
    if (!isRecord(selection)) {
        failures.push(`Selection set frontmatter 必须是对象：${selectionRelative}`);
        return;
    }
    if (selection.schema !== SELECTION_SET_SCHEMA) failures.push(`Selection set schema 无效：${selectionRelative}`);
    if (selection.selectionSetId !== basename(selectionRelative, ".md")) failures.push(`selectionSetId 必须与文件名一致：${selectionRelative}`);
    if (selection.intakeId !== intakeId) failures.push(`selection set intakeId 与所在 Intake 不一致：${selectionRelative}`);
    if (!SELECTION_STATUSES.has(String(selection.status))) failures.push(`Selection set status 无效：${selectionRelative}`);
    if (!Number.isInteger(Number(selection.intakeRevision)) || Number(selection.intakeRevision) < 1) failures.push(`Selection set intakeRevision 无效：${selectionRelative}`);
    const decision = isRecord(selection.decision) ? selection.decision : {};
    const scope = isRecord(decision.scope) ? decision.scope : {};
    const ids = asStringArray(selection.candidateIds);
    if (ids.length === 0) failures.push(`Selection set candidateIds 不能为空：${selectionRelative}`);
    const sorted = [...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    if (ids.length > 0 && ids.join("\u0000") !== sorted.join("\u0000")) failures.push(`Selection set candidateIds 必须按稳定 ID 排序：${selectionRelative}`);
    for (const id of ids) {
        if (!candidateIds.has(id)) failures.push(`Selection set 引用不存在的候选：${selectionRelative} ${id}`);
    }
    if (computeCandidateSetFingerprint(ids) !== selection.candidateSetFingerprint) {
        failures.push(`Selection set candidateSetFingerprint 与排序候选集不一致：${selectionRelative}`);
    }
    if (decision.kind !== "user-selection") failures.push(`decision.kind 必须为 user-selection：${selectionRelative}`);
    if (!isIsoDate(decision.recordedAt)) failures.push(`decision.recordedAt 不是合法 ISO 时间：${selectionRelative}`);
    if (decision.expiresAt != null && !isIsoDate(decision.expiresAt)) failures.push(`decision.expiresAt 不是合法 ISO 时间：${selectionRelative}`);
    if (asStringArray(scope.allowedWorkKinds).length === 0) failures.push(`decision.scope.allowedWorkKinds 不能为空：${selectionRelative}`);
    if (!SIDE_EFFECT_CLASSES.has(String(scope.sideEffectClass))) failures.push(`decision.scope.sideEffectClass 无效：${selectionRelative}`);
}

/** Intake 与 selection set 的静态结构校验（schema、指纹、scope、生命周期）。 */
export function verifyIntakesAndSelectionSets(repoRoot: string): string[] {
    const failures: string[] = [];
    const intakeRoot = resolve(repoRoot, ROOT_INTAKE_ROOT);
    if (!existsSync(intakeRoot)) return failures;
    for (const entry of readdirSync(intakeRoot, {withFileTypes: true})) {
        if (!entry.isDirectory()) continue;
        const intakeId = entry.name;
        const readmePath = join(intakeRoot, intakeId, "README.md");
        if (!existsSync(readmePath)) {
            failures.push(`Intake 目录缺少 README.md：${intakeId}`);
            continue;
        }
        const relativeIntakePath = `${ROOT_INTAKE_ROOT}/${intakeId}/README.md`;
        const parsed = parseFrontmatterBlock(readFileSync(readmePath, "utf8"));
        if (parsed === null) {
            failures.push(`Intake 缺少有效 frontmatter：${relativeIntakePath}`);
            continue;
        }
        const data = parsed.data;
        if (data.schema !== INTAKE_SCHEMA) failures.push(`Intake schema 无效：${relativeIntakePath}`);
        if (data.id !== intakeId) failures.push(`Intake id 必须与目录名一致：${relativeIntakePath}`);
        if (!INTAKE_STATUSES.has(String(data.status))) failures.push(`Intake status 无效：${relativeIntakePath}`);
        if (!Number.isInteger(Number(data.revision)) || Number(data.revision) < 1) failures.push(`Intake revision 必须是正整数：${relativeIntakePath}`);
        const candidateIds = new Set<string>();
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        candidates.forEach((candidate, index) => {
            const validated = validateCandidate(repoRoot, candidate, relativeIntakePath, index, failures);
            if (validated !== null && typeof validated.id === "string") {
                if (candidateIds.has(validated.id)) failures.push(`候选 ID 重复：${relativeIntakePath} ${validated.id}`);
                candidateIds.add(validated.id);
            }
        });
        if (data.mode === "batch") {
            const rawItemCount = Number(data.rawItemCount);
            const deduplicatedCandidateCount = Number(data.deduplicatedCandidateCount);
            if (!Number.isInteger(rawItemCount) || rawItemCount < 1) failures.push(`批量 Intake rawItemCount 无效：${relativeIntakePath}`);
            if (!Number.isInteger(deduplicatedCandidateCount) || deduplicatedCandidateCount < 1) failures.push(`批量 Intake deduplicatedCandidateCount 无效：${relativeIntakePath}`);
            if (Number.isInteger(deduplicatedCandidateCount) && deduplicatedCandidateCount !== candidates.length) {
                failures.push(`deduplicatedCandidateCount 与候选数组长度不一致：${relativeIntakePath}`);
            }
            const covered = new Set<number>();
            for (const candidate of candidates) {
                if (!isRecord(candidate) || !isRecord(candidate.source)) continue;
                for (const item of Array.isArray(candidate.source.items) ? candidate.source.items : []) {
                    if (isRecord(item) && Number.isInteger(Number(item.rawItem))) covered.add(Number(item.rawItem));
                }
            }
            if (Number.isInteger(rawItemCount)) {
                for (let rawItem = 1; rawItem <= rawItemCount; rawItem += 1) {
                    if (!covered.has(rawItem)) failures.push(`批量 Intake 原始来源项未映射：${relativeIntakePath} rawItem=${String(rawItem)}`);
                }
            }
        }
        const selectionsDir = join(intakeRoot, intakeId, "selections");
        if (!existsSync(selectionsDir)) continue;
        for (const selectionEntry of readdirSync(selectionsDir, {withFileTypes: true})) {
            if (!selectionEntry.isFile() || !selectionEntry.name.endsWith(".md")) continue;
            const selectionRelative = `${ROOT_INTAKE_ROOT}/${intakeId}/selections/${selectionEntry.name}`;
            const selectionParsed = parseFrontmatterBlock(readFileSync(join(selectionsDir, selectionEntry.name), "utf8"));
            if (selectionParsed === null) {
                failures.push(`Selection set 缺少有效 frontmatter：${selectionRelative}`);
                continue;
            }
            validateSelectionSet(selectionParsed.data, selectionRelative, intakeId, candidateIds, failures);
        }
    }
    return failures;
}

function initiativeFiles(repoRoot: string): string[] {
    const root = resolve(repoRoot, ".agents/initiatives");
    if (!existsSync(root)) return [];
    return readdirSync(root, {withFileTypes: true})
        .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "README.md")))
        .map((entry) => join(root, entry.name, "README.md"))
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Initiative DAG 无环 + Phase 依赖与 Task 引用存在性。 */
export function verifyInitiatives(repoRoot: string): string[] {
    const failures: string[] = [];
    const initiativeIds = new Set<string>();
    const parsedInitiatives: Array<{id: string; data: Record<string, unknown>}> = [];
    for (const absolutePath of initiativeFiles(repoRoot)) {
        const id = basename(dirname(absolutePath));
        initiativeIds.add(id);
        const parsed = parseFrontmatterBlock(readFileSync(absolutePath, "utf8"));
        if (parsed === null) {
            failures.push(`Initiative 缺少有效 frontmatter：${id}`);
            continue;
        }
        const data = parsed.data;
        if (data.schema !== INITIATIVE_SCHEMA) failures.push(`Initiative schema 无效：${id}`);
        if (data.id !== id) failures.push(`Initiative id 必须与目录名一致：${id}`);
        if (!INITIATIVE_STATUSES.has(String(data.status))) failures.push(`Initiative status 无效：${id}`);
        if (!Number.isInteger(Number(data.revision)) || Number(data.revision) < 1) failures.push(`Initiative revision 必须是正整数：${id}`);
        parsedInitiatives.push({id, data});
    }
    const edges: Array<[string, string]> = [];
    for (const {id, data} of parsedInitiatives) {
        const phases = Array.isArray(data.phases) ? data.phases : [];
        phases.forEach((phase, index) => {
            if (!isRecord(phase)) {
                failures.push(`Phase 必须是对象：${id} phases[${String(index)}]`);
                return;
            }
            const phaseId = typeof phase.id === "string" ? phase.id : "";
            if (phaseId === "") failures.push(`Phase 缺少 id：${id} phases[${String(index)}]`);
            if (!PHASE_STATUSES.has(String(phase.status))) failures.push(`Phase status 无效：${id} ${phaseId}`);
            for (const dependency of asStringArray(phase.dependsOn)) {
                if (!phases.some((other) => isRecord(other) && other.id === dependency)) {
                    failures.push(`Phase 依赖目标不存在：${id} ${phaseId} -> ${dependency}`);
                }
                edges.push([`${id}#${dependency}`, `${id}#${phaseId}`]);
            }
            for (const taskId of asStringArray(phase.tasks)) {
                if (resolveTaskReadmePath(repoRoot, taskId).path === null) failures.push(`Phase 引用的 Task 不存在：${id} ${phaseId} -> ${taskId}`);
            }
        });
        for (const dependency of asStringArray(data.dependsOnInitiatives)) {
            if (!initiativeIds.has(dependency)) failures.push(`Initiative 依赖目标不存在：${id} -> ${dependency}`);
            edges.push([dependency, id]);
        }
    }
    const adjacency = new Map<string, string[]>();
    for (const [from, to] of edges) {
        const list = adjacency.get(from) ?? [];
        list.push(to);
        adjacency.set(from, list);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (node: string): boolean => {
        if (visiting.has(node)) return false;
        if (visited.has(node)) return true;
        visiting.add(node);
        for (const next of adjacency.get(node) ?? []) {
            if (!visit(next)) return false;
        }
        visiting.delete(node);
        visited.add(node);
        return true;
    };
    for (const node of adjacency.keys()) {
        if (!visit(node)) {
            failures.push(`Initiative / Phase 依赖图存在环：${node}`);
            break;
        }
    }
    return failures;
}

export interface TaskReadmeLocation {
    relativePath: string;
    absolutePath: string;
}

/** 遍历双根 Task README；应用根依赖 ownership manifest，未加载时跳过应用根。 */
export function taskReadmeLocations(repoRoot: string): TaskReadmeLocation[] {
    const locations: TaskReadmeLocation[] = [];
    const roots: Array<[string, boolean]> = [
        [resolve(repoRoot, ROOT_TASK_OWNER_ROOT), true],
        [resolve(repoRoot, APPLICATION_TASK_OWNER_ROOT), readTaskOwnershipManifest(repoRoot).manifest !== null],
    ];
    for (const [root, enabled] of roots) {
        if (!enabled || !existsSync(root)) continue;
        for (const entry of readdirSync(root, {withFileTypes: true})) {
            if (!entry.isDirectory() || entry.name === "archived") continue;
            const absolutePath = join(root, entry.name, "README.md");
            if (existsSync(absolutePath)) locations.push({relativePath: absolutePath.slice(repoRoot.length + 1).replaceAll("\\", "/"), absolutePath});
        }
    }
    return locations;
}

/** Task lineage 组合仓库内唯一，且引用的 Intake / selection set / 候选与 scope 真实一致。 */
export function verifyTaskLineage(repoRoot: string): string[] {
    const failures: string[] = [];
    const seen = new Map<string, string>();
    for (const location of taskReadmeLocations(repoRoot)) {
        const parsed = parseFrontmatterBlock(readFileSync(location.absolutePath, "utf8"));
        if (parsed === null) continue;
        const lineage = parsed.data.lineage;
        if (lineage === undefined || lineage === null) continue;
        if (!isRecord(lineage)) {
            failures.push(`Task lineage 必须是对象：${location.relativePath}`);
            continue;
        }
        const intakeId = typeof lineage.intakeId === "string" ? lineage.intakeId : "";
        const selectionSetId = typeof lineage.selectionSetId === "string" ? lineage.selectionSetId : "";
        const candidateId = typeof lineage.candidateId === "string" ? lineage.candidateId : "";
        const workKind = typeof lineage.workKind === "string" ? lineage.workKind : "";
        for (const [field, value] of [["intakeId", intakeId], ["selectionSetId", selectionSetId], ["candidateId", candidateId], ["workKind", workKind]] as const) {
            if (value === "") failures.push(`Task lineage.${field} 缺失：${location.relativePath}`);
        }
        const combo = `${intakeId}|${selectionSetId}|${candidateId}|${workKind}`;
        const owner = seen.get(combo);
        if (owner !== undefined) failures.push(`Task lineage 组合重复（幂等约束）：${combo}（${owner} 与 ${location.relativePath}）`);
        seen.set(combo, location.relativePath);
        const intakeDir = resolve(repoRoot, ROOT_INTAKE_ROOT, intakeId);
        if (!existsSync(intakeDir)) {
            failures.push(`Task lineage 引用的 Intake 不存在：${intakeId}（${location.relativePath}）`);
            continue;
        }
        const selectionPath = join(intakeDir, "selections", `${selectionSetId}.md`);
        if (!existsSync(selectionPath)) {
            failures.push(`Task lineage 引用的 selection set 不存在：${selectionSetId}（${location.relativePath}）`);
            continue;
        }
        const selectionParsed = parseFrontmatterBlock(readFileSync(selectionPath, "utf8"));
        if (selectionParsed === null) continue;
        if (!asStringArray(selectionParsed.data.candidateIds).includes(candidateId)) {
            failures.push(`Task lineage 候选不在 selection set 内：${candidateId}（${location.relativePath}）`);
        }
        const lineageDecision = isRecord(selectionParsed.data.decision) ? selectionParsed.data.decision : {};
        const scope = isRecord(lineageDecision.scope) ? lineageDecision.scope : {};
        if (workKind !== "" && !asStringArray(scope.allowedWorkKinds).includes(workKind)) {
            failures.push(`Task lineage workKind 超出 selection scope：${workKind}（${location.relativePath}）`);
        }
    }
    return failures;
}
