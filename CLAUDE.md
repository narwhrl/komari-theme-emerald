# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Komari Monitor theme called **Komari Emerald**, built with Next.js, React, coss-ui-style local components, Base UI, and Tailwind CSS v4. The release artifact is a zip Komari can import, **not** a generic deployed web app. [komari-theme.json](komari-theme.json) is release input, not optional metadata.

## Commands

Use `bun` (the `engines` field pins bun >= 1.2 + Node 20.19/22.12+; `packageManager` is `bun`). Run from repo root.

```bash
bun run dev       # Next dev server
bun run build     # type-check + static export + zip packaging
bun run preview   # Next dev server for local preview
bun run lint      # eslint --fix --cache
```

There is **no test suite**. Do not invent `bun test` / Vitest commands. The release workflow ([.github/workflows/release-on-version-bump.yml](.github/workflows/release-on-version-bump.yml)) runs `bun install --frozen-lockfile`, detects version bumps, runs `bun run build`, and uploads `komari-theme-emerald-build*.zip`.

## Build & release contract

`bun run build` must preserve the Komari packaging flow defined by [scripts/build-theme.ts](scripts/build-theme.ts). After a successful build, the repo root must contain:

- `dist/`
- `komari-theme-emerald-build-<short-sha>.zip` (commit hash from `git rev-parse --short HEAD`)

Zip layout - **do not change names**:

```text
komari-theme.json   (from repo root)
preview.png         (renamed from docs/preview.png)
dist/               (Next static export output)
```

Next injects build-time values through public env in [next.config.ts](next.config.ts): `NEXT_PUBLIC_BUILD_VERSION` from `package.json` and `NEXT_PUBLIC_BUILD_GIT_HASH` from git.

## UI stack

- **Components**: local coss-ui-style React components in [src/components/ui/](src/components/ui/) (alert, avatar, back-top, badge, button, card-x, dialog, empty, input, progress-thin, sonner, spinner, tabs, tooltip). Components wrap `@base-ui/react` primitives where appropriate. Variants use `class-variance-authority`; class composition uses `cn()` in [src/lib/utils.ts](src/lib/utils.ts).
- **Styling**: Tailwind CSS v4, configured CSS-first in [src/styles/main.css](src/styles/main.css) with OKLCH design tokens and a `dark` variant. **No SCSS, no UnoCSS.**
- **Dark mode**: driven by `useAppStore().themeMode`; [src/components/Provider.tsx](src/components/Provider.tsx) toggles a `.dark` class on `<html>`.
- **Toasts**: `sonner` `<Toaster>` mounted from [src/components/ui/sonner.tsx](src/components/ui/sonner.tsx); exposed app-wide as `window.$message` via [src/utils/message.ts](src/utils/message.ts).
- **Globals**: only `window.$message` exists. There is **no** `$dialog`, `$notification`, `$loadingBar`, or `$modal`.
- **Icons**: `@iconify/react` (`<Icon icon="..." />`). Lucide icons are available via the `lucide:` prefix (e.g. `lucide:x`). **Do not** introduce a separate lucide component package.
- **Charts and globe**: `echarts` renders charts directly through [src/components/EChart.tsx](src/components/EChart.tsx); `cobe` powers [src/components/NodeEarthGlobe.tsx](src/components/NodeEarthGlobe.tsx).

## Architecture

### App shell

- [src/app/layout.tsx](src/app/layout.tsx) owns the Next root layout and global CSS import.
- [src/app/page.tsx](src/app/page.tsx) is the client app shell. It mounts `Provider`, background, header, footer, `Toaster`, startup lifecycle wiring (`initApp()` / `destroyInitManager()`), and the lightweight client route switch.
- Runtime client routes are `/` -> `HomeView` and `/instance/:id` -> `InstanceDetail`. [src/utils/navigation.ts](src/utils/navigation.ts) provides the small client-side `navigateTo()` helper used by the exported static theme.

### State

- [src/stores/app.ts](src/stores/app.ts) uses Zustand for public settings, theme-derived config, login state, layout flags, formatting prefs, theme mode, and persisted UI state. `publicSettings.theme_settings` comes from Komari and **must** be parsed defensively (`typeof` checks, guarded `JSON.parse`, valid-value filtering, defaults). The schema is declared in [komari-theme.json](komari-theme.json) under `configuration.data`.
- [src/stores/nodes.ts](src/stores/nodes.ts) uses Zustand for normalized nodes, group derivation, WebSocket state, and live updates.
- Components/views should read from stores; do not maintain parallel state for the same domain.

### Transport & startup

- API/RPC live in [src/utils/api.ts](src/utils/api.ts) and [src/utils/rpc.ts](src/utils/rpc.ts) (notes in [src/utils/rpc.md](src/utils/rpc.md)).
- Transport selection, polling, reconnects, and the websocket-to-http fallback all live in [src/utils/init.ts](src/utils/init.ts). Transport mode is user-configurable via `rpcTransportMode` in the theme manifest.
- Formatting/lookup helpers: `helper.ts`, `recordHelper.ts`, `regionHelper.ts`, `osImageHelper.ts`, `tagHelper.ts`. Reuse these - do not duplicate parsing/formatting in components.

### Runtime asset contract

[public/images/](public/images/) filenames are part of the runtime contract. Code builds paths from runtime values rather than importing assets:

- `flags/<UPPERCASE_CODE>.svg` consumed by `getRegionCode()` in [src/utils/regionHelper.ts](src/utils/regionHelper.ts). Casing matters.
- `logo/os-*.{svg,png,ico}` returned exactly by `getOSImage()` in [src/utils/osImageHelper.ts](src/utils/osImageHelper.ts). Mixed case and non-SVG extensions there are intentional; do not normalize.

Renaming, moving, or removing files under `public/images/` is a **code change**: check references under `src/` and update helper mappings first.

## Conventions

- Use typed TSX client components with explicit `'use client'` where hooks, browser APIs, Zustand, or Base UI primitives are used.
- `@/` alias -> `src/` (defined in [tsconfig.json](tsconfig.json)).
- Lint stack: ESLint (`@antfu/eslint-config`). Run `bun run lint` before committing.
- Dependency versions are declared directly in [package.json](package.json) (no workspace catalog). Add new deps with `bun add` / `bun add -d`.

## Repo-grounded anti-patterns

- Do not rename `komari-theme.json`, `docs/preview.png`, or the zip naming pattern `komari-theme-emerald-build-<sha>.zip`.
- Do not embed ad-hoc parsing of `theme_settings` inside components; normalize once in `stores/app.ts`.
- Do not reintroduce Vue libraries, Vite, reka-ui, Naive UI, UnoCSS, or SCSS.
- Do not add matrix builds, release automation, or test stages without a concrete need.
- Do not duplicate AGENTS.md content here. The nearest `AGENTS.md` overrides this file for its subtree:
  - [AGENTS.md](AGENTS.md) - root build/packaging
  - [src/AGENTS.md](src/AGENTS.md) - app code rules
  - [public/images/AGENTS.md](public/images/AGENTS.md) - asset filename contract
