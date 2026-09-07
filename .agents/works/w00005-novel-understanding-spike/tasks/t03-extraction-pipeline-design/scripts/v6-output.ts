import {createRequire} from "node:module";
import type * as TypeScript from "typescript";
import type {BeatDraft, ConceptDraft, DisclosureDraft, ExtractionDraft, NameDraft, Source, Span} from "../../t02-novel-memory-model-design/schema-v6.ts";

export type OutputStage = "a" | "b";

export type OutputIssue = {
    readonly path: string;
    readonly line: number;
    readonly column: number;
    readonly message: string;
};

export type OutputParseOptions = {
    readonly stage: OutputStage;
    readonly paragraphCount: number;
    readonly paragraphs?: readonly string[];
    readonly knownConceptIds?: readonly string[];
};

export type OutputParseResult =
    | {readonly ok: true; readonly stage: "a"; readonly value: readonly BeatDraft[]}
    | {readonly ok: true; readonly stage: "b"; readonly value: ExtractionDraft}
    | {readonly ok: false; readonly issues: readonly OutputIssue[]};

type ParsedLiteral = string | number | boolean | null | ParsedLiteral[] | {[key: string]: ParsedLiteral};
type ObjectValue = {[key: string]: ParsedLiteral};

const LOCAL_ID = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u;
const KNOWN_ID = /^known:[A-Za-z][A-Za-z0-9_:-]{0,95}$/u;
const MODE_BY_VALUE: Record<DisclosureDraft["mode"], true> = {
    assertion: true,
    question: true,
    request: true,
    conjecture: true,
};
const CHANNEL_BY_VALUE: Record<Source["channel"], true> = {
    narrator: true,
    author: true,
    system: true,
    speech: true,
    thought: true,
};

function loadTypeScript(): typeof TypeScript {
    const require = createRequire(import.meta.url);
    return require("typescript") as typeof TypeScript;
}

function isObjectValue(value: ParsedLiteral | undefined): value is ObjectValue {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(issues: OutputIssue[], sourceFile: TypeScript.SourceFile, node: TypeScript.Node, path: string, message: string): void {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    issues.push({path, line: position.line + 1, column: position.character + 1, message});
}

function addDiagnostic(issues: OutputIssue[], ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, diagnostic: TypeScript.Diagnostic, path: string): void {
    const start = diagnostic.start ?? 0;
    const position = sourceFile.getLineAndCharacterOfPosition(start);
    issues.push({path, line: position.line + 1, column: position.character + 1, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")});
}

function propertyName(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, property: TypeScript.PropertyAssignment): string | null {
    if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) return property.name.text;
    return null;
}

function parseLiteral(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, node: TypeScript.Expression, path: string, issues: OutputIssue[]): ParsedLiteral | undefined {
    if (ts.isParenthesizedExpression(node)) return parseLiteral(ts, sourceFile, node.expression, path, issues);
    if (ts.isAsExpression(node)) {
        if (node.type.kind !== ts.SyntaxKind.ConstKeyword) {
            addIssue(issues, sourceFile, node.type, path, "只允许 as const");
            return undefined;
        }
        return parseLiteral(ts, sourceFile, node.expression, path, issues);
    }
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isNumericLiteral(node)) {
        const value = Number(node.text);
        if (!Number.isFinite(value)) addIssue(issues, sourceFile, node, path, "数字必须是有限数值");
        return value;
    }
    if (ts.isArrayLiteralExpression(node)) {
        const result: ParsedLiteral[] = [];
        node.elements.forEach((element, index) => {
            const elementPath = `${path}[${index}]`;
            if (element.kind === ts.SyntaxKind.OmittedExpression) {
                addIssue(issues, sourceFile, element, elementPath, "不允许数组空位");
                return;
            }
            if (ts.isSpreadElement(element)) {
                addIssue(issues, sourceFile, element, elementPath, "不允许数组展开");
                return;
            }
            const parsed = parseLiteral(ts, sourceFile, element, elementPath, issues);
            if (parsed !== undefined) result.push(parsed);
        });
        return result;
    }
    if (ts.isObjectLiteralExpression(node)) {
        const result: ObjectValue = {};
        const names = new Set<string>();
        node.properties.forEach((property, index) => {
            const propertyPath = `${path}.${index}`;
            if (!ts.isPropertyAssignment(property)) {
                addIssue(issues, sourceFile, property, propertyPath, "对象只允许普通属性赋值，不允许方法、简写或展开");
                return;
            }
            const name = propertyName(ts, sourceFile, property);
            if (name === null) {
                addIssue(issues, sourceFile, property.name, propertyPath, "属性名必须是非计算标识符或字符串");
                return;
            }
            if (names.has(name)) {
                addIssue(issues, sourceFile, property.name, `${path}.${name}`, "对象键重复");
                return;
            }
            names.add(name);
            const parsed = parseLiteral(ts, sourceFile, property.initializer, `${path}.${name}`, issues);
            if (parsed !== undefined) result[name] = parsed;
        });
        return result;
    }
    addIssue(issues, sourceFile, node, path, "表达式不在 V6 字面量白名单内");
    return undefined;
}

function objectField(object: ObjectValue, key: string, path: string, node: TypeScript.Node, sourceFile: TypeScript.SourceFile, issues: OutputIssue[]): ParsedLiteral | undefined {
    if (!(key in object)) addIssue(issues, sourceFile, node, `${path}.${key}`, "缺少必需字段");
    return object[key];
}

function rejectUnknownFields(object: ObjectValue, allowed: readonly string[], path: string, node: TypeScript.Node, sourceFile: TypeScript.SourceFile, issues: OutputIssue[]): void {
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(object)) if (!allowedSet.has(key)) addIssue(issues, sourceFile, node, `${path}.${key}`, "未知字段");
}

