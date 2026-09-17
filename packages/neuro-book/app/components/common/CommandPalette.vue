<script setup lang="ts">
import {IDE_THEME_HOST_CLASS} from "nbook/app/utils/theme/theme-tokens";
import {filterCommands, groupCommands, moveSelection, type CommandItem} from "nbook/app/utils/command-palette";
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from "vue";

/**
 * 命令面板（⌘K / Ctrl+K）。
 *
 * 与通用对话框分开做，不是重复造轮子：对话框是「居中 + 确认/取消」的模态，
 * 面板是「顶部对齐 + 边打边筛 + 键盘选完即执行」——交互模型不同，硬套对话框会
 * 得到一个长得像弹窗、手感不对的东西。teleport、遮罩、Esc、焦点归还则沿用
 * Dialog.vue 那套已验证的做法。
 *
 * **teleport 目标必须是主题宿主**，不能是 body：配色变量由 apply-theme 写在宿主的
 * inline style 上，挂到 body 就只能拿到 :root 的 sepia fallback——当前主题是 light
 * 时面板会变回暖色，与界面其它部分两套色温。
 */

const props = withDefaults(defineProps<{
    modelValue: boolean;
    commands: CommandItem[];
    placeholder?: string;
}>(), {
    placeholder: "",
});

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
    (e: "select", id: string): void;
}>();

const {t} = useI18n();

const isMounted = ref(false);
const query = ref("");
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
/** 打开前的焦点元素，关闭时还回去——键盘用户不该被丢到文档开头。 */
let restoreTarget: HTMLElement | null = null;

const visible = computed(() => filterCommands(props.commands, query.value));
const groups = computed(() => groupCommands(visible.value));

function close(): void {
    emit("update:modelValue", false);
}

function run(item: CommandItem): void {
    if (item.disabled) {
        return;
    }
    close();
    emit("select", item.id);
}

function move(delta: number): void {
    selectedIndex.value = moveSelection(selectedIndex.value, delta, visible.value.length);
    void nextTick(scrollSelectedIntoView);
}

function scrollSelectedIntoView(): void {
    listRef.value?.querySelector<HTMLElement>("[data-selected='true']")?.scrollIntoView({block: "nearest"});
}

function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
        return;
    }
    if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
        return;
    }
    if (event.key === "Enter") {
        event.preventDefault();
        const item = visible.value[selectedIndex.value];
        if (item) {
            run(item);
        }
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        close();
    }
}

watch(() => props.modelValue, (open) => {
    if (open) {
        restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        query.value = "";
        selectedIndex.value = 0;
        void nextTick(() => inputRef.value?.focus());
        return;
    }
    query.value = "";
    selectedIndex.value = 0;
    restoreTarget?.focus();
    restoreTarget = null;
});

// 输入变化后回到首项：用户接着打字时，选中项不该停在过滤前的位置。
watch(query, () => {
    selectedIndex.value = 0;
});

onMounted(() => {
    isMounted.value = true;
});

onBeforeUnmount(() => {
    restoreTarget = null;
});
</script>

<template>
    <Teleport v-if="isMounted" :to="`.${IDE_THEME_HOST_CLASS}`">
        <div v-if="props.modelValue" class="fixed inset-0 z-[9500] flex items-start justify-center bg-[color-mix(in_srgb,var(--shadow-color)_40%,transparent)] px-4 pt-[12vh]" @click.self="close">
            <div class="flex w-[min(560px,92vw)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[0_24px_60px_color-mix(in_srgb,var(--shadow-color)_18%,transparent)]" role="dialog" aria-modal="true" :aria-label="t('commandPalette.title')">
                <div class="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border-color)] px-3">
                    <span class="i-lucide-search h-4 w-4 shrink-0 text-[var(--text-muted)]"></span>
                    <input
                        ref="inputRef"
                        v-model="query"
                        type="text"
                        class="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                        :placeholder="props.placeholder || t('commandPalette.placeholder')"
                        autocomplete="off"
                        spellcheck="false"
                        @keydown="onKeydown"
                    >
                    <kbd class="shrink-0 rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">Esc</kbd>
                </div>

                <div ref="listRef" class="max-h-[52vh] min-h-0 overflow-y-auto py-1" role="listbox" :aria-label="t('commandPalette.title')">
                    <p v-if="visible.length === 0" class="px-4 py-6 text-center text-xs text-[var(--text-muted)]">{{ t("commandPalette.empty") }}</p>
                    <template v-for="group in groups" :key="group.group">
                        <p class="px-4 pb-1 pt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{{ group.group }}</p>
                        <button
                            v-for="item in group.items"
                            :key="item.id"
                            type="button"
                            role="option"
                            class="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors"
                            :class="[
                                item.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                                visible[selectedIndex]?.id === item.id && !item.disabled ? 'bg-[var(--bg-hover)] text-[var(--text-main)]' : 'text-[var(--text-secondary)]',
                            ]"
                            :data-selected="visible[selectedIndex]?.id === item.id"
                            :aria-selected="visible[selectedIndex]?.id === item.id"
                            :disabled="item.disabled"
                            @mousemove="selectedIndex = visible.findIndex((c) => c.id === item.id)"
                            @click="run(item)"
                        >
                            <span v-if="item.iconClass" :class="item.iconClass" class="h-4 w-4 shrink-0 text-[var(--text-muted)]"></span>
                            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                            <span v-if="item.hint" class="shrink-0 text-[11px] text-[var(--text-muted)]">{{ item.hint }}</span>
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>
