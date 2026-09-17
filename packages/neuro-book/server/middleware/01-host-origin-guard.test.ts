import {createServer, request} from "node:http";
import {createConnection} from "node:net";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createApp, eventHandler, toNodeListener} from "h3";
import guard, {
    TRUSTED_HOSTS_ENV,
    isAllowedHost,
    isIpLiteral,
    isLocalhostHostname,
    isSameOrigin,
    matchesTrustedEntry,
    parseHostHeader,
    parseTrustedHosts,
} from "nbook/server/middleware/01-host-origin-guard";

/**
 * 这些用例用真实 HTTP server 驱动守卫，覆盖 DNS rebinding 防线所需的全部场景：
 * 同源/跨源 Origin、白名单 Host、IP 字面量、localhost 系、IPv6、缺失 Origin、
 * 容器/局域网场景与逃生舱环境变量。
 */

const servers: Array<ReturnType<typeof createServer>> = [];

beforeEach(() => {
    delete process.env[TRUSTED_HOSTS_ENV];
});

afterEach(async () => {
    delete process.env[TRUSTED_HOSTS_ENV];
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

/**
 * 启动一个只挂守卫 + 兜底成功处理器的测试 server，返回其端口。
 */
async function startGuardServer(): Promise<number> {
    const app = createApp();
    app.use(guard);
    // 守卫放行时返回 undefined，h3 继续执行到兜底处理器，得到 200。
    app.use(eventHandler(() => ({ok: true})));
    const server = createServer(toNodeListener(app));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("测试 server 未监听 TCP 端口");
    }
    return address.port;
}

/**
 * 发起一个 GET 请求；连接固定到 127.0.0.1，但 Host / Origin 头由调用方完全控制。
 */
function send(port: number, headers: Record<string, string>): Promise<{status: number; body: string}> {
    return new Promise((resolve, reject) => {
        const outgoing = request({host: "127.0.0.1", port, method: "GET", path: "/api/app/version", headers}, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
                body += chunk;
            });
            response.on("end", () => resolve({status: response.statusCode ?? 0, body}));
        });
        outgoing.on("error", reject);
        outgoing.end();
    });
}

/**
 * 用裸 TCP 发一个不带 Host 头的 HTTP/1.0 请求，返回状态码。
 * 这是唯一能真正省略 Host 的方式（Node 的 http.request 会自动补 Host）。
 */
function sendWithoutHostHeader(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
        const socket = createConnection({host: "127.0.0.1", port}, () => {
            socket.write("GET /api/app/version HTTP/1.0\r\n\r\n");
        });
        let raw = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk: string) => {
            raw += chunk;
        });
        socket.on("end", () => {
            const match = raw.match(/^HTTP\/1\.\d (\d{3})/u);
            resolve(match?.[1] ? Number.parseInt(match[1], 10) : 0);
        });
        socket.on("error", reject);
    });
}

