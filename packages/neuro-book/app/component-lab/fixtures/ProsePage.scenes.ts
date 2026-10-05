import type ProsePage from "nbook/app/components/common/ProsePage.vue";
import type {LabFixtureDefinition} from "./index";

/**
 * 稿面排版的三个真实形态：常规正文（含标题/列表/引用/代码/表格）、frontmatter 剥离、空正文。
 *
 * 这里检视的是排版本身（宋体、阅读字号、版心宽度），不是外层容器——纸色与滚动归宿主，
 * 所以场景里给一个固定宽度的框，让人看清版心在窄容器里如何让位。
 */
export const prosePageScenes = [
    {
        id: "prose",
        label: "常规正文（标题/列表/引用/代码）",
        input: {props: {content: "---\ntitle: 元数据不会出现在稿面\n---\n\n# 第一章 退潮\n\n潮水退到最低处时，码头只剩下一排湿漉漉的桩子。\n\n他把第十一封信折好，塞回大衣内袋。\n\n## 当夜\n\n- 灯塔没有亮\n- 渡轮停在锚地\n\n> 有些信，写的时候就知道寄不出去。\n\n`sea_level` 记在航海日志的边角上。\n\n```ts\nconst tide: number = -1.2;\n```"}},
    },
    {
        id: "frontmatter",
        label: "剥掉 frontmatter 只排正文",
        input: {props: {content: "---\ntitle: 标题\nstatus: draft\ntags:\n  - 开局示例\n---\n\n只有这一段是稿面内容。"}},
    },
    {
        id: "empty-body",
        label: "只有 frontmatter（不渲染任何元素）",
        input: {props: {content: "---\ntitle: 只有元数据\n---\n"}},
    },
    {
        id: "narrow",
        label: "窄容器（版心让位、页边距收紧）",
        input: {props: {content: "# 窄栏\n\n版心宽度是上限不是固定值：容器窄于版心时，正文跟着容器走。"}},
    },
] satisfies LabFixtureDefinition<typeof ProsePage>["scenes"];
