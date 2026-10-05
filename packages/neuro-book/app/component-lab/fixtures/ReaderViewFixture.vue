<script setup lang="ts">
/**
 * ReaderView 的 Lab 场景台。
 *
 * 台子给零件一个定高的只读容器：视图自己管滚动与稿面纸色，台子只负责把高度定下来，
 * 否则「空态居中」与「长正文滚动」两个行为都看不出来。
 */
import ReaderView from "nbook/app/components/editor-workbench/ReaderView.vue";
import {useLabSubject, type LabFixtureProps} from "../lab-subject";

const props = defineProps<LabFixtureProps>();
// 只读视图仍会发 ready/actions/focus；接进事件台，让人能确认它没有发出 save。
const subject = useLabSubject<typeof ReaderView>(() => props.input, ["ready", "actions", "focus", "save"]);
</script>

<template>
    <div class="reader-view-lab" data-reader-view-lab>
        <ReaderView data-lab-subject v-bind="subject.bindings.value" />
    </div>
</template>

<style scoped>
.reader-view-lab {
    height: 100%;
    overflow: hidden;
}
</style>
