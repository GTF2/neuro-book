/**
 * 宿主内的实例表：环境适配器用它持有「一个运行实例 + 适配器自己的监听」。
 *
 * 同一 instanceId 存活（未 closed）期间重复启动共享同一宿主对象，不再创建一套提供者；实例关闭后
 * 其 id 退役：不能再用于启动（lifecycle 身份合同要求刷新、重启或再次启动换新身份；诊断按实例身份
 * 归属记录，复用会把两个实例的记录混在一起），表也不再持有已关闭实例的对象图。
 * 停止未完成的实例仍是同一实例（停止中），继续共享，直到恢复关闭后在下一次查询时退役。
 */

import type {Application} from "./contracts";

export interface InstanceTable<T extends {readonly application: Application}> {
    /** 存活则返回同一宿主对象；id 已退役抛 TypeError；否则调用 `create` 创建并登记。 */
    start(instanceId: string, create: () => T): T;
    /** 存活宿主；没有或已关闭返回 null。 */
    get(instanceId: string): T | null;
}

export function createInstanceTable<T extends {readonly application: Application}>(): InstanceTable<T> {
    const live = new Map<string, T>();
    const retired = new Set<string>();
    const lookup = (instanceId: string): T | null => {
        const entry = live.get(instanceId);
        if (entry === undefined) {
            return null;
        }
        if (entry.application.root.phase !== "closed") {
            return entry;
        }
        live.delete(instanceId);
        retired.add(instanceId);
        return null;
    };
    return {
        start(instanceId, create) {
            const existing = lookup(instanceId);
            if (existing !== null) {
                return existing;
            }
            if (retired.has(instanceId)) {
                throw new TypeError(`instanceId ${instanceId} 属于已关闭的实例；再次启动必须使用新的实例身份`);
            }
            const entry = create();
            live.set(instanceId, entry);
            // 停止结算为 closed 时立即退役；未完成则保持存活，恢复关闭后由下一次查询退役。
            void entry.application.stopped.then(() => lookup(instanceId));
            return entry;
        },
        get: lookup,
    };
}