function parseStringValue(value: ParsedLiteral | undefined, path: string, node: TypeScript.Node, sourceFile: TypeScript.SourceFile, issues: OutputIssue[], nonEmpty = true): string | null {
    if (typeof value !== "string" || nonEmpty && value.trim().length === 0) {
        addIssue(issues, sourceFile, node, path, nonEmpty ? "必须是非空字符串" : "必须是字符串");
        return null;
    }
    return value;
}

function parseIntegerValue(value: ParsedLiteral | undefined, path: string, node: TypeScript.Node, sourceFile: TypeScript.SourceFile, issues: OutputIssue[]): number | null {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        addIssue(issues, sourceFile, node, path, "必须是整数");
        return null;
    }
    return value;
}

function parseSpanValue(value: ParsedLiteral | undefined, path: string, node: TypeScript.Node, sourceFile: TypeScript.SourceFile, issues: OutputIssue[]): Span | null {
    if (!Array.isArray(value) || value.length !== 2) {
        addIssue(issues, sourceFile, node, path, "必须是两个整数的闭区间");
        return null;
    }
    const from = parseIntegerValue(value[0], `${path}[0]`, node, sourceFile, issues);
    const to = parseIntegerValue(value[1], `${path}[1]`, node, sourceFile, issues);
    if (from === null || to === null || from < 1 || to < from) {
        addIssue(issues, sourceFile, node, path, "必须是从 1 开始且 from 不大于 to 的闭区间");
        return null;
    }
    return [from, to];
}

function parseBeatDraft(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, value: ParsedLiteral | undefined, node: TypeScript.Node, path: string, issues: OutputIssue[]): BeatDraft | null {
    if (!isObjectValue(value)) {
        addIssue(issues, sourceFile, node, path, "Beat 必须是对象");
        return null;
    }
    rejectUnknownFields(value, ["id", "paragraphs", "gist"], path, node, sourceFile, issues);
    const id = parseStringValue(objectField(value, "id", path, node, sourceFile, issues), `${path}.id`, node, sourceFile, issues);
    const paragraphs = parseSpanValue(objectField(value, "paragraphs", path, node, sourceFile, issues), `${path}.paragraphs`, node, sourceFile, issues);
    const gist = parseStringValue(objectField(value, "gist", path, node, sourceFile, issues), `${path}.gist`, node, sourceFile, issues);
    if (id !== null && !LOCAL_ID.test(id)) addIssue(issues, sourceFile, node, `${path}.id`, "局部 ID 格式无效");
    if (id === null || paragraphs === null || gist === null || id !== null && !LOCAL_ID.test(id)) return null;
    return {id, paragraphs, gist};
}

