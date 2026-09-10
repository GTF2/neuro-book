import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve, dirname} from "node:path";
import {build} from "esbuild";
import {parseDataset} from "../t07-v7-schema-gold/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "../t07-v7-schema-gold/dataset-v7.json");
const output = process.argv[3] ? resolve(process.argv[3]) : resolve(root, "viewer-v7.html");
const data = parseDataset(JSON.parse(await readFile(input, "utf8")));
const bundle = await build({entryPoints: [resolve(root, "viewer.ts")], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", minify: true, legalComments: "none"});
const script = bundle.outputFiles[0]?.text;
if (!script) throw new Error("Viewer compilation produced no JavaScript");
const safeJson = JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
const template = await readFile(resolve(root, "viewer.template.html"), "utf8");
const style = await readFile(resolve(root, "viewer.css"), "utf8");
const iconModule = await import("@iconify-json/lucide/icons.json");
const icons = iconModule.default.icons;
const icon = (name: keyof typeof icons): string => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${icons[name].body}</svg>`;
for (const marker of ["__STYLE__", "__DATASET__", "__SCRIPT__"]) if (template.split(marker).length !== 2) throw new Error(`Template marker missing or repeated: ${marker}`);
const html = template.replace("__STYLE__", () => style).replace("__DATASET__", () => safeJson).replace("__SCRIPT__", () => script.replace(/<\/script/giu, "<\\/script"))
    .replace("__IMPORT_ICON__", () => icon("upload")).replace("__EXPORT_ICON__", () => icon("download")).replace("__RESET_ICON__", () => icon("scan"))
    .replace("__BACK_ICON__", () => icon("arrow-left")).replace("__SETTINGS_ICON__", () => icon("sliders-horizontal"));
await writeFile(output, html, "utf8");
console.log(JSON.stringify({schema: "neurobook.v7-viewer-build/v1", input, output, nodes: data.nodes.length, bytes: Buffer.byteLength(html), sha256: createHash("sha256").update(html).digest("hex")}, null, 2));
