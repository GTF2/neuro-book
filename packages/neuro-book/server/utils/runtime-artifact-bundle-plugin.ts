import {realpathSync} from "node:fs";
import {builtinModules, createRequire} from "node:module";
import {dirname, isAbsolute, join, relative, resolve, sep} from "node:path";
import {pathToFileURL} from "node:url";
import type {Plugin} from "esbuild";
import {
    resolveRuntimeArtifactNbookPath,
    type RuntimeArtifactCompilerContext,
} from "nbook/server/utils/runtime-artifact-compiler-context";

/**
 * 为 Profile/Variable artifact 提供一致的 SDK 与批准依赖解析。
 *
 * `nbook/**` 固定投影到当前编译上下文；Runtime builtin 保持 external；其余 bare
 * package 必须从 compilerPackageRoot 解析后进入 bundle，禁止从 artifact 所在目录向上查找。
 *
 * 「向上查找」本身是 Node 的既有语义（`createRequire(compilerPackageRoot)` 会沿 node_modules
 * 逐级上溯），所以这里校验的不是「只允许某一个目录」，而是**解析结果必须落在批准解析根集合内**：
 * 集合 = `{compilerNodeModulesRoot}` ∪ `{compilerPackageRoot 各级祖先的 node_modules}`。
 * 少了这一步，Bun 运行时的 `createRequire().resolve()` 会静默兜底到 Bun 全局安装缓存
 * （`~/.bun/install/cache`），把并不在本批准根内的依赖偷偷打进 artifact —— 既破坏「批准依赖」
 * 的来源完整性，也会让「打包漏依赖」这种本应失败的场景在 Bun 下静默通过（fail-open）。
 */
export function runtimeArtifactBundlePlugin(
    context: RuntimeArtifactCompilerContext,
    name: string,
): Plugin {
    const nodeModuleNames = new Set([
        ...builtinModules,
        ...builtinModules.map((moduleName) => `node:${moduleName}`),
    ]);
    const requireFromCompiler = createRequire(pathToFileURL(context.compilerPackageRoot));
    // 批准解析根集合只取决于编译上下文，不随被解析的 specifier 变化，构造期算一次即可。
    const approvedRoots = approvedResolutionRoots(context);
    return {
        name,
        setup(buildApi) {
            buildApi.onResolve({filter: /^(nbook|neuro_book)\//}, (args) => ({
                path: resolveRuntimeArtifactNbookPath(
                    context,
                    args.path.replace(/^(nbook|neuro_book)\//, ""),
                ),
            }));
            buildApi.onResolve({filter: /^[^./].*/}, (args) => {
                if (nodeModuleNames.has(args.path) || args.path === "bun" || args.path.startsWith("bun:")) {
                    return {path: args.path, external: true};
                }
                // 该 filter 也会命中 Windows 绝对路径 / UNC 入口（以盘符或反斜杠开头），
                // 但它们本身是路径而非裸包，不属于「批准依赖」语义，保持交给 esbuild 原样解析。
                const isPathLike = isAbsolute(args.path) || /^[A-Za-z]:[\\/]/u.test(args.path) || args.path.startsWith("\\\\");
                try {
                    const resolved = requireFromCompiler.resolve(args.path);
                    if (!isAbsolute(resolved)) {
                        return {path: args.path, external: true};
                    }
                    if (!isPathLike && !isWithinApprovedResolutionRoots(args.path, resolved, approvedRoots)) {
                        return {
                            errors: [{
                                text: `Authoring Kit 未登记依赖：${args.path}`,
                                detail: `解析结果落在批准包根之外：${resolved}`,
                            }],
                        };
                    }
                    return {path: resolved};
                } catch {
                    return {
                        errors: [{
                            text: `Authoring Kit 未登记依赖：${args.path}`,
                        }],
                    };
                }
            });
        },
    };
}

/** 取真实路径；路径不存在等情况下原样返回，避免因 realpath 失败而改变判定。 */
function realpathOrSelf(value: string): string {
    try {
        return realpathSync.native(value);
    } catch {
        return value;
    }
}

/** `relative()` 结果是否逃出 root（`..`、以 `..<sep>` 开头或绝对路径都算越界）。 */
function isOutsideRoot(relativePath: string): boolean {
    return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

/**
 * 批准解析根集合：`compilerNodeModulesRoot` 与 `compilerPackageRoot` 各级祖先的 `node_modules`。
 *
 * 它与 Node「从锚点目录逐级向上查找 node_modules」的语义一致，对 Source / Product 两种上下文
 * 都成立；同时排除了 Bun 全局安装缓存这种不在链上的兜底位置。
 */
function approvedResolutionRoots(context: RuntimeArtifactCompilerContext): readonly string[] {
    const roots = new Set<string>([resolve(context.compilerNodeModulesRoot)]);
    let current = dirname(resolve(context.compilerPackageRoot));
    for (;;) {
        roots.add(join(current, "node_modules"));
        const parent = dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return Object.freeze([...roots]);
}

/** 取 specifier 的包名（`@scope/name/sub` → `@scope/name`，`name/sub` → `name`）。 */
function packageNameOfSpecifier(specifier: string): string {
    const [first = "", second = ""] = specifier.split("/");
    return specifier.startsWith("@") && second ? `${first}/${second}` : first;
}

/**
 * 判断解析结果是否落在批准解析根集合内。两条判据任一命中即通过：
 *
 * 1. 解析结果（真实路径）位于某个批准根之下；
 * 2. 解析结果位于「某批准根下该包目录的真实路径」之下 —— 覆盖 pnpm / workspace 提升把
 *    `node_modules/<pkg>` 做成软链、其真实路径落在批准根之外（甚至磁盘另一处）的合法场景。
 *    若缺少这一条，Node 上原本解析成功的软链依赖会被误判为越界（Node 默认返回 realpath）。
 */
function isWithinApprovedResolutionRoots(
    specifier: string,
    resolved: string,
    approvedRoots: readonly string[],
): boolean {
    const resolvedReal = realpathOrSelf(resolve(resolved));
    const packageName = packageNameOfSpecifier(specifier);
    for (const root of approvedRoots) {
        if (!isOutsideRoot(relative(realpathOrSelf(root), resolvedReal))) {
            return true;
        }
        if (!isOutsideRoot(relative(realpathOrSelf(join(root, packageName)), resolvedReal))) {
            return true;
        }
    }
    return false;
}
