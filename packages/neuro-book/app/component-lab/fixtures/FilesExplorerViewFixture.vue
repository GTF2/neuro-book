<script setup lang="ts">
import {ref, watch} from "vue";
import FilesExplorerView from "nbook/app/components/novel-ide/workspace/FilesExplorerView.vue";
import type {WorkspaceFileNode} from "nbook/app/stores/novel-ide";
import type {WorkspaceFilesViewMode} from "nbook/shared/storage/workbench-files";
import type {WorkspaceFileClipboardIntent, WorkspaceFileMovePayload} from "nbook/app/components/novel-ide/workspace/workspace-file-tree";
import {useLabEventSink} from "../lab-event-sink";

const props = defineProps<{scene: string; data?: unknown}>();
const emitLabEvent = useLabEventSink();
const mode = ref<WorkspaceFilesViewMode>("ordinary");
const nodes = ref<WorkspaceFileNode[]>([]);
const expandedPaths = ref<string[]>([]);
const selectedPaths = ref<string[]>([]);
const selectedPath = ref("");
const clipboard = ref<WorkspaceFileClipboardIntent | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const lastEvent = ref("");

function node(path: string, directory = false, title = path.split("/").at(-1) ?? path): WorkspaceFileNode {
    return {
        path, absolutePath: `/lab/files/${path}`, title, mode: directory ? "directory" : "file",
        entryType: null, icon: null, status: null, words: 0, refs: [], isDirectory: directory,
        hasIndex: false, contentNode: false, summary: "", frontmatter: title === path ? {} : {title},
        frontmatterError: null, state: null, size: 0, mtimeMs: 1, editable: !directory,
    };
}
const sample = () => [
    node("index.md", false, "航海日志"),
    node("manuscript", true), node("manuscript/index.md", false, "第一卷"),
    node("manuscript/chapter-01.md", false, "潮门"), node("manuscript/notes.md", false, "海图"),
    node("reference", true), node("reference/chart.png"), node("empty", true),
];
watch(() => props.scene, (scene) => {
    nodes.value = scene === "empty" ? [] : sample();
    mode.value = scene === "content" ? "content" : "ordinary";
    expandedPaths.value = ["manuscript", "reference"];
    selectedPaths.value = [];
    selectedPath.value = "";
    clipboard.value = null;
    loading.value = scene === "loading";
    error.value = scene === "error" ? "无法读取文件树" : null;
    lastEvent.value = "";
}, {immediate: true});
function report(name: string, payload?: unknown): void {
    lastEvent.value = payload === undefined ? name : `${name} ${JSON.stringify(payload)}`;
    emitLabEvent(name, payload);
}
function select(node: WorkspaceFileNode): void {
    selectedPath.value = node.path;
    report("select", node.path);
}
function open(node: WorkspaceFileNode): void {
    const path = node.isDirectory ? `${node.path}/index.md` : node.path;
    if (!nodes.value.some(item => item.path === path && !item.isDirectory)) return;
    selectedPath.value = path;
    report("open", path);
}
function move(payload: WorkspaceFileMovePayload): void {
    report("move-intent", payload);
}
function clipboardIntent(intent: WorkspaceFileClipboardIntent): void {
    if (intent.kind === "clear") {
        clipboard.value = null;
    } else if (intent.kind === "copy" || intent.kind === "cut") {
        clipboard.value = intent;
    } else if (intent.kind === "paste") {
        const sources = clipboard.value && "sources" in clipboard.value ? clipboard.value.sources : [];
        report("paste-intent", {sources, destination: intent.destination});
    }
    report("clipboard-intent", intent);
}
function retry(): void {
    error.value = null;
    loading.value = false;
    report("retry");
}
</script>

<template>
    <div class="flex h-full min-h-0 min-w-0 flex-col">
        <FilesExplorerView
            data-lab-subject
            class="min-h-0 flex-1"
            :nodes="nodes" :mode="mode" :selected-path="selectedPath" :selected-paths="selectedPaths"
            :expanded-paths="expandedPaths" :loading="loading" :error="error"
            @update:mode="mode = $event"
            @update:expanded-paths="expandedPaths = $event"
            @update:selected-paths="selectedPaths = $event"
            @select="select" @open="open" @move="move" @clipboard-intent="clipboardIntent"
            @node-contextmenu="(node: WorkspaceFileNode) => report('node-contextmenu', node.path)"
            @root-contextmenu="report('root-contextmenu')"
            @create-root-content="report('create-root-content')" @retry="retry"
        />
        <p class="shrink-0 border-t border-[var(--divider)] px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
            {{ lastEvent || '本地文件场景' }}
        </p>
    </div>
</template>
