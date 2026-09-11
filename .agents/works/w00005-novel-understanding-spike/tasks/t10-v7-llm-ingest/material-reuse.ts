import {join} from "node:path";
import {z} from "zod";
import {hash} from "./compiler.ts";
import {materialSchema, type MaterialDraft} from "./draft.ts";
import {optionalJson, readJson, writeJson} from "./storage.ts";

const receiptSchema = z.strictObject({schema: z.literal("neurobook.memory.material-reuse.v1"), sourceRound: z.number().int().positive(), sha256: z.string()});
export interface MaterialOrigin {sourceRound: number; sha256: string; material: MaterialDraft}

/** Resolve a material reuse receipt to its original same-chapter model stage, rejecting changed or indirect origins. */
export async function materialOrigin(chapterRoot: string, round: number): Promise<MaterialOrigin> {
    const stageRoot = join(chapterRoot, `round-${round}`, "material");
    const material = materialSchema.parse(await readJson(join(stageRoot, "accepted.json")));
    const sha256 = hash(JSON.stringify(material));
    const rawReceipt = await optionalJson(join(stageRoot, "reuse.json"));
    if (rawReceipt === null) return {sourceRound: round, sha256, material};
    const receipt = receiptSchema.parse(rawReceipt);
    if (receipt.sourceRound >= round || receipt.sha256 !== sha256) throw new Error("Invalid material reuse origin or hash");
    const sourceRoot = join(chapterRoot, `round-${receipt.sourceRound}`, "material");
    if (await optionalJson(join(sourceRoot, "reuse.json")) !== null) throw new Error("Material reuse must point directly to its original model stage");
    const original = materialSchema.parse(await readJson(join(sourceRoot, "accepted.json")));
    if (hash(JSON.stringify(original)) !== sha256) throw new Error("Material reuse source hash mismatch");
    return {sourceRound: receipt.sourceRound, sha256, material};
}

export async function reuseMaterial(chapterRoot: string, round: number, origin: MaterialOrigin): Promise<MaterialDraft> {
    if (origin.sourceRound >= round) throw new Error("Material reuse source must precede the repair round");
    const verified = await materialOrigin(chapterRoot, origin.sourceRound);
    if (verified.sourceRound !== origin.sourceRound || verified.sha256 !== origin.sha256) throw new Error("Material reuse origin changed");
    const stageRoot = join(chapterRoot, `round-${round}`, "material");
    // Persist provenance first so interruption can never leave an accepted copy mistaken for a new model call.
    await writeJson(join(stageRoot, "reuse.json"), {schema: "neurobook.memory.material-reuse.v1", sourceRound: origin.sourceRound, sha256: origin.sha256}, true);
    await writeJson(join(stageRoot, "accepted.json"), verified.material, true);
    return verified.material;
}