describe("host-origin-guard 端到端 HTTP 行为", () => {
    it("同源 Origin + IP Host → 放行", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000"});
        expect(result.status).toBe(200);
    });

    it("无 Origin 头的同源请求（最常见客户端形态）→ 放行", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "127.0.0.1:3000"});
        expect(result.status).toBe(200);
    });

    it("不带 Host 头的请求 → 403（fail-closed，不回退 localhost）", async () => {
        const port = await startGuardServer();
        const status = await sendWithoutHostHeader(port);
        expect(status).toBe(403);
    });

    it("跨源 Origin（不同域）→ 403，且提示不同源", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "127.0.0.1:3000", origin: "http://evil.example.com"});
        expect(result.status).toBe(403);
        expect(result.body).toContain("不同源");
    });

    it("跨源 Origin（同主机不同端口）→ 403", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "127.0.0.1:3000", origin: "http://127.0.0.1:4000"});
        expect(result.status).toBe(403);
    });

    it("Origin 为字面量 null（file:// / 沙箱）→ 403", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "127.0.0.1:3000", origin: "null"});
        expect(result.status).toBe(403);
    });

    it("域名 Host 不在白名单 → 403，且提示白名单用法", async () => {
        const port = await startGuardServer();
        const result = await send(port, {host: "evil.example.com"});
        expect(result.status).toBe(403);
        expect(result.body).toContain("不在允许范围");
        expect(result.body).toContain(TRUSTED_HOSTS_ENV);
    });

    it("域名 Host 在白名单 → 放行", async () => {
        process.env[TRUSTED_HOSTS_ENV] = "evil.example.com";
        const port = await startGuardServer();
        const result = await send(port, {host: "evil.example.com"});
        expect(result.status).toBe(200);
    });

    it("白名单支持 *.example.com 通配，但不匹配裸域", async () => {
        process.env[TRUSTED_HOSTS_ENV] = "*.example.com";
        const port = await startGuardServer();
        expect((await send(port, {host: "app.example.com"})).status).toBe(200);
        expect((await send(port, {host: "a.b.example.com"})).status).toBe(200);
        expect((await send(port, {host: "example.com"})).status).toBe(403);
    });

    it("IP 字面量 Host（容器 / 局域网）→ 放行", async () => {
        const port = await startGuardServer();
        expect((await send(port, {host: "192.168.1.23:3000"})).status).toBe(200);
        expect((await send(port, {host: "10.0.0.5"})).status).toBe(200);
        expect((await send(port, {host: "0.0.0.0:3000"})).status).toBe(200);
    });

    it("localhost 与 *.localhost → 放行", async () => {
        const port = await startGuardServer();
        expect((await send(port, {host: "localhost:3000"})).status).toBe(200);
        expect((await send(port, {host: "localhost"})).status).toBe(200);
        expect((await send(port, {host: "studio.localhost:3000"})).status).toBe(200);
    });

    it("IPv6 字面量 [::1] → 放行（含同源 Origin）", async () => {
        const port = await startGuardServer();
        expect((await send(port, {host: "[::1]:3000"})).status).toBe(200);
        expect((await send(port, {host: "[::1]"})).status).toBe(200);
        expect((await send(port, {host: "[::1]:3000", origin: "http://[::1]:3000"})).status).toBe(200);
    });

    it("反向代理默认端口归一化：https://app.example.com 对 Host=app.example.com:443 → 放行", async () => {
        process.env[TRUSTED_HOSTS_ENV] = "app.example.com";
        const port = await startGuardServer();
        const result = await send(port, {host: "app.example.com:443", origin: "https://app.example.com"});
        expect(result.status).toBe(200);
    });

    it("白名单条目可带端口，端口不符则拒绝", async () => {
        process.env[TRUSTED_HOSTS_ENV] = "books.example.com:8443";
        const port = await startGuardServer();
        expect((await send(port, {host: "books.example.com:8443"})).status).toBe(200);
        expect((await send(port, {host: "books.example.com:9000"})).status).toBe(403);
    });

    it("多个白名单条目（含通配）逗号分隔均生效", async () => {
        process.env[TRUSTED_HOSTS_ENV] = "books.example.com, *.internal.example.com";
        const port = await startGuardServer();
        expect((await send(port, {host: "books.example.com"})).status).toBe(200);
        expect((await send(port, {host: "node.internal.example.com"})).status).toBe(200);
        expect((await send(port, {host: "other.example.com"})).status).toBe(403);
    });
});

