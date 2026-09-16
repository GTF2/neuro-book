import {afterEach, describe, expect, it} from "vitest";
import {
    ENCRYPTED_SECRET_PREFIX,
    SecretDecryptError,
    setSecretCipherForTesting,
    UnavailableSecretCipher,
    type SecretCipher,
} from "nbook/server/config/secret-cipher";
import {
    decryptGlobalConfigSecrets,
    encryptGlobalConfigSecrets,
    isEncryptedSecret,
} from "nbook/server/config/global-config-secrets";
import type {ModelProviderOptionsConfig, StoredGlobalConfig} from "nbook/server/config/types";

const fakeCipher: SecretCipher = {
    available: true,
    encrypt: (plaintext) => Buffer.from(`fake:${plaintext}`, "utf8").toString("base64"),
    decrypt: (ciphertext) => {
        const decoded = Buffer.from(ciphertext, "base64").toString("utf8");
        if (!decoded.startsWith("fake:")) {
            throw new SecretDecryptError("fake cipher 无法识别该密文");
        }
        return decoded.slice("fake:".length);
    },
};

function providerOptions(apiKey: string): ModelProviderOptionsConfig {
    return {apiKey, baseURL: "https://example.com/v1", proxy: "", timeoutMs: null, requestOptions: {}};
}

/** 覆盖三类凭据字段的完整配置样例（Key 均为明显假值）。 */
function fullConfig(): StoredGlobalConfig {
    return {
        models: {
            default: "p0",
            providers: [
                {id: "p0", name: "A", enabled: true, modelApi: null, options: providerOptions("sk-aaa"), models: []},
                {id: "p1", name: "B", enabled: true, modelApi: null, options: providerOptions("sk-bbb"), models: []},
            ],
        },
        embedding: {apiKey: "sk-embed"},
        web: {
            search: {
                order: ["tavily", "brave"],
                providers: {
                    tavily: {apiKey: "sk-tv"},
                    brave: {apiKey: "sk-br"},
                },
            },
        },
    };
}

/** 取全部 apiKey 字段值，便于断言。 */
function collectApiKeys(config: StoredGlobalConfig): string[] {
    return [
        config.embedding?.apiKey ?? "",
        config.web?.search?.providers?.tavily?.apiKey ?? "",
        config.web?.search?.providers?.brave?.apiKey ?? "",
        ...(config.models?.providers ?? []).map((provider) => provider.options?.apiKey ?? ""),
    ];
}

describe("global-config-secrets", () => {
    afterEach(() => {
        setSecretCipherForTesting(null);
    });

    it("加密→解密往返还原全部 Key，且落盘内容不含明文", () => {
        const original = fullConfig();
        const encrypted = encryptGlobalConfigSecrets(original, fakeCipher);
        expect(encrypted.warnings).toEqual([]);

        const storedValues = collectApiKeys(encrypted.config as StoredGlobalConfig);
        expect(storedValues).toHaveLength(5);
        for (const value of storedValues) {
            expect(isEncryptedSecret(value)).toBe(true);
        }
        // 序列化后的落盘文本绝不能出现明文 Key。
        const serialized = JSON.stringify(encrypted.config);
        for (const plaintext of ["sk-aaa", "sk-bbb", "sk-embed", "sk-tv", "sk-br"]) {
            expect(serialized).not.toContain(plaintext);
        }

        const decrypted = decryptGlobalConfigSecrets(encrypted.config, fakeCipher);
        expect(decrypted.warnings).toEqual([]);
        expect(collectApiKeys(decrypted.config as StoredGlobalConfig)).toEqual(collectApiKeys(original));
    });

    it("明文旧值（无前缀）被原样读取，不产生告警", () => {
        const legacy = fullConfig();
        const result = decryptGlobalConfigSecrets(legacy, fakeCipher);
        expect(result.warnings).toEqual([]);
        expect(collectApiKeys(result.config as StoredGlobalConfig)).toEqual(collectApiKeys(legacy));
    });

    it("解密失败时优雅降级：该字段清空、给出中文告警、其余配置保留", () => {
        const stored: StoredGlobalConfig = {
            models: {
                default: "p0",
                providers: [{id: "p0", name: "A", enabled: true, modelApi: null, options: providerOptions(`${ENCRYPTED_SECRET_PREFIX}bm90LWZha2U=`), models: []}],
            },
            embedding: {apiKey: `${ENCRYPTED_SECRET_PREFIX}bm90LWZha2U=`},
        };
        const result = decryptGlobalConfigSecrets(stored, fakeCipher);
        const config = result.config as StoredGlobalConfig;
        expect(config.models?.providers?.[0]?.options.apiKey).toBe("");
        expect(config.embedding?.apiKey).toBe("");
        // 未涉及密钥的字段照常可用。
        expect(config.models?.default).toBe("p0");
        expect(result.warnings).toHaveLength(2);
        expect(result.warnings.every((warning) => warning.includes("无法解密"))).toBe(true);
    });

    it("cipher 不可用时：加密降级为明文并告警，遇密文则清空", () => {
        const unavailable = new UnavailableSecretCipher();
        const encrypted = encryptGlobalConfigSecrets(fullConfig(), unavailable);
        expect(encrypted.warnings).toHaveLength(1);
        // 不可用 = 保持明文，不产生前缀。
        expect(collectApiKeys(encrypted.config as StoredGlobalConfig)).toContain("sk-aaa");

        const onEncrypted = decryptGlobalConfigSecrets(
            {embedding: {apiKey: `${ENCRYPTED_SECRET_PREFIX}bm90LWZha2U=`}},
            unavailable,
        );
        expect((onEncrypted.config as StoredGlobalConfig).embedding?.apiKey).toBe("");
        expect(onEncrypted.warnings[0]).toContain("无法解密");
    });

    it("已加密的值不会被二次加密（幂等）", () => {
        const once = encryptGlobalConfigSecrets(fullConfig(), fakeCipher).config as StoredGlobalConfig;
        const twice = encryptGlobalConfigSecrets(once, fakeCipher).config as StoredGlobalConfig;
        expect(collectApiKeys(twice)).toEqual(collectApiKeys(once));
    });

    it("空值不加密（保持为空串）", () => {
        const config: StoredGlobalConfig = {embedding: {apiKey: ""}};
        const result = encryptGlobalConfigSecrets(config, fakeCipher);
        expect((result.config as StoredGlobalConfig).embedding?.apiKey).toBe("");
    });
});
