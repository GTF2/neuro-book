import {describe, expect, it} from "vitest";
import {isGlobalConfigBackupEntry, isSqliteFile, redactGlobalConfigSecrets, sanitizeZipEntryName, shouldExcludeFromBackup} from "nbook/server/backup/backup-archive-rules";

describe("备份排除规则", () => {
    it("排除 logs 目录与锁/临时/wal/shm 文件", () => {
        expect(shouldExcludeFromBackup("logs")).toBe(true);
        expect(shouldExcludeFromBackup("logs/app.log")).toBe(true);
        expect(shouldExcludeFromBackup("workspace/.nbook/neuro-book.sqlite-wal")).toBe(true);
        expect(shouldExcludeFromBackup("workspace/.nbook/neuro-book.sqlite-shm")).toBe(true);
        expect(shouldExcludeFromBackup("workspace/a/.b.lock")).toBe(true);
        expect(shouldExcludeFromBackup("workspace/a/tempfile.tmp")).toBe(true);
        expect(shouldExcludeFromBackup("workspace\\a\\x.tmp")).toBe(true);
    });

    it("保留正常内容文件（含名字里带 logs 的非目录命中）", () => {
        expect(shouldExcludeFromBackup("workspace/manuscript/chapter-1.md")).toBe(false);
        expect(shouldExcludeFromBackup("config.yaml")).toBe(false);
        expect(shouldExcludeFromBackup(".env")).toBe(false);
        expect(shouldExcludeFromBackup("workspace/logs-notes.md")).toBe(false);
        expect(shouldExcludeFromBackup("workspace/.nbook/neuro-book.sqlite")).toBe(false);
    });

    it("SQLite 判定只按 .sqlite 后缀", () => {
        expect(isSqliteFile("workspace/.nbook/neuro-book.sqlite")).toBe(true);
        expect(isSqliteFile("workspace\\a\\.nbook\\project.sqlite")).toBe(true);
        expect(isSqliteFile("workspace/a/data.sqlite3")).toBe(false);
        expect(isSqliteFile("workspace/a/notes.md")).toBe(false);
    });
});

describe("zip 条目名安全化（zip-slip 防护）", () => {
    it("拒绝绝对路径、盘符与 .. 逃逸", () => {
        expect(sanitizeZipEntryName("/etc/passwd")).toBeNull();
        expect(sanitizeZipEntryName("C:/windows/system32")).toBeNull();
        expect(sanitizeZipEntryName("c:\\x")).toBeNull();
        expect(sanitizeZipEntryName("../outside.txt")).toBeNull();
        expect(sanitizeZipEntryName("workspace/../../outside.txt")).toBeNull();
        expect(sanitizeZipEntryName("")).toBeNull();
        expect(sanitizeZipEntryName("//server/share")).toBeNull();
    });

    it("归一化合法路径（反斜杠、冗余段）", () => {
        expect(sanitizeZipEntryName("workspace/manuscript/a.md")).toBe("workspace/manuscript/a.md");
        expect(sanitizeZipEntryName("workspace\\manuscript\\a.md")).toBe("workspace/manuscript/a.md");
        expect(sanitizeZipEntryName("./workspace//a.md")).toBe("workspace/a.md");
        expect(sanitizeZipEntryName("nb-backup.json")).toBe("nb-backup.json");
    });
});

describe("Global Config 备份脱敏", () => {
    it("识别 Global Config 条目并按 / 归一化", () => {
        expect(isGlobalConfigBackupEntry("workspace/.nbook/config.json")).toBe(true);
        expect(isGlobalConfigBackupEntry("workspace\\.nbook\\config.json")).toBe(true);
        expect(isGlobalConfigBackupEntry("workspace/novel-a/.nbook/config.json")).toBe(false);
        expect(isGlobalConfigBackupEntry("config.yaml")).toBe(false);
    });

    it("清空 provider / embedding / web 搜索三类 API Key，保留其余字段", () => {
        const redacted = redactGlobalConfigSecrets(JSON.stringify({
            models: {
                default: "openai/gpt-4o",
                providers: [{
                    id: "openai",
                    options: {apiKey: "sk-live-secret", baseURL: "https://api.example.com", proxy: ""},
                }],
            },
            embedding: {apiKey: "sk-live-embedding", model: "text-embedding-3-small"},
            web: {search: {providers: {tavily: {apiKey: "tvly-secret", enabled: true}, brave: {apiKey: "brave-secret"}}}},
            ui: {theme: "sepia"},
        }));

        const parsed = JSON.parse(redacted) as {
            models: {default: string; providers: Array<{options: {apiKey: string; baseURL: string}}>};
            embedding: {apiKey: string; model: string};
            web: {search: {providers: {tavily: {apiKey: string; enabled: boolean}; brave: {apiKey: string}}}};
            ui: {theme: string};
        };
        expect(parsed.models.providers[0]?.options.apiKey).toBe("");
        expect(parsed.embedding.apiKey).toBe("");
        expect(parsed.web.search.providers.tavily.apiKey).toBe("");
        expect(parsed.web.search.providers.brave.apiKey).toBe("");
        // 非密钥字段保持不变
        expect(parsed.models.providers[0]?.options.baseURL).toBe("https://api.example.com");
        expect(parsed.models.default).toBe("openai/gpt-4o");
        expect(parsed.embedding.model).toBe("text-embedding-3-small");
        expect(parsed.web.search.providers.tavily.enabled).toBe(true);
        expect(parsed.ui.theme).toBe("sepia");
        expect(redacted).not.toContain("sk-live-secret");
        expect(redacted).not.toContain("tvly-secret");
    });

    it("非 JSON 输入直接抛错（fail-closed，绝不原样入包）", () => {
        expect(() => redactGlobalConfigSecrets("apiKey: sk-live-secret")).toThrow(/不是合法 JSON/);
    });
});
