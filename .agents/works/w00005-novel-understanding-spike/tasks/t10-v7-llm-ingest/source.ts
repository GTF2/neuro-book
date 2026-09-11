import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { unzipSync } from "fflate";
import { SaxesParser } from "saxes";
import { z } from "zod";
import { sourceSchema, type Source } from "../t07-v7-schema-gold/index.ts";

interface XmlElement {
    local: string;
    uri: string;
    attributes: Record<string, string>;
    children: (XmlElement | string)[];
}

export interface SourceCapture {
    book: { id: string; title: string };
    sources: Source[];
    archive: { sha256: string; selection: string[] };
    normalization: "epub-body-blocks-v1";
}

const OPF = "http://www.idpf.org/2007/opf";
const XHTML = "http://www.w3.org/1999/xhtml";
const CONTAINER = "urn:oasis:names:tc:opendocument:xmlns:container";
const registeredSourceSchema = z.object({
    book: z.object({ id: z.string(), title: z.string() }),
    archive: z.object({ selection: z.array(z.string()).length(2) }),
    sources: z.array(sourceSchema.loose()).length(2),
});
const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

function parseXml(bytes: Uint8Array, member: string): XmlElement {
    const parser = new SaxesParser({ xmlns: true });
    const stack: XmlElement[] = [];
    let root: XmlElement | undefined;
    parser.on("opentag", tag => {
        const element: XmlElement = {
            local: tag.local,
            uri: tag.uri,
            attributes: Object.fromEntries(Object.values(tag.attributes).map(attribute => [attribute.name, attribute.value])),
            children: [],
        };
        const parent = stack.at(-1);
        if (parent) parent.children.push(element);
        else root = element;
        stack.push(element);
    });
    const appendText = (value: string): void => { stack.at(-1)?.children.push(value); };
    parser.on("text", appendText);
    parser.on("cdata", appendText);
    parser.on("closetag", () => { stack.pop(); });
    try {
        parser.write(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).close();
    } catch {
        throw new Error(`Invalid UTF-8 XML in EPUB member: ${member}`);
    }
    if (!root) throw new Error(`Empty XML in EPUB member: ${member}`);
    return root;
}

function elements(parent: XmlElement, local: string, uri: string): XmlElement[] {
    return parent.children.filter((child): child is XmlElement => typeof child !== "string" && child.local === local && child.uri === uri);
}

function one(parent: XmlElement, local: string, uri: string): XmlElement {
    const matches = elements(parent, local, uri);
    if (matches.length !== 1 || !matches[0]) throw new Error(`EPUB requires exactly one ${local}`);
    return matches[0];
}

function attribute(element: XmlElement, name: string): string {
    const value = element.attributes[name];
    if (!value) throw new Error(`EPUB ${element.local} is missing ${name}`);
    return value;
}

function content(element: XmlElement): string {
    return element.children.map(child => typeof child === "string" ? child : content(child)).join("");
}

function memberPath(base: string, href: string): string {
    let decoded: string;
    try { decoded = decodeURIComponent(href); } catch { throw new Error("EPUB contains invalid encoded member path"); }
    if (decoded.includes("\\") || decoded.includes("\0") || decoded.includes("?") || decoded.includes("#") || /^[a-z][a-z\d+.-]*:/i.test(decoded) || posix.isAbsolute(decoded)) {
        throw new Error("EPUB contains a non-local member path");
    }
    const joined = posix.normalize(posix.join(base, decoded));
    if (joined === ".." || joined.startsWith("../")) throw new Error("EPUB member path escapes archive root");
    return joined;
}

/** Capture the registered novel's spine prefix; semantic gold annotations are never read. */
export async function captureSources(epubPath: string, through: number): Promise<SourceCapture> {
    if (!Number.isSafeInteger(through) || through < 1) throw new Error("Chapter count must be a positive integer");
    const registered = registeredSourceSchema.parse(JSON.parse(await readFile(new URL("../t07-v7-schema-gold/sources.json", import.meta.url), "utf8")));
    const bytes = await readFile(epubPath);
    const archive = unzipSync(bytes);
    const read = (member: string): XmlElement => {
        const raw = archive[member];
        if (!raw) throw new Error(`EPUB member is missing: ${member}`);
        return parseXml(raw, member);
    };
    const container = read("META-INF/container.xml");
    const rootfiles = one(container, "rootfiles", CONTAINER);
    const rootfile = one(rootfiles, "rootfile", CONTAINER);
    const opfPath = memberPath("", attribute(rootfile, "full-path"));
    const packageXml = read(opfPath);
    const manifest = new Map<string, string>();
    for (const item of elements(one(packageXml, "manifest", OPF), "item", OPF)) {
        const id = attribute(item, "id");
        if (manifest.has(id)) throw new Error(`EPUB has duplicate manifest ID: ${id}`);
        manifest.set(id, memberPath(posix.dirname(opfPath), attribute(item, "href")));
    }
    const spine = elements(one(packageXml, "spine", OPF), "itemref", OPF).map(item => {
        const id = attribute(item, "idref");
        const member = manifest.get(id);
        if (!member) throw new Error(`EPUB spine references missing manifest ID: ${id}`);
        return member;
    });
    // This source registration identifies story members by chapter_*, excluding front matter.
    const storyMembers = spine.filter(member => posix.basename(member).startsWith("chapter_"));
    if (new Set(storyMembers).size !== storyMembers.length) throw new Error("EPUB spine repeats a story member");
    if (through > storyMembers.length) throw new Error(`Requested ${through} chapters; EPUB contains ${storyMembers.length}`);
    if (registered.archive.selection.some((member, index) => storyMembers[index] !== member)) {
        throw new Error("EPUB first two story members differ from registered V7 source");
    }
    const selection = storyMembers.slice(0, through);
    const sources = selection.map((member, index) => {
        const body = one(read(member), "body", XHTML);
        const paragraphs = body.children.filter((child): child is XmlElement => typeof child !== "string").map(block => content(block).trim()).filter(Boolean);
        const order = index + 1;
        const id = String(order).padStart(2, "0");
        const source = sourceSchema.parse({
            id: `source-c${id}`, revision: 1, chapterId: `c${id}`, chapterOrder: order,
            title: paragraphs[0], paragraphs, sha256: sha256(paragraphs.join("\n")),
        });
        const baseline = registered.sources[index];
        if (baseline && (source.title !== baseline.title || source.sha256 !== baseline.sha256
            || source.paragraphs.length !== baseline.paragraphs.length
            || source.paragraphs.some((paragraph, position) => paragraph !== baseline.paragraphs[position]))) {
            throw new Error(`Chapter ${order} differs from registered V7 source paragraphs`);
        }
        return source;
    });
    return { book: registered.book, sources, archive: { sha256: sha256(bytes), selection }, normalization: "epub-body-blocks-v1" };
}
