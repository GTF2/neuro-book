import fs from "node:fs/promises";
import path from "node:path";
import {resolveUserNbookRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import {resolveSecretCipher, warnSecretOnce} from "nbook/server/config/secret-cipher";
import {emitSecretWarnings, encryptGlobalConfigSecrets} from "nbook/server/config/global-config-secrets";
import type {StoredGlobalConfig} from "nbook/server/config/types";

/** 迁移目标路径：默认跟随当前 State Root（测试可显式覆盖）。 */
function defaultGlobalConfigPath(): string {
    return path.join(resolveUserNbookRoot(), "config.json");
}

/**
 * 启动时一次性迁移：把 Global Config 里尚存的明文 API Key 加密落盘。
 *
 * 设计取舍：
 * - 只在「确实发生加密变化」时才写回，避免每次启动都重写文件、触发文件 watcher。
 * - 任何失败都只告警、不抛出 —— 迁移是尽力而为，绝不能拖垮启动。未成功迁移的明文值
 *   会在下次保存配置时由写路径自动加密（config-service 的 saveGlobalConfig）。
 * - cipher 不可用（非 Windows/Bun）时直接跳过：本就以明文保存，无需迁移。
 */
export async function migrateGlobalConfigSecretStorage(options?: {configPath?: string}): Promise<void> {
    const filePath = options?.configPath ?? defaultGlobalConfigPath();
    try {
        const cipher = resolveSecretCipher();
        if (!cipher.available) {
            return;
        }
        let text: string;
        try {
            text = await fs.readFile(filePath, "utf-8");
        } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
                return; // 全新实例尚无配置：无需迁移
            }
            throw error;
        }
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return;
        }
        const raw = parsed as StoredGlobalConfig;
        const before = JSON.stringify(raw);
        const {config: migrated, warnings} = encryptGlobalConfigSecrets(raw, cipher);
        emitSecretWarnings(warnings);
        if (migrated && JSON.stringify(migrated) !== before) {
            await fs.mkdir(path.dirname(filePath), {recursive: true});
            await fs.writeFile(filePath, `${JSON.stringify(migrated, null, 4)}\n`, "utf-8");
        }
    } catch (error) {
        warnSecretOnce(`API Key 加密迁移失败（不影响使用，将在下次保存配置时重试）：${error instanceof Error ? error.message : String(error)}`);
    }
}
