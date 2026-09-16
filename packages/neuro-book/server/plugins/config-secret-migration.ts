import {defineNitroPlugin} from "nitropack/runtime";
import {migrateGlobalConfigSecretStorage} from "nbook/server/config/secret-migration";

/**
 * 启动时把历史明文 API Key 迁移为加密存储（best-effort，失败不阻塞启动）。
 * 详细取舍见 secret-migration.ts。
 */
export default defineNitroPlugin(async () => {
    await migrateGlobalConfigSecretStorage();
});
