import {describe, expect, it} from "vitest";
import {materialSchema} from "./draft.ts";
import {applyRecordPatch, canPatchCandidate, repairResponseSchema} from "./record-patch.ts";

const disclosure = {id: "d1", from: 1, to: 1, text: "角色提出问题。", channel: "speech", mode: "question", holder: "r1", about: ["r1"]};
const material = {
    referents: [{id: "r1", mentions: [{paragraph: 1, text: "角色", occurrence: 0, name: true}]}],
    disclosures: [disclosure],
    beats: [{id: "b1", from: 1, to: 1, gist: "角色提出问题。", mode: "narrative", about: ["r1"]}],
};
const patch = (record: unknown) => ({replacements: [{collection: "disclosures", record}]});

describe("record replacement", () => {
    it("chooses complete generation for unaddressable data and requires explicit regeneration", () => {
        expect(canPatchCandidate("material", material)).toBe(true);
        expect(canPatchCandidate("material", {...material, referents: [{id: "invalid:id"}]})).toBe(false);
        expect(canPatchCandidate("material", {...material, extra: []})).toBe(false);
        expect(canPatchCandidate("material", null)).toBe(false);
        expect(repairResponseSchema("material").parse({regenerate: "Need to split a disclosure"})).toEqual({regenerate: "Need to split a disclosure"});
        expect(() => repairResponseSchema("material").parse(material)).toThrow();
        expect(() => repairResponseSchema("material").parse({...patch(disclosure), regenerate: "ambiguous"})).toThrow();
    });
    it("repairs an invalid record while preserving all unrelated records and the original input", () => {
        const base = {...material, disclosures: [{...disclosure, mode: "unsupported"}]};
        const before = structuredClone(base);
        const result = applyRecordPatch("material", base, patch(disclosure));
        expect(materialSchema.parse(result.candidate)).toEqual(material);
        expect(result.changed).toEqual(["disclosures/d1"]);
        expect(base).toEqual(before);
        expect(result.candidate.referents).toEqual(base.referents);
        expect(result.candidate.beats).toEqual(base.beats);
    });

    it("cannot pass validation by deleting, creating or renaming records", () => {
        expect(() => applyRecordPatch("material", material, patch({...disclosure, id: "new_id"}))).toThrow(/create or rename/);
        expect(() => applyRecordPatch("material", material, {replacements: [], delete: ["d1"]})).toThrow();
    });

    it("rejects ambiguous base IDs and repeated patch targets", () => {
        expect(() => applyRecordPatch("material", {...material, disclosures: [disclosure, disclosure]}, patch(disclosure))).toThrow(/Ambiguous/);
        expect(() => applyRecordPatch("material", material, {replacements: [patch(disclosure).replacements[0], patch(disclosure).replacements[0]]})).toThrow(/Repeated/);
    });

    it("rejects invalid replacement data and collections belonging to another stage", () => {
        expect(() => applyRecordPatch("material", material, patch({...disclosure, mode: "unsupported"}))).toThrow();
        expect(() => applyRecordPatch("material", material, {replacements: [{collection: "facts", record: disclosure}]})).toThrow();
    });

    it("preserves unpatched errors for the mandatory whole-candidate validation", () => {
        const base = {...material, disclosures: [disclosure, {...disclosure, id: "d2", mode: "unsupported"}]};
        const result = applyRecordPatch("material", base, patch(disclosure));
        expect(() => materialSchema.parse(result.candidate)).toThrow();
        expect(result.candidate.disclosures).toEqual(base.disclosures);
    });
});
