import {Readable} from "node:stream";
import type {IncomingMessage} from "node:http";
import type {H3Event} from "h3";
import sharp from "sharp";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";

const mocks = vi.hoisted(() => ({
    listProjects: vi.fn(),
    updateProjectCover: vi.fn(),
}));
const originalDefineEventHandler = (globalThis as typeof globalThis & {defineEventHandler?: unknown}).defineEventHandler;

vi.mock("h3", async (importOriginal) => ({
    ...await importOriginal<typeof import("h3")>(),
    getRequestHeader: (event: H3Event, name: string) => event.node.req.headers[name.toLocaleLowerCase("en-US")],
}));
vi.mock("nbook/server/api/projects/project-control-plane", () => ({
    requireProjectRefQuery: () => projectWorkspaceRef("book"),
    toProjectMetadataDto: (project: unknown) => project,
}));
vi.mock("nbook/server/workspace-files/project-session", () => ({
    listProjects: mocks.listProjects,
    updateProjectCover: mocks.updateProjectCover,
}));

describe("PUT /api/projects/cover browser multipart", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
        mocks.listProjects.mockResolvedValue({
            revision: 1,
            projects: [{projectRoot: "book", kind: "novel", title: "Book", summary: ""}],
        });
        mocks.updateProjectCover.mockImplementation(async ({cover}) => ({
            revision: 2,
            project: {
                projectRoot: "book",
                kind: "novel",
                title: "Book",
                summary: "",
                cover: `assets/project-covers/${"a".repeat(64)}.${cover.extension}`,
            },
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        (globalThis as typeof globalThis & {defineEventHandler?: unknown}).defineEventHandler = originalDefineEventHandler;
    });

    it("真实 FormData 的空 File.type 经过 Busboy 后仍按 PNG bytes 上传", async () => {
        const png = await sharp({create: {width: 4, height: 6, channels: 4, background: "#123456"}})
            .png()
            .toBuffer();
        const file = new File([png], "cover.png", {type: ""});
        const form = new FormData();
        form.append("file", file, file.name);
        const browserRequest = new Request("http://local/api/projects/cover?projectRoot=book", {
            method: "PUT",
            body: form,
        });
        // Bun 下 Request 的 Headers 惰性物化:若先消费 body 再读 header,get() 会返回 null
        // (实测 arrayBuffer() 之后、未提前访问过的 header 全部读不到),Busboy 随即报 Missing Content-Type。
        // 故在消费 body 之前先取出请求头,使该用例在 Node 与 Bun 下构造出等价的请求(不改断言、不改被测行为)。
        const headerRecord: Record<string, string> = {};
        for (const headerName of ["content-type", "content-length"]) {
            const headerValue = browserRequest.headers.get(headerName);
            if (headerValue !== null) headerRecord[headerName] = headerValue;
        }
        const body = Buffer.from(await browserRequest.arrayBuffer());
        const request = Object.assign(Readable.from([body]), {
            headers: headerRecord,
            url: "/api/projects/cover?projectRoot=book",
        }) as IncomingMessage;
        const event = {node: {req: request, res: {}}, path: request.url} as H3Event;
        const handler = (await import("nbook/server/api/projects/cover.put")).default as (event: H3Event) => Promise<unknown>;

        await expect(handler(event)).resolves.toMatchObject({
            project: {cover: expect.stringMatching(/\.png$/u)},
        });
        expect(mocks.updateProjectCover).toHaveBeenCalledWith({
            ref: expect.objectContaining({projectRoot: "book"}),
            cover: {bytes: png, extension: "png"},
        });
    });
});
