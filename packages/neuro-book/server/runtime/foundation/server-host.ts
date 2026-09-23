/**
 * 后端环境适配器：把一个受管 Node/Bun 进程的合作停止输入翻译为 runtime.application 的宿主上下文。
 *
 * 适配器只拥有自己登记的进程信号监听：每个实例挂接一次，实例停止结算后移除，之后到达的信号
 * 不再触碰该实例。它不杀任何进程、不扫描 cwd、不读取凭据；根定位与权限由调用方先验证。
 * 第一切片用受控装配验证真实宿主事件，正式产品的 product-startup/shutdown 尚未接入这里。
 */

import {createApplicationRegistry} from "../../../runtime/application/application";
import type {Application, ApplicationManifest, ApplicationRegistry, EmergencyReport, StopResult} from "../../../runtime/application/application";

/** 适配器需要的最小进程接口：只用到信号事件的挂接与移除；测试可传入 EventEmitter 替身。 */
export interface SignalSource {
    on(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
    off(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
}

export interface ServerHostOptions {
    readonly instanceId: string;
    readonly manifest: ApplicationManifest;
    /** 合作停止信号；缺省 SIGINT 与 SIGTERM。Windows 上外部进程发送的信号不可合作，宿主需另提供停止通道。 */
    readonly signals?: ReadonlyArray<NodeJS.Signals>;
    /** 挂接信号的进程对象；缺省当前进程。 */
    readonly process?: SignalSource;
    /** 紧急输出；缺省向 stderr 写一行 JSON。 */
    readonly emergency?: (report: EmergencyReport) => void;
}

export interface ServerHost {
    readonly application: Application;
    /** 宿主的其它停止来源（控制路由、stdin 命令）经此请求停止；只有第一次请求生效并记录来源。 */
    requestStop(source: string): void;
    /** 生效的停止来源；未请求为 null。 */
    readonly stopSource: string | null;
    /** 停止结算后信号监听已移除。 */
    readonly detached: boolean;
}

const DEFAULT_SIGNALS: ReadonlyArray<NodeJS.Signals> = ["SIGINT", "SIGTERM"];

function writeEmergency(report: EmergencyReport): void {
    process.stderr.write(`${JSON.stringify({emergency: report})}\n`);
}

class ServerHostImpl implements ServerHost {
    readonly application: Application;
    stopSource: string | null = null;
    detached = false;
    readonly #controller = new AbortController();
    readonly #source: SignalSource;
    readonly #signals: ReadonlyArray<NodeJS.Signals>;
    readonly #onSignal = (signal: NodeJS.Signals): void => this.requestStop(`signal:${signal}`);

    constructor(registry: ApplicationRegistry, options: ServerHostOptions) {
        this.#source = options.process ?? process;
        this.#signals = options.signals ?? DEFAULT_SIGNALS;
        for (const signal of this.#signals) {
            this.#source.on(signal, this.#onSignal);
        }
        this.application = registry.start(
            {
                identity: {location: "server", instanceId: options.instanceId},
                stopSignal: this.#controller.signal,
                emergency: options.emergency ?? writeEmergency,
            },
            options.manifest,
        );
        void this.#settled().then(() => this.#detach());
    }

    requestStop(source: string): void {
        if (this.#controller.signal.aborted) {
            return;
        }
        this.stopSource = source;
        this.#controller.abort();
    }

    /** 实例停止结算：启动未成功即已结算；否则等待根作用域进入停止后的关闭结果。 */
    async #settled(): Promise<StopResult | null> {
        const startup = await this.application.startup;
        if (startup.status !== "available") {
            return startup.stop;
        }
        const stopSignal = this.application.root.stopSignal;
        if (!stopSignal.aborted) {
            await new Promise<void>((resolve) => stopSignal.addEventListener("abort", () => resolve(), {once: true}));
        }
        return this.application.stop();
    }

    #detach(): void {
        for (const signal of this.#signals) {
            this.#source.off(signal, this.#onSignal);
        }
        this.detached = true;
    }
}

/**
 * 服务端宿主：一个进程可以持有多个实例（按 instanceId 隔离）；同一 instanceId 存活期间重复启动
 * 共享同一实例与同一组监听，不再挂接第二份。
 */
export class ServerRuntimeHost {
    readonly #registry: ApplicationRegistry = createApplicationRegistry();
    readonly #hosts = new Map<string, ServerHostImpl>();

    start(options: ServerHostOptions): ServerHost {
        const existing = this.#hosts.get(options.instanceId);
        if (existing !== undefined && existing.application.root.phase !== "closed") {
            return existing;
        }
        const host = new ServerHostImpl(this.#registry, options);
        this.#hosts.set(options.instanceId, host);
        return host;
    }

    get(instanceId: string): ServerHost | null {
        const host = this.#hosts.get(instanceId);
        return host === undefined || host.application.root.phase === "closed" ? null : host;
    }
}
