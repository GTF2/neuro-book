import type {ModelLibraryEntryDto} from "nbook/shared/dto/app-settings.dto";

/** 参考匹配结果；`versionDistance` 为 null 表示至少一方没有可比较的版本号。 */
export type ModelLibraryReferenceMatch = {
    entry: ModelLibraryEntryDto;
    family: string;
    versionDistance: number | null;
    sharedQualifiers: string[];
};

/**
 * 为未精确命中 Model Library 的模型 ID 选择唯一同族参考条目。
 *
 * 判据按顺序为：族名一致 → 版本号距离最近 → 变体后缀（flash / pro / vision 等）重合最多
 * → 额外词最少 → 命名空间最浅 → ID 字典序。族名取最后一段 slug 的首个非版本词，
 * 命名空间（`zai/glm-5.2`）与日期后缀不参与比较。
 *
 * 只有版本距离不超过 1.0 或共享至少一个变体后缀才算同族参考；否则返回 null，
 * 由调用方保留「需要补充」。宁可没有参考，也不要拿无关世代的资料当参考值。
 */
export function selectModelLibraryReference(
    targetId: string,
    entries: readonly ModelLibraryEntryDto[],
): ModelLibraryReferenceMatch | null {
    const shapes = shapesFor(entries);
    const target = shapeOf(shapes, targetId);
    if (!target) {
        return null;
    }
    const targetTokenSet = new Set(target.tokens);
    let best: ReferenceCandidate | null = null;
    for (const entry of entries) {
        if (entry.id.trim().toLowerCase() === targetId.trim().toLowerCase()) {
            continue;
        }
        const shape = shapeOf(shapes, entry.id);
        if (!shape || shape.family !== target.family) {
            continue;
        }
        const sharedTokenCount = shape.tokens.filter((token) => targetTokenSet.has(token)).length;
        const candidate: ReferenceCandidate = {
            entry,
            versionDistance: target.version !== null && shape.version !== null
                ? Math.abs(target.version - shape.version)
                : null,
            sharedQualifiers: [...shape.qualifiers].filter((qualifier) => target.qualifiers.has(qualifier)).sort(),
            extraTokenCount: shape.tokens.length - sharedTokenCount,
            namespaceDepth: entry.id.split("/").length,
        };
        if (!isReferenceCloseEnough(candidate)) {
            continue;
        }
        if (best === null || compareReferenceCandidates(candidate, best) < 0) {
            best = candidate;
        }
    }
    return best
        ? {entry: best.entry, family: target.family, versionDistance: best.versionDistance, sharedQualifiers: best.sharedQualifiers}
        : null;
}

type ReferenceCandidate = {
    entry: ModelLibraryEntryDto;
    versionDistance: number | null;
    sharedQualifiers: string[];
    extraTokenCount: number;
    namespaceDepth: number;
};

/** 版本距离上限：同族相邻世代（如 5.3 与 5.2、k3 与 k2.7）都在 1.0 以内。 */
const MAX_REFERENCE_VERSION_DISTANCE = 1;

function isReferenceCloseEnough(candidate: ReferenceCandidate): boolean {
    return (candidate.versionDistance !== null && candidate.versionDistance <= MAX_REFERENCE_VERSION_DISTANCE)
        || candidate.sharedQualifiers.length > 0;
}

type ModelIdShape = {
    family: string;
    version: number | null;
    qualifiers: Set<string>;
    tokens: string[];
};

/**
 * 解析结果按 Model Library 数组实例缓存：发现列表会为每个远端模型重复匹配，
 * 每次重扫 730 条 ID 的解析成本没有必要。缓存生命周期跟着数组实例走，
 * 换一份资料（新数组）自然失效，不引入需要手动清理的全局状态。
 */
const shapeCacheByLibrary = new WeakMap<readonly ModelLibraryEntryDto[], Map<string, ModelIdShape | null>>();

function shapesFor(entries: readonly ModelLibraryEntryDto[]): Map<string, ModelIdShape | null> {
    let shapes = shapeCacheByLibrary.get(entries);
    if (!shapes) {
        shapes = new Map();
        shapeCacheByLibrary.set(entries, shapes);
    }
    return shapes;
}

function shapeOf(shapes: Map<string, ModelIdShape | null>, modelId: string): ModelIdShape | null {
    const key = modelId.trim().toLowerCase();
    if (!shapes.has(key)) {
        shapes.set(key, parseModelIdShape(modelId));
    }
    return shapes.get(key) ?? null;
}

/**
 * `v4` / `k2.7` / `m3` / `5.3` 这类版本词，数字部分最多三位；
 * `4o`（变体字母）与 `2601`、`0711`（四位日期戳）不按版本处理。
 */
const VERSION_TOKEN_PATTERN = /^[a-z]{0,2}\d{1,3}(?:\.\d{1,3})*$/u;

/** 从模型 ID 提取族名、版本与变体后缀；没有族名（纯版本或纯符号）时返回 null。 */
function parseModelIdShape(modelId: string): ModelIdShape | null {
    const normalized = modelId.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    const slug = normalized.slice(normalized.lastIndexOf("/") + 1);
    const tokens = slug.split(/[^a-z0-9.]+/u).filter(Boolean);
    const familyIndex = tokens.findIndex((token) => /[a-z]/u.test(token) && !VERSION_TOKEN_PATTERN.test(token));
    if (familyIndex < 0) {
        return null;
    }
    const family = tokens[familyIndex]!;
    let version: number | null = null;
    for (const token of tokens) {
        if (!VERSION_TOKEN_PATTERN.test(token)) {
            continue;
        }
        const parsed = Number.parseFloat(token.replace(/^[a-z]{1,2}/u, ""));
        if (Number.isFinite(parsed)) {
            version = parsed;
            break;
        }
    }
    const qualifiers = new Set<string>();
    for (const token of tokens) {
        if (token !== family && /[a-z]/u.test(token) && !VERSION_TOKEN_PATTERN.test(token)) {
            qualifiers.add(token);
        }
    }
    return {family, version, qualifiers, tokens};
}

function compareReferenceCandidates(left: ReferenceCandidate, right: ReferenceCandidate): number {
    const leftDistance = left.versionDistance ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.versionDistance ?? Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
    }
    if (left.sharedQualifiers.length !== right.sharedQualifiers.length) {
        return right.sharedQualifiers.length - left.sharedQualifiers.length;
    }
    if (left.extraTokenCount !== right.extraTokenCount) {
        return left.extraTokenCount - right.extraTokenCount;
    }
    if (left.namespaceDepth !== right.namespaceDepth) {
        return left.namespaceDepth - right.namespaceDepth;
    }
    return left.entry.id.localeCompare(right.entry.id);
}
