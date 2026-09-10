import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";
import {resolveAgentCacheRoot} from "@notnotype/neuro-book-test-support/paths";

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    cacheDir: resolveAgentCacheRoot("t09-v7-query-cli-vitest"),
    test: {
        include: ["*.test.ts"],
        setupFiles: ["@notnotype/neuro-book-test-support/vitest"],
        globalSetup: ["@notnotype/neuro-book-test-support/vitest"],
    },
});
