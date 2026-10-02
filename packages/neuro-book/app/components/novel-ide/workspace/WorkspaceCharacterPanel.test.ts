// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mount, type VueWrapper} from "@vue/test-utils";
import {defineComponent, nextTick, type Ref} from "vue";
import type {WorkspaceFileNode} from "nbook/app/stores/novel-ide";
import WorkspaceCharacterPanel from "nbook/app/components/novel-ide/workspace/WorkspaceCharacterPanel.vue";

/**
 * 角色面板的组件边界：明细面板的关闭只收起面板，不清空编辑器活动文件
 * （与 `WorkspaceFilePanel` 同一条语义；`clearActiveFile` 会把活动组 activePath 清空，
 * 编辑区随即停在「有标签、无正文」的加载态）。
 */

const fake = vi.hoisted(() => ({store: null as unknown}));

vi.mock("nbook/app/stores/novel-ide", async () => {
    const {ref} = await import("vue");
    const store = {
        loadingWorkspaceTree: ref(false),
        selectedFileNode: ref<WorkspaceFileNode | null>(null),
        selectedFilePath: ref(""),
        workspaceIssues: ref([]),
        workspaceTree: ref<WorkspaceFileNode[]>([]),
        createWorkspaceFile: vi.fn(),
        deleteWorkspacePath: vi.fn(),
        loadWorkspaceTree: vi.fn(async () => []),
        renameWorkspacePath: vi.fn(),
        selectWorkspacePath: vi.fn(async () => undefined),
        clearActiveFile: vi.fn(),
    };
    fake.store = store;
    return {useNovelIdeStore: () => store};
});

vi.mock("nbook/app/composables/useDialog", () => ({
    useDialog: () => ({confirm: vi.fn(async () => false), prompt: vi.fn(async () => null), alert: vi.fn(), choose: vi.fn(), chooseCards: vi.fn()}),
}));

vi.mock("nbook/app/composables/useNotification", () => ({
    useNotification: () => ({
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        notify: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        notifications: [],
    }),
}));

vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params === undefined ? key : `${key}(${Object.values(params).join(",")})`,
        locale: {value: "zh-CN"},
    }),
}));

const DetailStub = defineComponent({
    name: "WorkspaceCharacterDetailPanel",
    props: ["node", "issues", "height"],
    emits: ["close", "refresh", "update:height"],
    template: "<div data-detail=\"character\"></div>",
});

const ContextMenuStub = defineComponent({
    name: "ContextMenu",
    props: ["visible", "x", "y", "items", "contextValue"],
    emits: ["close", "select"],
    template: "<div data-stub=\"context-menu\"></div>",
});

const mounted: VueWrapper[] = [];

function nodeOf(overrides: Partial<WorkspaceFileNode>): WorkspaceFileNode {
    return {
        path: "lorebook/hero/index.md",
        title: "hero",
        summary: "",
        isDirectory: false,
        editable: true,
        hasIndex: false,
        ...overrides,
    } as WorkspaceFileNode;
}

const hero = nodeOf({entryType: "character", contentNode: true});
const rival = nodeOf({path: "lorebook/rival/index.md", title: "rival", entryType: "character", contentNode: true});

function storeMock() {
    return fake.store as {
        selectedFileNode: Ref<WorkspaceFileNode | null>;
        selectedFilePath: Ref<string>;
        workspaceTree: Ref<WorkspaceFileNode[]>;
        selectWorkspacePath: ReturnType<typeof vi.fn>;
        clearActiveFile: ReturnType<typeof vi.fn>;
    };
}

function mountPanel() {
    const wrapper = mount(WorkspaceCharacterPanel, {
        global: {
            stubs: {
                WorkspaceCharacterDetailPanel: DetailStub,
                ContextMenu: ContextMenuStub,
            },
        },
    });
    mounted.push(wrapper);
    return wrapper;
}

beforeEach(() => {
    storeMock().selectedFileNode.value = null;
    storeMock().selectedFilePath.value = "";
    storeMock().workspaceTree.value = [];
    storeMock().selectWorkspacePath.mockClear();
    storeMock().clearActiveFile.mockClear();
});

afterEach(() => {
    for (const wrapper of mounted.splice(0)) {
        wrapper.unmount();
    }
});

describe("WorkspaceCharacterPanel 明细关闭语义", () => {
    it("关闭详情只收起明细面板，不清空编辑器活动文件；重新选择节点后面板回来", async () => {
        const wrapper = mountPanel();
        storeMock().selectedFileNode.value = hero;
        storeMock().selectedFilePath.value = hero.path;
        await nextTick();
        expect(wrapper.find("[data-detail=\"character\"]").exists()).toBe(true);

        wrapper.findComponent(DetailStub).vm.$emit("close");
        await nextTick();
        expect(storeMock().clearActiveFile).not.toHaveBeenCalled();
        expect(wrapper.find("[data-detail=\"character\"]").exists()).toBe(false);

        storeMock().selectedFileNode.value = rival;
        storeMock().selectedFilePath.value = rival.path;
        await nextTick();
        expect(wrapper.find("[data-detail=\"character\"]").exists()).toBe(true);
    });
});
