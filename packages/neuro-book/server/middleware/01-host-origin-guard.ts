import {isIP} from "node:net";
import type {H3Event} from "h3";
import {defineEventHandler, getRequestHeader, getRequestHost, setResponseStatus} from "h3";
import {appLogger} from "nbook/server/app-logs/logger";

/**
 * HTTP 层 Host / Origin 校验守卫（防 DNS rebinding）。
 *
 * 威胁模型：本产品是本地优先（local-first）应用，默认只监听回环地址、开发期默认关闭鉴权。
 * 攻击者无法直接读取 `127.0.0.1`，但可以让浏览器访问一个 **域名**（如 `evil.com`），
 * 再通过短 TTL 把该域名解析到 `127.0.0.1`。此时浏览器认为页面与本地服务同源，
 * 于是绕过同源策略读取本地响应——这就是 DNS rebinding。
 *
 * 关键洞察：DNS rebinding **必须依赖一个域名**（域名解析权在攻击者手里），
 * 攻击者无法控制「IP 字面量」的解析。因此只要做到：
 *   1. Origin 存在时，要求它与请求 Host 同源（含端口比较）；
 *   2. Host 只允许「IP 字面量 / localhost 及 *.localhost / 显式白名单」，
 * 就足以阻断 rebinding，同时天然放行容器与局域网场景（`http://192.168.x.x:3000`）。
 *
 * 本守卫排在 `00-product-startup.ts` 之后、`auth.ts` 之前（Nitro 按文件名排序，
 * `01-` 位于 `00-` 之后、`auth` 之前）。它不读取请求体，也不改动任何鉴权/路由行为。
 */

/**
 * 显式信任主机白名单的环境变量名。
 *
 * 逗号分隔，支持 `*.example.com` 通配；用于反向代理、自定义域名、远程（remote）部署等
 * 「HTTP Host 是域名」的场景。例：
 *   NBOOK_TRUSTED_HOSTS="books.example.com,*.internal.example.com"
 */
export const TRUSTED_HOSTS_ENV = "NBOOK_TRUSTED_HOSTS";

/** 默认端口，用于同源比较时归一化。 */
const DEFAULT_PORTS: Record<string, string> = {
    "http": "80",
    "https": "443",
};

/**
 * 拆解 Host 头 / authority 字符串为 hostname 与 port。
 *
 * 支持 IPv6 字面量（形如 `[::1]`、`[::1]:3000`）。IPv6 的 hostname 会保留方括号，
 * 便于与后续比较、以及 `isIpLiteral` 统一处理。
 */
export function parseHostHeader(rawHost: string): {hostname: string; port: string | null} {
    const value = (rawHost ?? "").trim().toLowerCase();
    if (value.length === 0) {
        return {hostname: "", port: null};
    }

    if (value.startsWith("[")) {
        const closing = value.indexOf("]");
        if (closing === -1) {
            return {hostname: value, port: null};
        }
        const hostname = value.slice(0, closing + 1);
        const remainder = value.slice(closing + 1);
        const port = remainder.startsWith(":") ? remainder.slice(1) : "";
        return {hostname, port: port.length > 0 ? port : null};
    }

    const firstColon = value.indexOf(":");
    const lastColon = value.lastIndexOf(":");
    // 恰好一个冒号 → host:port；没有冒号 → 纯 host；（防御）多个冒号且未加括号 → 视为未加括号的 IPv6。
    if (firstColon !== -1 && firstColon === lastColon) {
        const hostname = value.slice(0, firstColon);
        const port = value.slice(firstColon + 1);
        return {hostname, port: port.length > 0 ? port : null};
    }

    return {hostname: value, port: null};
}

/**
 * 判断 hostname 是否为 IP 字面量（IPv4 或 IPv6）。
 *
 * DNS rebinding 依赖域名，IP 字面量不受其影响，因此一律放行。
 */
export function isIpLiteral(hostname: string): boolean {
    if (hostname.length === 0) {
        return false;
    }
    const bare = hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
    return isIP(bare) !== 0;
}

