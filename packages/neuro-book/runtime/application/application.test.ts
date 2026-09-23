import {describe, expect, it, vi} from "vitest";

import {readdir, readFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import type {PluginDefinition} from "../plugins/plugins";
import {provide} from "../plugins/plugins";
import {defineServiceKey} from "../services/services";

import {createApplication, createApplicationRegistry} from "./application";
import type {ApplicationManifest, EmergencyReport, HostContext, StartupGate} from "./application";

const moduleDir = dirname(fileURLToPath(import.meta.url));

interface Clock {
    now(): number;
}

const clockKey = defineServiceKey<Clock>("clock");
const greeterKey = defineServiceKey<{greet(name: string): string}>("greeter");

function host(instanceId = "app-1", location: "server" | "browser" = "server") {
    const controller = new AbortController();
    const emergencies: EmergencyReport[] = [];
    const context: HostContext = {identity: {location, instanceId}, stopSignal: controller.signal, emergency: (report) => emergencies.push(report)};
    return {context, controller, emergencies};
}

function greeterPlugin(location: "server" | "browser" = "server", activate?: PluginDefinition["entries"][number]["activate"]): PluginDefinition {
    return {
        id: "greeter",
        entries: [
            {
                id: "main",
                location,
                dependencies: [{key: clockKey}],
                provides: [greeterKey],
                activate:
                    activate ??
                    ((context) => {
                        const clock = context.services.require(clockKey);
                        return {services: [provide(greeterKey, {greet: (name) => `hi ${name} @${clock.now()}`})]};
                    }),
            },
        ],
    };
}

function manifest(overrides: Partial<ApplicationManifest> & {readonly extraGates?: StartupGate[]; readonly releaseClock?: () => void} = {}): ApplicationManifest {
    return {
        keys: [clockKey, greeterKey],
        receivers: [],
        capabilities: [{id: "clock", key: clockKey, create: (): Clock => ({now: () => 1}), release: overrides.releaseClock}],
        plugins: [greeterPlugin()],
        gates: [{id: "greeter", kind: "activate", entry: {plugin: "greeter", entry: "main"}}, ...(overrides.extraGates ?? [])],
        ...overrides,
    };
}

function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("runtime.application 机制边界", () => {
    it("内核源码只使用同目录相对导入与三个机制入口，不 import 框架、进程、DOM 或产品领域", async () => {
        const sources = (await readdir(moduleDir)).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort();
        expect(sources).toContain("application.ts");
        for (const name of sources) {
            const code = await readFile(join(moduleDir, name), "utf8");
            const specifiers = [...code.matchAll(/^\s*(?:import|export)\b[^"']*?\bfrom\s+["']([^"']+)["']/gmu)].map((match) => match[1]);
            for (const specifier of specifiers) {
                expect(specifier, `${name} 导入了 ${specifier}`).toMatch(/^(?:\.\/[^/]+|\.\.\/(?:lifecycle\/lifecycle|services\/services|plugins\/plugins))$/u);
            }
            expect(code, `${name} 不得引用 process/window`).not.toMatch(/\b(?:process|window|document)\./u);
        }
    });
});

describe("启动与接纳", () => {
    it("清单只登记描述；必需门禁全部成功才开放接纳；并发接纳请求等待同一启动结果，不另起初始化", async () => {
        const create = vi.fn((): Clock => ({now: () => 42}));
        const {context} = host();
        const application = createApplication(context, manifest({capabilities: [{id: "clock", key: clockKey, create}]}));
        expect(application.status()).toMatchObject({phase: "creating", admission: "closed", startup: null});
        const [a, b] = await Promise.all([
            application.admit({label: "a", run: () => "a"}),
            application.admit({label: "b", run: () => "b"}),
        ]);
        expect(a.status).toBe("accepted");
        expect(b.status).toBe("accepted");
        expect(create).toHaveBeenCalledTimes(1);
        const startup = await application.startup;
        expect(startup).toMatchObject({status: "available", gates: [{id: "greeter", status: "passed", required: true}], failures: []});
        expect(application.status()).toMatchObject({phase: "available", admission: "open"});
        if (a.status === "accepted") {
            expect(await a.operation.outcome).toEqual({status: "completed", value: "a"});
        }
    });

    it("必需门禁失败：不接纳、紧急输出可见、已取得资源收口；可选门禁失败只报告，无关能力继续可用", async () => {
        const releaseClock = vi.fn();
        const {context, emergencies} = host();
        const failing = createApplication(
            context,
            manifest({
                releaseClock,
                extraGates: [
                    {id: "optional", kind: "check", required: false, check: () => {
                        throw new Error("可选检查失败");
                    }},
                    {id: "required", kind: "resolve", key: defineServiceKey("unknown")},
                ],
            }),
        );
        const startup = await failing.startup;
        expect(startup).toMatchObject({
            status: "failed",
            gates: [
                {id: "greeter", status: "passed"},
                {id: "optional", status: "failed", required: false, reason: "check:threw", error: {name: "Error", message: "可选检查失败"}},
                {id: "required", status: "failed", required: true, reason: "resolve:unknown-key"},
            ],
            stop: {status: "closed"},
        });
        expect(startup.failures.map((failure) => `${failure.source}:${failure.required}`)).toEqual(["optional:false", "required:true"]);
        expect(emergencies).toEqual([{instanceId: "app-1", stage: "startup", reason: "必需门禁失败，业务不接纳", detail: "required:resolve:unknown-key"}]);
        expect(releaseClock).toHaveBeenCalledTimes(1);
        expect(await failing.admit({label: "x", run: () => 1})).toEqual({status: "rejected", reason: "startup-failed"});
        expect(failing.status()).toMatchObject({phase: "closed", admission: "closed"});

        const {context: okContext} = host("app-2");
        const tolerant = createApplication(okContext, manifest({extraGates: [{id: "optional", kind: "check", required: false, check: () => {
            throw new Error("可选检查失败");
        }}]}));
        expect(await tolerant.startup).toMatchObject({status: "available", gates: [{id: "greeter", status: "passed"}, {id: "optional", status: "failed", required: false}]});
        expect((await tolerant.admit({label: "x", run: () => 1})).status).toBe("accepted");
    });

    it("清单被拒绝的插件是结构化失败：被必需门禁引用时启动失败，门禁本身报 unknown-entry", async () => {
        const unregisteredKey = defineServiceKey<string>("unregistered");
        const rejected: PluginDefinition = {id: "greeter", entries: [{id: "main", location: "server", provides: [unregisteredKey], activate: () => ({services: [provide(unregisteredKey, "x")]})}]};
        const {context} = host();
        const application = createApplication(context, manifest({plugins: [rejected]}));
        const startup = await application.startup;
        expect(startup.status).toBe("failed");
        expect(startup.failures[0]).toMatchObject({category: "manifest", required: true, source: "greeter", stage: "register", reason: "plugin:main:unknown-service-key"});
        expect(startup.gates).toEqual([{id: "greeter", required: true, status: "failed", reason: "activate:unknown-entry", error: null}]);
    });
});

describe("启动与关闭竞态", () => {
    it("初始化未完成时宿主要求停止：迟到完成不重开接纳，已取得资源释放一次，余下门禁跳过", async () => {
        const gate = Promise.withResolvers<void>();
        const releaseClock = vi.fn();
        const {context, controller} = host();
        const application = createApplication(
            context,
            manifest({
                releaseClock,
                plugins: [greeterPlugin("server", async (activation) => {
                    activation.services.require(clockKey);
                    await gate.promise;
                    return {services: [provide(greeterKey, {greet: (name) => name})]};
                })],
                extraGates: [{id: "after", kind: "check", check: () => undefined}],
            }),
        );
        await tick();
        controller.abort();
        gate.resolve();
        const startup = await application.startup;
        expect(startup).toMatchObject({status: "stopped", stop: {status: "closed"}, gates: [{id: "greeter", status: "failed"}, {id: "after", status: "skipped"}]});
        expect(application.status()).toMatchObject({phase: "closed", admission: "closed"});
        expect(releaseClock).toHaveBeenCalledTimes(1);
        expect(await application.stop()).toEqual({status: "closed"});
    });

    it("停止进入后拒绝新业务，已接纳操作仍完成；依赖关闭失败则不报整实例 closed，重复停止观察同一结果", async () => {
        const {context, emergencies} = host();
        const application = createApplication(
            context,
            manifest({
                capabilities: [{id: "clock", key: clockKey, create: (): Clock => ({now: () => 1}), release: () => {
                    throw new Error("clock 释放失败");
                }}],
            }),
        );
        await application.startup;
        const inFlight = Promise.withResolvers<string>();
        const admitted = await application.admit({label: "long", run: () => inFlight.promise});
        expect(admitted.status).toBe("accepted");
        const stopping = application.stop();
        await tick();
        expect(application.status().admission).toBe("closed");
        expect(await application.admit({label: "late", run: () => 1})).toEqual({status: "rejected", reason: "stopping"});
        inFlight.resolve("done");
        if (admitted.status === "accepted") {
            // 等待方立即得到 cancelled；执行方仍在存活依赖上跑完，关闭等它结算后才释放资源。
            expect(await admitted.operation.outcome).toEqual({status: "cancelled", reason: "scope-stopping"});
            expect(await admitted.operation.termination).toEqual({status: "completed"});
        }
        const stop = await stopping;
        // clock 由 services 的服务作用域持有：它释放失败留在 stopping，根作用域因未关闭的子作用域报 blocked。
        expect(stop).toMatchObject({status: "incomplete", reason: "blocked", report: {failedResources: [], unclosedChildren: [expect.any(String)]}});
        expect(await application.stop()).toBe(stop);
        expect(application.status()).toMatchObject({phase: "stopping", stop});
        expect(emergencies.at(-1)).toEqual({instanceId: "app-1", stage: "stop", reason: "关闭未完成：blocked", detail: "failedResources=0 pendingReleases=0 unclosedChildren=1"});
    });
});

describe("隔离与登记", () => {
    it("同一 instanceId 存活期间重复启动共享同一实例；关闭后同 id 得到新实例；不同 id 与位置互相隔离", async () => {
        const registry = createApplicationRegistry();
        const a = host("shared");
        const first = registry.start(a.context, manifest());
        const again = registry.start(host("shared").context, manifest());
        expect(again).toBe(first);
        const other = registry.start(host("other", "browser").context, manifest({plugins: [greeterPlugin("browser")]}));
        expect(other).not.toBe(first);
        expect((await first.startup).status).toBe("available");
        expect((await other.startup).status).toBe("available");
        expect(registry.alive()).toHaveLength(2);
        await first.stop();
        expect(registry.get("shared")).toBeNull();
        expect(other.status().admission).toBe("open");
        const fresh = registry.start(host("shared").context, manifest());
        expect(fresh).not.toBe(first);
        expect((await fresh.startup).status).toBe("available");
    });
});
