# C4 Internationalization Task List

Source contracts: [`tasks/spec.md`](./spec.md)
Dependency plan: [`tasks/plan.md`](./plan.md)

Implementation MUST proceed in this order unless `tasks/plan.md` explicitly marks tasks independent.

## Foundation

- [ ] **T1 — Implement typed catalog and React binding**
  - Files: `src/i18n/messages.ts`, `src/i18n/index.ts`, `src/composables/useI18n.ts`
  - Acceptance: complete FR-15 catalog; typed dynamic args; catalog parity; pure language resolver; stable bound translator.
  - Verify: `bun run type-check`, pure Bun catalog/resolver smoke, and temporary Bun-bundled browser probe for stable/changed translator identity.

- [ ] **T2 — Wire store, hydration, and document language**
  - Files: `src/stores/app.ts`, `src/components/Provider.tsx`, `src/app/layout.tsx`
  - Acceptance: stored/browser precedence, best-effort explicit-choice persistence, no hydration writeback, layout-phase hydration, `<html lang>` sync.
  - Verify: `bun run type-check` plus seeded browser-language/storage scenarios and hydration console check.

- [ ] **T3 — Add Header and Command Menu language controls**
  - Files: `src/components/Header.tsx`, `src/components/CommandMenu.tsx`, `src/views/HomeView.tsx` (close label only), `src/components/ui/dialog.tsx`, `src/utils/regionHelper.ts`
  - Acceptance: catalog-backed Header `EN`/`中`, `toggle-language` command, complete shell copy, canonical emoji/ISO region display/flag/search, dialog caller cutover, keyboard behavior, 320px Cloudflare/admin fit.
  - Verify: type-check, pure region smoke, and real browser pointer/keyboard/search plus both 320px build-configuration checks.

## Shared contracts

- [ ] **T4 — Localize app shell and generic primitives**
  - Files: `src/app/page.tsx`, `src/components/LoadingCover.tsx`, `src/components/ui/back-top.tsx`, `src/components/ui/empty.tsx`
  - Acceptance: required empty description prop; shell accessibility copy; primitives remain store-agnostic.
  - Verify: type-check and accessibility snapshot.

- [ ] **T5 — Migrate duration, date, finance, and expiry formatters**
  - Files: `src/utils/helper.ts`, `src/utils/financeHelper.ts`, `src/utils/tagHelper.ts`, `src/components/NodeCard.tsx`, `src/components/NodeList.tsx`, `src/composables/useNodePingDisplay.ts`, `src/components/NodeGeneralCards.tsx`, `src/views/InstanceDetail.tsx`
  - Acceptance: explicit Lang, FR-08 outputs, correct English plurals, localized exchange-rate formatter, unchanged calculations/thresholds.
  - Verify: type-check and pure formatter smoke after each Plan 5A/5B cutover.

- [ ] **T6 — Localize VisitorInfoCard and Footer**
  - Files: `src/components/VisitorInfoCard.tsx`, `src/components/Footer.tsx`
  - Acceptance: semantic visitor state, preserved visit instant/data/disclosure, no refetch, external content unchanged.
  - Verify: type-check and browser request/state observation.

## Home

- [ ] **T7 — Localize HomeView**
  - Files: `src/views/HomeView.tsx`
  - Acceptance: home alerts/groups/views/empty/dialog bilingual; all semantic state preserved.
  - Verify: type-check and group/search/view/dialog browser scenario.

- [ ] **T8 — Localize node cards, list, and Ping display**
  - Files: `src/components/NodeCard.tsx`, `src/components/NodeList.tsx`, `src/components/NodePingListCell.tsx`, `src/composables/useNodePingDisplay.ts`
  - Acceptance: stable columns/sorting; bilingual labels/status/aria/tooltips; unchanged node/Ping data and cache.
  - Verify: type-check and online/offline card/list/Ping browser scenario.

- [ ] **T9 — Localize summary, map, and globe**
  - Files: `src/components/NodeGeneralCards.tsx`, `src/components/NodeEarthMaps.tsx`, `src/components/NodeEarthGlobe.tsx`
  - Acceptance: bilingual summaries/regions/errors; locale finance; stable finance item IDs/keys; no rate/map refetch or globe reinit.
  - Verify: type-check and earth/maps/cards/finance browser matrix.

## Detail and charts

- [ ] **T10 — Localize InstanceDetail with structured values**
  - Files: `src/views/InstanceDetail.tsx`
  - Acceptance: no translated parsing/label comparisons; complete detail copy; route/data/currency preserved.
  - Verify: type-check, real node, and nonexistent node.

- [ ] **T11 — Add error origins, range policy, and refactor LoadChart**
  - Files: `src/utils/displayError.ts`, `src/utils/chartRange.ts`, `src/utils/api.ts`, `src/utils/rpc.ts`, `src/utils/init.ts` (constructor cutover), `src/components/LoadChart.tsx`
  - Acceptance: explicit remote/transport/client origins, empty-remote fallback, sanitized range policy, one effective fetch transition on reset, stable ranges/series IDs, translated options/tooltips, no polling/refetch on switch.
  - Verify: type-check, pure error/range/fake-fetch smoke, and live/history/request-count browser scenario.

- [ ] **T12 — Refactor and localize PingChart**
  - Files: `src/components/PingChart.tsx`
  - Acceptance: shared sanitized numeric range and single-transition reset, task-ID series, bilingual controls/options/errors, all task/toggle state and requests preserved.
  - Verify: type-check, fetch-dependency audit, and partial-selection/toggle/range/request-count scenario.

- [ ] **T13 — Localize shared Ping errors and WebSocket fallback toast**
  - Files: `src/composables/useNodePingStats.ts`, `src/utils/init.ts`
  - Acceptance: raw cache error, unchanged cache/request semantics, event-time localized toast.
  - Verify: type-check and browser/request observation; report uninduced toast path honestly.

## Release gates

- [ ] **T14 — Audit strings, identities, effects, and callers**
  - Files: read-only unless an in-spec defect is found.
  - Acceptance: every Han literal classified; no translated identity/fetch dependency; canonical region helpers and effective range dependencies intact; all changed callers migrated; package contracts and API/RPC wire behavior unchanged.
  - Verify: source-search, constructor-origin classification, region/range policy checks, and caller-inventory evidence.

- [ ] **T15 — Execute real-browser acceptance matrix**
  - Acceptance: Spec 10.3 passes for both languages at 320/768/1280, both themes, home/detail/not-found, applicable view modes; separate 320px Cloudflare/GitHub and admin runs; no console/hydration/layout/request regression.
  - Verify: browser observations, accessibility snapshots, localStorage behavior, and request counts.

- [ ] **T16 — Run repository quality gates**
  - Commands: `bun run lint`, then `bun run build`.
  - Acceptance: zero warnings, successful export/package, unchanged manifest/lockfile/dependencies/archive contract.
