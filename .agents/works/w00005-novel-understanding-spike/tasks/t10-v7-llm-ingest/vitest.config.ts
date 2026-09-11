import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";
import {resolveAgentCacheRoot} from "@notnotype/neuro-book-test-support/paths";

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    cacheDir: resolveAgentCacheRoot("t10-v7-ingest-vitest"),
    test: {
        include: ["*.test.ts"],
        setupFiles: ["@notnotype/neuro-book-test-support/vitest"],
        globalSetup: ["@notnotype/neuro-book-test-support/vitest"],
    },
});
