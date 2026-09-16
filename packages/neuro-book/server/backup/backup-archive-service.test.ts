import {createHash, randomBytes} from "node:crypto";
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import { testHostPath } from "@notnotype/neuro-book-test-support/test-path"
import {join} from "node:path";
import {createClient} from "@libsql/client";
import {strFromU8, unzipSync} from "fflate";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {createRuntimePaths} from "nbook/server/runtime/paths/runtime-paths";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";
import {BackupArchiveService} from "nbook/server/backup/backup-archive-service";
import {backupKeyId, type BackupEncryptionKey} from "nbook/server/backup/backup-keyring-service";
import {
    createBackupCiphertextStream,
    createBackupEnvelopeDecipher,
    inspectBackupEnvelope,
    verifyBackupEnvelope,
} from "nbook/server/backup/backup-envelope";

// 归档服务端到端：假 State Root（含真实 SQLite）打包 → 解包断言条目集、
// 排除规则生效、SQLite 走冷快照、nb-backup.json 合法、sha256 与产物一致。

let fixtureRoot = "";
let tmpDir = "";

beforeAll(async () => {
    fixtureRoot = await mkdtemp(testHostPath("nbook-archive-fixture-"));
    tmpDir = await mkdtemp(testHostPath("nbook-archive-out-"));

    // 假 State Root：workspace 正文 + 应用库（真 SQLite）+ 顶层 config/.env + 应排除物
    await mkdir(join(fixtureRoot, "workspace", "novel-a", "manuscript"), {recursive: true});
    await mkdir(join(fixtureRoot, "workspace", ".nbook"), {recursive: true});
    await mkdir(join(fixtureRoot, "logs"), {recursive: true});
    await mkdir(join(fixtureRoot, "secrets"), {recursive: true});
    await writeFile(join(fixtureRoot, "workspace", "novel-a", "manuscript", "chapter-1.md"), "# 第一章\n正文内容");
    await writeFile(join(fixtureRoot, "workspace", "novel-a", "draft.tmp"), "temp");
    await writeFile(join(fixtureRoot, "workspace", "novel-a", "editor.lock"), "lock");
    await writeFile(join(fixtureRoot, "logs", "app.log"), "log line");
    await writeFile(join(fixtureRoot, "secrets", "backup-keyring.json"), "must not leak");
    await writeFile(join(fixtureRoot, "config.yaml"), "auth:\n  enabled: true\n");
    await writeFile(join(fixtureRoot, ".env"), "SECRET=1\n");
    await writeFile(join(fixtureRoot, "workspace", ".nbook", "config.json"), JSON.stringify({
        models: {
            default: null,
            providers: [{
                id: "openai",
                name: "OpenAI",
                enabled: true,
                modelApi: null,
                options: {
                    apiKey: "sk-live-provider-secret",
                    baseURL: "https://api.example.com",
                    proxy: "",
                    timeoutMs: null,
                    requestOptions: {},
                },
                models: [],
            }],
        },
        embedding: {enabled: false, provider: "openai-compatible", model: null, dimensions: null, apiKey: "sk-live-embedding-secret", baseURL: "", timeoutMs: null, requestOptions: {}},
        web: {search: {order: ["tavily"], providers: {tavily: {enabled: true, apiKey: "tvly-live-secret", timeoutMs: 15000}, brave: {enabled: false, apiKey: "", country: "US", searchLang: "en", timeoutMs: 15000}}}},
    }, null, 4));

    const dbPath = join(fixtureRoot, "workspace", ".nbook", "neuro-book.sqlite").replaceAll("\\", "/");
    const client = createClient({url: `file:${dbPath}`});
    await client.execute("CREATE TABLE demo (id INTEGER PRIMARY KEY, name TEXT)");
    await client.execute("INSERT INTO demo (name) VALUES ('hello')");
    client.close();
});

afterAll(async () => {
    await rm(fixtureRoot, {recursive: true, force: true}).catch(() => undefined);
    await rm(tmpDir, {recursive: true, force: true}).catch(() => undefined);
});

