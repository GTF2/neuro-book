<script setup lang="ts">
/**
 * 设置工作区页骨架（prefab 层）：VS Code 式形态=左分区导航+右内容+即时生效，
 * 无保存按钮、非模态（总集 L-4/C2，出现保存按钮/模态弹窗即打回）。
 * 契约完整但不接真机业务：不 import store/API，数据全为组件内占位常量，
 * 接入宿主时经 props 注入、变更走 emits 出口落库。
 */
export interface SettingsWorkspaceSection {
    id: string;
    /** 分区标题的 i18n 键，由本组件 t() 渲染，契约不收明文文案。 */
    titleKey: string;
    /** lucide 图标类名（i-lucide-*）。 */
    icon?: string;
}

export interface SettingsWorkspaceOption {
    value: string;
    /** 选项文案的 i18n 键。 */
    labelKey: string;
}

export interface SettingsWorkspaceField {
    id: string;
    /** 所属分区 id。 */
    sectionId: string;
    /** 标签文案的 i18n 键。 */
    labelKey: string;
    kind: "toggle" | "select" | "text" | "group";
    /** kind=select 的候选。 */
    options?: SettingsWorkspaceOption[];
    /** 初始值：toggle 收 boolean，select/text 收 string。 */
    value?: string | boolean;
    /** kind=group 的可展开子项（宪法 5：展开左缩进+左竖线，收起平齐）。 */
    children?: SettingsWorkspaceField[];
}

/* 占位分区：接入宿主后由 props.sections 覆盖。 */
const PLACEHOLDER_SECTIONS: SettingsWorkspaceSection[] = [
    { id: "appearance", titleKey: "settingsWorkspace.sections.appearance", icon: "i-lucide-palette" },
    { id: "models", titleKey: "settingsWorkspace.sections.models", icon: "i-lucide-cpu" },
    { id: "agent", titleKey: "settingsWorkspace.sections.agent", icon: "i-lucide-bot" },
    { id: "advanced", titleKey: "settingsWorkspace.sections.advanced", icon: "i-lucide-sliders-horizontal" },
];

/* 占位设置项：覆盖 select/toggle/text 三种控件形态+一个可展开分组样例。 */
const PLACEHOLDER_FIELDS: SettingsWorkspaceField[] = [
    {
        id: "theme", sectionId: "appearance", labelKey: "settingsWorkspace.fields.theme", kind: "select", value: "system",
        options: [
            { value: "system", labelKey: "settingsWorkspace.fields.theme.system" },
            { value: "dark", labelKey: "settingsWorkspace.fields.theme.dark" },
            { value: "light", labelKey: "settingsWorkspace.fields.theme.light" },
        ],
    },
    { id: "reduce-motion", sectionId: "appearance", labelKey: "settingsWorkspace.fields.reduceMotion", kind: "toggle", value: false },
    { id: "editor-font-size", sectionId: "appearance", labelKey: "settingsWorkspace.fields.editorFontSize", kind: "text", value: "16" },
    {
        id: "default-model", sectionId: "models", labelKey: "settingsWorkspace.fields.defaultModel", kind: "select", value: "placeholder-a",
        options: [
            { value: "placeholder-a", labelKey: "settingsWorkspace.fields.defaultModel.placeholderA" },
            { value: "placeholder-b", labelKey: "settingsWorkspace.fields.defaultModel.placeholderB" },
        ],
    },
    { id: "stream-replies", sectionId: "models", labelKey: "settingsWorkspace.fields.streamReplies", kind: "toggle", value: true },
    { id: "auto-approve-reads", sectionId: "agent", labelKey: "settingsWorkspace.fields.autoApproveReads", kind: "toggle", value: false },
    { id: "workflow-timeout", sectionId: "agent", labelKey: "settingsWorkspace.fields.workflowTimeout", kind: "text", value: "30" },
    {
        id: "advanced-group", sectionId: "advanced", labelKey: "settingsWorkspace.fields.advancedGroup", kind: "group",
        children: [
            { id: "verbose-logging", sectionId: "advanced", labelKey: "settingsWorkspace.fields.verboseLogging", kind: "toggle", value: false },
            { id: "telemetry", sectionId: "advanced", labelKey: "settingsWorkspace.fields.telemetry", kind: "toggle", value: false },
        ],
    },
];