describe("host-origin-guard 纯函数", () => {
    it("parseHostHeader 处理端口、无端口与 IPv6", () => {
        expect(parseHostHeader("127.0.0.1:3000")).toEqual({hostname: "127.0.0.1", port: "3000"});
        expect(parseHostHeader("localhost")).toEqual({hostname: "localhost", port: null});
        expect(parseHostHeader("[::1]:3000")).toEqual({hostname: "[::1]", port: "3000"});
        expect(parseHostHeader("[::1]")).toEqual({hostname: "[::1]", port: null});
        expect(parseHostHeader("  App.Example.COM:8443 ")).toEqual({hostname: "app.example.com", port: "8443"});
        expect(parseHostHeader("")).toEqual({hostname: "", port: null});
    });

    it("isIpLiteral 识别 IPv4 / IPv6 且排除域名", () => {
        expect(isIpLiteral("127.0.0.1")).toBe(true);
        expect(isIpLiteral("192.168.1.23")).toBe(true);
        expect(isIpLiteral("[::1]")).toBe(true);
        expect(isIpLiteral("::1")).toBe(true);
        expect(isIpLiteral("localhost")).toBe(false);
        expect(isIpLiteral("example.com")).toBe(false);
        expect(isIpLiteral("999.1.1.1")).toBe(false);
    });

    it("isLocalhostHostname 只接受 localhost 与子域", () => {
        expect(isLocalhostHostname("localhost")).toBe(true);
        expect(isLocalhostHostname("a.localhost")).toBe(true);
        expect(isLocalhostHostname("notlocalhost")).toBe(false);
        expect(isLocalhostHostname("localhost.evil.com")).toBe(false);
    });

    it("parseTrustedHosts 归一化空白、协议前缀、结尾点", () => {
        expect(parseTrustedHosts(undefined)).toEqual([]);
        expect(parseTrustedHosts("")).toEqual([]);
        expect(parseTrustedHosts(" books.example.com , *.internal.example.com ")).toEqual(["books.example.com", "*.internal.example.com"]);
        expect(parseTrustedHosts("https://books.example.com:8443/")).toEqual(["books.example.com:8443"]);
        expect(parseTrustedHosts("books.example.com.")).toEqual(["books.example.com"]);
    });

    it("matchesTrustedEntry 支持通配与端口约束", () => {
        expect(matchesTrustedEntry("app.example.com", "3000", "app.example.com")).toBe(true);
        expect(matchesTrustedEntry("app.example.com", "8443", "app.example.com:8443")).toBe(true);
        expect(matchesTrustedEntry("app.example.com", "9000", "app.example.com:8443")).toBe(false);
        expect(matchesTrustedEntry("sub.app.example.com", "3000", "*.app.example.com")).toBe(true);
        expect(matchesTrustedEntry("app.example.com", "3000", "*.app.example.com")).toBe(false);
    });

    it("isAllowedHost 组合三条放行规则", () => {
        expect(isAllowedHost("127.0.0.1:3000", [])).toBe(true);
        expect(isAllowedHost("[::1]:3000", [])).toBe(true);
        expect(isAllowedHost("localhost:3000", [])).toBe(true);
        expect(isAllowedHost("x.localhost", [])).toBe(true);
        expect(isAllowedHost("evil.example.com", [])).toBe(false);
        expect(isAllowedHost("books.example.com", ["books.example.com"])).toBe(true);
        // fail-closed：空 Host（缺失头）不因本函数被放行。
        expect(isAllowedHost("", [])).toBe(false);
    });

    it("isSameOrigin 归一化默认端口并拒绝非法 Origin", () => {
        expect(isSameOrigin("http://127.0.0.1:3000", "127.0.0.1:3000")).toBe(true);
        expect(isSameOrigin("http://127.0.0.1:3000", "127.0.0.1:4000")).toBe(false);
        expect(isSameOrigin("https://app.example.com", "app.example.com:443")).toBe(true);
        expect(isSameOrigin("https://app.example.com", "app.example.com")).toBe(true);
        expect(isSameOrigin("http://app.example.com", "app.example.com:8080")).toBe(false);
        expect(isSameOrigin("http://[::1]:3000", "[::1]:3000")).toBe(true);
        expect(isSameOrigin("null", "127.0.0.1:3000")).toBe(false);
        expect(isSameOrigin("not a url", "127.0.0.1:3000")).toBe(false);
        expect(isSameOrigin("chrome-extension://abc", "127.0.0.1:3000")).toBe(false);
    });
});
