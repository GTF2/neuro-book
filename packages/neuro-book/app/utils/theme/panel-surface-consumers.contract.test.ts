import {readFileSync, readdirSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

/**
 * `--panel-surface` 这个角色 token 的消费者契约。
 *
 * ── 它守的是什么 ──────────────────────────────────────────────────────
 *
 * 简洁档能让「导航 chrome」退场，靠的就是把面板底色从 `--bg-panel` 换成角色 token
 * `--panel-surface`（两者默认同值，所以换过去**观感零变化**，只是变得可被档位控制）。
 * 这件事没有任何类型系统能保证——换不换是一个**设计判断**，所以只能靠契约测试守。
 *
 * ── 判断标准（唯一一条）──────────────────────────────────────────────
 *
 * **「让你走到某处」的面板用 `--panel-surface`；「让你读/写」的面板用 `--bg-panel`。**
 *
 * 落到实际形态上：左侧、带 `border-r`、标题 + 列表（常常还有搜索框）的是导航；
 * 检查器 / 详情 / 对话面 / 编辑面是内容。**位置不是判据**——两个检查器在右侧，
 * 但它们是内容，所以照样用 `--bg-panel`。
 *
 * ── 覆盖范围与它的边界（写在明处）────────────────────────────────────
 *
 * · 只扫 `app/components/**\/*.vue`。`app/pages/*.preview.vue` 是开发用演示页，不在产品面内。
 * · 只拦「悄悄采用」这一个方向：内容面若误用了 `--panel-surface`，简洁档会把该保持亮面的
 *   区域一起退掉，而且**看起来只是"档位效果更强"**，极难归因——所以这条必须守死。
 * · **不拦反向**：新面板默认用 `--bg-panel` 是安全默认（显形而非退场）。漏归类只会让简洁档
 *   少覆盖一处，不会产生错误观感，不值得为它引入脆弱的标签解析。
 */

const appRoot = fileURLToPath(new URL("../../", import.meta.url));

/** 导航 chrome：必须用角色 token，简洁档才管得到。 */
const navShells = [
    // 主写作界面的左栏工具面板——简洁档在这里第一次生效
    "components/novel-ide/NovelIdeToolPanel.vue",
    // 剧情面板外壳（"剧情大纲" 列表）
    "components/novel-ide/plot/thread-panel/PlotThreadPanelShell.vue",
    // 剧情工作台侧栏（搜索框 + 结果列表）
    "components/novel-ide/plot/workbench/PlotWorkbenchSidebar.vue",
    // 承诺账本（"承诺账本(N)" 列表）
    "components/novel-ide/plot/planning/PlotPromiseLedgerTab.vue",
    // RAG 检查器的 Subject 列表（"共 N 个"）
    "components/novel-ide/rag/NovelRagInspectorSidebar.vue",
];

/** 内容面：**刻意**不用角色 token。注释里写清为什么不换。 */
const contentSurfaces = {
    // 你在里面读回复、写指令；和稿面同属「纸」。两边都退会得到对称噪声，反而分不出主次。
    "components/novel-ide/agent/AgentChatSurface.vue": "Agent 对话面",
    // 源码模式编辑器——写作面本身。
    "components/markdown-studio/MarkdownSourceEditor.vue": "源码编辑器",
    // 检查器是当前对象的属性/元数据视图，属于「读」。
    "components/novel-ide/plot/PlotInspector.vue": "剧情检查器",
    "components/novel-ide/plot/workbench/PlotWorkbenchInspector.vue": "剧情工作台检查器",
    "components/novel-ide/rag/NovelRagInspectorDetail.vue": "RAG 条目详情",
    // 设置对话框内的分区：对话框本身就是一个独立的内容面，其内部分区不该单独退场。
    "components/novel-ide/settings/AgentProfileNavList.vue": "设置内导航列表",
    "components/novel-ide/settings/NovelIdeModelSettingsPanel.vue": "模型设置面板",
    // 会话树位于模态对话框内，同上。
    "components/novel-ide/agent/AgentSessionTreeDialog.vue": "会话树对话框",
};

const PANEL_SURFACE = "var(--panel-surface)";

/** 递归收集 app/components 下的 .vue 文件（相对 app/ 的 POSIX 路径）。 */
function collectVueFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectVueFiles(full));
            continue;
        }
        if (entry.endsWith(".vue")) {
            out.push(path.relative(appRoot, full).split(path.sep).join("/"));
        }
    }
    return out;
}

const vueFiles = collectVueFiles(path.join(appRoot, "components"));
const reads = (file: string): string => readFileSync(path.join(appRoot, file), "utf8");

describe("面板角色 token 的消费者契约", () => {
    it("导航 chrome 用 --panel-surface，简洁档才退得动它们", () => {
        const missing = navShells.filter((file) => !reads(file).includes(PANEL_SURFACE));

        expect(missing, `以下导航面板没接角色 token，简洁档会漏掉它们：\n${missing.join("\n")}`).toEqual([]);
    });

    it("内容面不许用 --panel-surface", () => {
        const wrong = Object.keys(contentSurfaces).filter((file) => reads(file).includes(PANEL_SURFACE));

        // 误用的后果不是"报错"，而是简洁档把该保持亮面的区域一起退掉，
        // 现象只是"档位效果比预期强"——所以这条必须由测试守，靠人眼看不住。
        expect(wrong, `以下内容面误用了角色 token，简洁档会连它们一起退掉：\n${wrong.join("\n")}`).toEqual([]);
    });

    it("没有未经归类就采用角色 token 的组件", () => {
        const listed = new Set(navShells);
        const unclassified = vueFiles.filter((file) => reads(file).includes(PANEL_SURFACE) && !listed.has(file));

        expect(
            unclassified,
            "以下组件用了 --panel-surface 但没归类。请判断它是「让你走到某处」还是「让你读/写」，"
            + `然后加进 navShells 或 contentSurfaces（并把理由写进注释）：\n${unclassified.join("\n")}`,
        ).toEqual([]);
    });

    it("归类清单里的文件都真实存在", () => {
        // 文件被改名或删除时，前三条会因为"读不到内容"而**静默通过**（读出来是空串），
        // 所以这里必须显式确认路径有效。
        const known = new Set(vueFiles);
        const stale = [...navShells, ...Object.keys(contentSurfaces)].filter((file) => !known.has(file));

        expect(stale, `归类清单里有已不存在（或已改名）的文件：\n${stale.join("\n")}`).toEqual([]);
    });
});
