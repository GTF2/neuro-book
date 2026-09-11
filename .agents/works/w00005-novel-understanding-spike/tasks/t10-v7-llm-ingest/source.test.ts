import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { sourceSchema } from "../t07-v7-schema-gold/index.ts";
import { captureSources } from "./source.ts";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const goldenCapture = JSON.parse(await readFile(new URL("../t07-v7-schema-gold/sources.json", import.meta.url), "utf8")) as { sources: unknown[] };
const gold = goldenCapture.sources.map(source => sourceSchema.loose().parse(source));
const xmlEscape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function fixture(changes: Record<string, string> = {}): Promise<{ path: string; bytes: Uint8Array }> {
    const directory = await mkdtemp(join(tmpdir(), "v7-source-"));
    directories.push(directory);
    const members: Record<string, string> = {
        "META-INF/container.xml": '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
        "OEBPS/content.opf": '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="front" href="front.xhtml"/><item id="c1" href="chapter_00001.xhtml"/><item id="c2" href="chapter_00002.xhtml"/><item id="c3" href="chapter_00003.xhtml"/></manifest><spine><itemref idref="front"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>',
        "OEBPS/front.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Front matter</p></body></html>',
        "OEBPS/chapter_00003.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Not a paragraph</title></head><body>not a direct block<h1>Chapter 3</h1><p>First <em>nested</em> text &amp; tail</p><p> </p><div><![CDATA[Author note]]></div></body></html>',
    };
    for (const source of gold) members[`OEBPS/chapter_${String(source.chapterOrder).padStart(5, "0")}.xhtml`] = `<html xmlns="http://www.w3.org/1999/xhtml"><body>${source.paragraphs.map(paragraph => `<p>${xmlEscape(paragraph)}</p>`).join("")}</body></html>`;
    Object.assign(members, changes);
    const bytes = zipSync(Object.fromEntries(Object.entries(members).map(([name, value]) => [name, strToU8(value)])));
    const path = join(directory, "registered-fixture.epub");
    await writeFile(path, bytes);
    return { path, bytes };
}

describe("registered V7 EPUB source capture", () => {
    it("matches golden source coordinates and follows spine while preserving direct mixed body blocks", async () => {
        const input = await fixture();
        const result = await captureSources(input.path, 3);
        expect(result.sources.slice(0, 2)).toEqual(gold.map(source => sourceSchema.strip().parse(source)));
        expect(result.sources[2]?.paragraphs).toEqual(["Chapter 3", "First nested text & tail", "Author note"]);
        expect(result.sources[2]?.sha256).toBe(createHash("sha256").update("Chapter 3\nFirst nested text & tail\nAuthor note").digest("hex"));
        expect(result.archive.sha256).toBe(createHash("sha256").update(input.bytes).digest("hex"));
        expect(result.archive.selection).toEqual(["OEBPS/chapter_00001.xhtml", "OEBPS/chapter_00002.xhtml", "OEBPS/chapter_00003.xhtml"]);
        expect(result.normalization).toBe("epub-body-blocks-v1");
        expect(await readFile(input.path)).toEqual(Buffer.from(input.bytes));
        expect(await captureSources(input.path, 1)).toMatchObject({ sources: [result.sources[0]] });
    });

    it("rejects drift from registered first chapter and invalid ranges", async () => {
        const changed = await fixture({ "OEBPS/chapter_00001.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Changed chapter</p></body></html>' });
        await expect(captureSources(changed.path, 1)).rejects.toThrow("differs from registered");
        const input = await fixture();
        await expect(captureSources(input.path, 4)).rejects.toThrow("contains 3");
        await expect(captureSources(input.path, 0)).rejects.toThrow("positive integer");
        await expect(captureSources(input.path, 1.5)).rejects.toThrow("positive integer");
    });

    it("rejects malformed XML, missing members and non-local archive references", async () => {
        const malformed = await fixture({ "OEBPS/chapter_00003.xhtml": "<html><broken>" });
        await expect(captureSources(malformed.path, 3)).rejects.toThrow("Invalid UTF-8 XML");
        const missing = await fixture({ "META-INF/container.xml": '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="missing.opf"/></rootfiles></container>' });
        await expect(captureSources(missing.path, 1)).rejects.toThrow("member is missing");
        const outside = await fixture({ "META-INF/container.xml": '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="../outside.opf"/></rootfiles></container>' });
        await expect(captureSources(outside.path, 1)).rejects.toThrow("escapes archive root");
    });
});
