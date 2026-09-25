<script setup lang="ts">
import type {ReviewBlock, ReviewGroup} from "nbook/app/components/novel-ide/review/review-blocks";

/**
 * G2/G3 审稿窄栏（任务033 E 段，蓝图 :97 融合审稿）：
 * 纯 props/emit 骨架（不接 store/API——决议由挂载侧走 review-decision 端点）；
 * 审稿视图准入=仅涉正文实质改动件（蓝图 :101⑤），轻件走堆叠卡不入本栏。
 */
const props = defineProps<{
    group: ReviewGroup;
    /** 窄栏标题（人话：提案主题） */
    title: string;
}>();

const emit = defineEmits<{
    (e: "decision", action: "accept" | "reject" | "void" | "revoke", blockId: string): void;
    (e: "voidGroup"): void;
}>();

const pendingBlocks = computed(() => props.group.blocks.filter((block) => block.status === "pending"));
const settledBlocks = computed(() => props.group.blocks.filter((block) => block.status !== "pending"));

const statusText: Record<ReviewBlock["status"], string> = {
    pending: "待审",
    accepted: "已通过",
    rejected: "已拒绝",
    void: "已作废",
};

function blockTitle(block: ReviewBlock): string {
    return block.old ? `${block.old} → ${block.new}` : block.new;
}
</script>

<template>
    <aside class="review-sidebar" :aria-label="`审稿窄栏：${props.title}`">
        <header class="rs-head">
            <h3 class="rs-title">{{ props.title }}</h3>
            <span class="rs-meta">基于第 {{ props.group.baseRevision }} 版 · {{ pendingBlocks.length }} 块待审</span>
        </header>

        <ul class="rs-list">
            <li v-for="block in pendingBlocks" :key="block.blockId" class="rs-item">
                <p class="rs-diff"><s class="rs-old">{{ block.old }}</s> <ins class="rs-new">{{ block.new }}</ins></p>
                <p v-if="block.impactIds.length" class="rs-impact">影响 {{ block.impactIds.length }} 项</p>
                <div class="rs-ops">
                    <button type="button" class="rs-btn rs-btn--accept" @click="emit('decision', 'accept', block.blockId)">通过</button>
                    <button type="button" class="rs-btn rs-btn--reject" @click="emit('decision', 'reject', block.blockId)">拒绝</button>
                </div>
            </li>
        </ul>

        <p v-if="!pendingBlocks.length" class="rs-empty">本件已全部处理。</p>

        <div v-if="settledBlocks.length" class="rs-settled">
            <p class="rs-settled-h">已处理 {{ settledBlocks.length }} 块</p>
            <ul>
                <li v-for="block in settledBlocks" :key="block.blockId" class="rs-settled-item">
                    <span class="rs-status" :data-status="block.status">{{ statusText[block.status] }}</span>
                    <span class="rs-settled-text">{{ blockTitle(block) }}</span>
                    <button
                        v-if="block.status === 'accepted'"
                        type="button"
                        class="rs-btn rs-btn--revoke"
                        @click="emit('decision', 'revoke', block.blockId)"
                    >撤销</button>
                </li>
            </ul>
        </div>

        <button
            v-if="pendingBlocks.length"
            type="button"
            class="rs-btn rs-btn--void"
            @click="emit('voidGroup')"
        >整件拒绝（全部作废）</button>
    </aside>
</template>

<style scoped>
.review-sidebar{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border-color);border-left:2px solid var(--accent,#1e3a5f);border-radius:10px;background:var(--bg-panel,#fff)}
.rs-head{display:flex;flex-direction:column;gap:2px}
.rs-title{margin:0;font-size:13px;font-weight:650;color:var(--text-main)}
.rs-meta{font-size:11px;color:var(--text-muted)}
.rs-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.rs-item{display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--border-color);border-radius:8px}
.rs-diff{margin:0;font-size:12px;line-height:19px}
.rs-old{color:var(--text-muted)}
.rs-new{color:var(--text-main);text-decoration:none;font-weight:600}
.rs-impact{margin:0;font-size:11px;color:var(--status-warning,#ac5a15)}
.rs-ops{display:flex;gap:6px}
.rs-btn{padding:2px 10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-input,#fff);font-size:11.5px;color:var(--text-main);cursor:pointer}
.rs-btn:hover{background:var(--bg-hover,rgba(51,65,85,.08))}
.rs-btn--accept{border-color:var(--status-success,#2f7d4f)}
.rs-btn--reject,.rs-btn--void{border-color:var(--status-danger,#c22c2c);color:var(--status-danger,#c22c2c)}
.rs-btn--void{width:fit-content}
.rs-empty{margin:0;font-size:11.5px;color:var(--text-muted)}
.rs-settled{display:flex;flex-direction:column;gap:4px;padding-top:6px;border-top:1px dashed var(--border-color)}
.rs-settled-h{margin:0;font-size:11px;color:var(--text-muted)}
.rs-settled{margin:0;padding:6px 0 0}
.rs-settled ul{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none}
.rs-settled-item{display:flex;align-items:center;gap:6px;font-size:11.5px}
.rs-status{flex-shrink:0;padding:0 6px;border-radius:9999px;background:var(--bg-hover,rgba(51,65,85,.08));font-size:10.5px;color:var(--text-muted)}
.rs-status[data-status="accepted"]{color:var(--status-success,#2f7d4f)}
.rs-status[data-status="rejected"]{color:var(--status-danger,#c22c2c)}
.rs-btn--revoke{padding:0 6px;font-size:10.5px}
.rs-settled-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)}
</style>
