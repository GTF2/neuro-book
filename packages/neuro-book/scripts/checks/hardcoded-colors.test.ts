import {describe, expect, it} from "vitest";
import {
    compareAgainstBaseline,
    findColorHits,
    isExemptFile,
    loadBaseline,
    scanHardcodedColors,
    writeBaseline,
} from "./hardcoded-colors";

/**
 * UI token 护栏（可进 CI）。规则源自 `app/utils/theme/README.md` v2.1：
 * 业务组件禁止写固定 hex / rgb(a) / Tailwind 调色板类，文档登记的例外与测试断言除外。
 *
 * 「禁止新增」用 baseline 棘轮实现：只允许下降或持平。收敛某页后如要让基线收紧，
 * 运行 `bun packages/neuro-book/scripts/checks/hardcoded-colors.ts --update` 并核对 diff。
 */
describe("UI token 护栏：app/** 禁止新增硬编码颜色", () => {
    it("存量不超过 baseline（禁止新增）", () => {
        const {counts, hits} = scanHardcodedColors();

        if (process.env.UPDATE_HARDCODED_COLOR_BASELINE === "1") {
            writeBaseline(counts);
            return;
        }

        const baseline = loadBaseline();
        const {added, increased} = compareAgainstBaseline(counts, baseline);

        const describeFile = (file: string, count: number): string => {
            const samples = hits
                .filter((hit) => hit.file === file)
                .slice(0, 3)
                .map((hit) => `      ${hit.line}: ${hit.text}`)
                .join("\n");
            return `  ${file} → ${count} 处\n${samples}`;
        };

        const problems = [
            ...added.map((entry) => `新增文件出现硬编码颜色：\n${describeFile(entry.file, entry.count)}`),
            ...increased.map((entry) => `硬编码颜色比基线增加（${entry.baseline} → ${entry.count}）：\n${describeFile(entry.file, entry.count)}`),
        ];

        expect(
            problems,
            [
                "app/** 出现新增硬编码颜色（违反 app/utils/theme/README.md v2.1「禁止事项」）。",
                "请改用 36 个主题变量（如 text-[var(--text-main)] / bg-[var(--bg-input)]）。",
                "若确属文档登记的例外，把它加进 scripts/checks/hardcoded-colors.ts 的 EXCEPTION_PATHS 并同步更新文档；",
                "若是收敛某页后基线需要收紧，运行 bun packages/neuro-book/scripts/checks/hardcoded-colors.ts --update。",
                "",
                problems.join("\n\n"),
            ].join("\n"),
        ).toEqual([]);
    });

    it("放行清单只覆盖文档登记的例外", () => {
        expect(isExemptFile("utils/theme/theme-tokens.ts")).toBe(true);
        expect(isExemptFile("utils/theme/derive.ts")).toBe(true);
        expect(isExemptFile("components/common/JsonViewer.vue")).toBe(true);
        expect(isExemptFile("components/common/form/FormColorField.vue")).toBe(true);
        expect(isExemptFile("components/profile-template-editor/ProfileTemplateNodeView.vue")).toBe(true);
        expect(isExemptFile("components/novel-ide/plot/tree/plot-tree.types.ts")).toBe(true);
        expect(isExemptFile("styles/reference-chips.css")).toBe(true);
        expect(isExemptFile("utils/theme/hardcoded-colors.test.ts")).toBe(true);
        // 普通业务组件不在放行清单里。
        expect(isExemptFile("components/novel-ide/NovelPromptBar.vue")).toBe(false);
        expect(isExemptFile("components/novel-ide/plot/keyframe/PlotKeyframeLedgerTab.vue")).toBe(false);
        expect(isExemptFile("pages/index.vue")).toBe(false);
    });
});

describe("硬编码颜色检测器", () => {
    it("命中 hex / rgb(a) / hsl(a) / Tailwind 调色板类", () => {
        expect(findColorHits("background: #c42b1c;")).toHaveLength(1);
        expect(findColorHits("box-shadow: 0 0 0 rgba(0, 0, 0, 0.4);")).toHaveLength(1);
        expect(findColorHits("color: hsl(210 40% 98%);")).toHaveLength(1);
        expect(findColorHits('class="bg-gray-100 text-amber-700 border-rose-500/30"')).toHaveLength(3);
        expect(findColorHits('class="bg-black/50 shadow-black/10 bg-white/20"')).toHaveLength(3);
    });

    it("不误伤 HTML 数字实体、主题变量与 color-mix(… srgb …)", () => {
        expect(findColorHits('.replace(/\'/g, "&#039;");')).toHaveLength(0);
        expect(findColorHits('.replace(/&#x27;/g, "\'");')).toHaveLength(0);
        expect(findColorHits('class="text-[var(--text-main)] bg-[var(--bg-input)]"')).toHaveLength(0);
        expect(findColorHits("box-shadow: 0 12px 32px color-mix(in srgb, var(--shadow-color) 14%, transparent);")).toHaveLength(0);
        expect(findColorHits('class="text-[11px] px-2 py-0.5"')).toHaveLength(0);
    });

    it("逐行报告行号与命中片段", () => {
        const hits = findColorHits(["line one", "color: #ffffff;"].join("\n"));
        expect(hits).toEqual([{line: 2, text: "#ffffff", kind: "hex"}]);
    });
});
