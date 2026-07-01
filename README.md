# Komari Emerald — Next.js + coss-ui

A complete **framework rewrite** of [komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald).
Original Vue 3 + Vite + reka-ui + Tailwind v4 project → Next.js 15 App Router + coss-ui (Base UI + Tailwind v4).

## What changed

| Concern | Original (Vue 3) | This rewrite (Next.js) |
|---|---|---|
| Framework | Vue 3 + Vite | Next.js 15 (App Router, static export) |
| Components | `reka-ui` + shadcn-vue | **coss-ui** (`@coss/ui`) |
| State | Pinia | **Zustand** + `persist` middleware |
| Data layer | ad-hoc `fetch` | **TanStack Query** |
| Toaster | `vue-sonner` | `sonner` (React) |
| Icons | `@iconify/vue` | `@iconify/react` |
| Charts | `vue-echarts` | `echarts-for-react` |
| Markdown | inline | `react-markdown` + `remark-gfm` |
| 3D globe | `cobe` | `cobe` (unchanged) |
| RPC transport | WS (with HTTP fallback) | HTTP-only (realtime uses `/api/clients` WS) |

## What's in this folder

```
src/
├── app/
│   ├── globals.css           # OKLCH design tokens (coss-ui compatible)
│   ├── layout.tsx            # Root layout: fonts + Providers
│   ├── page.tsx              # Home (was HomeView.vue)
│   └── instance/[id]/page.tsx# Detail (was InstanceDetail.vue)
├── components/
│   └── Providers.tsx         # QueryClient + Toaster + lifecycle
├── hooks/
│   ├── useThemeMode.ts       # .dark class sync
│   ├── useMediaQuery.ts      # Breakpoint hook
│   └── useThemeVars.ts       # Read CSS vars into JS
├── lib/
│   └── utils.ts              # cn() helper (clsx + tailwind-merge)
├── stores/
│   ├── app.ts                # Zustand: theme, settings, persisted UI
│   └── nodes.ts              # Zustand: nodes, ws state, derivations
├── types/
│   └── global.d.ts           # window.$message + build-time constants
└── utils/
    ├── api.ts                # Komari REST API client
    ├── rpc.ts                # Komari JSON-RPC 2.0 client (HTTP-only)
    ├── init.ts               # Bootstraps the app, manages WS+polling
    ├── helper.ts             # Byte / uptime / date formatters
    ├── groupHelper.ts        # `;`-separated group parsing
    ├── message.ts            # window.$message (sonner wrapper)
    ├── iconify.ts            # No-op (CDN lazy load)
    └── echarts.ts            # Module registration (singleton)
```

## Still to port (placeholder components referenced above)

The following Vue source files have **not yet been translated** and are
referenced by the pages/Providers as `dynamic(() => import(...))`:

```
src/components/
├── background/Background.tsx       # was Background.vue
├── footer/Footer.tsx               # was Footer.vue
├── header/Header.tsx               # was Header.vue
├── loading/LoadingCover.tsx        # was LoadingCover.vue
├── MarkdownRenderer.tsx            # was MarkdownRenderer.vue (react-markdown)
├── node/NodeCard.tsx               # was NodeCard.vue (~17 KB)
├── node/NodeList.tsx               # was NodeList.vue (~20 KB)
├── node/NodeGeneralCards.tsx       # was NodeGeneralCards.vue (~21 KB)
├── node/NodeEarthGlobe.tsx         # was NodeEarthGlobe.vue (cobe)
├── node/NodeEarthMaps.tsx          # was NodeEarthMaps.vue (echarts + world map)
├── node/NodePingListCell.tsx       # was NodePingListCell.vue
├── charts/LoadChart.tsx            # was LoadChart.vue (~33 KB ECharts)
├── charts/PingChart.tsx            # was PingChart.vue (~25 KB ECharts)
├── TrafficProgress.tsx             # was TrafficProgress.vue
├── VisitorInfoCard.tsx             # was VisitorInfoCard.vue (~14 KB)
└── ui/                             # local shadcn-style components
    ├── BackTop.tsx
    ├── button/, card/, dialog/, tabs/, avatar/, alert/,
    ├── badge/, input/, spinner/, sonner/, empty/,
    ├── progress-thin/, back-top/, data-tooltip/
```

**Recommended next step**: run

```bash
npx shadcn@latest add @coss/ui
```

to populate `src/components/ui/` with the official coss-ui primitives.
Each page/component already imports from `@coss/ui/components/*` paths,
so once the CLI runs the build will resolve them.

## Scripts

```bash
pnpm install      # or bun install / npm install
pnpm dev          # next dev
pnpm build        # next build (static export)
pnpm start        # serve the static export
pnpm type-check   # tsc --noEmit
pnpm lint         # next lint
```

## Configuration

Create `.env.local` if Komari is served at a non-default path:

```bash
NEXT_PUBLIC_API_BASE=https://your-komari.example.com/api
```

If unset, requests go to `/api` on the current origin (same-origin deploy).