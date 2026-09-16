import {
    ENCRYPTED_SECRET_PREFIX,
    resolveSecretCipher,
    warnSecretOnce,
    type SecretCipher,
} from "nbook/server/config/secret-cipher";
import type {StoredGlobalConfig} from "nbook/server/config/types";

/**
 * Global Config 中 API Key 的加密/解密遍历逻辑（安全③）。
 *
 * 覆盖与 StoredGlobalConfig 一致的三类凭据字段：
 * - embedding.apiKey
 * - web.search.providers.<name>.apiKey
 * - models.providers[].options.apiKey
 *
 * 该模块是纯逻辑（不直接碰文件），便于单测注入 fake cipher；文件的读/写分别由
 * config-service（读、写边界）与 secret-migration（启动迁移）调用。
 */

/** 字段级变换结果：新值 + 可选中文警告。 */
type SecretFieldResult = {value: string; warning: string | null};

/** 一次遍历结果（config 可能为 null，表示输入为空）。 */
export type GlobalConfigSecretResult = {
    config: StoredGlobalConfig | null;
    warnings: string[];
};

/** 判断落盘值是否为密文。 */
export function isEncryptedSecret(value: string): boolean {
    return value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

/** 解密单个字段：明文（历史数据）原样返回；密文解不开则清空并给出中文警告。 */
function decryptSecretField(value: string, fieldPath: string, cipher: SecretCipher): SecretFieldResult {
    if (!isEncryptedSecret(value)) {
        return {value, warning: null};
    }
    if (!cipher.available) {
        return {
            value: "",
            warning: `无法解密 ${fieldPath}：当前环境不支持 API Key 解密（非 Windows/Bun）。请在设置中重新填写该 Key。`,
        };
    }
    try {
        return {value: cipher.decrypt(value.slice(ENCRYPTED_SECRET_PREFIX.length)), warning: null};
    } catch {
        return {
            value: "",
            warning: `无法解密 ${fieldPath}：该 Key 可能由另一台机器或另一个 Windows 账户加密。请在设置中重新填写该 Key。`,
        };
    }
}

/** 加密单个字段：空值与已是密文的值保持不变（幂等）；cipher 不可用则降级为明文。 */
function encryptSecretField(value: string, cipher: SecretCipher): string {
    if (!value || isEncryptedSecret(value) || !cipher.available) {
        return value;
    }
    return `${ENCRYPTED_SECRET_PREFIX}${cipher.encrypt(value)}`;
}

/**
 * 逐个遍历 Global Config 里的 apiKey 字段并应用 transform，返回新对象（不修改入参）。
 * 只重建确实存在密钥字段的分支，避免把无关配置写乱。
 */
function mapGlobalConfigSecrets(
    config: StoredGlobalConfig,
    transform: (value: string, fieldPath: string) => SecretFieldResult,
): {config: StoredGlobalConfig; warnings: string[]} {
    const warnings: string[] = [];
    const next: StoredGlobalConfig = {...config};

    const embedding = config.embedding;
    if (embedding && typeof embedding.apiKey === "string") {
        const applied = transform(embedding.apiKey, "embedding.apiKey");
        next.embedding = {...embedding, apiKey: applied.value};
        if (applied.warning) {
            warnings.push(applied.warning);
        }
    }

    const storedProviders = config.web?.search?.providers;
    if (storedProviders && typeof storedProviders === "object") {
        const nextProviders = {...storedProviders} as Record<string, {apiKey?: string} | undefined>;
        for (const [key, provider] of Object.entries(storedProviders) as Array<[string, {apiKey?: string} | undefined]>) {
            if (provider && typeof provider.apiKey === "string") {
                const applied = transform(provider.apiKey, `web.search.providers.${key}.apiKey`);
                nextProviders[key] = {...provider, apiKey: applied.value};
                if (applied.warning) {
                    warnings.push(applied.warning);
                }
            }
        }
        next.web = {...config.web, search: {...config.web?.search, providers: nextProviders}} as StoredGlobalConfig["web"];
    }

    const providers = config.models?.providers;
    if (Array.isArray(providers)) {
        next.models = {
            ...config.models,
            providers: providers.map((provider, index) => {
                const applied = transform(provider.options?.apiKey ?? "", `models.providers[${index}].options.apiKey`);
                if (applied.warning) {
                    warnings.push(applied.warning);
                }
                return {...provider, options: {...provider.options, apiKey: applied.value}};
            }),
        };
    }

    return {config: next, warnings};
}

/**
 * 读取后：把密文 apiKey 解密回明文供运行使用。
 * 明文原样返回（升级兼容）；解不开的字段清空并告警，其余配置照常可用。
 */
export function decryptGlobalConfigSecrets(
    config: StoredGlobalConfig | null,
    cipher: SecretCipher = resolveSecretCipher(),
): GlobalConfigSecretResult {
    if (!config) {
        return {config: null, warnings: []};
    }
    return mapGlobalConfigSecrets(config, (value, fieldPath) => decryptSecretField(value, fieldPath, cipher));
}

/**
 * 写入前：把明文 apiKey 加密后落盘。
 * cipher 不可用（非 Windows/Bun）时保持明文并给出一次告警（降级而非拒绝启动）。
 */
export function encryptGlobalConfigSecrets(
    config: StoredGlobalConfig,
    cipher: SecretCipher = resolveSecretCipher(),
): GlobalConfigSecretResult {
    if (!cipher.available) {
        return {
            config,
            warnings: ["当前环境不支持 API Key 加密（非 Windows/Bun），API Key 将以明文保存。"],
        };
    }
    return mapGlobalConfigSecrets(config, (value) => ({value: encryptSecretField(value, cipher), warning: null}));
}

/** 把一批警告统一打成去重后的日志。 */
export function emitSecretWarnings(warnings: string[]): void {
    for (const warning of warnings) {
        warnSecretOnce(warning);
    }
}