function parseConceptDraft(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, value: ParsedLiteral | undefined, node: TypeScript.Node, path: string, issues: OutputIssue[]): ConceptDraft | null {
    if (!isObjectValue(value)) {
        addIssue(issues, sourceFile, node, path, "概念必须是对象");
        return null;
    }
    rejectUnknownFields(value, ["id", "label", "at"], path, node, sourceFile, issues);
    const id = parseStringValue(objectField(value, "id", path, node, sourceFile, issues), `${path}.id`, node, sourceFile, issues);
    const label = parseStringValue(objectField(value, "label", path, node, sourceFile, issues), `${path}.label`, node, sourceFile, issues);
    const at = parseIntegerValue(objectField(value, "at", path, node, sourceFile, issues), `${path}.at`, node, sourceFile, issues);
    if (id !== null && !LOCAL_ID.test(id)) addIssue(issues, sourceFile, node, `${path}.id`, "局部 ID 格式无效");
    if (id === null || label === null || at === null || id !== null && !LOCAL_ID.test(id)) return null;
    return {id, label, at};
}

function parseNameDraft(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, value: ParsedLiteral | undefined, node: TypeScript.Node, path: string, issues: OutputIssue[]): NameDraft | null {
    if (!isObjectValue(value)) {
        addIssue(issues, sourceFile, node, path, "名称必须是对象");
        return null;
    }
    rejectUnknownFields(value, ["concept", "label", "at"], path, node, sourceFile, issues);
    const concept = parseStringValue(objectField(value, "concept", path, node, sourceFile, issues), `${path}.concept`, node, sourceFile, issues);
    const label = parseStringValue(objectField(value, "label", path, node, sourceFile, issues), `${path}.label`, node, sourceFile, issues);
    const at = parseIntegerValue(objectField(value, "at", path, node, sourceFile, issues), `${path}.at`, node, sourceFile, issues);
    if (concept !== null && !LOCAL_ID.test(concept)) addIssue(issues, sourceFile, node, `${path}.concept`, "名称必须引用本批局部概念 ID");
    if (concept === null || label === null || at === null || concept !== null && !LOCAL_ID.test(concept)) return null;
    return {concept, label, at};
}

function parseSourceValue(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, value: ParsedLiteral | undefined, node: TypeScript.Node, path: string, issues: OutputIssue[]): Source | null {
    if (!isObjectValue(value)) {
        addIssue(issues, sourceFile, node, path, "source 必须是对象");
        return null;
    }
    rejectUnknownFields(value, ["channel", "holder"], path, node, sourceFile, issues);
    const channel = parseStringValue(objectField(value, "channel", path, node, sourceFile, issues), `${path}.channel`, node, sourceFile, issues);
    const holder = objectField(value, "holder", path, node, sourceFile, issues);
    if (channel !== null && !CHANNEL_BY_VALUE[channel as Source["channel"]]) addIssue(issues, sourceFile, node, `${path}.channel`, "来源通道无效");
    if (channel === null || !CHANNEL_BY_VALUE[channel as Source["channel"]]) return null;
    const holderless = channel === "narrator" || channel === "author" || channel === "system";
    if (holderless) {
        if (holder !== null) addIssue(issues, sourceFile, node, `${path}.holder`, "该通道的 holder 必须是 null");
        return holder === null ? {channel, holder: null} : null;
    }
    if (holder !== null && (typeof holder !== "string" || holder.trim().length === 0)) {
        addIssue(issues, sourceFile, node, `${path}.holder`, "holder 必须是非空字符串或 null");
        return null;
    }
    if (channel === "speech" || channel === "thought") return {channel, holder: holder as string | null};
    return null;
}