describe("BackupArchiveService", () => {
    it("压缩直接进入密文 envelope：条目、摘要、排除和 SQLite 快照均正确", async () => {
        const paths = createRuntimePaths({
            applicationRoot: absoluteFsPath(fixtureRoot),
            stateRoot: absoluteFsPath(fixtureRoot),
        });
        const keyBytes = randomBytes(32);
        const encryptionKey: BackupEncryptionKey = {keyId: backupKeyId(keyBytes), key: keyBytes};
        const progress: Array<[number, number]> = [];
        const result = await new BackupArchiveService().createArchive(
            paths,
            tmpDir,
            encryptionKey,
            (done, total) => progress.push([done, total]),
        );

        expect(result.warnings).toEqual([]);
        expect(result.fileCount).toBe(4); // chapter-1.md + neuro-book.sqlite + config.yaml + config.json（.env 已排除）
        expect(progress.at(-1)).toEqual([4, 4]);

        const envelopeBytes = await readFile(result.backupPath);
        expect(envelopeBytes.byteLength).toBe(result.fileSize);
        expect(result.keyId).toBe(encryptionKey.keyId);
        expect(createHash("sha256").update(envelopeBytes).digest("hex")).toBe(result.sha256);

        const envelope = await inspectBackupEnvelope(result.backupPath);
        expect(envelope.header.keyId).toBe(encryptionKey.keyId);
        await verifyBackupEnvelope(result.backupPath, envelope, encryptionKey);
        const decryptedChunks: Buffer[] = [];
        const decrypted = createBackupCiphertextStream(result.backupPath, envelope)
            .pipe(createBackupEnvelopeDecipher(envelope, encryptionKey));
        for await (const chunk of decrypted) {
            decryptedChunks.push(chunk as Buffer);
        }
        const zipBytes = Buffer.concat(decryptedChunks);

        const entries = unzipSync(new Uint8Array(zipBytes));
        expect(Object.keys(entries)).not.toContain(".env");
        expect(Object.keys(entries).sort()).toEqual([
            "config.yaml",
            "nb-backup.json",
            "workspace/.nbook/config.json",
            "workspace/.nbook/neuro-book.sqlite",
            "workspace/novel-a/manuscript/chapter-1.md",
        ]);

        // Global Config 内的明文 API Key 已脱敏，且产物仍是可解析 JSON
        const redactedConfigText = strFromU8(entries["workspace/.nbook/config.json"] as Uint8Array);
        expect(redactedConfigText).not.toContain("sk-live-provider-secret");
        expect(redactedConfigText).not.toContain("sk-live-embedding-secret");
        expect(redactedConfigText).not.toContain("tvly-live-secret");
        const redactedConfig = JSON.parse(redactedConfigText) as {
            models: {providers: Array<{options: {apiKey: string; baseURL: string}}>};
            embedding: {apiKey: string};
            web: {search: {providers: {tavily: {apiKey: string}}}};
        };
        expect(redactedConfig.models.providers[0]?.options.apiKey).toBe("");
        expect(redactedConfig.embedding.apiKey).toBe("");
        expect(redactedConfig.web.search.providers.tavily.apiKey).toBe("");
        expect(redactedConfig.models.providers[0]?.options.baseURL).toBe("https://api.example.com");

        const manifest = JSON.parse(strFromU8(entries["nb-backup.json"] as Uint8Array)) as {formatVersion: number; encryption: string};
        expect(manifest.formatVersion).toBe(2);
        expect(manifest.encryption).toBe("AES-256-GCM");
        expect(await readdir(tmpDir)).not.toContain("backup.zip");

        // SQLite 快照是能打开的一致性数据库
        const snapshotPath = join(tmpDir, "restored.sqlite");
        await writeFile(snapshotPath, entries["workspace/.nbook/neuro-book.sqlite"] as Uint8Array);
        const client = createClient({url: `file:${snapshotPath.replaceAll("\\", "/")}`});
        const rows = await client.execute("SELECT name FROM demo");
        client.close();
        expect(rows.rows[0]?.name).toBe("hello");
    });
});
