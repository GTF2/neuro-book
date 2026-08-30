import {spawnPosixOwnedProcess} from "#owned-process/posix-adapter";
import {OwnedProcessError} from "#owned-process/types";
import type {OwnedProcessLease, OwnedProcessOptions, OwnedProcessSpec} from "#owned-process/types";
import {spawnWindowsOwnedProcess} from "#owned-process/windows-adapter";

export type {
    OwnedProcessCompletion,
    OwnedProcessLease,
    OwnedProcessOptions,
    OwnedProcessSpec,
    OwnedProcessStdio,
    OwnedProcessTerminationReason,
} from "#owned-process/types";
export {OwnedProcessError};

/**
 * 启动NeuroBook拥有的进程树。
 * Windows在目标创建前建立Job Object；POSIX监督器持有独立process group。
 * 两个平台都在宿主IPC断开时收口目标树。
 */
export function spawnOwnedProcess(spec: OwnedProcessSpec, options: OwnedProcessOptions = {}): OwnedProcessLease {
    if (process.platform === "win32") {
        if (process.arch !== "x64") {
            throw new OwnedProcessError(`Windows Owned Process当前仅支持x64，实际为${process.arch}。`, {stage: "platform"});
        }
        return spawnWindowsOwnedProcess(spec, options);
    }
    return spawnPosixOwnedProcess(spec, options);
}