function parseDisclosureDraft(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, value: ParsedLiteral | undefined, node: TypeScript.Node, path: string, issues: OutputIssue[]): DisclosureDraft | null {
    if (!isObjectValue(value)) {
        addIssue(issues, sourceFile, node, path, "披露必须是对象");
        return null;
    }
    rejectUnknownFields(value, ["id", "evidence", "about", "source", "mode", "text", "timeText"], path, node, sourceFile, issues);
    const id = parseStringValue(objectField(value, "id", path, node, sourceFile, issues), `${path}.id`, node, sourceFile, issues);
    const evidence = parseSpanValue(objectField(value, "evidence", path, node, sourceFile, issues), `${path}.evidence`, node, sourceFile, issues);
    const aboutValue = objectField(value, "about", path, node, sourceFile, issues);
    const about: string[] = [];
    if (!Array.isArray(aboutValue) || aboutValue.length === 0 || aboutValue.some((item) => typeof item !== "string" || item.trim().length === 0)) addIssue(issues, sourceFile, node, `${path}.about`, "about 必须是非空字符串数组");
    else about.push(...aboutValue.filter((item): item is string => typeof item === "string"));
    const source = parseSourceValue(ts, sourceFile, objectField(value, "source", path, node, sourceFile, issues), node, `${path}.source`, issues);
    const mode = parseStringValue(objectField(value, "mode", path, node, sourceFile, issues), `${path}.mode`, node, sourceFile, issues);
    const text = parseStringValue(objectField(value, "text", path, node, sourceFile, issues), `${path}.text`, node, sourceFile, issues);
    const timeTextPresent = "timeText" in value;
    const timeTextValue = objectField(value, "timeText", path, node, sourceFile, issues);
    const timeText = timeTextValue === null ? null : parseStringValue(timeTextValue, `${path}.timeText`, node, sourceFile, issues, false);
    if (!timeTextPresent) addIssue(issues, sourceFile, node, `${path}.timeText`, "缺少必需字段");
    if (id !== null && !LOCAL_ID.test(id)) addIssue(issues, sourceFile, node, `${path}.id`, "局部 ID 格式无效");
    if (mode !== null && !MODE_BY_VALUE[mode as DisclosureDraft["mode"]]) addIssue(issues, sourceFile, node, `${path}.mode`, "披露模式无效");
    if (id === null || evidence === null || about.length === 0 || source === null || mode === null || text === null || !timeTextPresent || (timeText === null && timeTextValue !== null) || id !== null && !LOCAL_ID.test(id) || mode !== null && !MODE_BY_VALUE[mode as DisclosureDraft["mode"]]) return null;
    return {id, evidence, about, source, mode: mode as DisclosureDraft["mode"], text, timeText};
}

function parseTopLevelType(ts: typeof TypeScript, node: TypeScript.TypeNode, stage: OutputStage): boolean {
    if (stage === "a") return ts.isArrayTypeNode(node) && ts.isTypeReferenceNode(node.elementType) && node.elementType.typeName.getText() === "BeatDraft";
    return ts.isTypeReferenceNode(node) && node.typeName.getText() === "ExtractionDraft";
}

