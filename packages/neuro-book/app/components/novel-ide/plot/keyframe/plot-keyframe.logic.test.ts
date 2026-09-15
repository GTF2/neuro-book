import {describe, expect, it} from "vitest";
import {
    formatKeyframeInstant,
    joinIrreversibleChanges,
    parseIrreversibleChanges,
    sortKeyframesByInstant,
    validateKeyframeDraft,
    type KeyframeDraft,
} from "nbook/app/components/novel-ide/plot/keyframe/plot-keyframe.logic";
import type {CreateStoryKeyframeRequestDto, StoryKeyframeDto, UpdateStoryKeyframeRequestDto} from "nbook/shared/dto/plot.dto";

/**
 * 关键帧 UI 纯逻辑测试:不可逆变化解析、故事时间排序、草稿校验与状态流转不变式。
 * 不变式对齐 docs/specs/plot/keyframe.md「关键不变量」:创建恒 pending、不可回退到 pending、
 * overthrown 必须挂 decisionRefId、instant 必须是非负整数字符串、name 同 Story 唯一。
 */

/** 构造帧 DTO;默认值可被覆盖。 */
function makeKeyframe(overrides: Partial<StoryKeyframeDto> = {}): StoryKeyframeDto {
    return {
        id: "1",
        storyId: "1",
        sceneId: null,
        name: "k-necklace-taken",
        title: "项链易主",
        instant: "600",
        irreversibleChanges: ["项链从阿黎转到灰隼手里"],
        source: "author",
        status: "pending",
        decisionRefId: null,
        note: null,
        createdAt: "2026-09-15T00:00:00.000Z",
        updatedAt: "2026-09-15T00:00:00.000Z",
        ...overrides,
    };
}

/** 构造编辑器草稿。 */
function makeDraft(overrides: Partial<KeyframeDraft> = {}): KeyframeDraft {
    return {
        name: "k-necklace-taken",
        title: "项链易主",
        instant: "600",
        irreversibleChangesText: "项链从阿黎转到灰隼手里",
        note: "",
        ...overrides,
    };
}

describe("关键帧·不可逆变化解析", () => {
    it("按行切分、逐条 trim 并丢弃空行", () => {
        expect(parseIrreversibleChanges("  甲死  \n\n  乙失剑\n")).toEqual(["甲死", "乙失剑"]);
    });

    it("兼容 CRLF 与行内空格,保持声明顺序且不去重", () => {
        expect(parseIrreversibleChanges("甲死\r\n乙死\r\n甲死")).toEqual(["甲死", "乙死", "甲死"]);
    });

    it("纯空白输入解析为空列表", () => {
        expect(parseIrreversibleChanges("  \n\t\n ")).toEqual([]);
    });

    it("joinIrreversibleChanges 与解析互逆(回填草稿用)", () => {
        const changes = ["甲死", "乙失剑"];
        expect(joinIrreversibleChanges(changes)).toBe("甲死\n乙失剑");
        expect(parseIrreversibleChanges(joinIrreversibleChanges(changes))).toEqual(changes);
    });
});

describe("关键帧·故事时间排序", () => {
    it("按 instant 数值升序(不是字符串字典序)", () => {
        const ordered = sortKeyframesByInstant([
            makeKeyframe({id: "3", name: "c", instant: "100"}),
            makeKeyframe({id: "1", name: "a", instant: "9"}),
            makeKeyframe({id: "2", name: "b", instant: "10"}),
        ]);
        expect(ordered.map((item) => item.instant)).toEqual(["9", "10", "100"]);
    });

    it("同 instant 时按 id 升序(数值比较,不是字典序)", () => {
        const ordered = sortKeyframesByInstant([
            makeKeyframe({id: "10", name: "b", instant: "600"}),
            makeKeyframe({id: "9", name: "a", instant: "600"}),
        ]);
        expect(ordered.map((item) => item.id)).toEqual(["9", "10"]);
    });

    it("不修改入参顺序", () => {
        const input = [
            makeKeyframe({id: "2", instant: "20"}),
            makeKeyframe({id: "1", instant: "10"}),
        ];
        const snapshot = input.map((item) => item.id);
        sortKeyframesByInstant(input);
        expect(input.map((item) => item.id)).toEqual(snapshot);
    });

    it("instant 文案保持原始数字(界面不换算日历时间)", () => {
        expect(formatKeyframeInstant(" 600 ")).toBe("600");
    });
});

