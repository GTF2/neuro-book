<script setup lang="ts">
/**
 * WorkbenchCommandPalette 的 Lab 场景：面板由场景自己的局部命令宿主挂载，LabShell 不再提供全局实例。
 *
 * 夹具直接复用 CodeEditorViewFixture 的真实编辑器、控制栏与局部宿主，只把受检零件标记改到
 * 打开中的面板上；打开方式的提示放在底部控制抽屉，画布里只有被检视的界面。
 */
import CodeEditorViewFixture from "./CodeEditorViewFixture.vue";

const props = defineProps<{scene: string; data?: unknown}>();
</script>

<template>
    <CodeEditorViewFixture :scene="props.scene" :data="props.data" :palette-subject="true" />
</template>
