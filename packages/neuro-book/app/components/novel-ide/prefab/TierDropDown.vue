<script setup lang="ts">
import {computed, ref} from "vue";
import {onClickOutside} from "@vueuse/core";

/**
 * TierDropDown：自绘下拉骨架（009 组件宪法 C-1 基底，prefab 层通用件）。
 * 禁原生 select；触发器+弹出选项面板全部走主题变量（R4 无写死色值）。
 * 宪法落点：C-1 自绘结构；C-2 可按元素有框/有底（chip 态 hover 显底=I-6/E5 定型）；
 * C-3 选中态=左侧 2px 均匀线（未选中行以透明边占位保持几何恒定）+文字强调色，无粗细变化；
 * C-4 落在 chip 形态（轻量+hover 显灰底块）；C-5 不适用（本件无过程行展开）。
 * 骨架阶段：不接 store/API/thinkingLevelMap，选项用组件内占位七档；
 * 接入方传 options 即替换。宽度自适应：触发器随内容收缩，弹层按最宽选项展开（E6「选中项隐身只显半截」的修正口径）。
 */
export interface TierDropDownOption {
    value: string;
    /** 文案 i18n 键：模板内统一 t() 渲染，不把成品文案传进组件 */
    labelKey: string;
    /** 可选二级说明的 i18n 键 */
    descriptionKey?: string;
    disabled?: boolean;
}

/** 占位数据：思考档位全量七档，词表对齐现网 agent.composer（zh-CN.ts:1812-1818）。 */
const PLACEHOLDER_TIER_OPTIONS: TierDropDownOption[] = [
    {value: "off", labelKey: "prefab.tierDropDown.levelOff"},
    {value: "minimal", labelKey: "prefab.tierDropDown.levelMinimal"},
    {value: "low", labelKey: "prefab.tierDropDown.levelLow"},
    {value: "medium", labelKey: "prefab.tierDropDown.levelMedium"},
    {value: "high", labelKey: "prefab.tierDropDown.levelHigh"},
    {value: "xhigh", labelKey: "prefab.tierDropDown.levelXhigh"},
    {value: "max", labelKey: "prefab.tierDropDown.levelMax"},
];

const props = withDefaults(defineProps<{
    /** 当前选中值；null=未选中，触发器显示占位文案 */
    modelValue: string | null;
    /** 选项集；缺省=占位七档。真机接入时由调用方按 thinkingLevelMap 过滤（I-7） */
    options?: TierDropDownOption[];
    /** 触发器无障碍标签/悬浮提示的 i18n 键 */
    labelKey?: string;
    /** 未选中时触发器占位文案的 i18n 键 */
    placeholderKey?: string;
    /** outline=与输入框同款边框底色（C-1）；chip=去描边轻芯片 hover 显底（I-6/E5 底部栏定型） */
    variant?: "outline" | "chip";
    /** 弹层方向；auto 按 down。真机接入如需视口碰撞翻转，换 useFloatingPanelLayout */
    dropdownDirection?: "auto" | "down" | "up";
    disabled?: boolean;
}>(), {
    options: () => PLACEHOLDER_TIER_OPTIONS,
    labelKey: "prefab.tierDropDown.label",
    placeholderKey: "prefab.tierDropDown.placeholder",
    variant: "outline",
    dropdownDirection: "auto",
    disabled: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
}>();

const {t} = useI18n();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
/** 键盘导航指针：-1=无；高亮行与鼠标悬停共用 */
const activeIndex = ref(-1);

const resolvedDirection = computed(() => props.dropdownDirection === "auto" ? "down" : props.dropdownDirection);

const selectedOption = computed(() => props.options.find((opt) => opt.value === props.modelValue) ?? null);

onClickOutside(rootRef, () => close());

const openPanel = () => {
    if (props.disabled) {
        return;
    }
    open.value = true;
    activeIndex.value = props.options.findIndex((opt) => opt.value === props.modelValue);
};

const close = () => {
    open.value = false;
    activeIndex.value = -1;
};

const toggle = () => {
    if (open.value) {
        close();
    } else {
        openPanel();
    }
};

const select = (opt: TierDropDownOption) => {
    if (props.disabled || opt.disabled) {
        return;
    }
    emit("update:modelValue", opt.value);
    close();
};

/** 键盘可用：触发器统一捕获；开态方向键移指针、Enter/空格选中、Esc 关闭 */
const onTriggerKeydown = (event: KeyboardEvent) => {
    if (props.disabled) {
        return;
    }
    if (!open.value) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openPanel();
        }
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const len = props.options.length;
        let next = activeIndex.value;
        for (let step = 0; step < len; step++) {
            next = (next + delta + len) % len;
            if (!props.options[next]?.disabled) {
                break;
            }
        }
        activeIndex.value = next;
        return;
    }
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const opt = props.options[activeIndex.value];
        if (opt && !opt.disabled) {
            select(opt);
        }
    }
};