describe("关键帧·创建校验", () => {
    it("合法草稿生成创建载荷:来源恒 author、无 status、备注空为 null", () => {
        const result = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({irreversibleChangesText: "甲死\n乙失剑", note: "  "}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        const body = (result as {ok: true; body: CreateStoryKeyframeRequestDto}).body;
        expect(body).toEqual({
            name: "k-necklace-taken",
            title: "项链易主",
            instant: "600",
            irreversibleChanges: ["甲死", "乙失剑"],
            source: "author",
            note: null,
        });
        // 创建路径不接受 status / decisionRefId(创建恒 pending)。
        expect("status" in body).toBe(false);
        expect("decisionRefId" in body).toBe(false);
    });

    it("备注非空时原样提交(trim 后)", () => {
        const result = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({note: "  待回撞确认  "}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        expect((result as {ok: true; body: CreateStoryKeyframeRequestDto}).body.note).toBe("待回撞确认");
    });

    it("name 缺失/形态非法/过长被拒", () => {
        const cases: Array<[string, string]> = [
            ["", "nameRequired"],
            ["K-Necklace", "nameFormat"],
            ["k_necklace", "nameFormat"],
            ["-abc", "nameFormat"],
            ["a".repeat(121), "nameTooLong"],
        ];
        for (const [name, code] of cases) {
            const result = validateKeyframeDraft({
                mode: "create",
                draft: makeDraft({name}),
                existingNames: [],
                current: null,
                nextStatus: "pending",
                decisionRefId: "",
            });
            expect(result.ok ? "ok" : result.code).toBe(code);
        }
    });

    it("同 Story 重名被拒", () => {
        const result = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({name: "k-necklace-taken"}),
            existingNames: ["k-necklace-taken"],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok ? "ok" : result.code).toBe("nameDuplicate");
        expect(result.ok ? "" : result.field).toBe("name");
    });

    it("标题缺失被拒", () => {
        const result = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({title: "   "}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok ? "ok" : result.code).toBe("titleRequired");
    });

    it("instant 必须是字符串形式的非负整数(瞬时锚点)", () => {
        const cases = ["", "  ", "-1", "1.5", "1e3", "abc", "６００"];
        for (const instant of cases) {
            const result = validateKeyframeDraft({
                mode: "create",
                draft: makeDraft({instant}),
                existingNames: [],
                current: null,
                nextStatus: "pending",
                decisionRefId: "",
            });
            expect(result.ok).toBe(false);
            expect(result.ok ? "" : result.field).toBe("instant");
        }
        for (const instant of ["0", "600", " 600 "]) {
            const result = validateKeyframeDraft({
                mode: "create",
                draft: makeDraft({instant}),
                existingNames: [],
                current: null,
                nextStatus: "pending",
                decisionRefId: "",
            });
            expect(result.ok).toBe(true);
        }
    });

    it("至少一条不可逆变化,且最多 50 条", () => {
        const empty = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({irreversibleChangesText: " \n \n"}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(empty.ok ? "ok" : empty.code).toBe("changesRequired");

        const tooMany = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({irreversibleChangesText: Array.from({length: 51}, (_, index) => `变化${index}`).join("\n")}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(tooMany.ok ? "ok" : tooMany.code).toBe("changesTooMany");
    });

    it("备注过长被拒", () => {
        const result = validateKeyframeDraft({
            mode: "create",
            draft: makeDraft({note: "字".repeat(5001)}),
            existingNames: [],
            current: null,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok ? "ok" : result.code).toBe("noteTooLong");
    });
});

describe("关键帧·编辑与状态流转", () => {
    it("未改名的帧不与自己重名", () => {
        const current = makeKeyframe({name: "k-necklace-taken"});
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken", "k-sword-lost"],
            current,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
    });

    it("改成了别的帧的 name 被拒", () => {
        const current = makeKeyframe({name: "k-necklace-taken"});
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft({name: "k-sword-lost"}),
            existingNames: ["k-necklace-taken", "k-sword-lost"],
            current,
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok ? "ok" : result.code).toBe("nameDuplicate");
    });

    it("已离开 pending 的帧不能改回 pending(回撞流转单向)", () => {
        for (const status of ["confirmed", "violated", "overthrown"] as const) {
            const result = validateKeyframeDraft({
                mode: "edit",
                draft: makeDraft(),
                existingNames: ["k-necklace-taken"],
                current: makeKeyframe({status, decisionRefId: status === "overthrown" ? "7" : null}),
                nextStatus: "pending",
                decisionRefId: "",
            });
            expect(result.ok).toBe(false);
            expect(result.ok ? "" : result.code).toBe("statusRevertToPending");
            expect(result.ok ? "" : result.field).toBe("status");
        }
    });

    it("pending 帧维持 pending 时不提交 status(避免无谓写)", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "pending"}),
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        const body = (result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body;
        expect("status" in body).toBe(false);
    });

    it("裁决维持帧:violated → confirmed 提交 status", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "violated"}),
            nextStatus: "confirmed",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        expect((result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body.status).toBe("confirmed");
    });

    it("推翻帧必须有裁决留痕:无 decisionRefId 被拒", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "violated", decisionRefId: null}),
            nextStatus: "overthrown",
            decisionRefId: "   ",
        });
        expect(result.ok).toBe(false);
        expect(result.ok ? "" : result.code).toBe("decisionRefRequired");
        expect(result.ok ? "" : result.field).toBe("decisionRefId");
    });

    it("推翻帧:带上决策记录 id 时同时提交 status 与 decisionRefId", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "violated"}),
            nextStatus: "overthrown",
            decisionRefId: " 7 ",
        });
        expect(result.ok).toBe(true);
        const body = (result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body;
        expect(body.status).toBe("overthrown");
        expect(body.decisionRefId).toBe("7");
    });

    it("帧上原有留痕时,推翻不再强制重填(也不误清空原有引用)", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "violated", decisionRefId: "7"}),
            nextStatus: "overthrown",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        const body = (result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body;
        expect(body.status).toBe("overthrown");
        expect("decisionRefId" in body).toBe(false);
    });

    it("非推翻状态下不提交 decisionRefId(不误清已有留痕)", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft(),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({status: "violated", decisionRefId: "7"}),
            nextStatus: "confirmed",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        const body = (result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body;
        expect("decisionRefId" in body).toBe(false);
        expect(body.status).toBe("confirmed");
    });

    it("清空备注:空串映射 null(PATCH 显式清空语义)", () => {
        const result = validateKeyframeDraft({
            mode: "edit",
            draft: makeDraft({note: ""}),
            existingNames: ["k-necklace-taken"],
            current: makeKeyframe({note: "旧备注"}),
            nextStatus: "pending",
            decisionRefId: "",
        });
        expect(result.ok).toBe(true);
        expect((result as {ok: true; body: UpdateStoryKeyframeRequestDto}).body.note).toBe(null);
    });
});
