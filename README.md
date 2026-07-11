<h3 align="center"> Komari Emerald </h3>
<p align="center">
基于 Next.js + React + coss-ui/Base UI + Tailwind CSS v4 构建的 Komari Monitor 主题
</p>

![preview](/docs/preview.png)

## 项目说明

本仓库是 [Tokinx/komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald) 的 Fork。上游仓库仍然是本主题的来源和参考；本 Fork 的代码、Release 和 Cloudflare Pages 部署项目彼此独立。

### 与原版的主要区别

| 项目          | 原版            | 当前 Fork                                            |
| ------------- | --------------- | ---------------------------------------------------- |
| 前端框架      | Vue 3 + Vite    | Next.js + React                                      |
| UI 与状态管理 | reka-ui + Pinia | coss-ui 风格本地组件 + Base UI + Zustand             |
| 路由          | Vue Router      | Next App Router + 客户端导航                         |
| 构建方式      | Vite 静态构建   | Next static export，并支持 Cloudflare Pages 静态部署 |

如果只需要上游发布的稳定主题，可以前往[原版 Release 页面](https://github.com/Tokinx/komari-theme-emerald/releases)。如果需要使用当前 Fork 的代码或部署版本，请使用[当前仓库](https://github.com/narwhrl/komari-theme-emerald)的分支、Release 或自行构建。

## 使用主题

1. 从 Release 页面下载最新的 `komari-theme-emerald-build-*.zip` 文件
2. 登录 Komari Monitor，点击 `设置`，选择 `主题管理` 选项卡
3. 点击 `上传主题`，选择下载的主题压缩包
4. 刷新页面，即可看到新的主题

## Cloudflare Pages 部署

本项目使用 Next.js static export，Cloudflare Pages 只需要发布静态文件，不需要运行 Next.js 服务端。Cloudflare 对完整的服务端 Next.js 应用推荐使用 Workers；本项目的静态部署可以参考 [Next.js Static site 指南](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)。

### 使用 Git 集成部署

1. 打开 Cloudflare Dashboard，进入 `Workers & Pages`
2. 选择 `Create application` -> `Pages` -> `Connect to Git`
3. 授权 GitHub，并选择本 Fork 仓库
4. 将生产分支设置为 `master`；其他分支可以作为 Preview Deployment
5. 在构建设置中填写：

   | 配置项                 | 值                                               |
   | ---------------------- | ------------------------------------------------ |
   | Root directory         | `/`                                              |
   | Framework preset       | `Next.js (Static HTML Export)`，或使用自定义配置 |
   | Build command          | `bun run build-only`                             |
   | Build output directory | `out`                                            |

   `bun run build-only` 对应仓库中的 `next build`，会生成 Cloudflare Pages 所需的 `out/` 静态目录。Cloudflare Pages 会自动安装依赖；建议将 `BUN_VERSION` 设置为项目 `package.json` 中声明的 `1.3.14`，以保持构建环境一致。

6. 保存并部署。后续推送到生产分支会更新正式站点，推送到其他分支或提交 Pull Request 会生成预览部署。

详细配置可参考 Cloudflare 的 [Git integration 指南](https://developers.cloudflare.com/pages/get-started/git-integration/) 和 [Build configuration 文档](https://developers.cloudflare.com/pages/configuration/build-configuration/)。

### Pages 构建与主题压缩包构建的区别

- Cloudflare Pages：运行 `bun run build-only`，发布 `out/`
- Komari 主题发布：运行 `bun run build`，完成类型检查、静态构建和主题打包，最终生成 `dist/` 与 `komari-theme-emerald-build-<commit>.zip`

Pages 不需要上传主题压缩包；如果要在 Komari 的主题管理中安装本项目，仍然需要使用完整的 `bun run build` 生成的 zip 文件。

## Cloudflare Pages 环境变量

在 Cloudflare Dashboard 中进入 `Workers & Pages` -> 选择 Pages 项目 -> `Settings` -> `Environment variables`。构建阶段读取的 `NEXT_PUBLIC_*` 值会被写入静态前端，修改后需要重新部署；不要在其中放置密码、Token 或其他秘密。

| 变量                             | 是否必需            | 说明                                                                                                                                        |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `BUN_VERSION`                    | 建议设置            | 设置为 `1.3.14`，与项目 `package.json` 的 `packageManager` 保持一致                                                                         |
| `NEXT_PUBLIC_API_BASE`           | 跨域部署时必需      | Komari API 基础地址。默认值为 `/api`，适用于主题与 Komari 在同一域名下的情况；独立部署到 Pages 时填写例如 `https://monitor.example.com/api` |
| `NEXT_PUBLIC_RPC_TRANSPORT_MODE` | 可选                | 只接受 `http` 或 `websocket`。跨域或 WebSocket 未配置时建议设置为 `http`；不设置时使用 Komari 主题配置中的传输方式                          |
| `NEXT_PUBLIC_GITHUB_REPOSITORY`  | Fork 部署时建议设置 | GitHub 仓库地址或 `owner/repository`，例如 `narwhrl/komari-theme-emerald`。用于 Cloudflare Pages 页面上的 GitHub/Star 入口                  |
| `CF_PAGES`                       | 不需要手动设置      | Cloudflare Pages 会自动注入值 `1`，项目据此启用 Pages 专用界面行为。仅在本地模拟 Pages 构建时才需要手动设置                                 |

当 `NEXT_PUBLIC_API_BASE` 指向与 Pages 不同的域名时，Komari 后端还必须允许 Pages 域名的 CORS 和凭据请求，并正确提供 HTTPS；这些设置不能通过 Cloudflare Pages 的前端环境变量替代。

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- Bun: `>=1.2.0`

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 使用演示后端启动本地代理
bun run dev:demo

# 代码检查
bun run lint
```

## 开发文档

- [coss-ui 本地组件使用指南](./docs/coss-ui.md)

## 构建

```bash
# 类型检查 + 生产构建 + Komari 主题压缩包
bun run build

# 仅生成 Next.js 静态导出目录 out/
bun run build-only

# 预览生产构建
bun run preview
```

## 技术栈

| 类别     | 技术                           |
| -------- | ------------------------------ |
| 框架     | Next.js 16 + React 19          |
| 构建工具 | Next static export             |
| UI 组件  | coss-ui 风格本地组件 + Base UI |
| 样式方案 | Tailwind CSS v4                |
| 状态管理 | Zustand                        |
| 路由     | Next App Router + 客户端导航   |
| 提示系统 | sonner（Toaster）              |
| 图标     | @iconify/react                 |
| 图表     | ECharts                        |
| 3D 地球  | cobe                           |
| 实用工具 | dayjs                          |
| 代码规范 | ESLint (@antfu/eslint-config)  |

## 鸣谢

- [Komari](https://github.com/komari-monitor/komari)
- [Komari Next](https://github.com/tonyliuzj/komari-next)
- [Komari Naive](https://github.com/lyimoexiao/komari-theme-naive)
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [coss ui](https://coss.com/ui)
- [Base UI](https://base-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

本主题基座基于 [Komari Naive](https://github.com/lyimoexiao/komari-theme-naive)，特此感谢

## License

[MIT](./LICENSE)
