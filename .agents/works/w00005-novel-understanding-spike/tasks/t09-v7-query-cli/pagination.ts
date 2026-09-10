import {createHash} from "node:crypto";
import {z} from "zod";
import {QueryError} from "./contract.ts";

export function fingerprint(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const cursorSchema = z.strictObject({version: z.literal(1), query: z.string().regex(/^[a-f0-9]{64}$/), offset: z.number().int().positive(), checksum: z.string().regex(/^[a-f0-9]{64}$/)});

export function pageItems<T>(items: T[], limit: number, query: string, cursor: string | undefined) {
    let offset = 0;
    if (cursor !== undefined) {
        try {
            if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid encoding");
            const bytes = Buffer.from(cursor, "base64url");
            if (bytes.toString("base64url") !== cursor) throw new Error("Noncanonical encoding");
            const decoded = cursorSchema.parse(JSON.parse(bytes.toString("utf8")));
            if (decoded.query !== query || decoded.offset % limit !== 0 || decoded.offset >= items.length || decoded.checksum !== fingerprint([decoded.version, decoded.query, decoded.offset])) throw new Error("Cursor mismatch");
            offset = decoded.offset;
        } catch {
            throw new QueryError("INVALID_CURSOR", "Invalid cursor or cursor belongs to a different query, scope, page size, or snapshot", 2);
        }
    }
    const next = offset + limit;
    const nextCursor = next < items.length ? Buffer.from(JSON.stringify({version: 1, query, offset: next, checksum: fingerprint([1, query, next])})).toString("base64url") : null;
    return {items: items.slice(offset, next), nextCursor};
}
