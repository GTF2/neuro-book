<script setup lang="ts">
import NotificationViewport from "nbook/app/components/common/NotificationViewport.vue";
import DesktopTitleBar from "nbook/app/components/common/DesktopTitleBar.vue";
import { useDialog } from "nbook/app/composables/useDialog";
import { useNotification } from "nbook/app/composables/useNotification";
import {provideWorkbenchChrome} from "nbook/app/composables/useWorkbenchChrome";

provideWorkbenchChrome();

if (import.meta.client) {
    const dialog = useDialog();
    const notification = useNotification();
    window.alert = dialog.alert as any;
    window.confirm = dialog.confirm as any;
    window.prompt = dialog.prompt as any;
    (window as any).$dialog = dialog;
    (window as any).$notify = notification;
}

const desktopAvailable = computed(() => import.meta.client && Boolean(window.neuroBookDesktop));
</script>

<template>
    <DesktopTitleBar />
    <div :class="{ 'desktop-page-shell': desktopAvailable }">
        <NuxtPage/>
    </div>
    <NotificationViewport :desktop="desktopAvailable" />
</template>

<style>

.desktop-page-shell {
    display: flex;
    height: calc(100dvh - 36px);
    min-height: 0;
    overflow: hidden;
    flex-direction: column;
}

.desktop-page-shell > * {
    height: 100%;
    min-height: 0;
}

*, ::after, ::before, ::backdrop, ::file-selector-button {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
}

/*
 * 这里刻意不写 scrollbar-width / scrollbar-color —— 它们是「标准滚动条」属性：
 * 一旦在某个元素上生效，Chrome 121+ 就会改用标准渲染路径，该元素的 ::-webkit-scrollbar*
 * 全部随之失效，包括下面那条用来去掉上下箭头的 ::-webkit-scrollbar-button。
 * 之前几轮「明明写了 display: none 却仍有箭头、粗细也不对」就是这个原因。
 * 需要隐藏某个容器的滚动条时，在那个容器上单独写 scrollbar-width: none，不要在这里统一设。
 */

/* WebKit-based browsers support */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

/* 上下箭头按钮一律不显示：只留轨道与滑块，箭头在现代界面里既占位置又显旧。 */
::-webkit-scrollbar-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    -webkit-appearance: none !important;
    appearance: none !important;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background-color: var(--text-muted);
    border-radius: 3px;
    opacity: 0.5;
}

::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-secondary);
}

::-webkit-scrollbar-corner {
    background: transparent;
}

span[class^="i-"],
span[class*=" i-"] {
    display: block;
}
</style>
