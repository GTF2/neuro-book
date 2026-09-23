/**
 * runtime.application 内核的公开合同：宿主上下文、装配清单、启动门禁、接纳与停止结果。
 *
 * 只有类型；没有可执行副作用。行为合同见 docs/specs/runtime/application.md。
 * 环境适配器（server/runtime、app/runtime）把宿主事件翻译成这里的 HostContext，再消费 Application。
 */

import type {
    CloseIncomplete,
    CloseRequest,
    FailureError,
    OperationHandle,
    OperationSpec,
    RuntimeInstanceIdentity,
    Scope,
    ScopePhase,
} from "../lifecycle/lifecycle";
import type {ContributionReceiver, EntryRef, PluginDefinition, PluginHost} from "../plugins/plugins";
import type {ServiceAssembly, ServiceCreateContext, ServiceDependency, ServiceKey} from "../services/services";

export type {FailureError} from "../lifecycle/lifecycle";

/** 紧急输出：诊断插件未就绪或失败时仍能报告的最小错误；只含脱敏字段。 */
export interface EmergencyReport {
    readonly instanceId: string;
    readonly stage: "startup" | "stop";
    readonly reason: string;
    readonly detail: string | null;
}

/**
 * 宿主上下文：只提供实例身份、停止来源与最小输出。根定位、凭据与进程管理权限由环境边界先验证，
 * 内核不扫描 cwd、用户目录或网络。
 */
export interface HostContext {
    readonly identity: RuntimeInstanceIdentity;
    /** 宿主要求停止（进程信号、页面销毁、验收脚本）；触发即进入停止。 */
    readonly stopSignal: AbortSignal;
    emergency(report: EmergencyReport): void;
}

/** 装配方提供的本地能力：以根作用域为 owner 的服务提供者（例如后端的进程能力、浏览器的远端协议代理）。 */
export interface CapabilityProvider<T = unknown> {
    readonly id: string;
    readonly key: ServiceKey<T>;
    readonly dependencies?: ReadonlyArray<ServiceDependency>;
    create(context: ServiceCreateContext): T | Promise<T>;
    release?(instance: T): void | Promise<void>;
}

/** 启动门禁：装配方声明的就绪条件；`required` 默认 true。 */
export type StartupGate =
    | {readonly id: string; readonly required?: boolean; readonly kind: "activate"; readonly entry: EntryRef}
    | {readonly id: string; readonly required?: boolean; readonly kind: "resolve"; readonly key: ServiceKey<unknown>}
    | {readonly id: string; readonly required?: boolean; readonly kind: "check"; check(context: {readonly signal: AbortSignal; readonly root: Scope}): void | Promise<void>};

/** 静态受信清单：键登记表、接收者、本地能力、插件定义与门禁；顺序即登记与执行顺序。 */
export interface ApplicationManifest {
    readonly keys: ReadonlyArray<ServiceKey<unknown>>;
    readonly receivers: ReadonlyArray<ContributionReceiver>;
    readonly capabilities?: ReadonlyArray<CapabilityProvider>;
    readonly plugins: ReadonlyArray<PluginDefinition>;
    readonly gates: ReadonlyArray<StartupGate>;
}

export type GateOutcome =
    | {readonly id: string; readonly required: boolean; readonly status: "passed"}
    | {readonly id: string; readonly required: boolean; readonly status: "failed"; readonly reason: string; readonly error: FailureError | null}
    /** 停止先于门禁执行。 */
    | {readonly id: string; readonly required: boolean; readonly status: "skipped"};

export type StartupFailureCategory = "manifest" | "gate" | "stopped";

/** 结构化启动失败：分类、来源与阶段是程序分支依据，人类文案不是。 */
export interface StartupFailure {
    readonly category: StartupFailureCategory;
    readonly required: boolean;
    /** 插件 id、能力 id 或门禁 id。 */
    readonly source: string;
    readonly stage: "register" | "gate";
    readonly reason: string;
    readonly error: FailureError | null;
}

export type StopResult =
    | {readonly status: "closed"}
    /** 清理失败、超时或被阻塞：保持停止中，不映射为 closed。 */
    | {readonly status: "incomplete"; readonly reason: CloseIncomplete["reason"]; readonly report: CloseIncomplete};

export type StartupResult =
    | {readonly status: "available"; readonly instanceId: string; readonly gates: ReadonlyArray<GateOutcome>; readonly failures: ReadonlyArray<StartupFailure>}
    /** 必需失败：不发布可用结果，已取得资源已收口（结果见 `stop`）。 */
    | {readonly status: "failed"; readonly instanceId: string; readonly gates: ReadonlyArray<GateOutcome>; readonly failures: ReadonlyArray<StartupFailure>; readonly stop: StopResult}
    /** 宿主在启动完成前要求停止。 */
    | {readonly status: "stopped"; readonly instanceId: string; readonly gates: ReadonlyArray<GateOutcome>; readonly failures: ReadonlyArray<StartupFailure>; readonly stop: StopResult};

export type AdmissionRejection = "startup-failed" | "stopping" | "closed";

export type AdmissionResult<T> =
    | {readonly status: "accepted"; readonly operation: OperationHandle<T>}
    | {readonly status: "rejected"; readonly reason: AdmissionRejection};

export interface ApplicationStatus {
    readonly identity: RuntimeInstanceIdentity;
    readonly phase: ScopePhase;
    /** 只有必需门禁全部成功且未停止时开放。 */
    readonly admission: "closed" | "open";
    readonly startup: StartupResult | null;
    readonly gates: ReadonlyArray<GateOutcome>;
    readonly failures: ReadonlyArray<StartupFailure>;
    readonly stop: StopResult | null;
}

export interface Application {
    readonly identity: RuntimeInstanceIdentity;
    readonly root: Scope;
    readonly assembly: ServiceAssembly;
    readonly plugins: PluginHost;
    /** 同一实例的全部启动请求共享它。 */
    readonly startup: Promise<StartupResult>;
    status(): ApplicationStatus;
    /** 等待同一启动结果后接纳业务操作；未开放接纳时明确拒绝，不绕过启动。 */
    admit<T>(spec: OperationSpec<T>): Promise<AdmissionResult<T>>;
    /** 幂等：重复停止观察同一次结果。 */
    stop(request?: CloseRequest): Promise<StopResult>;
}
