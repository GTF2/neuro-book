import {filterCommands, groupCommands, moveSelection, type CommandItem} from "nbook/app/utils/command-palette";
import {describe, expect, it} from "vitest";

function item(id: string, label: string, group: string, hint?: string): CommandItem {
    return {id, label, group, hint};
}

const COMMANDS: CommandItem[] = [
    item("home", "打开书架", "前往", "打开项目选择器"),
    item("files", "写作", "前往"),
    item("plot", "剧情工作台", "前往"),
    item("focus", "专注写作", "外观", "Ctrl+Shift+F"),
    item("chrome", "界面观感", "外观", "已开启：简洁"),
    item("newChapter", "新建章节", "编辑"),
    item("lint", "Prose lint", "编辑", "扫 AI 味"),
];

describe("filterCommands", () => {
    it("空查询返回全部且保持调用方给的顺序（分组与常用度由调用方决定）", () => {
        expect(filterCommands(COMMANDS, "  ").map((c) => c.id)).toEqual(["home", "files", "plot", "focus", "chrome", "newChapter", "lint"]);
    });

    it("命中排序：标签前缀 > 标签包含 > 副标题/分组命中", () => {
        // "写作" 是 files 的前缀，也在 focus 的副标题「Ctrl+Shift+F」之外——注意 focus 标签是「专注写作」含「写作」
        const result = filterCommands(COMMANDS, "写作");
        expect(result.map((c) => c.id)).toEqual(["files", "focus"]);

        // 只出现在副标题/分组里的词也要能找到，但排在标签命中之后
        const byHint = filterCommands(COMMANDS, "简洁");
        expect(byHint.map((c) => c.id)).toEqual(["chrome"]);

        // 分组名也能搜到整组
        const byGroup = filterCommands(COMMANDS, "外观");
        expect(byGroup.map((c) => c.id)).toEqual(["focus", "chrome"]);
    });

    it("大小写不敏感（对拉丁标签与副标题都成立）", () => {
        expect(filterCommands(COMMANDS, "PROSE").map((c) => c.id)).toEqual(["lint"]);
        expect(filterCommands(COMMANDS, "prose").map((c) => c.id)).toEqual(["lint"]);
        // 副标题「Ctrl+Shift+F」用小写也能命中
        expect(filterCommands(COMMANDS, "ctrl+shift+f").map((c) => c.id)).toEqual(["focus"]);
    });

    it("中文副标题「扫 AI 味」能搜到「Prose lint」——中英混排界面里两边都要能找到", () => {
        expect(filterCommands(COMMANDS, "扫 AI 味").map((c) => c.id)).toEqual(["lint"]);
    });

    it("没有命中返回空数组", () => {
        expect(filterCommands(COMMANDS, "不存在的命令")).toEqual([]);
    });
});

describe("moveSelection", () => {
    it("向下走到底循环回第一项，向上走过头循环到最后一项", () => {
        expect(moveSelection(0, -1, 3)).toBe(2);
        expect(moveSelection(2, 1, 3)).toBe(0);
        expect(moveSelection(1, 1, 3)).toBe(2);
    });

    it("未选中（-1）时，向下取首项、向上取末项", () => {
        expect(moveSelection(-1, 1, 4)).toBe(0);
        expect(moveSelection(-1, -1, 4)).toBe(3);
    });

    it("结果为空时不产生选中项", () => {
        expect(moveSelection(-1, 1, 0)).toBe(-1);
        expect(moveSelection(2, 1, 0)).toBe(-1);
    });
});

describe("groupCommands", () => {
    it("按连续分组切段，保持原顺序（过滤后分组可能零散，不该被重新聚合打乱排序）", () => {
        const filtered = filterCommands(COMMANDS, "写作");
        expect(groupCommands(filtered).map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
            ["前往", ["files"]],
            ["外观", ["focus"]],
        ]);
    });

    it("同一分组的相邻项合并成一段", () => {
        expect(groupCommands(COMMANDS).map((g) => g.group)).toEqual(["前往", "外观", "编辑"]);
    });
});