/**
 * 判断 hostname 是否为 `localhost` 或 `*.localhost`。
 */
export function isLocalhostHostname(hostname: string): boolean {
    return hostname === "localhost" || hostname.endsWith(".localhost");
}

/**
 * 解析白名单环境变量。逗号分隔，逐项归一化为可比较的 entry。
 *
 * - 去掉首尾空白与结尾的点；
 * - 若 entry 带协议（`https://a.example.com`）则取其 host；
 * - 通配前缀 `*.` 会被保留。
 */
export function parseTrustedHosts(raw: string | undefined): string[] {
    if (!raw) {
        return [];
    }
    const entries: string[] = [];
    for (const chunk of raw.split(",")) {
        let entry = chunk.trim().toLowerCase();
        if (entry.length === 0) {
            continue;
        }
        if (entry.includes("://")) {
            try {
                entry = new URL(entry).host.toLowerCase();
            } catch {
                continue;
            }
        }
        entry = entry.replace(/\.+$/u, "");
        if (entry.length > 0) {
            entries.push(entry);
        }
    }
    return entries;
}

/**
 * 判断 (hostname, port) 是否命中某条白名单 entry。
 *
 * 支持的 entry 形态：`example.com`、`example.com:8080`、`*.example.com`、`*.example.com:8080`。
 * 通配 `*.example.com` 只匹配子域（至少一段），不匹配裸域 `example.com`。
 */
export function matchesTrustedEntry(hostname: string, port: string | null, entry: string): boolean {
    const parsed = parseHostHeader(entry);
    if (parsed.port !== null && parsed.port !== port) {
        return false;
    }
    if (parsed.hostname.startsWith("*.")) {
        const suffix = parsed.hostname.slice(1); // ".example.com"
        return hostname.length > suffix.length && hostname.endsWith(suffix);
    }
    return hostname === parsed.hostname;
}

/**
 * 判断请求 Host 是否在允许集合内。
 *
 * 允许集合 = IP 字面量 ∪ `localhost`/`*.localhost` ∪ `NBOOK_TRUSTED_HOSTS` 白名单。
 */
export function isAllowedHost(hostHeader: string, trustedEntries: readonly string[]): boolean {
    const {hostname, port} = parseHostHeader(hostHeader);
    // fail-closed：缺失/空 Host 头一律拒绝。安全守卫不保留 fail-open 默认分支。
    if (hostname.length === 0) {
        return false;
    }
    if (isIpLiteral(hostname)) {
        return true;
    }
    if (isLocalhostHostname(hostname)) {
        return true;
    }
    return trustedEntries.some((entry) => matchesTrustedEntry(hostname, port, entry));
}

/**
 * 以给定 scheme 归一化 authority，剥离默认端口，便于同源比较。
 */
function normalizeAuthority(authority: string, scheme: string): string {
    const {hostname, port} = parseHostHeader(authority);
    const defaultPort = DEFAULT_PORTS[scheme] ?? "";
    const effectivePort = port ?? defaultPort;
    if (defaultPort.length > 0 && effectivePort === defaultPort) {
        return hostname;
    }
    return effectivePort.length > 0 ? `${hostname}:${effectivePort}` : hostname;
}

/**
 * 判断 Origin 头是否与请求 Host 同源（含端口比较）。
 *
 * - 非法 Origin（含字面量 `null`，如来自 `file://` 或沙箱 iframe）→ 不同源；
 * - 端口比较会按 Origin 的 scheme 归一化默认端口（80/443）。
 */
export function isSameOrigin(originHeader: string, hostHeader: string): boolean {
    const rawOrigin = originHeader.trim();
    if (rawOrigin.length === 0) {
        return false;
    }
    let originUrl: URL;
    try {
        originUrl = new URL(rawOrigin);
    } catch {
        return false;
    }
    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
        return false;
    }

    const scheme = originUrl.protocol.slice(0, -1);
    return normalizeAuthority(originUrl.host, scheme) === normalizeAuthority(hostHeader, scheme);
}

