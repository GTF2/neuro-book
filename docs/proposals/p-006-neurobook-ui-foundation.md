# NeuroBook UI Foundation

状态：reviewing

关联 Issue：[#191](https://github.com/notnotype/neuro-book/issues/191)

本 Proposal 只把已批准的 Issue #191 UI Foundation 方案整理成长期决策记录，不在本 Task 实现产品代码、Spec 或依赖切换。文中明确区分当前仓库事实与批准后的目标状态；“目标”不表示该项已经完成。

## 问题

NeuroBook 主应用的非页面 SFC 仍由应用内的 common、编辑器和领域组件分别维护。共享组件库 `@notnotype/nb-ui` 已有公共组件、token、主题包和独立 playground，但主应用尚未完成一次明确的接入边界：当前应用没有把 nb-ui 作为显式 workspace 依赖，没有在 Nuxt 配置中接入其 CSS，也没有用一条可审查的导入路径替换本地等价 primitive。结果是组件 props/emits、浮层、表单、通知、可调整面板和主题职责容易在两个地方继续分叉。

主题问题与组件问题相互放大。当前应用的 `ui.theme`、`ui.customThemes`、主题快照和局部主题宿主同时承担颜色、持久化、首帧和编辑器明暗选择；nb-ui 则把“颜色配色（colorway）”与“形状、密度、装饰和组件覆盖（theme）”分成两个轴。没有统一的迁移合同时，任何局部切换都可能留下第二份颜色 authority、重复的变量写入或失效的旧入口。

开发态也缺少与产品入口分开的唯一组件 Lab。仓库有 14 个 `*.preview.vue` 页面，当前尚无统一的 Lab scene 或正式 Product surface 合同来登记它们的场景去向。若继续把 preview 当作长期入口，组件迁移无法证明每个场景去向，也无法在删除页面前证明正式页面行为没有下降。

Issue #191 因此需要一次有明确 owner、可逆批次和证据门禁的底座迁移：先冻结组件与 preview 场景合同，再接入 nb-ui、收敛主题 authority、建立仅 Source Dev 的 `/lab`，逐批把组件解耦到真实页面或 Lab，最后在 14 个场景逐项迁移并有证据后删除 preview 路由。Workbench/View Host、View Registry、Editor Split 和插件运行时不属于这次问题。

## 目标与非目标

### 目标

1. 将 `@notnotype/nb-ui` 定为 NeuroBook 主应用的共享 UI 基座，采用显式导入和清晰的包边界，不引入自动注册碰撞。
2. 记录并执行已批准的许可证决策：nb-ui 的目标许可证为 `AGPL-3.0-only`，允许 Product 分发；版本保持 `0.2.0-alpha.0`，本 Proposal 不发布包。
3. 将公开配色偏好收敛为 `system | nbook-light | nbook-dark`。目标 `nbook` 配色的变量值与 macOS 对应配色逐项相等，但 Product 只安装并显式使用 `nbookTheme`，不安装 `macosTheme`。
4. 让 Global Config 成为唯一持久化配色 authority；未认证用户和 `system` 首帧无 FOUC，认证用户从配置恢复显式配色时最多允许一次首帧后的纠正。
5. 建立仅 Source Dev 的 NeuroBook Component Lab：提供 catalog、registry slices、deterministic fixtures、视口/配色切换、事件日志、computed token、ARIA 和依赖检查；Product 构建不包含 Lab 路由或 Lab 资产。
6. 以组件合同和真实页面为验收边界，迁移普通 primitive、表单、编辑器、Plot、World Engine、Agent/Workflow 等已列批次，组件解耦后删除旧 controller/import/style 入口，不加 alias、adapter 或静默 fallback。
7. 冻结 14 个 preview 源路径及每页的 scenario ID/kind；每个 scenario 在删除源页面前进入唯一正确的 Lab scene 或正式 Product surface，并附相应证据。
8. 为后续三个 capability 提供唯一决策依据：新建 `ui.component-contracts` 和 `ui.component-lab` 两份 `planned` Spec，并原地更新既有 `theme.system`；Proposal 被接受不等同于 Spec 已创建、代码已实现或 Product 已验收。

### 非目标

- 本 Proposal 不修改业务源码、测试源码、配置、依赖、lockfile、生成物、Issue/Project 元数据或任何运行时数据；实现工作由 Issue #191 的后续扁平 Task 完成。
- 不在本次方案中实现许可证切换、nbook 数值对齐、主题 clean cutover、Lab、组件迁移或 preview 删除；这些是目标实现顺序，不是当前已完成事实。
- 不建立 Workbench/View Host、View Registry、Editor Split 或插件运行时；这些能力不在 Issue #191。
- 不把 `macosTheme` 安装到 Product，不把 macOS 主题作为 Product 的运行时依赖或第二套默认主题。
- 不保留 `ui.theme` / `ui.customThemes` 作为新的并行颜色 authority，不用 cookie 或 localStorage 镜像 Global Config，也不保留旧 alias、兼容分支或隐式回退来掩盖 clean cutover。
- 不将 Lab 当作 Product 功能、正式页面替代品或真实业务数据入口；Lab fixture 不发真实网络请求、不读 Pinia 或 storage。
- 不把 PM claim、label、planned 状态、CI 通过或 Reviewer 建议解释为远端 Issue/Project 写入、push、PR、合并、发布、部署、浏览器人工验收或真实 Provider/Model 授权。

## 当前行为与证据

以下是本 Proposal 在当前 checkout 读取到的事实。Task context 记录的设计基线为 `9e54e5d3863d3505ce26db149164e95d60950df6`；本设计 worktree 当前 checkout 为已核对过分支合同的后续提交。目标状态均未从这些事实倒推出“已完成”。

| 当前事实 | 证据 | 对方案的影响 |
| --- | --- | --- |
| nb-ui 当前版本是 `0.2.0-alpha.0`，包许可证仍为 `PolyForm-Noncommercial-1.0.0`。 | [`packages/nb-ui/package.json`](../../packages/nb-ui/package.json) 第 1–18 行 | AGPL 是已批准的目标变更，不得在本 Proposal 或当前状态中写成已切换。 |
| nb-ui 已提供 `nbook` 与 `macos` 主题包、组件/组合式 API、`styles.css` 和纯数据 manifest 结构；手动导入与 Nuxt module 都是库的公开能力。 | [`packages/nb-ui/README.md`](../../packages/nb-ui/README.md)、[`packages/nb-ui/themes/nbook/index.ts`](../../packages/nb-ui/themes/nbook/index.ts)、[`packages/nb-ui/themes/macos/index.ts`](../../packages/nb-ui/themes/macos/index.ts) | 主应用选择显式导入；Nuxt module 是可用库能力，但不作为 Product 接入方式。 |
| 当前 nbook 配色仍与 macOS 配色不逐项相等。例如 nbook light 使用 `--bg-main: #e3e4e6`、`--bg-panel: #fffcf5`，nbook dark 使用 `--bg-main: #1a1b1e`；macOS light 使用 `#f6f8fa`/`#ffffff`，macOS dark 使用 `#1c1c1e`/`#2c2c2e`。 | [`packages/nb-ui/themes/nbook/colorways.ts`](../../packages/nb-ui/themes/nbook/colorways.ts)、[`packages/nb-ui/themes/macos/colorways.ts`](../../packages/nb-ui/themes/macos/colorways.ts) | “nbook 与 macOS 深相等”是 B 批次的未来验收条件，不是当前状态；当前 PolyForm 和数值差异必须在实现证据中明确。 |
| 主应用 package.json 当前没有 `@notnotype/nb-ui` 依赖。 | [`packages/neuro-book/package.json`](../../packages/neuro-book/package.json) 的 dependencies | 目标接入须显式加入 workspace 依赖并由后续获授权的实现 Task 更新 lockfile；本 Proposal 不修改它。 |
| Nuxt 配置当前自动扫描应用内组件目录；CSS 先加载 reset 和应用主题变量；modules 中没有 nb-ui module，CSS 中也没有 nb-ui `styles.css`。 | [`packages/neuro-book/nuxt.config.ts`](../../packages/neuro-book/nuxt.config.ts) 的 `components`、`css`、`modules` | 目标顺序是 CSS reset 后、领域 CSS 前加入 nb-ui 样式，依赖 build.transpile；仍不启用 nb-ui Nuxt module。 |
| 现有 `theme.system` Spec 是 `implemented`，正文仍描述 8 套旧主题、`ui.theme`、`ui.customThemes`、主题 snapshot 与 `sepia` fallback。 | [`docs/specs/theme/system.md`](../specs/theme/system.md)、[`packages/neuro-book/app/utils/theme/README.md`](../../packages/neuro-book/app/utils/theme/README.md) | C 批次必须原地把同一 `theme.system` 改为新的 colorway/config 合同并在证据闭合后晋升；不能新建平行的 theme Spec。 |
| 当前应用代码仍有 `activeThemeId`、`customThemes`、`themeVarsSnapshot`、`useIdeTheme()`、`ui.theme` 和本地主题宿主调用点。 | [`packages/neuro-book/app/stores/novel-ide.ts`](../../packages/neuro-book/app/stores/novel-ide.ts)、[`packages/neuro-book/app/composables/useIdeTheme.ts`](../../packages/neuro-book/app/composables/useIdeTheme.ts)、[`packages/neuro-book/app/pages/index.vue`](../../packages/neuro-book/app/pages/index.vue)、[`packages/neuro-book/app/pages/login.vue`](../../packages/neuro-book/app/pages/login.vue) | 目标是一次 clean cutover：由 C 迁移全部消费者、删除旧主题写入职责，并保留 `novel-ide-theme` 仅作为浮层/teleport 结构根而不是颜色 authority。 |
| 当前 app/pages 中存在精确的 14 个 preview 源文件，且它们并非统一的 Lab scene 或正式 surface 合同。 | `workflow.preview.vue`、`world-engine.workbench-preview.vue`、`world-engine.preview.vue`、`tsx-profile-editor.preview.vue`、`subject-state-viewer.preview.vue`、`structured-text-editor.preview.vue`、`plot.preview.vue`、`plot-workbench.preview.vue`、`plot-tree.preview.vue`、`plot-timeline.preview.vue`、`model-settings.preview.vue`、`plot-thread.preview.vue`、`dnd.preview.vue`、`diff-workbench.preview.vue`，均位于 [`packages/neuro-book/app/pages/`](../../packages/neuro-book/app/pages/) | A 必须先冻结逐字路径、scenario ID 和 kind；P 只能在逐项 destination/evidence 闭合后删除源文件。 |
| 当前根 Spec 注册表只有既有 Theme 等条目，没有 `ui.component-contracts` 或 `ui.component-lab` 的已登记正文。 | [`docs/specs/README.md`](../specs/README.md) 的已实现/待实现注册表 | Proposal accepted 后由 Leader 创建两份 `planned` Spec；Proposal 本身不替代 Spec。 |
| nb-ui 的当前工程规范要求公共组件有可观察的 props/emits/slots/a11y/边界合同，并要求 fixtures、真实 playground 和窄屏验证。 | [`packages/nb-ui/docs/ui-development-spec.md`](../../packages/nb-ui/docs/ui-development-spec.md)、[`packages/nb-ui/docs/design-language.md`](../../packages/nb-ui/docs/design-language.md) | 后续 component Task 必须以行为和真实 surface 证据验收，不能以 class 快照或 Lab 通过替代产品验收。 |

### 已批准但尚未完成的事实边界

- 开发者已批准完整 UI Foundation 目标，包括 AGPL-3.0-only 与 Product 分发、nbook 公开配色、显式 nb-ui 接入、唯一 Global Config authority、Source Dev-only Lab、14 个 preview 迁移后删除，以及不纳入 Workbench/View Host 等边界。
- 当前 nb-ui 仍为 PolyForm，当前 nbook colorways 仍与 macOS 不深相等；后续 B 需要真实修改与逐项测试，p-006 不提前宣称完成。
- p-006 accepted 只表示长期方向已决定，不能替代 `ui.component-contracts` / `ui.component-lab` planned Spec、`theme.system` 的 planned 切换、Issue 子批次 claim、实现 Task 或任何远端授权。

## 方案、备选方案和取舍

### 方案一：显式接入 nb-ui，保持主题与配色两轴

#### 1. nb-ui 包与主应用接入

B 批次将 `packages/nb-ui/package.json` 的许可证目标改为 `AGPL-3.0-only`，用仓库 AGPL-3.0-only 正文替换包内许可证文件，版本继续为 `0.2.0-alpha.0`，不发布。主应用增加精确 workspace 依赖，获得依赖安装授权后才更新 lockfile；Nuxt CSS 顺序为 reset → `@notnotype/nb-ui/styles.css` → 领域样式，必要时为 linked package 加入 transpile。

主应用只从 nb-ui 的公开 `components`、`composables`、`colorway`、`theme`、`themes/nbook` 和纯数据 `themes/nbook/colorways` 入口显式导入；不创建 re-export、alias 或 adapter。主应用不启用 `@notnotype/nb-ui/nuxt`，因此不会把库的自动组件/组合式注册隐式带入 Product。首个消费者固定为 `JsonViewer.vue` 的六个图标按钮：逐项使用公开 `IconButton`，保持 title、disabled、click、iconClass、aria-label、外部 props/emits 和 JSON 编辑行为；若公开合同不能覆盖其中一项，B 停止迁移并先修 nb-ui 公共合同，不在应用内补例外。

许可证切换和依赖接入是工程目标，不是当前 p-006 的执行内容；后续实现仍须按“合同 → 授权安装 → nb-ui focused tests/typecheck/build:css → NeuroBook typecheck/CSS 会合 → 真实 JsonViewer surface”顺序推进。

#### 2. nbook colorway 与 Global Config

公开偏好类型固定为：

```ts
type UiColorwayPreference = "system" | "nbook-light" | "nbook-dark";
```

其中 `system` 是根据操作系统外观实时解析的用户偏好，`nbook-light` 与 `nbook-dark` 是公开 nbook 配色 ID。B 批次目标是让 nbook 两套 33 个 `NbColorwayVars` 与 macOS 对应两套逐项深相等；在此之前，当前差异继续作为未完成事实。Product 只安装 `nbookTheme`，不安装、重导出或依赖 `macosTheme`；macOS 主题保留在 nb-ui 中作为参考实现，不成为 Product 的运行时依赖。

C 批次把 `UiConfigDtoSchema`、内联 bootstrap DTO、Global Config schema 和 `EffectiveConfig["ui"]` 的持久化字段收敛为 `colorway`，默认值为 `system`，registry 只登记 `ui.colorway`（`global`、`hot`、`replace`）。删除 `ui.theme`、`ui.customThemes`、`CustomThemeDtoSchema` 以及只服务旧自定义主题的解析器和设置界面；normalizer 对旧输入不建立第二套运行时 authority，下一次保存的 `ui` 只含 `colorway` 与 `costCurrency`。这项 clean cutover 不承诺保留旧自定义主题编辑/导入导出行为。

运行时分为三个层次：

1. `resolveUiColorway(preference, prefersDark)` 只解析公开三值。`system` 使用 `matchMedia` 的实时结果；浏览器不可用时明确回退 `nbook-dark`；显式 `nbook-light` / `nbook-dark` 不响应系统变化。
2. 由纯数据 colorways 生成的 pre-hydration 脚本在 SPA bundle 前只给 `documentElement` 应用 system 解析结果，body 首帧继承。未认证或 system 用户首帧必须无 FOUC；认证用户保存显式值时允许先绘 system、恢复 session/config 后恰好一次纠正，不允许循环或竞态重绘。
3. `useColorwayManager()` 维护唯一媒体订阅和幂等 bootstrap。未认证/login 保持 system；认证就绪后从 Global Config 的 user-assets 读取 `colorway`；读取失败保持 system。并发 bootstrap 共用 promise，`setColorway` 使用 revision guard，保存失败恢复上一偏好并通知。

Global Config 是唯一持久化 authority：不建立 cookie/localStorage 镜像，不让 index 或任一组件另写主题快照。Novel IDE store 只维护 `activeColorwayPreference`、`activeColorwayId`、`activeColorwayAppearance` 等当前投影字段；NotificationViewport 直接继承 body 的 nbook vars，并按当前 appearance 选择 tone。`.novel-ide-theme` 字面 class 可保留为现有浮层 teleport/closest 的结构根，但 `IDE_THEME_HOST_CLASS` 重命名为 `IDE_OVERLAY_HOST_CLASS` 后不再承担颜色写入。Monaco、Diff、Agent snapshot/patch 和设置面板都切换到 colorway/appearance 合同；Agent `ide.colorway` 只接受 `system | nbook-light | nbook-dark`。

现有 `theme.system` 的 Spec 必须在 C 开始时原地改为上述目标合同并标为 `planned`，C 的实现、focused tests、首帧和真实 surface 证据闭合后才恢复 `implemented`。这一过程不创建第二个 theme Spec。

#### 3. 仅 Source Dev 的 NeuroBook Component Lab

D 批次新建并由 `nuxt.config.ts` 显式导入 `modules/neuro-book-lab.ts`。module 在 dev 环境只注册 `/lab` → `dev/lab/pages/lab.vue`；Product 分支不注册 `/lab`，且 Product 构建的 client/Nitro graph、module IDs、imports 和文本都不得包含 Lab 路径、sentinel、fixture 名称或 dev/lab 资产。Product builder 用受控 scratch root、operation identity、source digest 和 sidecar 逐项验证，不以“压缩后字符串搜不到”代替模块图验证。

A 批次独占 catalog aggregate/types，D 批次独占 `registry.ts`、destination aggregate、module、client/Nitro 证据和 verifier；E–O 只能修改自己的 slice。catalog 的公开类型固定为：

```ts
export type NeuroBookComponentTier = "presentational" | "composite" | "workspace";
export type NeuroBookComponentMaturity = "experimental" | "supported";
export type NeuroBookComponentStatus = "pending" | "ready";
export type NeuroBookComponentDependency = "api" | "pinia" | "storage";

export type NeuroBookComponentCatalogEntry = {
    id: string;
    source: `nbook/app/components/${string}.vue`;
    label: string;
    group: "common" | "editor" | "workspace" | "settings" | "plot" | "world-engine" | "agent" | "workflow" | "profile" | "experimental";
    parentId: string | null;
    tier: NeuroBookComponentTier;
    maturity: NeuroBookComponentMaturity;
    status: NeuroBookComponentStatus;
    description: string;
    dependencies: readonly NeuroBookComponentDependency[];
    blockingReason?: string;
};
```

每个 `app/components/**/*.vue`（页面、app root、dev/lab 除外）在 aggregate 中恰好出现一次；id 唯一，parent 存在且无环，ready 必须有 fixture，pending 必须有 blockingReason 且不渲染。workspace 组件的 API/Pinia/storage 副作用只能经 typed port；fixture 可有 deterministic mock 数据、时钟和 typed mock port，但不发真实网络请求、不读 Pinia 或 storage。首个 ready 产品特有条目为 `ReferenceChip`，继续由 `reference-chips.css` 管理类别语义外观。

Lab 运行合同固定为：

```ts
export type NeuroBookLabViewportId = "responsive" | "phone" | "tablet";

export type NeuroBookLabControl = {
    id: string;
    label: string;
    type: "boolean" | "text" | "number" | "select";
    defaultValue?: string | number | boolean;
    options?: readonly {label: string; value: string}[];
};

export type NeuroBookLabScene = {
    id: string;
    label: string;
    fixture: Component;
    controls: readonly NeuroBookLabControl[];
    targetSelector: string;
    events: readonly string[];
};
```

`/lab` 为三栏仪器界面：左栏可搜索组件树及 ready/pending 计数，中栏选择 scene、`responsive | phone | tablet` 和 `nbook-light | nbook-dark`，右栏显示 controls、最多 100 条事件、层级/依赖、computed token 与 ARIA。phone 固定 `390×844`，tablet 固定 `768×1024`；不提供独立 theme selector。URL 真相源固定为：

```text
/lab?component=<id>&scene=<id>&viewport=responsive|phone|tablet&colorway=nbook-light|nbook-dark
```

非法 query 值 replace 为 catalog 首项、scene 默认值、responsive 和当前有效 nbook 配色；刷新恢复，Back 不返回非法 URL。Lab stage 独立 `applyColorway`，Lab chrome 继承 app 配色；Lab 不调用 `setColorway`、Config API、Pinia 或 storage，query 也不修改 Global Config。fixture 通过 `lab-event` 报告交互，并在挂载/场景切换后触发 `rendered` 以刷新 inspector。
每个可展示 fixture 的核心交互节点还必须绑定 `id="nb-lab-target"`，供 inspector 定位和高亮；组件目录与 registry slice 的职责边界保持唯一，不能由 D 或后续批次另建第二份 catalog 真相源。

#### 4. 组件解耦与真实 surface

A 冻结 catalog 和 preview baseline 后，每个子批次从自己的 pending slice 读取全部 SFC；先用 LSP references 确认父组件、页面、动态组件和测试调用方，再按 `presentational | composite | workspace` 分类。解耦只移动 API、Pinia、storage、Project/Session generation、轮询、取消和持久化到页面 host、领域 controller/composable 或 typed port；SFC 保留瞬时 UI 状态，受控值使用现有 `modelValue`/`update:modelValue` 或具名 v-model，不制造第二 authority。

每个组件必须使用 nb-ui 公共 primitive 和 token，补齐 deterministic fixture、default/loading/empty/error/disabled/readonly/invalid、长文本和 `390px` 等适用状态，且在正式页面或 Workbench 通过真实 port 验证。Lab 通过不能替代真实 surface；旧 controller 片段、旧 import、旧样式和无用 mock 在真实行为证据闭合后删除。超过 800 行的 `AgentChatSurface.vue`、`WorldEngineWorkbenchDialog.vue`、`ProfileTemplateVisualEditor.vue` 等必须按 controller/composable + view SFC + 子组件拆解，不以 Facade 隐藏行数，也不改变路由、authority、保存/取消/错误语义。

批次与依赖固定如下：

| 顺序 | 子批次 | 允许范围 | 依赖 |
| --- | --- | --- | --- |
| A | component contracts and catalog baseline | accepted p-006、两份 planned Spec、frontend standard、全部待登记 SFC、14 页 scenario baseline 与静态测试 | A claimed、Spec/Git 门禁闭合 |
| B | adopt nb-ui package and license decision | AGPL 元数据、nbook 数值、纯数据 colorways export、workspace/CSS/transpile、JsonViewer 六按钮 | A |
| C | cut over nbook theme and nbook colorways | config/store/settings/client variable、首帧 bootstrap、旧主题删除、`theme.system` 同步 | B |
| D | add dev-only NeuroBook component lab | module、dev/lab 聚合与壳、Nuxt config、Product graph 排除、URL/inspector、ReferenceChip | A、B、C |
| E | migrate common primitives and product chips | common 顶层、`dnd-test/**` experimental 组件/fixtures、notification/resizable | D |
| F | decouple forms, low-code forms and diff | `common/form/**`、`common/low-code-form/**`、`common/diff/**` | E |
| G | decouple Markdown Studio components | `components/markdown-studio/**` | F |
| H | decouple profile template editor components | `components/profile-template-editor/**` | F |
| I | decouple shell/workspace/project/RAG/history/jobs | novel-ide 壳、`workspace/**`、`rag/**`、`history/**`、`jobs/**`、`ai/**`、`profile/**` | E、G |
| J | decouple settings and account surfaces | settings、`NovelIdeSettingsDialog.vue`、账户/Admin；C 已删除旧 theme 编辑器 | C、E |
| K | decouple Plot views | Plot 顶层 view、`tree/**`、`timeline/**`、`thread-panel/**` | D、E |
| L | decouple Plot workbench and planning | `plot/workbench/**`、`planning/**`、`chapter-panel/**`、`NovelPlotPanel.vue` | K |
| M | decouple World Engine editors and inspectors | 叶子 editor/view、`workbench-preview/**` 解耦及 deterministic data；不改 N catalog/registry | D、E |
| N | decouple World Engine workbench host | host/API ports、正式入口、workbench-preview rename、N slice 与 imports | M、I |
| O | decouple Agent and Workflow surfaces | agent、workflow-preview、Composer 正式 Workflow Dialog/API ports；不新增 `/workflow` | D、E、I |
| P | retire preview routes and close catalog | 14 个 preview 页面清退、pending=0、全域 browser/Product 验收 | F–O |

M 可串行修改 N-owned 的 World Engine SFC 以解耦，但不修改 N 的 catalog/registry 或声称其 ready；N 负责最终 rename、host imports、注册和 scenario 证据。每一批只有在自己的 catalog 条目全部 ready、真实 surface 行为不低于迁移前、旧引用为零、focused tests/typecheck/browser smoke 通过后才可收口；缺任一项就保持 pending，不把 required 检查降级为 notRun。

#### 5. Preview 场景迁移与删除

A 冻结以下 14 个源路径、每页现有 scenario ID 和 `demo-only | product-behavior` kind；后续 E–O 只能填写 destination/evidence，不能增删或重分类。以下是批准方案确定的 owner 方向；一个页面若同时含两种场景，按冻结的 scenario kind 拆分处理，而不是把整页武断归为一种类型。

| 源页面 | 目标 owner 与正式去向 | 场景验收下限 |
| --- | --- | --- |
| `workflow.preview.vue` | O：Agent Composer 的 Workflow Dialog；demo 场景进入 Lab | product-behavior 必须有正式 Dialog/evidence，demo-only 必须有 Lab scene |
| `world-engine.workbench-preview.vue` | N：World Engine Workbench Host 正式入口；完成正式 rename 后清退旧 preview | product-behavior 必须有 Workbench evidence |
| `world-engine.preview.vue` | N：World Engine workbench-preview 两页的 destination 保持 N-owned pending；M 仅解耦所需的 mock/data 并提供 M-owned deterministic fixture | 逐场景登记 N 的 Lab 或 formalSurface/evidence；N 最终完成两页 scenario 证据，M 的 mock/data 不代表正式流完成 |
| `tsx-profile-editor.preview.vue` | H：Profile Template Editor 的 Lab fixture与正式 editor surface | demo-only 进入 Lab，product-behavior 登记正式 surface |
| `subject-state-viewer.preview.vue` | M：Subject State viewer 的 deterministic Lab fixture 与既有 API surface | 不把 Lab 通过当作正式 API 行为证据 |
| `structured-text-editor.preview.vue` | F：StructuredTextEditor Lab fixture与现有消费者 | 正式消费者证据与适用 Lab 场景均需闭合 |
| `plot.preview.vue` | K/L：Plot 正式 panel 与对应 Lab scene | 五个 Plot 页面逐 scenario 映射，不能留在 preview |
| `plot-workbench.preview.vue` | L：PlotWorkbenchDialog 正式 surface | product-behavior 必须有真实 Dialog evidence |
| `plot-tree.preview.vue` | K：Plot tree 正式 view 与 Lab scene | 迁移前后行为不降低 |
| `plot-timeline.preview.vue` | K：Plot timeline 正式 view 与 Lab scene | 迁移前后行为不降低 |
| `model-settings.preview.vue` | J：Settings/Account 正式 surface与必要 Lab scene | product-behavior 必须有正式 settings evidence |
| `plot-thread.preview.vue` | K：Plot thread panel 正式 view 与 Lab scene | 迁移前后行为不降低 |
| `dnd.preview.vue` | E：`dnd-test/**` experimental catalog slice 与 fixtures | demo-only 必须有 Lab scene/test |
| `diff-workbench.preview.vue` | F：DiffWorkbench 正式消费者与 Lab fixture | formalSurface/evidence 与适用 Lab scene 闭合 |

`demo-only` 场景必须有 Lab component/scene/test；`product-behavior` 场景必须有 formalSurface/evidence test，Lab 可选。P 只有在 14 项逐 scenario 解析、所有 destination/evidence 合法、catalog `pending=0`、正式入口行为不低于迁移前并完成 Product 构建及真实 surface 证据后，才删除源页面、旧 preview 链接、样式和 mock。普通业务词中出现的 `preview` 不计入这 14 项归零门禁。

### 方案二：继续使用应用内本地组件，只复制 nb-ui 的视觉 token

此方案可以少改依赖和 import，但会保留两套 props/emits/a11y、浮层、表单和通知实现，无法证明主应用真正消费 nb-ui 的公共合同，也不能为 14 个场景建立唯一 Lab/正式 surface 去向。拒绝。

### 方案三：在 Nuxt 中启用 `@notnotype/nb-ui/nuxt` module 自动注册

自动注册是 nb-ui 支持的路径，但主应用当前已有多层 components 自动扫描；叠加无前缀注册会使来源、优先级和冲突难以审查，并违背“主应用显式导入”的批准边界。拒绝；保留 nb-ui module 作为库能力，不在 Product 配置中启用。

### 方案四：Product 同时安装 nbookTheme 与 macosTheme，借 macOS 作为运行时 fallback

这会让 macOS 进入 Product 运行时依赖，使主题包和配色 authority 多一层，也把参考实现混入产品身份。批准方案要求 Product 不装 macosTheme；目标相等通过 nbook 配色数值逐项验证，而不是运行时安装参考主题。拒绝。

### 方案五：把 colorway 镜像到 cookie/localStorage，避免认证恢复时纠正

这会制造第二份持久化 authority，引入跨入口、清除和竞态问题。批准方案明确 Global Config 是唯一持久化来源，并接受认证显式配色在 system 首帧后一次纠正。拒绝。

### 方案六：保留旧 theme/customThemes alias，渐进兼容所有旧入口

旧字段和自定义主题编辑器正是当前职责分叉的来源；alias、adapter 或静默 fallback 会使旧 authority 永久存在，无法证明 clean cutover。目标 normalizer 忽略旧输入、下一次保存只写 colorway；若发现必须改变产品行为、数据 owner、权限或失败语义才能完成解耦，应保持 pending 并回到 Proposal/Spec，而不是自行加兼容分支。拒绝。

### 方案七：先删除 preview 页面，再用 Lab 补回演示

这会丢失 scenario 基线和正式行为证据，无法判断迁移是否覆盖全部用户可见路径。采用“先冻结 baseline → 迁移到唯一 destination → 真实 surface/evidence → 最后删除”的顺序。

## 数据、接口、安全、迁移、发布与回滚影响

### 数据与持久化

目标 Global Config 的 `ui` 结构只持久化 `colorway` 与已有 `costCurrency`；`colorway` 取 `system | nbook-light | nbook-dark`，默认 `system`。当前持久化的 `ui.theme` / `ui.customThemes` 属于旧合同；C 的 normalizer/保存路径按批准方案 clean cutover，不把它们复制成另一份 runtime state，也不为旧自定义主题建立隐式迁移 authority。内存中的 store 只投影当前解析结果，不拥有持久化数据。

Lab query 只描述当前 Lab view，不写 Global Config；Lab stage 的颜色应用只影响 Lab surface，Lab chrome 继承应用当前配色。fixture 的 mock 数据、时钟和 typed port 是 deterministic 运行输入，不是用户 Project/Session/Pinia/storage 数据。

### 接口与状态

- 配置 DTO、bootstrap、editor snapshot/global save/reset 的公开 schema 从 `theme`/`customThemes` 转为 `colorway`，OpenAPI 由实现 Task 的生成命令按代码更新；本 Proposal 不直接改生成物。
- `resolveUiColorway()` 输出有效 preference、colorway ID、light/dark appearance 及可应用的 nbook variables；system 的媒体变化只改变解析投影，不改变 Global Config 中的 preference。
- `useColorwayManager()` 的保存失败恢复上一偏好并发出通知；并发 bootstrap 共享 promise，过期保存不能覆盖较新的 revision。
- Agent 公共 snapshot/patch 从 `ide.theme` 切为 `ide.colorway`，patch 只接受三值；Monaco/Diff 只消费 `activeColorwayAppearance`，不再读旧主题 snapshot。
- Lab URL 的非法 component/scene/viewport/colorway 必须 replace 为有效默认组合；无 catalog ready 条目或 pending 条目不能渲染为可选目标。
- 组件合同以 props、emits、slots、ARIA、键盘、受控状态、loading/error/empty/disabled/readonly/invalid 和 390px 边界为黑盒输入/输出；业务副作用经 host/controller/typed port，不藏在 presentational SFC。

### 安全与权限

本方案不新增网络端点或身份权限。Product Application Root 继续只读；Product 构建必须 fail closed 地排除 dev/lab 页面、fixture、sentinel 和模块图引用。Lab fixture 不连接真实 Provider/Model、不读取用户 storage/Pinia、不写 Global Config；真实页面仍经已有认证、API 和数据 owner。

远端 Issue/Project、PR、push、合并、发布、部署、数据库迁移、真实 Provider/Model、浏览器人工验收和数据删除仍然逐项需要开发者授权。Proposal accepted、Task planned、focused test 通过或 Product build 成功都不扩展该授权。

组件迁移必须保持现有保存、取消、错误、权限和数据 owner 语义；如果解耦要求改变这些可观察行为，则对应 catalog 条目保持 pending，追加阻塞记录并回到 Proposal/Spec，不用静默降级或未经批准的例外解决。

### 迁移顺序

1. p-006 accepted 后，Leader 先创建并登记两份 `planned` UI Spec，运行 `docs:check`；两份 Spec 门禁闭合后才创建 A Task。A 只消费已登记的 Spec，冻结 catalog aggregate/types、frontend standard 的组件合同和 14 页逐 scenario baseline；未冻结前不修改 preview 实现。
2. B 完成许可证目标、nbook 33 变量目标、纯数据 colorways export、依赖/CSS 合同和 JsonViewer 首个消费者；当前实现仍不得跳过 CSS 会合与组件公共合同。
3. C 将 Global Config、首帧脚本、runtime manager、store、设置、Agent snapshot/patch、Monaco/Diff 和主题宿主一次切到 colorway，原地更新 `theme.system`；删除旧主题编辑器/解析器/快照 authority。
4. D 建立 Source Dev-only Lab 与 Product exclusion verifier；E–O 按表逐批解耦、补 fixture、写 catalog/registry slice、验证真实 surface 并删除旧引用。
5. P 对 A baseline 逐 scenario 核对 destination/evidence，确认 pending=0、14 个源文件和链接可删除，再执行 preview 清退和最终 Product/浏览器验收。

上述顺序中的依赖、授权和证据是独立门禁；不因为 Proposal accepted 就自动获得依赖安装、测试、build、browser 或远端动作授权。

### 发布与回滚

- nb-ui 许可证目标允许 Product 分发，但本方案不发布 `0.2.0-alpha.0`，不改变版本号；发布仍需单独的发布授权和现有 Product 资产门禁。
- Product 运行时不能携带 `/lab` route、Lab fixture 或 dev/lab 资产；Source Dev `/lab` 是开发诊断面，不是可发布功能。
- 各实现批次应保持独立、可回退的提交边界。无数据库迁移或用户数据删除；但 config schema、consumer、bootstrap 和 Agent patch 必须作为同一 colorway 合同一起回滚，不能只恢复一侧。
- 回滚不恢复被 clean cutover 删除的自定义主题行为或新旧 alias；若需要回到旧版本，必须恢复对应版本的完整配置消费者和其原有合同。任何需要额外数据迁移、行为兼容或权限例外的回滚场景都要停止并重新取得决策。

## 对 Spec 的预期改动

Proposal accepted 后，由 Leader 建立两个唯一的 `planned` Spec，并在 C 开始时原地调整现有 `theme.system`。Proposal 不直接成为实现合同；三个 capability 的预期边界如下。

### `ui.component-contracts`

- **成熟度与 owner**：新建 `kind: behavior`、`status: planned`、`capability: ui.component-contracts`，owner 为 `ui`。
- **输入与前置条件**：A 冻结的 `app/components/**/*.vue` 路径集合、组件 props/emits/slots、ARIA/键盘边界、catalog entry、typed port、deterministic fixture 和真实 Product surface；页面、app root、dev/lab 不进入组件 catalog。
- **输出与可观察行为**：每个纳入的 SFC 在 aggregate 恰好一个 entry；entry 的 id/parent/tier/maturity/status/dependencies 合法；ready entry 有 fixture 并在真实 surface 可消费；pending entry 有 blockingReason 且不渲染；组件公开状态、事件、焦点和窄屏行为与迁移前不下降。
- **状态与转换**：初始 `pending`；合同、fixture、静态依赖和真实 surface 证据全部闭合后才可变为 `ready`；行为或边界不满足时保持 `pending`，不以更改状态隐藏缺口。P 只有所有条目 ready 且 14 个 scenario 证据闭合后才可结束 catalog。
- **副作用与数据**：presentational/composite SFC 不直接拥有 API、Pinia、storage 或 Project/Session 持久化；workspace 组件通过 typed port 请求副作用，数据 authority 留在 host/controller。fixture 只使用 deterministic mock，不写用户数据。
- **失败与恢复**：重复/缺失 id、断 parent、parent 环、缺 fixture、非法依赖、直接命中 fetch/storage/Pinia、真实 surface 行为回归或旧引用残留均使 focused gate fail；条目保持 pending，修复只在既有 Task 合同内进行，超出目标/owner/文件/验收则交回 Leader。
- **边界与兼容**：共享公共 primitive 使用 nb-ui；NeuroBook 特有 `ReferenceChip`、编辑器、领域组合仍由主应用拥有；不保留本地 duplicate primitive 的 alias/adapter。
- **验收与 Smoke**：catalog 全量扫描一次覆盖、parent 无环、pending/ready 约束、公共组件行为测试、真实消费者 surface、适用 keyboard/ARIA/390px 和旧引用归零；Lab 通过不能代替正式 surface。

### `ui.component-lab`

- **成熟度与 owner**：新建 `kind: behavior`、`status: planned`、`capability: ui.component-lab`，owner 为 `ui`。
- **输入与前置条件**：Source Dev 模式、冻结的 catalog/registry slices、fixture/scene、controls、viewport、nbook colorway 和合法 URL query；Product 模式必须没有 `/lab` route 和 Lab 资产。
- **输出与可观察行为**：Source Dev `/lab` 提供左侧 catalog 导航、中间 stage、右侧 inspector；支持 `responsive`、`phone=390×844`、`tablet=768×1024` 和 `nbook-light`/`nbook-dark`，记录最多 100 条 lab events、rendered 后 token snapshot、层级/依赖与 ARIA；非法 query replace 到有效默认组合。
- **状态与转换**：module 仅在 dev 注册路由；entry 从 pending 到 ready 前不出现在可渲染 ready 选择中；scene 挂载或切换触发 `rendered`，交互通过 `lab-event` 更新 inspector；刷新恢复有效 query，Back 不保留非法 query。
- **副作用与数据**：stage 可独立 applyColorway；Lab chrome 继承 app 配色；Lab 不调用 `setColorway`、Config API、Pinia 或 storage。fixture 的网络、时间和业务数据均为 deterministic mock/typed port。
- **失败与恢复**：非法 query、缺失 scene、pending entry 或错误 fixture 合同使用明确的 replace/阻塞结果，不静默展示缺失组件；Product graph/client/Nitro module 检测到 dev/lab 引用、路径、fixture 或 sentinel 时 fail closed 并删除整个候选产物，不发布部分 Product 资产。
- **边界与兼容**：Lab 是 Source Dev 诊断面，不是 Product 功能或正式 surface；Product browser 验收仍需独立证据；D 只消费 A 的 aggregate，不能创建第二 catalog 真相源。
- **验收与 Smoke**：dev=true 恰好一个 `/lab` route、dev=false 无 `/lab` 且所有 page 不在 dev/lab；worktree 不落 `.nuxt` 运行态；catalog 一对一扫描、fixture/scene/controls/events/ARIA/viewport 合同、URL replace、Product client+Nitro graph exclusion 和真实 Lab surface 均通过。

### `theme.system`（原地更新）

- **成熟度与 owner**：沿用 `docs/specs/theme/system.md` 的唯一 capability 和 `ui` owner；C 开始时 status 改为 `planned`，C 的实现与验证闭合后原地晋升 `implemented`。不创建 `theme.system-v2` 或其它并行正文。
- **输入与前置条件**：Global Config `ui.colorway` preference、浏览器 `matchMedia`/首帧环境、认证 session/config 恢复结果，以及 nb-ui nbook 纯数据 colorways；公开 preference 仅 `system | nbook-light | nbook-dark`。
- **输出与可观察行为**：`documentElement`/body 获得正确 nbook 变量和 light/dark appearance；system 实时跟随媒体，显式 ID 不跟随；设置、Monaco、Diff、Agent patch、Notification 和主题宿主消费同一解析结果；认证显式值允许首帧 system 后一次纠正。
- **状态与转换**：未认证或 system 为 system；认证 bootstrap 从 Global Config 恢复 preference；并发 bootstrap 幂等共享 promise；保存成功更新 authority 和投影；保存失败恢复上一 preference 并通知；媒体变化只更新 system 投影；不允许循环或第二次无依据重绘。
- **副作用与数据**：Global Config 是唯一持久化 authority；pre-hydration 只应用首帧变量；运行时 manager 负责唯一媒体订阅和应用；不写 cookie/localStorage 镜像，不维持旧 theme/customThemes snapshot。
- **失败与恢复**：浏览器不可用时明确 fallback `nbook-dark`；config 读取失败保持 system；保存失败回滚上一值并通知；非法 Agent patch 或旧输入被拒绝/忽略，不能写入无效 colorway；nbook 变量或 CSS 会合未通过时 C 停止，不能用 macosTheme 或本地颜色补洞。
- **边界与兼容**：Product 只安装 nbookTheme，不安装 macosTheme；`.novel-ide-theme` 只保留为 overlay/teleport 结构 class；`--we-*` 继续是唯一 World Engine 别名层映射，分类色板和编辑器内部语法色不进入公共 colorway。
- **验收与 Smoke**：33 个 nbook/macOS colorway vars 逐项相等、纯数据入口无 CSS 副作用、旧 theme/customThemes 消费归零、config/bootstrap/openAPI/Agent patch 合同一致、未认证 system 首帧无 FOUC、认证显式值恰好一次纠正、媒体实时跟随、保存失败回滚、Monaco/Diff/settings/Notification 真实 surface 行为与全 required focused tests/typecheck 证据闭合。

### Preview baseline 与后续 Task 的接口

A 还需要在其允许的 baseline 产物中逐字登记 14 个源路径、每页稳定 scenario ID、`demo-only | product-behavior` kind、destination 与 evidence 类别。p-006 只固定上述决策，不替 A 猜测未知 scenario ID。E–O 只能为现有 baseline 填写去向和证据；P 以 baseline 解析结果决定能否删除源页面。出现新增/删减/重分类、真实 surface 行为变化或必须扩大 owner 的情况，必须回到 Proposal/Spec，不得在迁移中静默修改。

## 决策记录

- 2026-08-27｜开发者批准｜接受 Issue #191 的 UI Foundation 目标及其关键取舍：nb-ui 目标许可证 `AGPL-3.0-only` 并允许 Product 分发；公开配色偏好为 `system | nbook-light | nbook-dark`；nbook 目标变量与 macOS 对应变量逐项相等但 Product 不安装 `macosTheme`；主应用显式导入且不启用 nb-ui Nuxt module；Global Config 是唯一持久化配色 authority；认证显式配色允许 system 首帧后一次纠正；Lab 仅 Source Dev；14 个 preview 场景先迁移后删除；Workbench/View Host、View Registry、Editor Split 和插件运行时排除。
- 2026-08-27T01:56:46Z｜开发者接受 Task 00162｜明确接受本 Task 的 Proposal 目标、范围、依赖、验收和停止条件；该接受授权本地可逆设计文档编辑、验证和本地 commit，不授权远端 Issue/Project 写入、push、PR、合并、发布、部署或其它受限动作。依据：`.agents/tasks/00162-ui-foundation-proposal/context.md`。
- 2026-08-27｜设计落盘决定｜采用本 Proposal 的唯一方案：先冻结组件/preview 合同，再按 A→P 依赖迁移；Proposal accepted 后创建两份 planned UI Spec，并原地更新 `theme.system`。本记录不宣称任何代码、许可证、nbook 数值、Spec、Lab、preview 清退或 Product 验收已完成。
