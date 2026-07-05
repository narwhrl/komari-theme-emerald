<h3 align="center"> Komari Emerald </h3>
<p align="center">
基于 Next.js + React + coss-ui/Base UI + Tailwind CSS v4 构建的 Komari Monitor 主题
</p>

![preview](/docs/preview.png)

## 使用

1. 从 [Release 页面](https://github.com/Tokinx/komari-theme-emerald/releases) 下载最新的 `komari-theme-emerald-build-*.zip` 文件
2. 登录 Komari Monitor 后，点击 `设置`，选择 `主题管理` 选项卡
3. 点击 `上传主题` 按钮，选择下载的 `komari-theme-emerald-build-*.zip` 文件
4. 刷新页面，即可看到新的主题

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- Bun: `>=1.2.0`

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 代码检查
bun run lint
```

## 开发文档

- [coss-ui 本地组件使用指南](./docs/coss-ui.md)

## 构建

```bash
# 类型检查 + 生产构建
bun run build

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
