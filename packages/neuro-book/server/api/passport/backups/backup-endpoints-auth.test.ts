import {beforeEach, describe, expect, it, vi} from "vitest";

// 云备份会打包并上传整个 State Root，必须与管理员接口同级受 requireAdminAccess 保护。
// 与 server/utils/auth.test.ts 同法：Nuxt/Nitro auto-import 的全局在单测里挂到 globalThis，
// 再动态 import 路由模块，断言鉴权开启且无 session 时端点直接以 401 拒绝。

const bootConfigMock = vi.hoisted(() => ({enabled: true}));

vi.mock("nbook/server/config/boot-config", () => ({
    loadBootAuthEnabledSync: () => bootConfigMock.enabled,
}));
vi.mock("nbook/server/utils/prisma", () => ({
    prisma: {user: {findUnique: vi.fn()}},
}));
vi.mock("nbook/server/backup/backup-job-manager", () => ({
    usePassportJobManager: () => ({startBackup: vi.fn(() => "job"), startRestore: vi.fn(() => "job"), job: () => null}),
}));
vi.mock("nbook/server/utils/novel-chapter", () => ({validateBody: vi.fn()}));

type GuardError = Error & {statusCode?: number};

beforeEach(() => {
    const globals = globalThis as typeof globalThis & Record<string, unknown>;
    globals.defineEventHandler = (handler: unknown) => handler;
    globals.createError = (input: {statusCode?: number; message?: string}) => {
        const error = new Error(input.message ?? "错误") as GuardError;
        error.statusCode = input.statusCode;
        return error;
    };
    globals.getRouterParam = () => "1";
    globals.getUserSession = vi.fn(async () => ({}));
    globals.setUserSession = vi.fn();
    globals.clearUserSession = vi.fn();
    bootConfigMock.enabled = true;
});

describe("备份端点鉴权守卫", () => {
    it("发起备份端点拒绝未登录请求", async () => {
        const {default: handler} = await import("nbook/server/api/passport/backups/index.post");
        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 401});
    });

    it("恢复端点拒绝未登录请求", async () => {
        const {default: handler} = await import("nbook/server/api/passport/backups/[id]/restore.post");
        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 401});
    });

    it("任务轮询端点拒绝未登录请求", async () => {
        const {default: handler} = await import("nbook/server/api/passport/backups/jobs/[id].get");
        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 401});
    });
});
