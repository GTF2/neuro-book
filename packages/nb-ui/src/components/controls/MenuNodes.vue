<script setup lang="ts" generic="T extends {label?: string; disabled?: boolean; separator?: boolean; iconClass?: string; shortcut?: string; tone?: 'default' | 'danger'; checked?: boolean; type?: string; title?: string}">
import {onMounted, ref} from "vue";

const props = defineProps<{
    items: readonly T[];
    active?: T | null;
    itemClass?: (item: T) => string | (string | Record<string, boolean>)[];
}>();

const emit = defineEmits<{
    (e: "select", item: T): void;
    (e: "hover", item: T | null, trigger: HTMLElement, immediate: boolean): void;
}>();

const root = ref<HTMLElement | null>(null);

function hasChildren(item: T): boolean {
    return "children" in item && Array.isArray(item.children) && item.children.length > 0;
}
function role(item: T): string {
    if (item.type === "radio") return "menuitemradio";
    if (item.type === "checkbox") return "menuitemcheckbox";
    return "menuitem";
}

/**
 * 本层可聚焦的菜单项，按 DOM 顺序（跳过禁用项与分隔线）。
 *
 * 菜单项是原生 `<button>`（不经过 reka-ui 的 `DropdownMenuItem`），reka 的 roving-focus
 * 管不到它们，因此本组件自己维护键盘导航。只收本层——子菜单渲染在**同层的兄弟面板**里，
 * 按祖先关系过滤才不会把下一级的项算进来。
 */
function focusableItems(anchor: HTMLElement | null): HTMLElement[] {
    const host = anchor?.parentElement ?? null;
    if (host === null) return [];
    return [...host.querySelectorAll<HTMLElement>(':scope > [role^="menuitem"]')]
        .filter((element) => !(element as HTMLButtonElement).disabled);
}

/** 在当前项之间移动；`step` 为 ±1。两端循环，跳过禁用项。 */
function moveFocus(event: KeyboardEvent, step: 1 | -1): void {
    const current = event.currentTarget as HTMLElement | null;
    const list = focusableItems(current);
    if (list.length === 0) return;
    event.preventDefault();
    const index = current === null ? -1 : list.indexOf(current);
    // 当前项不在可聚焦表里（例如刚被禁用）时，按方向从头/尾进入。
    const next = index === -1
        ? (step === 1 ? 0 : list.length - 1)
        : (index + step + list.length) % list.length;
    list[next]?.focus();
}

function onKeydown(item: T, event: KeyboardEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        moveFocus(event, event.key === "ArrowDown" ? 1 : -1);
        return;
    }
    if (event.key === "Home" || event.key === "End") {
        const list = focusableItems(target);
        if (list.length === 0) return;
        event.preventDefault();
        (event.key === "Home" ? list[0] : list.at(-1))?.focus();
        return;
    }
    if (!hasChildren(item) || event.key !== "ArrowRight" || !target || !("getBoundingClientRect" in target)) return;
    event.preventDefault();
    target.setAttribute("aria-expanded", "true");
    emit("hover", item, target, true);
}

/**
 * 焦点落到父项时展开子菜单。
 *
 * 鼠标路径走 `pointerenter`/`mouseenter`；键盘路径只有 `focus`——没有它，键盘用户看不到子菜单。
 */
function onFocus(item: T, event: FocusEvent): void {
    if (!hasChildren(item)) {
        emit("hover", null, event.currentTarget as HTMLElement, false);
        return;
    }
    emit("hover", item, event.currentTarget as HTMLElement, true);
}
</script>

<template>
    <template v-for="(item, index) in items" :key="index">
        <div v-if="item.separator" role="separator" class="my-1 h-px bg-[var(--divider)]"></div>
        <button
            v-else
            type="button"
            :role="role(item)"
            :aria-checked="item.type === 'radio' || item.type === 'checkbox' ? item.checked === true : undefined"
            :aria-haspopup="hasChildren(item) ? 'menu' : undefined"
            :aria-expanded="hasChildren(item) ? active === item : undefined"
            :disabled="item.disabled"
            :title="item.title"
            :class="itemClass?.(item) ?? 'nb-ui-popover-item flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs disabled:cursor-not-allowed disabled:opacity-40'"
            @focus="onFocus(item, $event)"
            @pointerenter="emit('hover', hasChildren(item) ? item : null, $event.currentTarget as HTMLElement, false)"
            @mouseenter="emit('hover', hasChildren(item) ? item : null, $event.currentTarget as HTMLElement, false)"
            @click="hasChildren(item) ? emit('hover', item, $event.currentTarget as HTMLElement, true) : emit('select', item)"
            @keydown="onKeydown(item, $event)"
        >
            <span class="inline-flex min-w-0 items-center gap-2">
                <span v-if="item.iconClass" :class="[item.iconClass, 'h-4 w-4 shrink-0']"></span>
                <slot name="item" :item="item"><span class="truncate" :class="item.tone === 'danger' ? 'text-[var(--status-danger)]' : ''">{{ item.label }}</span></slot>
            </span>
            <span v-if="hasChildren(item)" class="i-lucide-chevron-right h-3.5 w-3.5 shrink-0"></span>
            <span v-else-if="item.checked" class="i-lucide-check h-3.5 w-3.5 shrink-0"></span>
            <slot v-else name="item-right" :item="item"><span v-if="item.shortcut" class="font-mono text-[10px] text-[var(--text-muted)]">{{ item.shortcut }}</span></slot>
        </button>
    </template>
</template>
