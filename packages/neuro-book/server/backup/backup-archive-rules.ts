// 备份归档的纯规则层（Task 112 spec §9.4）：排除规则、zip 条目名安全化与 Global Config 密钥脱敏。
// 抽成纯函数便于直接单测，也让打包/恢复两侧共享同一判据。

/**
 * 打包排除规则：secrets/、logs/ 整目录、锁文件、临时文件、SQLite wal/shm 伴生文件。
 * relativePath 以 State Root 为基准、使用 / 分隔。
 */
export function shouldExcludeFromBackup(relativePath: string): boolean {
    const normalized = relativePath.replaceAll("\\", "/");
    if (normalized === "secrets" || normalized.startsWith("secrets/")
        || normalized === "logs" || normalized.startsWith("logs/")) {
        return true;
    }
    const name = normalized.split("/").pop() ?? "";
    return name.endsWith(".lock") || name.endsWith(".tmp") || name.endsWith("-wal") || name.endsWith("-shm");
}

/**
 * SQLite 数据库判定：这类文件不能直接拷贝活文件，打包时走 VACUUM INTO 冷快照。
 */
export function isSqliteFile(relativePath: string): boolean {
    return relativePath.replaceAll("\\", "/").endsWith(".sqlite");
}

/**
 * zip 条目名安全化（zip-slip 防护）：拒绝绝对路径、盘符、UNC 与 .. 逃逸；
 * 返回归一化的 / 分隔相对路径，非法返回 null。
 */
export function sanitizeZipEntryName(entryName: string): string | null {
    const normalized = entryName.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || normalized.startsWith("//") || /^[a-zA-Z]:/.test(normalized)) {
        return null;
    }
    const parts = normalized.split("/").filter((part) => part.length > 0 && part !== ".");
    if (parts.length === 0 || parts.some((part) => part === "..")) {
        return null;
    }
    return parts.join("/");
}

/**
 * 备份中唯一携带明文 API Key 的文件（Global Config）；其余密钥文件应整份排除。
 * 相对路径以 State Root 为基准：Global Config 位于 workspace/.nbook/config.json。
 */
export const GLOBAL_CONFIG_BACKUP_ENTRY = "workspace/.nbook/config.json";

/** 判断归档条目是否为需要脱敏的 Global Config。 */
export function isGlobalConfigBackupEntry(relativePath: string): boolean {
    return relativePath.replaceAll("\\", "/") === GLOBAL_CONFIG_BACKUP_ENTRY;
}

/** 就地把对象的 apiKey 字符串清空；非对象或非字符串字段保持不变。 */
function blankApiKey(container: unknown): void {
    if (!container || typeof container !== "object" || Array.isArray(container)) {
        return;
    }
    const record = container as Record<string, unknown>;
    if (typeof record.apiKey === "string") {
        record.apiKey = "";
    }
}

/**
 * 从 Global Config 文本中清除全部 API Key 值，返回仍是合法 JSON 的文本。
 *
 * 覆盖 server/config/types.ts 声明的三类凭据字段：models.providers[].options.apiKey、
 * embedding.apiKey、web.search.providers.<name>.apiKey。值置为空字符串而非删除字段：
 * 读取侧 `normalizeText` 对缺失与空串等价，保留字段可维持 StoredProviderConfig.options.apiKey
 * 的 string 形状，避免写入路径拿到 undefined。
 *
 * 入参不是合法 JSON 时直接抛错（fail-closed）：绝不能把可能仍含明文 Key 的原始文本放进归档。
 */
export function redactGlobalConfigSecrets(text: string): string {
    let config: unknown;
    try {
        config = JSON.parse(text) as unknown;
    } catch (error) {
        throw new Error("Global Config 不是合法 JSON，为避免备份泄露密钥已停止；请先修复 workspace/.nbook/config.json 后重试。", {cause: error});
    }
    if (config && typeof config === "object" && !Array.isArray(config)) {
        const global = config as Record<string, unknown>;
        blankApiKey(global.embedding);
        const web = global.web;
        const search = web && typeof web === "object" ? (web as Record<string, unknown>).search : undefined;
        const searchProviders = search && typeof search === "object" ? (search as Record<string, unknown>).providers : undefined;
        if (searchProviders && typeof searchProviders === "object" && !Array.isArray(searchProviders)) {
            for (const provider of Object.values(searchProviders as Record<string, unknown>)) {
                blankApiKey(provider);
            }
        }
        const models = global.models;
        const providers = models && typeof models === "object" ? (models as Record<string, unknown>).providers : undefined;
        if (Array.isArray(providers)) {
            for (const provider of providers) {
                const options = provider && typeof provider === "object" ? (provider as Record<string, unknown>).options : undefined;
                blankApiKey(options);
            }
        }
    }
    return `${JSON.stringify(config, null, 4)}\n`;
}
