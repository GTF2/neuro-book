<script setup lang="ts">
/**
 * ProsePage 的 Lab 场景台。
 *
 * 台子只做一件事：给零件一个可量宽度并画出稿面纸色——纸色归宿主（阅读视图与面板的来源不同），
 * 因此这里按 nbook 主题的稿面变量铺底，让排版在接近真实的地方被检查。
 */
import ProsePage from "nbook/app/components/common/ProsePage.vue";
import {useLabSubject, type LabFixtureProps} from "../lab-subject";

const props = defineProps<LabFixtureProps>();
const subject = useLabSubject<typeof ProsePage>(() => props.input);
</script>

<template>
    <div class="prose-page-lab" data-prose-page-lab>
        <ProsePage data-lab-subject v-bind="subject.bindings.value" />
    </div>
</template>

<style scoped>
.prose-page-lab {
    height: 100%;
    overflow-y: auto;
    background: var(--page-surface, var(--bg-main));
}
</style>
