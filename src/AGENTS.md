# Source Tree Guide

This document applies to `/src` only. Keep changes aligned with the current Next.js + React + coss-ui/Base UI + Tailwind CSS v4 structure. There is no Vue, Vite, reka-ui, Pinia, or Vue Router in this tree.

## Core Architecture

- `src/app/layout.tsx` owns the Next root layout and imports `@/styles/main.css`.
- `src/app/page.tsx` is the client app shell. It mounts `Provider`, background, header, footer, `Toaster`, startup lifecycle wiring (`initApp()` / `destroyInitManager()`), and the lightweight client route switch.
- Runtime routes are:
  - `/` -> `@/views/HomeView.tsx`
  - `/instance/:id` -> `@/views/InstanceDetail.tsx`
- `@/utils/navigation` provides the small client-side `navigateTo()` helper used by the exported static theme.

## Authoring Conventions

- Use typed TSX client components with explicit `'use client'` where hooks, browser APIs, Zustand, or Base UI primitives are used.
- Prefer `@/` imports for source-local modules.
- Keep data protocol and formatting behavior in `@/utils`, not duplicated inside views.

## UI Library

`src/components/ui/` is the local coss-ui-style component library (alert, avatar, back-top, badge, button, card-x, dialog, empty, input, progress-thin, sonner, spinner, tabs, tooltip).

- Wrap `@base-ui/react` primitives when applicable.
- Declare variants with `class-variance-authority` and merge classes with `cn()` from `@/lib/utils`.
- Use Tailwind utilities and CSS variables from `@/styles/main.css`.

When adding UI:

1. Compose existing primitives from `src/components/ui/` first.
2. If a primitive is missing, add a local coss-style React component using Base UI where appropriate.
3. Do not introduce Vue libraries, reka-ui, Naive UI, UnoCSS, SCSS, or per-component CSS files for utility-expressible styling.

## Stores

- Zustand stores are the source of truth for app state.
- `@/stores/app` owns public settings, theme-derived config, login state, layout flags, formatting preferences, theme mode, and persisted UI state.
- `@/stores/nodes` owns normalized node data, group derivation, WebSocket state, and node updates.
- For behavior based on `publicSettings.theme_settings`, keep defensive `typeof` checks, valid-value filtering, and defaults. The settings schema lives in `komari-theme.json` (`configuration.data`).

## Utils

- `src/utils` owns transport, formatting, lookups, and startup orchestration.
- Keep API/RPC access in `@/utils/api` and `@/utils/rpc`.
- Keep startup, transport selection, polling, reconnects, and WebSocket fallback in `@/utils/init`.
- Keep formatting in helpers such as `@/utils/helper` and record shaping in `@/utils/recordHelper`.
- Keep region, OS, and tag lookup logic in `regionHelper`, `osImageHelper`, and `tagHelper`.
- `@/utils/message` is the wrapper exposed as `window.$message`; it calls `sonner`.

## App Globals

- Only one app global exists on `window`: `$message`. It is typed in `src/types/global.d.ts`.
- Theming is handled by `Provider.tsx`, which toggles `.dark` on `<html>`. Source of truth for the user-chosen mode is `useAppStore().themeMode` (`'auto' | 'light' | 'dark'`).
- Build-time values are exposed through Next public env values in `next.config.ts`: `NEXT_PUBLIC_BUILD_VERSION` and `NEXT_PUBLIC_BUILD_GIT_HASH`.

## Icons

- Icons go through `@iconify/react` (`<Icon icon="icon-park-outline:sun" />`).
- Lucide icons are available via the `lucide:` prefix (e.g. `lucide:x`, `lucide:minus`). Do not add a separate lucide component package.

## Styles

- Single global stylesheet: `@/styles/main.css`. It imports `tailwindcss`, declares the `dark` custom variant, and defines OKLCH design tokens for both modes.
- Component styling should be Tailwind utilities composed with `cn()`.

## Validation

- Validate source-tree changes with:
  - `bun run lint`
  - `bun run build`
- There is no test suite. Do not invent one.
