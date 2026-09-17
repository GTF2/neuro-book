export type TitleBarMenuPresentation = "full" | "compact";

export type TitleBarMenuMeasurements = Readonly<{
    availableWidth: number;
    fullMenuWidth: number;
    titleWidth: number;
    controlsWidth: number;
}>;

export const MINIMUM_TITLE_BAR_DRAG_WIDTH = 120;

export type WorkbenchActivityItemId =
    | "home"
    | "files"
    | "characters"
    | "plot"
    | "world"
    | "trace"
    | "history"
    | "agent-panel"
    | "account"
    | "settings";

export type WorkbenchActivityItem = Readonly<{
    id: WorkbenchActivityItemId;
    disabled: boolean;
}>;

export type WorkbenchActivityContext = Readonly<{
    desktopAvailable: boolean;
    surfaceActive: boolean;
    userAssetsMode: boolean;
}>;

export type WorkbenchActivityItems = Readonly<{
    primary: WorkbenchActivityItem[];
    secondary: WorkbenchActivityItem[];
    agentPanel: WorkbenchActivityItem | null;
    footer: WorkbenchActivityItem[];
}>;

export type ActivityBarSecondaryMeasurements = Readonly<{
    availableHeight: number;
    fixedHeight: number;
    itemHeight: number;
    moreButtonHeight: number;
}>;

/** 保证完整菜单不会挤掉标题栏的最小可拖动区域。 */
export function resolveTitleBarMenuPresentation(
    measurements: TitleBarMenuMeasurements,
): TitleBarMenuPresentation {
    const requiredWidth = measurements.fullMenuWidth
        + measurements.titleWidth
        + measurements.controlsWidth
        + MINIMUM_TITLE_BAR_DRAG_WIDTH;
    return measurements.availableWidth >= requiredWidth ? "full" : "compact";
}

/** 返回各宿主共享的 Activity Bar 能力；组件只负责图标、文案和事件。 */
export function createWorkbenchActivityItems(
    context: WorkbenchActivityContext,
): WorkbenchActivityItems {
    const projectDisabled = !context.surfaceActive;
    const novelOnlyDisabled = projectDisabled || context.userAssetsMode;
    return {
        /*
         * primary 只放**写作会话中被反复查阅**的入口。
         *
         * `world` 从 primary 移到 secondary：它是世界观引擎的**配置面**，配置一次长期不动，
         * 而 files / characters / plot 是写一场戏时要同时对照的三样东西。依据是 NN/g 对渐进披露
         * 的四条判断里的「频率」——一个配置型入口占着常驻位，等于让每一次写作都先掠过它。
         *
         * 这三项**不能拆到不同层级**（那是四条判断里的「共同使用」）：作者在同一次写作里要来回看
         * 角色、地点与剧情线，分开放会逼用户反复切换导航。所以只动 world，不动另外两个。
         */
        primary: [
            ...(!context.desktopAvailable ? [{id: "home" as const, disabled: false}] : []),
            {id: "files", disabled: projectDisabled},
            {id: "characters", disabled: novelOnlyDisabled},
            {id: "plot", disabled: novelOnlyDisabled},
        ],
        /*
         * 顺序即溢出优先级：`resolveActivityBarSecondaryItems` 从前往后保留可见项，
         * 放不下才进 More。所以把最不常用的 world 放在最后。
         */
        secondary: [
            {id: "trace", disabled: projectDisabled},
            {id: "history", disabled: novelOnlyDisabled},
            {id: "world", disabled: novelOnlyDisabled},
        ],
        agentPanel: context.desktopAvailable
            ? null
            : {id: "agent-panel", disabled: projectDisabled},
        footer: [
            {id: "account", disabled: false},
            {id: "settings", disabled: false},
        ],
    };
}

/**
 * 次要入口只在放不下时进入 More。只要存在 overflow，就先为 More 预留一个完整按钮位。
 */
export function resolveActivityBarSecondaryItems<T>(
    items: readonly T[],
    measurements: ActivityBarSecondaryMeasurements,
): {visible: T[]; overflow: T[]} {
    if (items.length === 0) {
        return {visible: [], overflow: []};
    }
    const itemHeight = Math.max(1, measurements.itemHeight);
    const remainingHeight = Math.max(0, measurements.availableHeight - measurements.fixedHeight);
    const fullCapacity = Math.floor(remainingHeight / itemHeight);
    if (fullCapacity >= items.length) {
        return {visible: [...items], overflow: []};
    }
    const visibleCapacity = Math.max(
        0,
        Math.floor((remainingHeight - measurements.moreButtonHeight) / itemHeight),
    );
    return {
        visible: items.slice(0, visibleCapacity),
        overflow: items.slice(visibleCapacity),
    };
}
