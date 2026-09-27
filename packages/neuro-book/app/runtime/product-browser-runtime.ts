import {ref, type Ref} from "vue";
import type {Component} from "vue";
import {FilesClient, createHttpFilesTransport, type FilesBinding} from "nbook/app/features/files/files-client";
import type {WorkspaceFileStreamEventDto} from "nbook/shared/dto/workspace-file-events.dto";
import {SHELL_FILES_VIEW} from "nbook/app/utils/workbench/product-catalog";
import {createWorkbenchRegistry, type DescriptorResult, type ViewDescriptor, type WorkbenchRegistry} from "nbook/app/utils/workbench/descriptors";
import {SHELL_LEFT_CONTAINER, SHELL_PANEL_CONTAINER, SHELL_RIGHT_CONTAINER} from "nbook/app/utils/workbench/containers";
import {resolveWorkbenchViewFactory} from "nbook/app/utils/workbench/view-factories";
import type {CommandRegistry, Release} from "nbook/app/utils/workbench/commands";
import {
    registerViewTitleCommands,
    registerWorkbenchShellCommands,
    SHELL_FILES_REFRESH_COMMAND,
    type WorkbenchShellCommandPort,
    type WorkbenchViewCommandPort,
} from "nbook/app/utils/workbench/workbench-shell-commands";
import type {ApplicationManifest, StartupResult, StopResult} from "../../runtime/application/application";
import type {ContributionReceiver} from "../../runtime/plugins/plugins";
import {BrowserRuntimeHost, type PageLifecycleTarget} from "./browser-host";

const FILES_ENTRY = {plugin: "nbook.files", entry: "browser"} as const;
const FILES_VIEW_CAPABILITY = "workbench.view";
const FILES_COMMAND_CAPABILITY = "workbench.command";

export interface ProductBrowserRuntimeOptions {
    readonly instanceId: string;
    readonly commands: CommandRegistry;
    readonly shell: WorkbenchShellCommandPort;
    readonly viewCommands: WorkbenchViewCommandPort;
    readonly page?: PageLifecycleTarget;
    readonly onFailure: (reason: string) => void;
}

export interface ProductBrowserRuntime {
    readonly registry: DescriptorResult<WorkbenchRegistry>;
    readonly available: Readonly<Ref<boolean>>;
    readonly startup: Promise<StartupResult>;
    resolveViewFactory(factoryKey: string): DescriptorResult<Component>;
    subscribeFiles(binding: FilesBinding, onEvent: (event: WorkspaceFileStreamEventDto) => void, signal?: AbortSignal): Promise<void>;
    destroy(): Promise<StopResult>;
}

