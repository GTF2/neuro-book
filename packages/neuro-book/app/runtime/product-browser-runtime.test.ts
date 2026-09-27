import {describe, expect, it, vi} from "vitest";
import {SHELL_FILES_VIEW} from "nbook/app/utils/workbench/product-catalog";
import {createCommandRegistry} from "nbook/app/utils/workbench/commands";
import {SHELL_PANEL_DEFAULTS} from "nbook/app/utils/workbench/panel-state";
import {SHELL_VIEW_COMMAND_IDS, type WorkbenchShellCommandPort} from "nbook/app/utils/workbench/workbench-shell-commands";
import {createProductBrowserRuntime} from "./product-browser-runtime";
import type {PageLifecycleTarget} from "./browser-host";

vi.mock("nbook/app/stores/novel-ide", () => ({useNovelIdeStore: () => ({})}));
class Page implements PageLifecycleTarget {
    private readonly listeners = new Set<() => void>();
    addEventListener(_name: "pagehide", listener: () => void): void { this.listeners.add(listener); }
    removeEventListener(_name: "pagehide", listener: () => void): void { this.listeners.delete(listener); }
    hide(): void { for (const listener of this.listeners) listener(); }
}

function windowRuntime(id: string, page: Page, refresh: (target: {viewId: string; generation: number}, actionId: string) => Promise<{ok: true; value: string | null}>) {
    const commands = createCommandRegistry({context: () => ({}), agentMode: () => "normal", development: false, report: () => undefined});
    const saved = {status: "saved" as const, diagnosis: ""};
    const shell: WorkbenchShellCommandPort = {
        state: () => ({panel: {...SHELL_PANEL_DEFAULTS, maximized: false}, mode: "split", ready: true}),
        setPanelState: async () => saved,
        setMaximized: () => undefined,
        moveView: async () => saved,
        moveContainer: async () => saved,
        mergeContainer: async () => saved,
        reopenContainer: async () => saved,
        selectContainer: async () => saved,
        restoreContainerPlacement: async () => saved,
        restoreViewPlacement: async () => saved,
        setPartVisibility: async () => saved,
        revealView: async () => saved,
    };
    const runtime = createProductBrowserRuntime({instanceId: id, page, commands, shell, viewCommands: {runAction: refresh}, onFailure: (reason) => {throw new Error(reason);}});
    return {runtime, commands};
}

describe("product browser Files lifecycle", () => {
    it("two windows publish independent Files View and refresh; pagehide revokes only its own commands", async () => {
        const firstRefresh = vi.fn(async () => ({ok: true as const, value: "first"}));
        const first = windowRuntime("window-a", new Page(), firstRefresh);
        const secondPage = new Page();
        const secondRefresh = vi.fn(async () => ({ok: true as const, value: "second"}));
        const second = windowRuntime("window-b", secondPage, secondRefresh);
        try {
            expect((await first.runtime.startup).status).toBe("available");
            expect((await second.runtime.startup).status).toBe("available");
            const published = first.runtime.registry;
            expect(published.ok && published.value.resolveView(SHELL_FILES_VIEW.id).ok).toBe(true);
            expect(first.runtime.resolveViewFactory(SHELL_FILES_VIEW.factoryKey).ok).toBe(true);
            expect(await first.commands.executeCommand(SHELL_VIEW_COMMAND_IDS.refreshFiles, {viewId: SHELL_FILES_VIEW.id, generation: 1})).toMatchObject({ok: true, value: "first"});
            expect(await second.commands.executeCommand(SHELL_VIEW_COMMAND_IDS.refreshFiles, {viewId: SHELL_FILES_VIEW.id, generation: 1})).toMatchObject({ok: true, value: "second"});
            expect(firstRefresh).toHaveBeenCalledTimes(1);
            expect(secondRefresh).toHaveBeenCalledTimes(1);
            secondPage.hide();
            await second.runtime.destroy();
            const revoked = second.runtime.registry;
            expect(revoked.ok && revoked.value.resolveView(SHELL_FILES_VIEW.id).ok).toBe(false);
            expect(second.runtime.resolveViewFactory(SHELL_FILES_VIEW.factoryKey).ok).toBe(false);
            expect(second.commands.getCommand(SHELL_VIEW_COMMAND_IDS.refreshFiles).ok).toBe(false);
            expect(first.runtime.registry.ok).toBe(true);
            expect((await first.commands.executeCommand(SHELL_VIEW_COMMAND_IDS.refreshFiles, {viewId: SHELL_FILES_VIEW.id, generation: 2})).ok).toBe(true);
        } finally {
            await Promise.all([first.runtime.destroy(), second.runtime.destroy()]);
        }
    });

    it("stops the exact Files stream on pagehide without stopping another window", async () => {
        const firstPage = new Page();
        const first = windowRuntime("stream-a", firstPage, vi.fn(async () => ({ok: true as const, value: null})));
        const second = windowRuntime("stream-b", new Page(), vi.fn(async () => ({ok: true as const, value: null})));
        const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
            await new Promise<void>((resolve) => init?.signal?.addEventListener("abort", () => resolve(), {once: true}));
            throw new DOMException("aborted", "AbortError");
        });
        try {
            await Promise.all([first.runtime.startup, second.runtime.startup]);
            const binding = {projectRoot: "project-a", publicId: "ready-a"};
            const firstStream = first.runtime.subscribeFiles(binding, () => undefined).catch((error: unknown) => error);
            const secondStream = second.runtime.subscribeFiles(binding, () => undefined).catch((error: unknown) => error);
            await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
            expect(String(fetch.mock.calls[0]?.[0])).toContain("projectRoot=project-a&publicId=ready-a");
            firstPage.hide();
            await firstStream;
            expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
            expect(fetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(false);
            await first.runtime.destroy();
            expect(second.runtime.available.value).toBe(true);
            await second.runtime.destroy();
            await secondStream;
        } finally {
            fetch.mockRestore();
            await Promise.all([first.runtime.destroy(), second.runtime.destroy()]);
        }
    });
});
