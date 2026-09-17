import {describe, expect, it} from "vitest";
import {
    createWorkbenchActivityItems,
    resolveActivityBarSecondaryItems,
    resolveTitleBarMenuPresentation,
} from "nbook/app/utils/workbench-chrome";

describe("Workbench Chrome", () => {
    it("keeps the full menu only when the title bar still has a usable drag surface", () => {
        expect(resolveTitleBarMenuPresentation({
            availableWidth: 760,
            fullMenuWidth: 244,
            titleWidth: 180,
            controlsWidth: 168,
        })).toBe("full");

        expect(resolveTitleBarMenuPresentation({
            availableWidth: 640,
            fullMenuWidth: 244,
            titleWidth: 180,
            controlsWidth: 168,
        })).toBe("compact");
    });

    it("keeps the desktop activity bar focused on project tools and moves global navigation into the title bar", () => {
        const bookshelf = createWorkbenchActivityItems({
            desktopAvailable: true,
            surfaceActive: false,
            userAssetsMode: false,
        });

        expect(bookshelf.primary.map((item) => [item.id, item.disabled])).toEqual([
            ["files", true],
            ["characters", true],
            ["plot", true],
        ]);
        expect(bookshelf.secondary.map((item) => [item.id, item.disabled])).toEqual([
            ["trace", true],
            ["history", true],
            // world 是配置面（配置一次长期不动），所以不进常驻区；顺序即溢出优先级，放最后
            ["world", true],
        ]);
        expect(bookshelf.agentPanel).toBeNull();
        expect(bookshelf.footer.map((item) => item.id)).toEqual(["account", "settings"]);

        const browserWorkspace = createWorkbenchActivityItems({
            desktopAvailable: false,
            surfaceActive: true,
            userAssetsMode: false,
        });
        expect(browserWorkspace.primary[0]).toEqual({
            id: "home",
            disabled: false,
        });
        expect(browserWorkspace.agentPanel).toEqual({
            id: "agent-panel",
            disabled: false,
        });
    });

    it("折叠次要入口时为 More 保留完整按钮位", () => {
        const items = createWorkbenchActivityItems({
            desktopAvailable: true,
            surfaceActive: true,
            userAssetsMode: false,
        }).secondary;

        expect(resolveActivityBarSecondaryItems(items, {
            availableHeight: 176,
            fixedHeight: 0,
            itemHeight: 44,
            moreButtonHeight: 44,
        })).toEqual({
            visible: items,
            overflow: [],
        });

        /*
         * 88 = 两个按钮位。容量算出 2 项，但放不下全部次要入口，所以必须先为 More 留一个
         * 完整按钮位，实际只能显示 1 项——这条用例的意图正是验证那个「先留位」的次序。
         *
         * 原值是 132：那时容量（3）已大于条目数（2），走的是「全部可见」分支，
         * 根本没经过留位逻辑，等于用例标题写的事没测。次要入口增加到 3 项之后这个洞才显形。
         */
        expect(resolveActivityBarSecondaryItems(items, {
            availableHeight: 88,
            fixedHeight: 0,
            itemHeight: 44,
            moreButtonHeight: 44,
        })).toEqual({
            visible: items.slice(0, 1),
            overflow: items.slice(1),
        });

        expect(resolveActivityBarSecondaryItems(items, {
            availableHeight: 44,
            fixedHeight: 0,
            itemHeight: 44,
            moreButtonHeight: 44,
        })).toEqual({
            visible: [],
            overflow: items,
        });
    });
});
