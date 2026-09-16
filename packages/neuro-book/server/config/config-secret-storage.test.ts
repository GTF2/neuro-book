import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {
    ENCRYPTED_SECRET_PREFIX,
    SecretDecryptError,
    setSecretCipherForTesting,
    type SecretCipher,
} from "nbook/server/config/secret-cipher";
import {readGlobalConfigFileAtWorkspaceRoot} from "nbook/server/config/config-service";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";

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

let workspaceRoot: string;

beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nb-config-secret-"));
    await fs.mkdir(path.join(workspaceRoot, ".nbook"), {recursive: true});
});

afterEach(async () => {
    setSecretCipherForTesting(null);
    await fs.rm(workspaceRoot, {recursive: true, force: true});
});

async function writeGlobalConfig(value: unknown): Promise<void> {
    await fs.writeFile(path.join(workspaceRoot, ".nbook", "config.json"), JSON.stringify(value), "utf-8");
}

describe("config-service 读取边界的密钥解密", () => {
    it("明文旧值原样读出（升级兼容，不丢 Key）", async () => {
        await writeGlobalConfig({
            models: {
                providers: [{
                    id: "p0",
                    name: "A",
                    enabled: true,
                    modelApi: null,
                    options: {apiKey: "sk-plain", baseURL: "", proxy: "", timeoutMs: null, requestOptions: {}},
                    models: [],
                }],
            },
        });
        setSecretCipherForTesting(fakeCipher);

        const config = await readGlobalConfigFileAtWorkspaceRoot(absoluteFsPath(workspaceRoot));

        expect(config.models?.providers?.[0]?.options.apiKey).toBe("sk-plain");
    });

    it("密文被解密回明文", async () => {
        const encrypted = `${ENCRYPTED_SECRET_PREFIX}${Buffer.from("fake:sk-enc", "utf8").toString("base64")}`;
        await writeGlobalConfig({embedding: {apiKey: encrypted}});
        setSecretCipherForTesting(fakeCipher);

        const config = await readGlobalConfigFileAtWorkspaceRoot(absoluteFsPath(workspaceRoot));

        expect(config.embedding?.apiKey).toBe("sk-enc");
    });

    it("解不开的密文清空该字段且不抛错", async () => {
        await writeGlobalConfig({embedding: {apiKey: `${ENCRYPTED_SECRET_PREFIX}bm90LWZha2U=`}});
        setSecretCipherForTesting(fakeCipher);

        const config = await readGlobalConfigFileAtWorkspaceRoot(absoluteFsPath(workspaceRoot));

        expect(config.embedding?.apiKey).toBe("");
    });
});