function parseStageValue(ts: typeof TypeScript, sourceFile: TypeScript.SourceFile, expression: TypeScript.Expression, options: OutputParseOptions, issues: OutputIssue[]): readonly BeatDraft[] | ExtractionDraft | null {
    const parsed = parseLiteral(ts, sourceFile, expression, "$.initializer", issues);
    if (options.stage === "a") {
        if (!Array.isArray(parsed)) {
            addIssue(issues, sourceFile, expression, "$.initializer", "A 输出必须是数组");
            return null;
        }
        const beats = parsed.map((value, index) => parseBeatDraft(ts, sourceFile, value, expression, `$.initializer[${index}]`, issues)).filter((beat): beat is BeatDraft => beat !== null);
        const spans = beats.slice().sort((left, right) => left.paragraphs[0] - right.paragraphs[0]);
        let next = 1;
        for (const beat of spans) {
            if (beat.paragraphs[0] !== next) addIssue(issues, sourceFile, expression, "$.initializer", "Beat 必须连续覆盖全章，不能有空隙或重叠");
            next = beat.paragraphs[1] + 1;
        }
        if (next !== options.paragraphCount + 1) addIssue(issues, sourceFile, expression, "$.initializer", "Beat 必须覆盖到本章末段");
        return beats;
    }
    if (!isObjectValue(parsed)) {
        addIssue(issues, sourceFile, expression, "$.initializer", "B 输出必须是对象");
        return null;
    }
    rejectUnknownFields(parsed, ["concepts", "names", "disclosures"], "$.initializer", expression, sourceFile, issues);
    const conceptsValue = parsed.concepts;
    const namesValue = parsed.names;
    const disclosuresValue = parsed.disclosures;
    if (!Array.isArray(conceptsValue)) addIssue(issues, sourceFile, expression, "$.initializer.concepts", "必须是数组");
    if (!Array.isArray(namesValue)) addIssue(issues, sourceFile, expression, "$.initializer.names", "必须是数组");
    if (!Array.isArray(disclosuresValue)) addIssue(issues, sourceFile, expression, "$.initializer.disclosures", "必须是数组");
    const concepts = Array.isArray(conceptsValue) ? conceptsValue.map((value, index) => parseConceptDraft(ts, sourceFile, value, expression, `$.initializer.concepts[${index}]`, issues)).filter((item): item is ConceptDraft => item !== null) : [];
    const names = Array.isArray(namesValue) ? namesValue.map((value, index) => parseNameDraft(ts, sourceFile, value, expression, `$.initializer.names[${index}]`, issues)).filter((item): item is NameDraft => item !== null) : [];
    const disclosures = Array.isArray(disclosuresValue) ? disclosuresValue.map((value, index) => parseDisclosureDraft(ts, sourceFile, value, expression, `$.initializer.disclosures[${index}]`, issues)).filter((item): item is DisclosureDraft => item !== null) : [];
    const conceptsById = new Set(concepts.map((concept) => concept.id));
    const knownIds = new Set(options.knownConceptIds ?? []);
    concepts.forEach((concept, index) => {
        if (concept.at < 1 || concept.at > options.paragraphCount) addIssue(issues, sourceFile, expression, `$.initializer.concepts[${index}].at`, "at 超出本章范围");
        if (options.paragraphs && !options.paragraphs[concept.at - 1]?.includes(concept.label)) addIssue(issues, sourceFile, expression, `$.initializer.concepts[${index}].label`, "label 必须出现在 at 段正文中");
    });
    names.forEach((name, index) => {
        if (!conceptsById.has(name.concept)) addIssue(issues, sourceFile, expression, `$.initializer.names[${index}].concept`, "名称引用了不存在的本批概念");
        if (name.at < 1 || name.at > options.paragraphCount) addIssue(issues, sourceFile, expression, `$.initializer.names[${index}].at`, "at 超出本章范围");
        if (options.paragraphs && !options.paragraphs[name.at - 1]?.includes(name.label)) addIssue(issues, sourceFile, expression, `$.initializer.names[${index}].label`, "名称必须出现在 at 段正文中");
    });
    disclosures.forEach((disclosure, index) => {
        if (disclosure.evidence[0] < 1 || disclosure.evidence[1] > options.paragraphCount) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].evidence`, "证据区间超出本章范围");
        const end = disclosure.evidence[1];
        disclosure.about.forEach((reference, aboutIndex) => {
            if (LOCAL_ID.test(reference) && !conceptsById.has(reference)) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].about[${aboutIndex}]`, "about 引用了不存在的本批概念");
            if (KNOWN_ID.test(reference) && !knownIds.has(reference.slice("known:".length))) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].about[${aboutIndex}]`, "about 引用了候选表之外的 known 概念");
            if (!LOCAL_ID.test(reference) && !KNOWN_ID.test(reference)) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].about[${aboutIndex}]`, "about 引用格式无效");
            const local = concepts.find((concept) => concept.id === reference);
            if (local && local.at > end) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].about[${aboutIndex}]`, "概念在证据末段尚不可见");
        });
        const holder = disclosure.source.holder;
        if (holder !== null) {
            if (LOCAL_ID.test(holder) && !conceptsById.has(holder)) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].source.holder`, "来源持有者不存在");
            if (KNOWN_ID.test(holder) && !knownIds.has(holder.slice("known:".length))) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].source.holder`, "来源持有者不在候选表");
            if (!LOCAL_ID.test(holder) && !KNOWN_ID.test(holder)) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].source.holder`, "来源持有者引用格式无效");
            const local = concepts.find((concept) => concept.id === holder);
            if (local && local.at > end) addIssue(issues, sourceFile, expression, `$.initializer.disclosures[${index}].source.holder`, "来源持有者在证据末段尚不可见");
        }
    });
    return {concepts, names, disclosures};
}