/** C-1：outline 与输入框同款边框底色；I-6/E5：chip 去描边轻芯片 */
const triggerClass = computed(() => props.variant === "chip"
    ? "h-7 px-2 border border-transparent"
    : "h-7 px-2.5 border border-[var(--border-color)] bg-[var(--bg-input)]");

const triggerOpenClass = computed(() => props.variant === "chip"
    ? "bg-[var(--bg-hover)]"
    : "border-[var(--accent-main)] ring-1 ring-[var(--accent-main)]/30");
</script>

<template>
    <div ref="rootRef" class="relative inline-flex w-fit max-w-full">
        <button
            type="button"
            class="flex min-w-0 select-none items-center justify-between gap-1.5 rounded-md text-[12px] text-[var(--text-main)] outline-none transition-colors"
            :class="[
                triggerClass,
                open ? triggerOpenClass : '',
                props.disabled ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-[var(--bg-hover)]',
            ]"
            aria-haspopup="listbox"
            :aria-expanded="open"
            :aria-label="t(props.labelKey)"
            :title="t(props.labelKey)"
            :tabindex="props.disabled ? -1 : 0"
            :disabled="props.disabled"
            @click="toggle"
            @keydown="onTriggerKeydown"
        >
            <span class="min-w-0 truncate">{{ selectedOption ? t(selectedOption.labelKey) : t(props.placeholderKey) }}</span>
            <span
                class="i-lucide-chevron-down h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-200"
                :class="open ? '-rotate-180 text-[var(--text-main)]' : ''"
            ></span>
        </button>

        <transition name="tier-dd">
            <div
                v-if="open"
                role="listbox"
                :aria-label="t(props.labelKey)"
                class="absolute left-0 z-[9200] max-h-[50vh] w-max min-w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] p-1.5 shadow-lg custom-scrollbar"
                :class="resolvedDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'"
                @keydown.esc.prevent="close()"
            >
                <div
                    v-for="(opt, index) in props.options"
                    :key="opt.value"
                    role="option"
                    :aria-selected="opt.value === props.modelValue"
                    :aria-disabled="opt.disabled || undefined"
                    class="flex cursor-pointer items-center gap-2 rounded-md border-l-2 border-l-transparent py-1 pl-2 pr-2 text-[12px] transition-colors last:mb-0"
                    :class="[
                        opt.value === props.modelValue
                            ? 'border-l-[var(--accent-main)] text-[var(--accent-main)]'
                            : 'text-[var(--text-secondary)]',
                        opt.disabled ? 'cursor-default opacity-50' : '',
                        index === activeIndex && !opt.disabled ? 'bg-[var(--bg-hover)]' : '',
                    ]"
                    @mouseenter="activeIndex = index"
                    @click="select(opt)"
                >
                    <span class="min-w-0 flex-1">
                        <span class="block truncate">{{ t(opt.labelKey) }}</span>
                        <span v-if="opt.descriptionKey" class="mt-0.5 block truncate text-[10px] font-normal text-[var(--text-muted)]">{{ t(opt.descriptionKey) }}</span>
                    </span>
                    <span v-if="opt.value === props.modelValue" class="i-lucide-check h-3 w-3 shrink-0 text-[var(--accent-main)]"></span>
                </div>
                <div v-if="props.options.length === 0" class="px-2 py-1 text-[12px] text-[var(--text-muted)]">{{ t("prefab.tierDropDown.empty") }}</div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.tier-dd-enter-active,
.tier-dd-leave-active {
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tier-dd-enter-from,
.tier-dd-leave-to {
    opacity: 0;
    transform: translateY(-4px) scaleY(0.96);
}
</style>
