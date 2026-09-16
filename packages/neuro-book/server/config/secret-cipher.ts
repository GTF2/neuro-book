import {createRequire} from "node:module";

/**
 * Provider API Key 落盘加密层（安全③）。
 *
 * 目标：让 workspace/.nbook/config.json 里的 API Key 不再以明文落盘，同时保证配置
 * 文件其余字段仍可读、可 diff、可人工修改。
 *
 * 关键设计（原因写在对应位置）：
 * - 密文带显式前缀 {@link ENCRYPTED_SECRET_PREFIX}；无前缀即明文（含历史数据），
 *   两者可在同一文件内共存，读取时透明区分 —— 这是「升级不丢旧 Key」的基础。
 * - 默认实现走 Windows DPAPI（bun:ffi 调 crypt32.dll）。DPAPI 只能由「同一 Windows
 *   用户」解开：换机器 / 换 Windows 账户 / 直接拷贝配置都会解不开，因此解密失败必须
 *   优雅降级（见 global-config-secrets.ts），绝不能崩在启动或请求路径上。
 * - bun:ffi 是 Bun 专有模块，而 Product 由 Bun 启动、测试却跑在 Node 下 —— 因此
 *   绝不在模块顶层 import，改为运行时惰性加载；加载失败即视为「不可用」。
 */

/** 加密值的显式前缀：有它=密文，没有=明文。带版本号便于将来更换算法。 */
export const ENCRYPTED_SECRET_PREFIX = "dpapi:v1:";

/** 可注入的加解密接口。测试注入 fake，使核心逻辑不依赖具体 OS。 */
export interface SecretCipher {
    /** 当前环境是否具备加解密能力。false 时调用方应降级为明文存储。 */
    readonly available: boolean;
    /** 加密明文，返回 base64 密文（不含前缀）。失败抛错。 */
    encrypt(plaintext: string): string;
    /** 解密 base64 密文。失败抛错（由调用方决定如何降级）。 */
    decrypt(ciphertext: string): string;
}

/** 解密失败（换机器/换账户/密文损坏）专用错误，便于调用方识别并给出中文提示。 */
export class SecretDecryptError extends Error {
    constructor(message: string, options?: {cause?: unknown}) {
        super(message, options);
        this.name = "SecretDecryptError";
    }
}

// --- 一次性告警：同一提示只打一次，避免每次读配置都刷屏（尤其读路径被高频调用时）。 ---
const emittedWarnings = new Set<string>();

/** 输出去重后的中文告警（走 console.warn，随应用日志落地）。 */
export function warnSecretOnce(message: string): void {
    if (emittedWarnings.has(message)) {
        return;
    }
    emittedWarnings.add(message);
    console.warn(`[secret] ${message}`);
}

// --- 惰性加载的 bun:ffi 最小类型声明（避免在 Node 下引入不存在的模块类型）。 ---
type FfiFunction = (...args: unknown[]) => number;
type FfiSymbolSpec = {args: number[]; returns: number};
type FfiModule = {
    // 泛型让 dlopen 的返回符号逐键确定类型（配合 noUncheckedIndexedAccess 不产生 undefined）。
    dlopen: <K extends string>(library: string, symbols: Record<K, FfiSymbolSpec>) => {symbols: Record<K, FfiFunction>};
    FFIType: {ptr: number; u32: number; i32: number};
    ptr: (value: unknown) => unknown;
    read: {ptr: (pointer: unknown, offset: number) => unknown};
    toArrayBuffer: (pointer: unknown, byteOffset: number, byteLength: number) => ArrayBuffer;
};

type LoadedDpapi = {
    ffi: FfiModule;
    protect: FfiFunction;
    unprotect: FfiFunction;
    localFree: FfiFunction;
};

// 64 位下 DATA_BLOB 布局：cbData(u32) + 4 字节 padding + pbData(ptr) = 16 字节。
const DATA_BLOB_BYTE_LENGTH = 16;
// CRYPTPROTECT_UI_FORBIDDEN：禁止任何交互式提示，适配后台服务进程。
const CRYPTPROTECT_UI_FORBIDDEN = 0x1;

/** 是否处于 DPAPI 可用的运行时（Bun + Windows）。 */
function isDpapiRuntime(): boolean {
    return typeof (globalThis as {Bun?: unknown}).Bun !== "undefined" && process.platform === "win32";
}