export function parseStageOutput(raw: string, options: OutputParseOptions): OutputParseResult {
    const ts = loadTypeScript();
    const sourceFile = ts.createSourceFile("model-output.ts", raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const issues: OutputIssue[] = [];
    const parseDiagnostics = (sourceFile as TypeScript.SourceFile & {readonly parseDiagnostics?: readonly TypeScript.Diagnostic[]}).parseDiagnostics ?? [];
    for (const diagnostic of parseDiagnostics) addDiagnostic(issues, ts, sourceFile, diagnostic, "$");
    if (sourceFile.statements.length !== 1) addIssue(issues, sourceFile, sourceFile, "$.statements", "只允许一个顶层 const 声明");
    const statement = sourceFile.statements[0];
    if (!statement || !ts.isVariableStatement(statement)) {
        if (statement) addIssue(issues, sourceFile, statement, "$.statements[0]", "顶层语句必须是 const 声明");
        return {ok: false, issues};
    }
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) addIssue(issues, sourceFile, statement.declarationList, "$.statements[0]", "顶层声明必须使用 const");
    if (statement.declarationList.declarations.length !== 1) addIssue(issues, sourceFile, statement.declarationList, "$.statements[0].declarations", "只允许一个变量声明");
    const declaration = statement.declarationList.declarations[0];
    if (!declaration || !ts.isIdentifier(declaration.name)) {
        addIssue(issues, sourceFile, declaration ?? statement, "$.declaration.name", "变量名必须是标识符");
        return {ok: false, issues};
    }
    const expectedName = options.stage === "a" ? "beats" : "extraction";
    if (declaration.name.text !== expectedName) addIssue(issues, sourceFile, declaration.name, "$.declaration.name", `变量名必须是 ${expectedName}`);
    if (declaration.type) addIssue(issues, sourceFile, declaration.type, "$.declaration.typeAnnotation", "顶层变量不允许类型标注");
    if (!declaration.initializer || !ts.isSatisfiesExpression(declaration.initializer)) {
        addIssue(issues, sourceFile, declaration.initializer ?? declaration, "$.declaration.initializer", "必须使用 satisfies 固定合同类型");
        return {ok: false, issues};
    }
    if (!parseTopLevelType(ts, declaration.initializer.type, options.stage)) addIssue(issues, sourceFile, declaration.initializer.type, "$.declaration.type", options.stage === "a" ? "必须是 BeatDraft[]" : "必须是 ExtractionDraft");
    const value = parseStageValue(ts, sourceFile, declaration.initializer.expression, options, issues);
    if (issues.length > 0 || value === null) return {ok: false, issues};
    return options.stage === "a" ? {ok: true, stage: "a", value: value as readonly BeatDraft[]} : {ok: true, stage: "b", value: value as ExtractionDraft};
}
