/**
 * runtime.application：运行实例启动、接纳、停止与结果查询的唯一公开入口。
 *
 * Owner 为 runtime。本目录只允许同目录相对导入与 lifecycle / services / plugins 三个机制入口：
 * 不依赖 Vue、Nuxt、Nitro、进程信号、DOM、文件或数据库驱动。宿主事件由环境适配器
 * （server/runtime/foundation、app/runtime）翻译为 `HostContext` 后交给这里；
 * 「同一 instanceId 存活期间共享实例、已关闭不复活」由持有实例表的适配器保证，内核不维护全局表。
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
