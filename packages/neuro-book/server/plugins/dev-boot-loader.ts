// dev 模式首屏 loader：SPA 下 Nuxt 只在生产 index.html 注入 spaLoadingTemplate，dev 的
// #__nuxt 是空 div，Vite 预打包期间（首次启动 / 大项目触发二次预打包后的 full-reload）
// 用户面对 20-40s 纯白屏。Nuxt dev 的 HTML 不经过 Vite transformIndexHtml，所以只能在
// Nitro render:response 里注入。app.vue 挂载后移除；full-reload 重新请求 HTML 时会再次
// 注入，覆盖二次预打包窗口。生产构建 import.meta.dev 恒为 false，本插件整体 dead-code。
const BOOT_LOADER_STYLE = [
    "#nbook-boot-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#131313;color:#e8e4da;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;user-select:none}",
    "#nbook-boot-loader[data-mode='light']{background:#f6f4ef;color:#3d3a33}",
    "#nbook-boot-loader .nboot-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(128,128,128,.25);border-top-color:#8a7bd8;animation:nboot-spin 1s linear infinite}",
    "@keyframes nboot-spin{to{transform:rotate(1turn)}}",
    "#nbook-boot-loader .nboot-title{font-size:15px;font-weight:600;letter-spacing:.02em}",
    "#nbook-boot-loader .nboot-sub{font-size:12px;opacity:.62;max-width:440px;text-align:center;line-height:1.7}",
    "#nbook-boot-loader .nboot-track{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(128,128,128,.15);overflow:hidden}",
    "#nbook-boot-loader .nboot-fill{position:absolute;top:0;bottom:0;width:34%;background:linear-gradient(90deg,transparent,#8a7bd8,transparent);animation:nboot-slide 1.4s ease-in-out infinite}",
    "@keyframes nboot-slide{0%{left:-34%}100%{left:100%}}",
].join("");

const BOOT_LOADER_HTML = [
    `<style>${BOOT_LOADER_STYLE}</style>`,
    '<div id="nbook-boot-loader" role="status">',
    '<div class="nboot-spinner"></div>',
    '<div class="nboot-title">正在准备写作环境…</div>',
    '<div class="nboot-sub">首次启动或依赖更新时需要预打包，约 20–40 秒<br>Preparing your writing environment — first launch may take 20–40 s</div>',
    '<div class="nboot-track"><div class="nboot-fill"></div></div>',
    "</div>",
    // 产品默认深色（@nuxtjs/color-mode），这里读同一个 localStorage 键对齐配色，避免水合前后的明暗跳变。
    "<script>try{var m=localStorage.getItem('nuxt-color-mode');var dark=m==='dark'||((m==null||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(!dark){document.getElementById('nbook-boot-loader').setAttribute('data-mode','light')}}catch(e){}</script>",
].join("");

export default defineNitroPlugin((nitro) => {
    if (!import.meta.dev) {
        return;
    }
    nitro.hooks.hook("render:response", (response) => {
        const contentType = response.headers?.["content-type"];
        if (typeof response.body !== "string" || typeof contentType !== "string" || !contentType.includes("text/html")) {
            return;
        }
        if (!response.body.includes('<div id="__nuxt">')) {
            return;
        }
        response.body = response.body.replace('<div id="__nuxt">', `${BOOT_LOADER_HTML}<div id="__nuxt">`);
    });
});
