import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {
    ENCRYPTED_SECRET_PREFIX,
    SecretDecryptError,
    setSecretCipherForTesting,
    UnavailableSecretCipher,
    type SecretCipher,
} from "nbook/server/config/secret-cipher";
import {migrateGlobalConfigSecretStorage} from "nbook/server/config/secret-migration";

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

const plaintextConfig = {
    models: {
        default: "p0",
        providers: [{
            id: "p0",
            name: "A",
            enabled: true,
            modelApi: null,
            options: {apiKey: "sk-legacy", baseURL: "", proxy: "", timeoutMs: null, requestOptions: {}},
            models: [],
        }],
    },
    embedding: {apiKey: "sk-embed-legacy"},
};

let root: string;
let configPath: string;

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "nb-secret-migration-"));
    configPath = path.join(root, "config.json");
});

afterEach(async () => {
    setSecretCipherForTesting(null);
    await fs.rm(root, {recursive: true, force: true});
});

describe("secret-migration", () => {
    it("把明文 Key 加密落盘", async () => {
        await fs.writeFile(configPath, JSON.stringify(plaintextConfig), "utf-8");
        setSecretCipherForTesting(fakeCipher);

        await migrateGlobalConfigSecretStorage({configPath});

        const raw = await fs.readFile(configPath, "utf-8");
        expect(raw).not.toContain("sk-legacy");
        expect(raw).not.toContain("sk-embed-legacy");
        expect(raw).toContain(ENCRYPTED_SECRET_PREFIX);
    });

    it("已是密文时不再改写文件（避免每次启动无谓写入）", async () => {
        await fs.writeFile(configPath, JSON.stringify(plaintextConfig), "utf-8");
        setSecretCipherForTesting(fakeCipher);

        await migrateGlobalConfigSecretStorage({configPath});
        const first = await fs.readFile(configPath, "utf-8");
        await migrateGlobalConfigSecretStorage({configPath});
        const second = await fs.readFile(configPath, "utf-8");

        expect(second).toBe(first);
    });

    it("cipher 不可用时保持明文不动", async () => {
        await fs.writeFile(configPath, JSON.stringify(plaintextConfig), "utf-8");
        setSecretCipherForTesting(new UnavailableSecretCipher());

        await migrateGlobalConfigSecretStorage({configPath});

        const raw = await fs.readFile(configPath, "utf-8");
        expect(raw).toContain("sk-legacy");
        expect(raw).not.toContain(ENCRYPTED_SECRET_PREFIX);
    });

    it("文件不存在时静默跳过、不抛错", async () => {
        setSecretCipherForTesting(fakeCipher);
        await expect(migrateGlobalConfigSecretStorage({configPath: path.join(root, "missing.json")})).resolves.toBeUndefined();
    });
});