/** Each page owns its command entries, View implementation and event subscriptions. The server Project owner is never stopped here. */
export function createProductBrowserRuntime(options: ProductBrowserRuntimeOptions): ProductBrowserRuntime {
    const emptyRegistry = createWorkbenchRegistry({parts: [], containers: [SHELL_LEFT_CONTAINER, SHELL_PANEL_CONTAINER, SHELL_RIGHT_CONTAINER], views: []});
    const filesRegistry = createWorkbenchRegistry({parts: [], containers: [SHELL_LEFT_CONTAINER, SHELL_PANEL_CONTAINER, SHELL_RIGHT_CONTAINER], views: [SHELL_FILES_VIEW]});
    const available = ref(false);
    const transport = createHttpFilesTransport();
    let viewPublished = false;

    const views: ContributionReceiver<ViewDescriptor, ViewDescriptor, DescriptorResult<Component>> = {
        capability: FILES_VIEW_CAPABILITY,
        validate: ({id, declaration}) => id === SHELL_FILES_VIEW.id && declaration === SHELL_FILES_VIEW
            ? null : "Files View 声明与产品目录不一致",
        prepare: () => {
            const factory = resolveWorkbenchViewFactory(SHELL_FILES_VIEW.factoryKey);
            if (!factory.ok) throw new Error(factory.reason);
            return factory;
        },
        commit: () => { viewPublished = true; },
        revoke: () => { viewPublished = false; },
    };
    const commands: ContributionReceiver<typeof SHELL_FILES_REFRESH_COMMAND, WorkbenchViewCommandPort, {release: Release | null}> = {
        capability: FILES_COMMAND_CAPABILITY,
        validate: ({id, declaration}) => id === SHELL_FILES_REFRESH_COMMAND.command.id && declaration === SHELL_FILES_REFRESH_COMMAND
            ? null : "Files 命令声明与产品目录不一致",
        prepare: () => ({release: null}),
        commit: (handle, prepared) => {
            const result = registerViewTitleCommands(options.commands, [handle.declaration], options.viewCommands);
            if (!result.ok) throw new Error(result.reason);
            prepared.release = result.value;
        },
        revoke: (_handle, prepared) => {
            prepared.release?.();
            prepared.release = null;
        },
    };
    const manifest: ApplicationManifest = {
        keys: [],
        receivers: [views, commands],
        plugins: [{id: FILES_ENTRY.plugin, entries: [{
            id: FILES_ENTRY.entry,
            location: "browser",
            contributions: [
                {capability: FILES_VIEW_CAPABILITY, id: SHELL_FILES_VIEW.id, declaration: SHELL_FILES_VIEW},
                {capability: FILES_COMMAND_CAPABILITY, id: SHELL_FILES_REFRESH_COMMAND.command.id, declaration: SHELL_FILES_REFRESH_COMMAND},
            ],
            activate: () => ({contributions: {
                [FILES_VIEW_CAPABILITY]: {[SHELL_FILES_VIEW.id]: SHELL_FILES_VIEW},
                [FILES_COMMAND_CAPABILITY]: {[SHELL_FILES_REFRESH_COMMAND.command.id]: options.viewCommands},
            }}),
        }]}],
        gates: [
            {id: "workbench-shell", kind: "check", check: ({root}) => {
                const result = registerWorkbenchShellCommands(options.commands, options.shell);
                if (!result.ok) throw new Error(result.reason);
                root.register({kind: "workbench-commands", label: "workbench shell commands", value: result.value, release: (release) => release()});
            }},
            {id: "files-browser", kind: "activate", entry: FILES_ENTRY},
        ],
    };
    const host = new BrowserRuntimeHost().start({instanceId: options.instanceId, manifest, page: options.page});
    const startup = host.application.startup.then((result) => {
        if (result.status === "available" && !host.application.root.stopSignal.aborted) available.value = true;
        else if (result.status !== "available") options.onFailure(result.failures.map((failure) => `${failure.source}: ${failure.reason}`).join("; ") || result.status);
        return result;
    });
    void host.application.stopped.then(() => { available.value = false; });

    return {
        get registry() {
            return available.value && !host.application.root.stopSignal.aborted && viewPublished
                ? filesRegistry : emptyRegistry;
        },
        available,
        startup,
        resolveViewFactory(factoryKey) {
            if (factoryKey !== SHELL_FILES_VIEW.factoryKey) return resolveWorkbenchViewFactory(factoryKey);
            if (!available.value || host.application.root.stopSignal.aborted || !viewPublished) {
                return {ok: false, reason: `Files View 未就绪：${factoryKey}`};
            }
            return resolveWorkbenchViewFactory(factoryKey);
        },
        async subscribeFiles(binding, onEvent, signal) {
            const result = await startup;
            if (result.status !== "available" || host.application.root.stopSignal.aborted || signal?.aborted) {
                throw new Error("浏览器 Files runtime 已停止");
            }
            const stopped = host.application.root.stopSignal;
            return new FilesClient(binding, transport).events(onEvent, signal === undefined ? stopped : AbortSignal.any([stopped, signal]));
        },
        destroy: () => host.destroy(),
    };
}
