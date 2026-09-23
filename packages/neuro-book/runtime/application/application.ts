/**
 * runtime.application：运行实例启动、接纳、停止与结果查询的唯一公开入口。
 *
 * Owner 为 runtime。本目录只允许同目录相对导入与 lifecycle / services / plugins 三个机制入口：
 * 不依赖 Vue、Nuxt、Nitro、进程信号、DOM、文件或数据库驱动。宿主事件由环境适配器
 * （server/runtime/foundation、app/runtime）翻译为 `HostContext` 后交给这里。
 *
 * 数据边界：内核只在内存里维护清单登记、门禁结果与停止结果；本能力不定义用户持久格式，
 * 正常停止不删除任何配置、Project、数据库或 Storage 记录。
 *
 * 行为合同见 docs/specs/runtime/application.md。
 */

import {ApplicationImpl} from "./bootstrap";
import type {Application, ApplicationManifest, HostContext} from "./contracts";

export type * from "./contracts";

/** 创建并启动一个运行实例；启动结果在 `application.startup` 上共享。 */
export function createApplication(host: HostContext, manifest: ApplicationManifest): Application {
    return new ApplicationImpl(host, manifest);
}

/**
 * 同一宿主内的实例登记：重复启动请求指向同一 `instanceId` 且实例仍存活时共享它，不再创建一套
 * 提供者；已关闭的实例不复活，同 id 再次启动得到新实例。不同 id 的实例互相隔离。
 */
export interface ApplicationRegistry {
    start(host: HostContext, manifest: ApplicationManifest): Application;
    get(instanceId: string): Application | null;
    /** 当前存活（未进入 closed）的实例。 */
    alive(): ReadonlyArray<Application>;
}

export function createApplicationRegistry(): ApplicationRegistry {
    const applications = new Map<string, Application>();
    const isAlive = (application: Application): boolean => application.root.phase !== "closed";
    return {
        start(host, manifest) {
            const existing = applications.get(host.identity.instanceId);
            if (existing !== undefined && isAlive(existing)) {
                return existing;
            }
            const application = createApplication(host, manifest);
            applications.set(host.identity.instanceId, application);
            return application;
        },
        get(instanceId) {
            const application = applications.get(instanceId);
            return application === undefined || !isAlive(application) ? null : application;
        },
        alive() {
            return [...applications.values()].filter(isAlive);
        },
    };
}