const props = withDefaults(
    defineProps<{
        /** 分区清单；缺省用内置占位分区。 */
        sections?: SettingsWorkspaceSection[];
        /** 初始选中分区 id；缺省取第一个分区。 */
        activeSectionId?: string;
        /** 设置项清单；缺省用内置占位字段。 */
        fields?: SettingsWorkspaceField[];
    }>(),
    {
        sections: () => PLACEHOLDER_SECTIONS,
        activeSectionId: undefined,
        fields: () => PLACEHOLDER_FIELDS,
    },
);

const emit = defineEmits<{
    (e: "section-change", sectionId: string): void;
    /** 搜索词变化出口；本组件只做当前分区即时过滤，跨分区检索归宿主。 */
    (e: "search", query: string): void;
    /** 任一项即时变更（无保存按钮，变更即出口，由宿主落库）。 */
    (e: "setting-change", fieldId: string, value: string | boolean): void;
}>();

const {t} = useI18n();

const activeSectionId = ref(props.activeSectionId ?? props.sections[0]?.id ?? "");
const searchQuery = ref("");
const expandedGroupIds = ref(new Set<string>());
const openDropdownId = ref<string | null>(null);

/* 占位值池：变更即 emit，本组件不持久化。 */
const fieldValues = ref<Record<string, string | boolean>>(collectInitialValues(props.fields));

watch(searchQuery, (query) => emit("search", query));

const rootEl = ref<HTMLElement | null>(null);

function collectInitialValues(fields: SettingsWorkspaceField[]): Record<string, string | boolean> {
    const values: Record<string, string | boolean> = {};
    const walk = (list: SettingsWorkspaceField[]) => {
        for (const field of list) {
            if (field.value !== undefined) values[field.id] = field.value;
            if (field.children) walk(field.children);
        }
    };
    walk(fields);
    return values;
}

function selectSection(sectionId: string): void {
    activeSectionId.value = sectionId;
    openDropdownId.value = null;
    emit("section-change", sectionId);
}

function toggleGroup(fieldId: string): void {
    const next = new Set(expandedGroupIds.value);
    if (next.has(fieldId)) next.delete(fieldId);
    else next.add(fieldId);
    expandedGroupIds.value = next;
}

function toggleDropdown(fieldId: string): void {
    openDropdownId.value = openDropdownId.value === fieldId ? null : fieldId;
}

function selectOption(field: SettingsWorkspaceField, value: string): void {
    fieldValues.value[field.id] = value;
    openDropdownId.value = null;
    emit("setting-change", field.id, value);
}

function toggleSwitch(field: SettingsWorkspaceField): void {
    const next = !fieldValues.value[field.id];
    fieldValues.value[field.id] = next;
    emit("setting-change", field.id, next);
}

function onTextChange(field: SettingsWorkspaceField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    fieldValues.value[field.id] = value;
    emit("setting-change", field.id, value);
}

function selectLabelKey(field: SettingsWorkspaceField): string {
    const current = fieldValues.value[field.id];
    const option = field.options?.find((item) => item.value === current);
    return option?.labelKey ?? "";
}

function selectLabelExists(field: SettingsWorkspaceField): boolean {
    return selectLabelKey(field) !== "";
}

