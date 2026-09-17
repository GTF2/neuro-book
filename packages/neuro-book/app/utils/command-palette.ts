/**
 * 命令面板的纯逻辑：过滤与选择。与 Vue 无关，可单测。
 */

export type CommandItem = {
    id: string;
    label: string;
    /** 分组标题，用于界面分组与「按分组也能搜到」 */
    group: string;
    /** 副标题，例如快捷键或当前状态（「已开启」） */
    hint?: string;
    /** 图标类名（UnoCSS 的 i-lucide-*） */
    iconClass?: string;
    disabled?: boolean;
};

/** 命中优先级：越小越靠前。同优先级保持输入顺序。 */
const RANK_LABEL_PREFIX = 0;
const RANK_LABEL_CONTAINS = 1;
const RANK_OTHER_FIELD = 2;

function rank(item: CommandItem, needle: string): number | null {
    const label = item.label.toLowerCase();
    if (label.startsWith(needle)) {
        return RANK_LABEL_PREFIX;
    }
    if (label.includes(needle)) {
        return RANK_LABEL_CONTAINS;
    }
    if ((item.hint ?? "").toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle)) {
        return RANK_OTHER_FIELD;
    }
    return null;
}

/**
 * 按查询串过滤命令。
 *
 * 空查询返回全部（保持调用方给的顺序——分组与常用度由调用方决定）。
 * 非空时按命中位置排序：标签前缀 > 标签包含 > 副标题或分组命中；同优先级保持原顺序，
 * 这样用户连打几个字时结果顺序不会乱跳。
 */
export function filterCommands<T extends CommandItem>(commands: readonly T[], query: string): T[] {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return [...commands];
    }

    const scored: Array<{item: T; index: number; score: number}> = [];
    commands.forEach((item, index) => {
        const score = rank(item, needle);
        if (score !== null) {
            scored.push({item, index, score});
        }
    });

    scored.sort((a, b) => a.score - b.score || a.index - b.index);
    return scored.map((entry) => entry.item);
}

/**
 * 移动选中项。**循环**——到头回到另一端，与 VS Code / Raycast 一致；
 * 短列表（十来项）里循环比撞墙更顺手。
 */
export function moveSelection(current: number, delta: number, total: number): number {
    if (total <= 0) {
        return -1;
    }
    if (current < 0) {
        return delta > 0 ? 0 : total - 1;
    }
    return (current + delta + total) % total;
}

/** 按分组把命令切成连续的段，供界面渲染分组标题。 */
export function groupCommands<T extends CommandItem>(commands: readonly T[]): Array<{group: string; items: T[]}> {
    const groups: Array<{group: string; items: T[]}> = [];
    for (const item of commands) {
        const last = groups[groups.length - 1];
        if (last && last.group === item.group) {
            last.items.push(item);
        } else {
            groups.push({group: item.group, items: [item]});
        }
    }
    return groups;
}
