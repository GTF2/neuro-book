import {afterEach, describe, expect, it} from "vitest";
import {
    ENCRYPTED_SECRET_PREFIX,
    resolveSecretCipher,
    SecretDecryptError,
    setSecretCipherForTesting,
    UnavailableSecretCipher,
    type SecretCipher,
} from "nbook/server/config/secret-cipher";

/** 明显是假值、且与真实 DPAPI 无关的 fake cipher，保证测试不依赖 Windows。 */
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

describe("secret-cipher", () => {
    afterEach(() => {
        setSecretCipherForTesting(null);
    });

    it("测试环境（Node/vitest）默认 cipher 不可用；在 Bun 下跑测试则跳过", () => {
        if (typeof (globalThis as {Bun?: unknown}).Bun !== "undefined") {
            return;
        }
        expect(resolveSecretCipher().available).toBe(false);
    });

    it("注入的 fake cipher 优先于默认实现，可完成往返", () => {
        setSecretCipherForTesting(fakeCipher);
        const cipher = resolveSecretCipher();
        expect(cipher.available).toBe(true);
        expect(cipher.decrypt(cipher.encrypt("sk-fake-123"))).toBe("sk-fake-123");
    });

    it("不可用 cipher 的加/解密都会抛 SecretDecryptError（由调用方降级）", () => {
        const cipher = new UnavailableSecretCipher();
        expect(cipher.available).toBe(false);
        expect(() => cipher.encrypt("x")).toThrow(SecretDecryptError);
        expect(() => cipher.decrypt("x")).toThrow(SecretDecryptError);
    });

    it("密文前缀常量稳定（落盘格式契约）", () => {
        expect(ENCRYPTED_SECRET_PREFIX).toBe("dpapi:v1:");
    });
});
