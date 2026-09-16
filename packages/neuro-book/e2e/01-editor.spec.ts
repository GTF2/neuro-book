import {readFileSync} from "node:fs";
import {expect, openE2eProject, test} from "./fixtures";
import {E2E_CHAPTER_FILE_PATH, E2E_CHAPTER_RELATIVE_PATH} from "./e2e-env";

/**
 * 主链路①：打开应用 → 进入项目 → 在编辑器里写一节文字 → 真的落盘。
 *
 * 这是「应用能不能用」的最短闭环：任何一环坏掉（启动、项目会话、文件树、编辑器挂载、
 * 保存链路）都会让本用例红。最后一步读磁盘上的章节文件，确认不是「界面看起来像保存了」。
 */
test("主链路①：进入项目并在编辑器中写入正文", async ({page}) => {
    const marker = `E2E 冒烟正文 ${Date.now().toString(36)}`;

    await openE2eProject(page);

    // 章节深埋在「正文/示范卷」下，用文件面板搜索把它筛出来（搜索会强制展开祖先节点）。
    // 注意：搜索也会命中正文里提到 "001-chapter" 的说明文档，所以必须按标题筛，
    // 不能取「第一行」——那会打开 manuscript/index.md 而不是章节本体。
    await page.getByPlaceholder("搜索文件、类型、摘要...").fill("001-chapter");
    const chapterRow = page
        .locator('[data-role="workspace-file-tree-root"] [data-role="workspace-file-row"]')
        .filter({hasText: "示范章节"})
        .first();
    await expect(chapterRow).toBeVisible();
    await chapterRow.click();

    // 先证明打开的是章节文件本身：文件详情卡会显示当前文件的 workspace 相对路径。
    // （同一路径在卡片与工具提示里各出现一次，取第一个即可。）
    await expect(page.getByText(E2E_CHAPTER_RELATIVE_PATH, {exact: true}).first()).toBeVisible();

    // 编辑器挂载：Tiptap 的 contenteditable 出现即代表富文本编辑器可用。
    // `.nb-markdown-editor` 与 `[contenteditable=true]` 可能是同一节点也可能是父子，两种都覆盖。
    const editor = page.locator(".nb-markdown-editor[contenteditable='true'], .nb-markdown-editor [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("contenteditable", "true");

    // 在文末写入一段独一无二的标记，再用 Ctrl+S 触发保存。
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(marker);
    await page.keyboard.press("Control+s");

    // 落盘验证：直接读隔离 State Root 里的章节文件，确认内容真的写进去了。
    await expect.poll(
        () => readFileSync(E2E_CHAPTER_FILE_PATH, "utf8"),
        {message: "编辑器写入的正文应已保存到章节文件", timeout: 30_000},
    ).toContain(marker);
});