/**
 * 生成 Host 被拒时的中文提示，给出白名单逃生舱用法。
 */
function hostRejectedMessage(hostHeader: string, trustedEntries: readonly string[]): string {
    const trustedHint = trustedEntries.length > 0
        ? `当前已配置白名单：${trustedEntries.join(", ")}。`
        : "当前未配置白名单。";
    return `请求被拒绝：Host「${hostHeader}」不在允许范围内。`
        + "仅允许 IP 字面量、localhost / *.localhost，或通过环境变量 "
        + `${TRUSTED_HOSTS_ENV} 显式加入的主机。`
        + trustedHint
        + `如需通过反向代理或自定义域名访问，请把域名（支持 *.example.com 通配）加入 ${TRUSTED_HOSTS_ENV}。`;
}

/**
 * 生成 Origin 不同源时的中文提示。
 */
function originRejectedMessage(originHeader: string, hostHeader: string): string {
    return `请求被拒绝：Origin「${originHeader}」与请求 Host「${hostHeader}」不同源。`
        + "跨源请求已被拒绝，以防 DNS rebinding。"
        + "若为反向代理或自定义域名场景，请让代理保留原始 Host"
        + "（例如 nginx 的 `proxy_set_header Host $host;`），并把域名加入 "
        + `${TRUSTED_HOSTS_ENV}。`;
}

/**
 * 生成请求缺少 Host 头时的中文提示。
 */
function missingHostMessage(): string {
    return "请求被拒绝：请求缺少 Host 头。"
        + "为保证同源比较与 DNS rebinding 防线完整，本服务要求每个请求都携带 Host 头。";
}

/**
 * 生成 403 拒绝响应。
 *
 * 直接返回 JSON 错误体（而非 `throw createError`）是为了让中文说明稳定出现在响应体中：
 * h3/Nitro 的错误序列化只保证 `statusMessage`（且会剥离非 ASCII 字符），长中文文案只有
 * 作为响应体 `message` 才能可靠传达。返回非 undefined 值会短路后续中间件与路由。
 */
function rejectRequest(event: H3Event, message: string): {statusCode: number; statusMessage: string; message: string} {
    setResponseStatus(event, 403, "Forbidden");
    return {
        statusCode: 403,
        statusMessage: "Forbidden",
        message,
    };
}

/**
 * Nitro 全站 Host / Origin 守卫。
 *
 * 顺序：先校验 Origin（主防线），再校验 Host（兜底）。两者都不读取请求体。
 */
export default defineEventHandler((event) => {
    // 显式读原始 Host 头：h3 的 getRequestHost 在缺 Host 时会回退为 "localhost"，
    // 无法区分「确实访问 localhost」与「根本没带 Host」。此处 fail-closed。
    const rawHostHeader = getRequestHeader(event, "host");
    if (rawHostHeader === undefined || rawHostHeader.trim() === "") {
        void appLogger.warn("http.host-missing", {path: event.path});
        return rejectRequest(event, missingHostMessage());
    }

    const hostHeader = getRequestHost(event);
    const trustedEntries = parseTrustedHosts(process.env[TRUSTED_HOSTS_ENV]);

    const originHeader = getRequestHeader(event, "origin");
    if (originHeader !== undefined && !isSameOrigin(originHeader, hostHeader)) {
        void appLogger.warn("http.origin-rejected", {
            host: hostHeader,
            origin: originHeader,
            path: event.path,
        });
        return rejectRequest(event, originRejectedMessage(originHeader, hostHeader));
    }

    if (!isAllowedHost(hostHeader, trustedEntries)) {
        void appLogger.warn("http.host-rejected", {
            host: hostHeader,
            path: event.path,
            trustedHosts: trustedEntries,
        });
        return rejectRequest(event, hostRejectedMessage(hostHeader, trustedEntries));
    }

    return undefined;
});