/** 按需加载 bun:ffi 并绑定 crypt32/kernel32 符号。 */
function loadDpapi(): LoadedDpapi {
    // 用拼接串构造模块名，让打包器无法在构建期静态解析 bun:ffi（非 Bun 构建机没有该模块）。
    const require = createRequire(import.meta.url);
    const ffi = require(["bun", "ffi"].join(":")) as FfiModule;
    const {symbols} = ffi.dlopen("crypt32.dll", {
        CryptProtectData: {
            args: [ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.u32, ffi.FFIType.ptr],
            returns: ffi.FFIType.i32,
        },
        CryptUnprotectData: {
            args: [ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.ptr, ffi.FFIType.u32, ffi.FFIType.ptr],
            returns: ffi.FFIType.i32,
        },
    });
    // DPAPI 的输出缓冲用 LocalAlloc 分配，必须用 LocalFree 释放；它在 kernel32 而非 crypt32。
    const kernel = ffi.dlopen("kernel32.dll", {LocalFree: {args: [ffi.FFIType.ptr], returns: ffi.FFIType.ptr}});
    return {ffi, protect: symbols.CryptProtectData, unprotect: symbols.CryptUnprotectData, localFree: kernel.symbols.LocalFree};
}

/** Windows DPAPI 实现（当前用户作用域）。 */
class DpapiSecretCipher implements SecretCipher {
    readonly available = true;
    private readonly dpapi: LoadedDpapi;

    constructor() {
        // 构造即加载：加载失败让 createDefaultSecretCipher 捕获并降级。
        this.dpapi = loadDpapi();
    }

    /** 执行一次 DPAPI 调用并复制出结果缓冲；无论成败都释放 Windows 侧内存。 */
    private invoke(input: Uint8Array, protect: boolean): Uint8Array {
        const {ffi, protect: protectFn, unprotect: unprotectFn, localFree} = this.dpapi;
        const inBlob = new Uint8Array(DATA_BLOB_BYTE_LENGTH);
        const inView = new DataView(inBlob.buffer);
        inView.setUint32(0, input.byteLength, true);
        inView.setBigUint64(8, BigInt(Number(ffi.ptr(input))), true);

        const outBlob = new Uint8Array(DATA_BLOB_BYTE_LENGTH);
        const ok = (protect ? protectFn : unprotectFn)(ffi.ptr(inBlob), null, null, null, null, CRYPTPROTECT_UI_FORBIDDEN, ffi.ptr(outBlob));
        const outView = new DataView(outBlob.buffer);
        const outLength = outView.getUint32(0, true);
        if (!ok) {
            throw new SecretDecryptError(protect ? "DPAPI 加密失败" : "DPAPI 解密失败（该值可能由另一台机器或另一个 Windows 账户加密）");
        }
        const outPointer = ffi.read.ptr(ffi.ptr(outBlob), 8);
        try {
            return new Uint8Array(ffi.toArrayBuffer(outPointer, 0, outLength)).slice();
        } finally {
            localFree(outPointer);
        }
    }

    encrypt(plaintext: string): string {
        return Buffer.from(this.invoke(Buffer.from(plaintext, "utf8"), true)).toString("base64");
    }

    decrypt(ciphertext: string): string {
        return Buffer.from(this.invoke(Buffer.from(ciphertext, "base64"), false)).toString("utf8");
    }
}

/** 当前环境无加密能力时的占位实现：永远抛错，由调用方按 available=false 降级。 */
export class UnavailableSecretCipher implements SecretCipher {
    readonly available = false;
    encrypt(): string {
        throw new SecretDecryptError("当前环境不支持 API Key 加密（非 Windows 或非 Bun 运行时）");
    }
    decrypt(): string {
        throw new SecretDecryptError("当前环境不支持 API Key 解密（非 Windows 或非 Bun 运行时）");
    }
}

/** 测试/自定义注入的覆盖实现；null 表示使用按环境解析的默认实现。 */
let overrideCipher: SecretCipher | null = null;
let cachedDefaultCipher: SecretCipher | null = null;

/** 测试专用：注入 fake cipher 或恢复默认（传 null）。 */
export function setSecretCipherForTesting(cipher: SecretCipher | null): void {
    overrideCipher = cipher;
}

/** 解析当前应使用的 cipher：注入优先，否则按运行时惰性构造默认实现。 */
export function resolveSecretCipher(): SecretCipher {
    if (overrideCipher) {
        return overrideCipher;
    }
    if (!cachedDefaultCipher) {
        cachedDefaultCipher = createDefaultSecretCipher();
    }
    return cachedDefaultCipher;
}

/** 默认实现：DPAPI 可用则用之，否则降级为「不可用」。 */
function createDefaultSecretCipher(): SecretCipher {
    if (isDpapiRuntime()) {
        try {
            return new DpapiSecretCipher();
        } catch (error) {
            warnSecretOnce(`DPAPI 加密不可用，API Key 将以明文保存：${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return new UnavailableSecretCipher();
}
