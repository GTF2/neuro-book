import type {WorkspaceFileNode} from "nbook/app/stores/novel-ide";

/**
 * 稿面状态行的「位置感」摘要——全部由工作区树推导，不新增后端接口。
 *
 * 回答的是「我在哪、写到哪了」：卷名、卷内第几章、本章字数、全书字数。
 * 没有按天记录的字数历史，所以**刻意不含「今日字数」**——宁可少一项，不做假指标。
 */
export type ManuscriptPositionSummary = {
    /** 卷名（章节目录的父目录）。直接挂在根下的章节没有卷，为 null。 */
    volumeTitle: string | null;
    /** 卷内第几章（1 起）。推不出时为 null。 */
    chapterCurrent: number | null;
    /** 同卷（同分组）下的章节数。 */
    chapterTotal: number;
    /** 本章字数：章节 index.md 的 words；推不出章节时退回当前文件自己的。 */
    chapterWords: number | null;
    /** 所在根目录的标题（如「正文」）。 */
    scopeTitle: string | null;
    /** 该根目录下全部文件的字数合计。 */
    scopeWords: number | null;
};

/** 章节文件约定：目录下的 index.md。与详情面板的章节统计口径一致。 */
const INDEX_MD = "/index.md";

function dirname(path: string): string {
    const cut = path.lastIndexOf("/");
    return cut > 0 ? path.slice(0, cut) : "";
}

/**
 * 剥掉目录节点路径的尾斜杠。
 *
 * 这个代码库里**目录节点的 path 带尾斜杠**（store 的 normalizeWorkspaceMovedPath 对目录
 * 返回 `${path}/`），文件节点不带。所有按路径查 Map、拼前缀、比较目录名的地方都必须先归一化，
 * 否则 `byPath.get("manuscript/001-vol")` 查不到 key 为 `manuscript/001-vol/` 的卷节点——
 * 实测症状是卷名显示成路径段、全书字数消失。
 */
function norm(path: string): string {
    return path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * 从扁平工作区树解析当前打开文件的位置摘要。
 *
 * 结构不按深度猜：树的章节既有 `manuscript/000-opening/index.md`（三段，无卷），
 * 也有 `manuscript/001-vol/001-chapter/index.md`（四段，有卷）两种形态。
 * 所以「卷」定义为**章节目录的父目录**：index.md 所在目录的父目录是根目录时视为无卷，
 * 否则那个父目录就是卷。位置在「同卷的章节目录」之间排序得出。
 *
 * 推不出任何有用信息（找不到文件、选中的是目录、树为空）时返回 null，调用方据此隐藏状态行。
 */
export function resolveManuscriptPositionSummary(nodes: readonly WorkspaceFileNode[], activePath: string | null | undefined): ManuscriptPositionSummary | null {
    if (!activePath) {
        return null;
    }
    const active = nodes.find((node) => norm(node.path) === norm(activePath));
    if (!active || active.isDirectory) {
        return null;
    }

    const byPath = new Map(nodes.map((node) => [norm(node.path), node]));
    const activePathNorm = norm(active.path);
    const rootSeg = activePathNorm.split("/")[0] ?? "";
    const rootDir = byPath.get(rootSeg);
    const isChapterIndex = activePathNorm.toLowerCase().endsWith(INDEX_MD);
    const chapterDir = isChapterIndex ? activePathNorm.slice(0, -INDEX_MD.length) : dirname(activePathNorm);
    const groupDir = dirname(chapterDir);

    // 同分组的章节目录：groupDir 的**直接子目录**里、自身带 index.md、且**不是卷**的。
    // 「卷」的判定：该目录下还有更深的 index.md——卷头（卷自己的 index.md）与根级章节
    // 在结构上同构（都是某目录下的 index.md），唯一可靠的区分是它内部是否还有章节。
    const directChildDirs = new Set<string>();
    const groupPrefix = `${groupDir}/`;
    for (const node of nodes) {
        const path = norm(node.path);
        if (!path.startsWith(groupPrefix)) {
            continue;
        }
        const rest = path.slice(groupPrefix.length);
        const slash = rest.indexOf("/");
        if (slash > 0) {
            directChildDirs.add(`${groupPrefix}${rest.slice(0, slash)}`);
        }
    }
    const indexNodes = nodes.filter((node) => node.contentNode && !node.isDirectory && node.path.toLowerCase().endsWith(INDEX_MD));
    const chapterDirs = [...directChildDirs]
        .filter((dir) => {
            const ownIndexPath = `${dir}${INDEX_MD}`.toLowerCase();
            const dirPrefix = `${dir}/`.toLowerCase();
            const hasOwnIndex = indexNodes.some((node) => norm(node.path).toLowerCase() === ownIndexPath);
            // 卷：自己有 index 之外，内部还有更深的 index.md
            const isVolume = indexNodes.some((node) => {
                const lower = norm(node.path).toLowerCase();
                return lower.startsWith(dirPrefix) && lower !== ownIndexPath;
            });
            return hasOwnIndex && !isVolume;
        })
        .sort();

    const inVolume = groupDir !== rootSeg && groupDir !== "";
    const chapterCurrent = chapterDirs.indexOf(chapterDir);
    const chapterIndexNode = byPath.get(`${chapterDir}${INDEX_MD}`);

    const scopeWords = rootDir ? nodes.reduce((total, node) => (norm(node.path).startsWith(`${rootSeg}/`) && !node.isDirectory ? total + node.words : total), 0) : null;

    return {
        volumeTitle: inVolume ? byPath.get(groupDir)?.title ?? groupDir.slice(groupDir.lastIndexOf("/") + 1) : null,
        chapterCurrent: chapterCurrent >= 0 ? chapterCurrent + 1 : null,
        chapterTotal: chapterDirs.length,
        chapterWords: chapterIndexNode ? chapterIndexNode.words : active.words,
        scopeTitle: rootDir?.title ?? rootSeg,
        scopeWords: scopeWords !== null && scopeWords > 0 ? scopeWords : null,
    };
}
