import {routeHostsProduct} from "nbook/app/utils/product-host";

/**
 * 跨宿主导航守卫：跳过产品启动的文档（Component Lab）不能 SPA 进入产品页。
 *
 * 产品启动接线（旧桶原件保护、配色配置）只在文档加载时跑一次；在 Lab 文档里直接渲染产品页，
 * 会让产品页运行在没有迁移门禁与配置的半接线状态。这里改成整页加载，让产品启动完整重跑。
 * 鉴权把未登录的 Lab 重定向到 `/login` 时也经过这里，同样整页加载。
 *
 * 文件名前缀保证它排在其它全局中间件（鉴权）之前。路由中间件在全部插件执行后才开始运行
 * （初始导航由 `app:created` 强制重放），因此这里总能读到 `$productHost`。
 */
export default defineNuxtRouteMiddleware((to) => {
    if (useNuxtApp().$productHost !== false || !routeHostsProduct(to)) {
        return;
    }
    // 经路由解析出完整 href（含 app.baseURL），不能直接拿 fullPath 当地址。
    return navigateTo(useRouter().resolve(to).href, {external: true});
});
