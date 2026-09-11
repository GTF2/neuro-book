import {mkdir, open, readFile, rename} from "node:fs/promises";
import {dirname, join} from "node:path";
import {randomUUID} from "node:crypto";
import {DatabaseSync} from "node:sqlite";

export async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")); }
export async function optionalJson(path: string): Promise<unknown | null> {
    try { return await readJson(path); } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
        throw error;
    }
}
export async function writeJson(path: string, value: unknown, immutable = false): Promise<void> {
    await mkdir(dirname(path), {recursive: true});
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (immutable) {
        const previous = await optionalJson(path);
        if (previous !== null) {
            if (JSON.stringify(previous) !== JSON.stringify(value)) throw new Error(`Immutable artifact conflict: ${path}`);
            return;
        }
    }
    const temporary = `${path}.${randomUUID()}.tmp`;
    const file = await open(temporary, "wx");
    try { await file.writeFile(text, "utf8"); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path);
}

export async function withRunLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
    await mkdir(root, {recursive: true});
    const coordinator = new DatabaseSync(join(root, "writer-lock.sqlite"));
    try {
        // SQLite owns the OS lock and releases it on process death; no stale-file takeover is needed.
        try { coordinator.exec("PRAGMA busy_timeout=0; BEGIN IMMEDIATE"); }
        catch { throw new Error("Run already has an active writer or its coordination database is unavailable"); }
        try { return await operation(); } finally { coordinator.exec("ROLLBACK"); }
    } finally { coordinator.close(); }
}