/* 当前分区字段按搜索词即时过滤；分组自身不命中时看子项是否命中。 */
const visibleFields = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const sectionFields = props.fields.filter((field) => field.sectionId === activeSectionId.value);
    if (!query) return sectionFields;
    const matches = (field: SettingsWorkspaceField) => t(field.labelKey).toLowerCase().includes(query);
    return sectionFields
        .map((field) => (field.kind === "group" ? {...field, children: (field.children ?? []).filter(matches)} : field))
        .filter((field) => (field.kind === "group" ? (field.children?.length ?? 0) > 0 : matches(field)));
});

/* 自绘下拉（宪法 1）：点击面板外即收起。 */
function onGlobalPointerdown(event: PointerEvent): void {
    if (openDropdownId.value && rootEl.value && !rootEl.value.contains(event.target as Node)) {
        openDropdownId.value = null;
    }
}

onMounted(() => window.addEventListener("pointerdown", onGlobalPointerdown));
onBeforeUnmount(() => window.removeEventListener("pointerdown", onGlobalPointerdown));
</script>

<template>
    <section ref="rootEl" class="flex h-full min-h-0 flex-col bg-[var(--bg-panel)] text-[var(--text-main)]">
        <!-- 顶部：页标题+即时过滤搜索；无保存按钮=即时生效语义（L-4 对照验收） -->
        <header class="flex shrink-0 items-center gap-4 border-b border-[var(--border-color)] px-6 py-4">
            <h2 class="text-base font-semibold">{{ t("settingsWorkspace.title") }}</h2>
            <div class="relative ml-auto w-72 max-w-full">
                <span class="i-lucide-search pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true"></span>
                <input
                    v-model="searchQuery"
                    type="search"
                    :aria-label="t('settingsWorkspace.searchPlaceholder')"
                    :placeholder="t('settingsWorkspace.searchPlaceholder')"
                    class="h-8 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] pl-8 pr-2 text-sm text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-main)]"
                />
            </div>
        </header>

        <div class="flex min-h-0 flex-1">
            <!-- 左分区导航：选中=左 2px 均匀线+文字强调色（宪法 3，不靠粗细）；hover 灰底=可按容器（宪法 2） -->
            <nav class="w-48 shrink-0 overflow-y-auto border-r border-[var(--border-color)] py-3">
                <button
                    v-for="section in sections"
                    :key="section.id"
                    type="button"
                    class="relative flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-[var(--accent-main)] before:content-[''] before:opacity-0"
                    :class="section.id === activeSectionId
                        ? 'text-[var(--accent-text)] before:opacity-100'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'"
                    @click="selectSection(section.id)"
                >
                    <span :class="section.icon" class="h-4 w-4 shrink-0" aria-hidden="true"></span>
                    <span class="truncate">{{ t(section.titleKey) }}</span>
                </button>
            </nav>

            <!-- 右内容：单列窄栏，随改随生效 -->
            <div class="min-w-0 flex-1 overflow-y-auto px-8 py-6">
                <p v-if="visibleFields.length === 0" class="px-2 text-sm text-[var(--text-muted)]">
                    {{ t("settingsWorkspace.searchEmpty", { query: searchQuery.trim() }) }}
                </p>
                <div v-else class="max-w-2xl space-y-1">
                    <template v-for="field in visibleFields" :key="field.id">
                        <!-- 可展开分组：组头 hover 灰底；展开内容左缩进 12px+左竖线，收起平齐（宪法 5） -->
                        <div v-if="field.kind === 'group'">
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
                                :aria-expanded="expandedGroupIds.has(field.id)"
                                @click="toggleGroup(field.id)"
                            >
                                <span
                                    class="i-lucide-chevron-right h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform"
                                    :class="expandedGroupIds.has(field.id) ? 'rotate-90' : ''"
                                    aria-hidden="true"
                                ></span>
                                {{ t(field.labelKey) }}
                            </button>
                            <div v-if="expandedGroupIds.has(field.id)" class="ml-3 space-y-1 border-l-2 border-[var(--border-color)] pl-3">
                                <div v-for="child in field.children ?? []" :key="child.id" class="flex items-center justify-between gap-6 rounded-md px-2 py-2">
                                    <span class="min-w-0 truncate text-sm text-[var(--text-main)]">{{ t(child.labelKey) }}</span>
                                    <button
                                        v-if="child.kind === 'toggle'"
                                        type="button"
                                        role="switch"
                                        :aria-checked="Boolean(fieldValues[child.id])"
                                        class="relative h-5 w-9 shrink-0 rounded-full border transition-colors"
                                        :class="fieldValues[child.id] ? 'border-[var(--accent-main)] bg-[var(--accent-main)]' : 'border-[var(--border-color)] bg-[var(--bg-input)]'"
                                        @click="toggleSwitch(child)"
                                    >
                                        <span
                                            class="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[var(--bg-panel)] transition-all"
                                            :class="fieldValues[child.id] ? 'left-5' : 'left-0.5'"
                                        ></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <!-- 普通设置行：label 左、控件右；行 hover 灰底（宪法 2） -->
                        <div v-else class="flex items-center justify-between gap-6 rounded-md px-2 py-2 transition-colors hover:bg-[var(--bg-hover)]">
                            <span class="min-w-0 truncate text-sm text-[var(--text-main)]">{{ t(field.labelKey) }}</span>
                            <!-- 自绘下拉（宪法 1）：触发器=与输入框同款边框底色；面板=纸面底+边框+浅影+悬停高亮+选中态 -->
                            <div v-if="field.kind === 'select'" class="relative shrink-0">
                                <button
                                    type="button"
                                    class="flex h-8 min-w-40 items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--text-main)] transition-colors hover:border-[var(--border-strong)]"
                                    :aria-expanded="openDropdownId === field.id"
                                    aria-haspopup="listbox"
                                    @click="toggleDropdown(field.id)"
                                >
                                    <span class="truncate">{{ selectLabelExists(field) ? t(selectLabelKey(field)) : "" }}</span>
                                    <span class="i-lucide-chevron-down h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true"></span>
                                </button>
                                <ul
                                    v-if="openDropdownId === field.id"
                                    role="listbox"
                                    class="absolute right-0 z-20 mt-1 max-h-60 min-w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] py-1 shadow-md"
                                >
                                    <li v-for="option in field.options ?? []" :key="option.value">
                                        <button
                                            type="button"
                                            role="option"
                                            :aria-selected="fieldValues[field.id] === option.value"
                                            class="relative flex w-full items-center whitespace-nowrap px-3 py-1.5 text-left text-sm transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-[var(--accent-main)] before:content-[''] before:opacity-0"
                                            :class="fieldValues[field.id] === option.value
                                                ? 'text-[var(--accent-text)] before:opacity-100'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'"
                                            @click="selectOption(field, option.value)"
                                        >
                                            {{ t(option.labelKey) }}
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <!-- 开关：开=强调色底，关=输入框底，滑块位置表达状态 -->
                            <button
                                v-else-if="field.kind === 'toggle'"
                                type="button"
                                role="switch"
                                :aria-checked="Boolean(fieldValues[field.id])"
                                class="relative h-5 w-9 shrink-0 rounded-full border transition-colors"
                                :class="fieldValues[field.id] ? 'border-[var(--accent-main)] bg-[var(--accent-main)]' : 'border-[var(--border-color)] bg-[var(--bg-input)]'"
                                @click="toggleSwitch(field)"
                            >
                                <span
                                    class="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[var(--bg-panel)] transition-all"
                                    :class="fieldValues[field.id] ? 'left-5' : 'left-0.5'"
                                ></span>
                            </button>
                            <!-- 文本项：与下拉触发器同款边框底色；@change 即时生效 -->
                            <input
                                v-else
                                type="text"
                                :value="String(fieldValues[field.id] ?? '')"
                                class="h-8 w-40 shrink-0 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-[var(--accent-main)]"
                                @change="onTextChange(field, $event)"
                            />
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </section>
</template>
