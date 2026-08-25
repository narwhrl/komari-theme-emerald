# Spec: C4 Visitor UI zh-CN / en-US Internationalization

## Status

**Implemented and verified.** User approval preceded implementation; the behavior and acceptance criteria below are the delivered source of truth.

## 1. Objective

Komari Emerald MUST provide a complete bilingual visitor interface in Simplified Chinese (`zh-CN`) and American English (`en-US`) without changing Komari's API, RPC, static-export, theme-package, or administrator configuration contracts.

Primary users:

- A visitor opening a public Komari status page.
- A site operator using the public page to inspect nodes.
- Keyboard and screen-reader users consuming the same public interface.

Success means:

1. The visitor-facing interface selects a deterministic initial language.
2. The visitor can switch language from Header or Command Menu without reload.
3. The choice persists when localStorage is available.
4. Every theme-owned visible string and accessible name in scope changes language immediately.
5. External content classified by FR-05 is passed to existing renderers unchanged; only the explicitly listed semantic fields such as region codes receive localized display names.
6. Language changes preserve UI state and do not cause API/RPC requests.
7. `bun run lint`, `bun run build`, and the specified real-browser matrix pass.

## 2. Resolved assumptions

| ID   | Decision                                                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | This feature covers the exported **visitor UI**, not Komari's administrator UI.                                                                                                          |
| A-02 | `komari-theme.json` managed-setting labels remain Chinese. The manifest has scalar `name`/`help` fields and no verified locale schema. Bilingual concatenation is prohibited.            |
| A-03 | Only `zh-CN` and `en-US` are supported. All Chinese browser tags, including `zh-Hans`, `zh-Hant`, `zh-TW`, and `zh-HK`, map to `zh-CN`.                                                  |
| A-04 | Static HTML and metadata use `zh-CN` as the build-time fallback. Runtime language is applied during client hydration; locale-prefixed routes are not introduced.                         |
| A-05 | Existing administrator content—site name, announcements, node names, groups, tags, remarks, Ping task names, filing numbers—must not be translated.                                      |
| A-06 | Remote error text may be displayed verbatim only when it is identifiable as a server/RPC response. Client/network/unknown failures use a localized theme fallback.                       |
| A-07 | No i18n dependency and no test framework are added. The type checker and real browser are the verification mechanisms available in this repository.                                      |
| A-08 | The localStorage key is the existing project-style scalar key `lang`; there is no migration because the current store declares `lang` but does not persist it.                           |
| A-09 | Cross-tab language synchronization is out of scope. A reload in another tab reads the persisted choice.                                                                                  |
| A-10 | Product names and technical abbreviations such as Komari Monitor, Komari Emerald, GitHub, Star, CPU, GPU, RAM, Swap, TCP, UDP, IP, RPC, POST, ms, and currency codes are locale-neutral. |

## 3. Scope

### 3.1 Included

- Browser-language resolution and validation.
- Best-effort localStorage persistence.
- Runtime `<html lang>` synchronization.
- Header and Command Menu language controls.
- Home, card, list, summary, map, globe, visitor card, node detail, LoadChart, and PingChart copy.
- Loading, empty, failure, toast, tooltip, dialog, and screen-reader-only text.
- Locale-aware uptime, duration, date/time, financial amount, exchange-rate, and plural/count formatting.
- Localized region display names using the existing region dictionary.
- Stable language-independent state identifiers and chart series identifiers.
- Hardcoded-string audit and browser regression.

### 3.2 Excluded

- Locale URL prefixes, server negotiation, cookies, or request headers.
- Localized Next metadata. `Komari Monitor` and its static description remain build-time metadata.
- Translation of administrator- or backend-authored content.
- Translation of third-party geo API values such as ISP and location names.
- Translation of developer comments, console messages, API/RPC metadata, region aliases, or internal token `白嫖中` used by finance exclusion logic.
- Additional languages, lazy-loaded catalogs, remote translation files, or runtime catalog editing.
- Accessibility redesign unrelated to strings. Existing accessible surfaces and the new language control are in scope; making ECharts fully screen-reader equivalent is not.
- Cross-tab synchronization and OS/browser locale negotiation beyond initial language selection.

## 4. Repository and technology constraints

- Next.js static export, React 19, TypeScript 5.9, Zustand 5, Base UI/coss-ui-style primitives, Tailwind CSS v4.
- Runtime code lives under `src/`.
- `src/app/layout.tsx` owns `<html>` and global metadata.
- `src/components/Provider.tsx` owns browser hydration and document-level effects.
- `src/stores/app.ts` is the single source of application language state.
- `src/utils/tagHelper.ts` already exposes partial bilingual finance/expiry formatting and MUST be migrated, not duplicated.
- `src/utils/regionHelper.ts` already supports `'zh' | 'en'` display names and MUST remain the region-data source.
- The project has no test suite. Do not add Vitest, Jest, Playwright test files, or `bun test`.
- No new runtime or development dependencies.

## 5. Commands

Run from repository root.

```bash
# Development against the maintained demo backend
bun run dev:demo

# Incremental static contract check
bun run type-check

# Final zero-warning lint gate
bun run lint

# Final type-check + Next export + theme package gate
bun run build
```

`bun run build` MUST continue producing `dist/` and `komari-theme-emerald-build-<sha>.zip` containing `dist/`, `komari-theme.json`, and `preview.png`.

## 6. Terminology

| Term                       | Definition                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Language                   | Stable persisted code `zh-CN` or `en-US`.                                                                                        |
| Theme-owned text           | A string authored by this repository to label, describe, or report its UI.                                                       |
| External content           | Operator, backend, RPC, API, or third-party response data.                                                                       |
| Stable identity            | A value used for state, equality, keys, branches, cache keys, effect dependencies, or ECharts series identity; never translated. |
| Catalog                    | Compile-time checked mapping from message key to a static string or typed message function.                                      |
| First supported preference | First entry in browser preference order that begins with `zh` or `en`, case-insensitive.                                         |

## 7. Functional requirements

### FR-01 Language resolution

`resolvePreferredLang(stored, browserLanguages)` MUST apply this precedence:

1. Valid stored value `zh-CN` or `en-US`.
2. First supported browser preference, in order.
3. `en-US` when no browser preference is supported.
4. `zh-CN` only as the server/static-render fallback before browser hydration.

Resolution examples:

| Stored  | Browser preferences  | Result  |
| ------- | -------------------- | ------- |
| `zh-CN` | `['en-US']`          | `zh-CN` |
| `en-US` | `['zh-CN']`          | `en-US` |
| missing | `['zh-TW', 'en-US']` | `zh-CN` |
| missing | `['fr-FR', 'en-GB']` | `en-US` |
| missing | `['fr-FR', 'de-DE']` | `en-US` |
| invalid | `['zh-Hans-CN']`     | `zh-CN` |
| invalid | empty/unavailable    | `en-US` |

The resolver MUST:

- Trim and compare case-insensitively.
- Treat storage access exceptions as missing storage.
- Read `navigator.languages` first and fall back to `navigator.language`.
- Never write during resolution.

### FR-02 Language state and persistence

`AppStoreState.lang` remains the single runtime source of truth.

`AppStoreActions` MUST add:

```ts
interface AppStoreActions {
  setLang: (lang: Lang) => void
}
```

Behavior:

- `hydrateFromBrowser()` resolves and sets `lang` with FR-01.
- `setLang()` accepts only the `Lang` type, updates state synchronously, then best-effort writes `lang` to localStorage.
- Browser-derived or fallback language is not written during hydration. Persistence begins only when the visitor explicitly invokes `setLang()`.
- A storage write failure MUST NOT roll back state or show an error.
- Language changes MUST NOT alter theme mode, selected group, view mode, home search, scroll position, finance currency, chart controls, or caches.
- No storage event listener is added.

### FR-03 Hydration and document language

- `src/app/layout.tsx` keeps `lang="zh-CN"` as static fallback and `suppressHydrationWarning`.
- `Provider` MUST hydrate browser preferences in a layout-phase client effect so the resolved language is applied before the first stable interactive paint where React permits.
- `Provider` MUST set `document.documentElement.lang = lang` whenever state changes.
- No inline blocking script, cookie, server middleware, or route variant is added.
- A brief `zh-CN` server HTML fallback before hydration is accepted; a mixed-language stable UI after hydration is not.

### FR-04 Language controls

#### Header

- Add one 32px compact control beside the existing theme action.
- Visible content shows the **target** language using catalog keys: `language.shortEnglish` while current language is `zh-CN`; `language.shortChinese` while current language is `en-US`.
- Tooltip and accessible name use `header.switchEnglish` / `header.switchChinese` in the current catalog.
- Activation calls `setLang(getAlternateLang(lang))` without navigation or reload.
- The control remains visible at 320px and MUST NOT force horizontal page overflow.

#### Command Menu

- Add action ID `toggle-language` in section `actions`.
- Label uses the same target-language action key as Header.
- Description uses `command.languageDescription`.
- Keywords contain `translate('zh-CN', 'language.searchTerms')`, `translate('en-US', 'language.searchTerms')`, `zh-CN`, and `en-US`; component code MUST NOT hardcode Han search literals.
- Selecting the command updates language and closes the menu through existing command behavior.
- Query text is preserved until close; opening the menu later still initializes from `homeSearchText` per current behavior.

### FR-05 Translation boundary

Theme-owned text MUST come from the catalog. External content MUST remain unchanged.

| Data                                                             | Translate? | Rule                                                                                                     |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| UI labels, descriptions, placeholders, aria labels, sr-only text | Yes        | Catalog key.                                                                                             |
| Theme fallback/error/loading text                                | Yes        | Catalog key selected at render time.                                                                     |
| Site name, announcement title/body                               | No         | Render original string.                                                                                  |
| Node/group/tag/remark/Ping task names                            | No         | Render original string; escape when inserted into HTML tooltip.                                          |
| Region names                                                     | Yes        | Existing `regionHelper` dictionary according to current language. Unknown region value remains original. |
| OS product names, browser brand names                            | No         | Locale-neutral product value. `Unknown` fallback is localized.                                           |
| Third-party country/city/ISP text                                | No         | Render original response; local fallback is translated.                                                  |
| Backend/RPC error text                                           | No         | Render original only under FR-11 remote-error rule.                                                      |
| Currency codes and symbols                                       | No         | Locale-neutral; numeric value formatting changes.                                                        |
| Technical abbreviations and units listed in A-10                 | No         | Preserve canonical spelling.                                                                             |

For node OS display, only a missing or whitespace-only backend value uses `node.unknownOs`. Any nonempty value, including a literal `Unknown`, remains external content and follows the existing `getOSName()` behavior.

### FR-06 Catalog completeness and type safety

The catalog MUST use flat semantic keys. Components MUST NOT access nested objects or concatenate a locale code into a key.

Required files:

```text
src/i18n/messages.ts       Catalogs and catalog-derived types
src/i18n/index.ts          Public translation/language API
src/composables/useI18n.ts React binding to AppStoreState.lang
```

Required public contract:

```ts
export type Lang = 'zh-CN' | 'en-US'
export const DEFAULT_LANG: Lang = 'zh-CN'
export const SUPPORTED_LANGS: readonly Lang[]

export type MessageKey = keyof typeof zhCN

type CatalogShape = {
  [K in MessageKey]: typeof zhCN[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string
}

export type MessageArgs<K extends MessageKey>
  = CatalogShape[K] extends (...args: infer A) => string ? A : []

export interface Translate {
  <K extends MessageKey>(key: K, ...args: MessageArgs<K>): string
}

export function translate<K extends MessageKey>(
  lang: Lang,
  key: K,
  ...args: MessageArgs<K>
): string

export function isLang(value: unknown): value is Lang
export function resolvePreferredLang(stored: unknown, preferences: readonly string[]): Lang
export function getAlternateLang(lang: Lang): Lang
export function toRegionLanguage(lang: Lang): 'zh' | 'en'
```

Catalog rules:

- `zhCN` is the source key set.
- `enUS` MUST use `satisfies CatalogShape`; missing/extra keys and mismatched function parameters fail type-check.
- Static catalog values map to `string`, not the Chinese literal type, so English text can differ.
- Dynamic messages are typed functions, not `{placeholder}` strings. Example:

```ts
const zhCN = {
  'ping.selected': ({ selected, total }: { selected: number, total: number }) =>
    `已选择 ${selected} / ${total}`,
} as const

const enUS = {
  'ping.selected': ({ selected, total }: { selected: number, total: number }) =>
    `Selected ${selected} of ${total}`,
} satisfies CatalogShape
```

Every function-valued message has this exact single-object parameter contract:

```ts
interface MessageFunctionParams {
  'command.searchNodes': { query: string }
  'command.itemCount': { count: number }
  'home.pingDialogTitle': { name: string }
  'node.viewDetails': { name: string }
  'node.sortAscending': { label: string }
  'node.sortDescending': { label: string }
  'node.pingDetails': { name: string }
  'ping.averageLatency': { value: number }
  'ping.averageLoss': { loss: string }
  'ping.averageLossVolatility': { loss: string, volatility: string }
  'map.onlineOffline': { online: number, offline: number }
  'detail.load': { value: string }
  'detail.usedPercent': { value: string }
  'detail.accumulated': { value: string }
  'detail.processes': { count: number }
  'range.hours': { count: number }
  'range.days': { count: number }
  'ping.selected': { selected: number, total: number }
  'billing.customDays': { count: number }
  'expiry.days': { count: number }
  'expiry.remaining': { count: number }
  'uptime.days': { count: number }
  'uptime.hours': { count: number }
  'uptime.minutes': { count: number }
  'uptime.seconds': { count: number }
}
```

The catalog declarations MUST be checked against these parameter shapes; callers pass preformatted decimal strings only for fields typed `string`. Count values remain numbers so English plural selection cannot depend on parsing display text.

- Pluralized functions use one cached `Intl.PluralRules` instance per catalog locale; English `one` and `other` forms are required.
- Catalog values MUST be plain text without HTML.
- Translation lookup is O(1), does not parse dot paths, and never allocates a merged catalog.
- A missing runtime key (possible only through corrupted JavaScript) falls back to the `zh-CN` value, then the key string; it MUST NOT throw in production.

`useI18n()` contract:

```ts
export function useI18n(): { lang: Lang, t: Translate }
```

`t` MUST have stable identity while `lang` is unchanged and change when `lang` changes.

### FR-07 Stable identity

Translated strings MUST NOT be used as:

- React state values.
- Tab/toggle values.
- React keys when a semantic ID exists.
- Equality or branch operands.
- Effect dependencies that trigger data fetching.
- Cache keys.
- ECharts series IDs.

Required migrations:

1. `LoadChart`: state is `number | null` (`null` = realtime). Tab values are `realtime` and `hours:<n>`.
2. `PingChart`: state is numeric hours. Tab values are `hours:<n>`.
3. LoadChart series define stable IDs (`cpu`, `load`, `ram`, `swap`, `disk`, `download`, `upload`, `tcp`, `udp`, `process`) and tooltip branches use `seriesId`, never localized `seriesName`.
4. PingChart task series IDs are the task ID string; tooltip color/task lookup uses ID, not potentially duplicate task names.
5. `NodeList` column definitions store `labelKey`, not translated `label`; sorting uses `ColumnKey`.
6. `InstanceDetail` items have stable IDs/flags; OS icon display MUST NOT compare `item.label === '操作系统'`.
7. `InstanceDetail` MUST delete `splitMetricValue()` and regex parsing of translated finance/expiry strings. Metric values and units are constructed as structured fields.
8. `VisitorInfoCard` stores semantic device/browser/geo states and a `Date`/timestamp, never translated display strings.
9. Shared Ping cache stores raw error state, never translated text.
10. `NodeGeneralCards` finance summary items use stable IDs `total-value`, `monthly-spend`, and `remaining-value`; localized labels are display-only and React uses `key={item.id}`.

Range-state rules:

- LoadChart always offers `null`/`realtime`; its numeric candidates remain the current `4`, `24`, `168`, `720`, and valid custom maximum-hour value behavior. An absent, zero, negative, or non-finite preservation limit uses the current 720-hour fallback.
- PingChart numeric candidates remain the current `1`, `6`, `12`, and `24` hours filtered by its sanitized positive preservation limit; an absent, zero, negative, or non-finite limit uses the current 168-hour fallback.
- Pure range-policy helpers sanitize each limit and derive the effective semantic selection synchronously. On a limit change, rendering/fetching uses the normalized selection immediately; a guarded render-phase state update reconciles the stale raw selection before commit.
- If a backend preservation-limit change removes the selected numeric range, the effective selection becomes the first valid semantic value (`null` for LoadChart, first Ping range for PingChart). The fetch effect depends on this effective value, so the limit change causes exactly one fetch for the new range; render-phase reconciliation causes none. A language change never changes the numeric candidate set or effective selection.

`src/utils/chartRange.ts` owns this pure shared policy. It exposes no React, store, RPC, or translated labels. Load/Ping components map returned numeric semantics to localized labels at render. For Ping, a positive finite limit below one hour is clamped to `1`, guaranteeing the first valid range.

### FR-08 Locale-aware formatting

#### Uptime

`formatUptimeWithFormat` becomes:

```ts
declare function formatUptimeWithFormat(seconds: number, format: UptimeFormat, lang: Lang): string
```

No default language overload remains. All callers pass `lang`.

Required output semantics:

|  Input | Precision | zh-CN         | en-US                |
| -----: | --------- | ------------- | -------------------- |
|      0 | hour      | `0 秒`        | `0 seconds`          |
|     59 | minute    | `不足 1 分钟` | `Less than 1 minute` |
|   3600 | hour      | `1 小时`      | `1 hour`             |
|   7200 | hour      | `2 小时`      | `2 hours`            |
| 183600 | hour      | `2 天 3 小时` | `2 days 3 hours`     |

- Negative, non-finite, and zero values normalize to zero.
- Unit order remains day → hour → minute → second.
- Existing precision truncation remains; no rounding up.
- The unreferenced broad `formatUptime()` export is removed; the repository reference audit confirms no caller.

#### Date/time

`helper.ts` MUST expose a closed style union rather than accepting arbitrary Day.js format strings:

```ts
export type DateTimeStyle = 'full' | 'chart' | 'time' | 'visitor'

export declare function formatDateTime(
  timestamp: string | Date | undefined,
  style: DateTimeStyle,
  lang: Lang,
): string
```

- `full`: numeric year/month/day plus hour/minute/second.
- `chart`: numeric month/day plus hour/minute.
- `time`: hour/minute/second; this replaces Ping bar `HH:mm:ss` calls.
- `visitor`: numeric year/month/day plus hour/minute and preserves the current absence of seconds.
- All styles use `Intl.DateTimeFormat(lang, options)` with two-digit month/day/hour/minute/second where present and `hourCycle: 'h23'`.
- No `timeZone` override is set; values remain in the visitor browser's local time zone, matching current client formatting semantics.
- Locale-specific field order and punctuation come from `Intl`; callers MUST NOT parse the result.
- Invalid/missing timestamps return `-`.
- `VisitorInfoCard` stores the visit `Date`; changing language reformats it without resetting the instant.

#### Numbers and finance

- `formatFinanceAmount(amount, currency, lang)` uses `Intl.NumberFormat(lang)`.
- Exchange-rate rows use `Intl.NumberFormat(lang, { minimumFractionDigits: 6, maximumFractionDigits: 6 })`.
- Compact notation behavior remains at absolute values ≥ 100000.
- Add `formatExchangeRate(rate: number, lang: Lang): string` in `financeHelper.ts`; it normalizes non-finite input to `0` and uses exactly six fractional digits. `NodeGeneralCards` MUST NOT retain an inline fixed-locale formatter.
- Formatter instances SHOULD be cached per locale/options; do not instantiate one formatter per node per render.
- Currency symbols/codes and byte units remain unchanged.
- Percent calculations and underlying numeric values remain unchanged.

#### Billing and expiry

- `tagHelper.ts` imports `Lang` and the translation API; it MUST NOT retain its own bilingual text table.
- `getBillingCycleText`, `getExpireText`, `formatPrice`, `formatPriceWithCycle`, and `getNodePriceTags` require explicit `lang`.
- English day forms MUST distinguish `1 day` and `2 days`; current `1 days` behavior is fixed.
- Existing expiry thresholds and finance calculations are unchanged.

### FR-09 Visitor information state

`VisitorInfoCard` MUST use semantic state:

```ts
type DeviceKind = 'desktop' | 'android' | 'iphone' | 'ipad' | 'tablet'
type BrowserKind = 'edge' | 'opera' | 'chrome' | 'firefox' | 'safari' | 'unknown'
type GeoState
  = | { status: 'loading' }
    | { status: 'ready', ip: string, isp: string | null, location: string | null, countryCode: string }
    | { status: 'unavailable' }
```

Rules:

- UA detection returns `DeviceKind`/`BrowserKind`.
- Browser brand output remains Edge/Opera/Chrome/Firefox/Safari; only unknown fallback translates.
- Geo loaders return `null` for missing ISP/location; they MUST NOT write Chinese fallback strings into fetched data.
- Language changes re-render device, unknown, loading, unavailable, subtitle, accessible name, and visit time without rerunning UA detection or geo fetch.
- The disclosure button gets `展开访客信息` / `Show visitor details` and collapse equivalents.
- IP masking behavior remains unchanged.

### FR-10 Region localization and normalization

`regionHelper.ts` MUST use one internal resolver for every display/search/flag helper:

1. Preserve the original input for unknown-value fallback.
2. Trim for lookup.
3. Resolve a direct flag-emoji key first.
4. Otherwise uppercase a two-letter value and resolve it through a module-level code index built once from `emojiToRegionMap`; do not scan or allocate per node render.

The resolver remains internal. Public helpers retain their current signatures and clean-cut behavior:

- `getRegionDisplayName(value, toRegionLanguage(lang))` returns the localized mapped name for recognized emoji or ISO input; unknown input returns the original external string unchanged.
- `getRegionCode(value)` returns the canonical uppercase code for recognized emoji or ISO input so flag asset paths remain valid; unknown input retains current fallback behavior.
- `getEmojiByCode(value)` trims and resolves recognized codes through the same index; unknown input retains current fallback behavior.
- `isRegionMatch(value, query)` uses the same resolved region record, so recognized emoji and trimmed/case-insensitive ISO inputs search by English name, Chinese name, code, and aliases. Unknown inputs retain simple case-insensitive substring matching.

Every visible `getRegionDisplayName()` call passes `toRegionLanguage(lang)`:

- Command Menu node descriptions.
- NodeCard flag alt.
- NodeList flag alt.
- InstanceDetail flag alt.
- NodeEarthMaps point names/tooltips.
- NodeEarthGlobe flag labels when exposed to accessibility APIs.

Language changes MUST NOT change search eligibility. Region aliases/map data remain unchanged.

Pure verification covers `🇺🇸`, `US`, `us`, whitespace-padded recognized values, and an unknown external value in both languages; it also covers canonical flag code and bilingual search output.

### FR-11 Error model

Components MUST store errors independent of locale. Error origin MUST be assigned where external responses are decoded, not inferred later from numeric codes or English message prefixes.

Add `src/utils/displayError.ts`:

```ts
export type ErrorOrigin = 'remote' | 'transport' | 'client'

export declare function getDisplayErrorMessage(
  error: unknown,
  localizedFallback: string,
): string
```

Cut over the internal error constructors without compatibility overloads:

```ts
interface ApiErrorOptions {
  origin: ErrorOrigin
  status?: string
  code?: number
}

interface RpcErrorOptions {
  origin: ErrorOrigin
  data?: unknown
}

declare class ApiError {
  constructor(message: string, options: ApiErrorOptions)
}

declare class RpcError {
  constructor(code: number, message: string, options: RpcErrorOptions)
}
```

`displayError.ts` owns `ErrorOrigin`. `api.ts` and `rpc.ts` import that type; the helper checks `Error` plus its structural `origin` field and MUST NOT import `ApiError` or `RpcError`, avoiding a runtime cycle.

`ApiError` preserves `name`, `status` (default `error`), and `code`; `RpcError` preserves `name`, `code`, and `data`. Both expose the supplied `origin` as a `readonly` public property. The options object is required, so TypeScript inventories every constructor call during cutover.

Origin assignment:

- `remote`: Komari REST response bodies with `status === 'error'` and JSON-RPC response `error` objects decoded by `handleResponse()`.
- `transport`: locally generated HTTP-status, network, timeout, WebSocket connection/error/remote-close/not-connected, and response-parse failures.
- `client`: unsupported protocol, unexpected health response, the intentional `close()` pending-request rejection (`WebSocket closed by client`), and other locally detected invariant failures.

Display rules:

- Only an `Error.message` with `origin === 'remote'` and `message.trim().length > 0` is returned verbatim; the original untrimmed string is returned.
- Remote constructors preserve the decoded response message and MUST NOT substitute `Unknown error` or any other local English text. A missing, non-string, empty, or whitespace-only remote message is normalized to `''` so display falls back to the current catalog.
- `transport`, `client`, missing/invalid origin, empty, map-asset, non-Error, and unknown failures return `localizedFallback`.
- External messages render through React text nodes or existing HTML escaping; they are never used as markup.
- Error objects are retained in component/cache state and translated only during render.
- Errors are not persisted.
- Existing console diagnostics remain developer-facing and need not translate.

Component fallbacks:

| Surface                  | Fallback                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| LoadChart                | `获取负载数据失败` / `Failed to load performance data`                                           |
| PingChart                | `获取延迟数据失败` / `Failed to load latency data`                                               |
| Shared Ping bars         | `加载失败` / `Failed to load`                                                                    |
| World map asset          | `地图资源加载失败` / `Failed to load map resources`                                              |
| WebSocket fallback toast | `WebSocket 无法连接，尝试回落 POST 模式。` / `WebSocket unavailable. Falling back to POST mode.` |

### FR-12 Network and cache invariants

Changing `lang` MUST NOT:

- Call `common:getRecords`, `public:queryMetrics`, `public:getPingMetricStats`, REST APIs, exchange-rate APIs, or visitor geo APIs.
- Recreate the shared Ping cache or alter its key/version/refresh timer.
- Reset LoadChart/PingChart records or selection.
- Restart realtime polling timers.
- Reinitialize the cobe globe. Globe labels may re-render; the canvas effect remains mounted.

Implementation rule: fetch effects MUST NOT depend on `lang`, `t`, or translated option arrays. Formatting/chart-option memos MAY depend on them.

### FR-13 Accessibility and interaction

- `<html lang>` always matches current state after hydration.
- Every existing theme-owned `aria-label`, `sr-only` string, dialog title/description, tooltip, input label, placeholder, and status label in scope translates.
- `DialogContent` gains a required `closeLabel: string` prop. The generic primitive no longer imports app state or has a hardcoded Chinese default. Every caller supplies `t('common.close')`.
- `Empty.description` becomes required; the generic primitive has no locale default.
- The Header language button is a native button with visible target-language text, tooltip, focus ring, and localized accessible name.
- Command Menu combobox behavior, `aria-activedescendant`, arrow navigation, Enter activation, Escape close, and Ctrl/Cmd+K remain unchanged.
- Sorting accessible names use complete localized phrases, e.g. `内存，升序` / `Memory, ascending`.
- Dynamic accessible names include external names unchanged, e.g. `查看节点 {name} 详情` / `View details for {name}`.
- Status is never communicated only by translated color; existing visible/accessible status text remains.

### FR-14 Responsive behavior

At 320 CSS px width in both languages:

- Header has no horizontal page overflow in both build configurations: Cloudflare/GitHub action and admin action.
- At `max-width: 359px`, the command button hides both keycap spans and becomes one 32×32 icon-only button; its tooltip, `aria-label`, and keyboard shortcut remain.
- At `max-width: 359px`, the Cloudflare GitHub action hides the visible `Star` span and becomes one 32×32 icon-only button; its tooltip and accessible name remain. The admin icon button, theme button, language button, avatar, and loading skeleton use the same 32px compact geometry.
- Header loading state mirrors the rendered action count and order, including the language control; at `max-width: 359px` every action placeholder is 32×32.
- Site name may truncate to zero visible width if necessary; avatar and every action remain reachable.
- English text may truncate only where current UI already provides tooltip/accessibility text.
- Command Menu fits within viewport and its close control remains reachable.
- Finance disclosure stays within `calc(100vw - 2rem)`.
- Ping controls wrap without overlap.
- No font size is reduced below existing values solely to fit English.

### FR-15 Catalog and copy specification

The following is the required semantic copy baseline. Minor punctuation changes require spec update before implementation. `{...}` denotes typed function input, not runtime template parsing.

#### Common, shell, Header

| Key                       | zh-CN                          | en-US                                 |
| ------------------------- | ------------------------------ | ------------------------------------- |
| `common.loading`          | 正在加载                       | Loading                               |
| `common.loadFailed`       | 加载失败                       | Failed to load                        |
| `common.notAvailable`     | N/A                            | N/A                                   |
| `common.noData`           | 暂无数据                       | No data                               |
| `common.online`           | 在线                           | Online                                |
| `common.offline`          | 离线                           | Offline                               |
| `common.current`          | 当前                           | Current                               |
| `common.unlimitedTraffic` | 无限流量                       | Unlimited                             |
| `common.close`            | 关闭                           | Close                                 |
| `common.backHome`         | 返回首页                       | Back to home                          |
| `common.backTop`          | 返回顶部                       | Back to top                           |
| `shell.skipToContent`     | 跳到主要内容                   | Skip to main content                  |
| `header.actionsLoading`   | 页面操作加载中                 | Page actions loading                  |
| `header.siteLoading`      | 站点信息加载中                 | Site information loading              |
| `header.themeAuto`        | 自动主题                       | System theme                          |
| `header.themeLight`       | 浅色主题                       | Light theme                           |
| `header.themeDark`        | 深色主题                       | Dark theme                            |
| `header.switchLight`      | 切换到浅色主题                 | Switch to light theme                 |
| `header.switchDark`       | 切换到深色主题                 | Switch to dark theme                  |
| `header.switchAuto`       | 切换到跟随系统                 | Use system theme                      |
| `header.starGithub`       | 在 GitHub 上 Star              | Star on GitHub                        |
| `header.admin`            | 后台管理                       | Admin dashboard                       |
| `header.openCommand`      | 打开命令菜单，快捷键 Command K | Open command menu, shortcut Command K |
| `header.switchEnglish`    | 切换到 English                 | Switch to English                     |
| `header.switchChinese`    | 切换到中文                     | Switch to Chinese                     |

#### Language control

| Key                     | zh-CN          | en-US                    |
| ----------------------- | -------------- | ------------------------ |
| `language.shortEnglish` | EN             | EN                       |
| `language.shortChinese` | 中             | 中                       |
| `language.searchTerms`  | 中文 英语 语言 | English Chinese language |

#### Command Menu

| Key                               | zh-CN                                | en-US                                          |
| --------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `command.title`                   | 命令菜单                             | Command menu                                   |
| `command.description`             | 搜索节点或执行常用操作               | Search nodes or run common actions             |
| `command.inputLabel`              | 搜索节点或执行操作                   | Search nodes or run an action                  |
| `command.placeholder`             | 搜索节点、分组或操作…                | Search nodes, groups, or actions…              |
| `command.sectionSearch`           | 搜索                                 | Search                                         |
| `command.sectionActions`          | 操作                                 | Actions                                        |
| `command.sectionGroups`           | 分组                                 | Groups                                         |
| `command.sectionNodes`            | 节点                                 | Nodes                                          |
| `command.cardView`                | 卡片视图                             | Card view                                      |
| `command.cardViewDescription`     | 用卡片查看节点状态                   | View node status as cards                      |
| `command.listView`                | 列表视图                             | List view                                      |
| `command.listViewDescription`     | 用表格密度查看节点状态               | View node status in a compact table            |
| `command.themeDescription`        | 调整界面明暗模式                     | Change interface appearance                    |
| `command.languageDescription`     | 更改界面语言                         | Change interface language                      |
| `command.clearSearch`             | 清除首页搜索                         | Clear home search                              |
| `command.searchNodes`             | 搜索节点：{query}                    | Search nodes: {query}                          |
| `command.searchDescription`       | 在首页节点列表中筛选                 | Filter the node list on the home page          |
| `command.allNodesDescription`     | 显示所有节点                         | Show all nodes                                 |
| `command.groupDescription`        | 切换首页节点分组                     | Switch the home node group                     |
| `command.adminDescription`        | 打开 Komari 管理后台                 | Open the Komari admin dashboard                |
| `command.nodeDescriptionFallback` | 节点详情                             | Node details                                   |
| `command.itemCount`               | {count} 项                           | {count} item (`one`); {count} items (`other`)  |
| `command.noResults`               | 无结果                               | No results                                     |
| `command.noMatches`               | 没有匹配项，试试节点名称、地区或分组 | No matches. Try a node name, region, or group. |
| `command.navigate`                | 导航                                 | Navigate                                       |
| `command.open`                    | 打开                                 | Open                                           |
| `command.close`                   | 关闭                                 | Close                                          |

#### Home and node surfaces

| Key                          | zh-CN                                            | en-US                                                                    |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `home.rpcErrorTitle`         | RPC 服务错误                                     | RPC service error                                                        |
| `home.rpcErrorDescription`   | 连接服务器失败，请检查网络设置或刷新页面后再试。 | Could not connect to the server. Check your network or refresh the page. |
| `home.allNodes`              | 全部节点                                         | All nodes                                                                |
| `home.all`                   | 全部                                             | All                                                                      |
| `home.groupLabel`            | 节点分组                                         | Node groups                                                              |
| `home.noNodes`               | 暂无节点                                         | No nodes                                                                 |
| `home.noMatchingNodes`       | 没有匹配的节点                                   | No matching nodes                                                        |
| `home.viewToggle`            | 节点视图切换                                     | Node view                                                                |
| `home.cardView`              | 卡片视图                                         | Card view                                                                |
| `home.listView`              | 列表视图                                         | List view                                                                |
| `home.pingDialogTitle`       | {name} 延迟 / 丢包                               | {name} latency / packet loss                                             |
| `node.viewDetails`           | 查看 {name} 节点详情                             | View details for {name}                                                  |
| `node.status`                | 状态                                             | Status                                                                   |
| `node.system`                | 系统                                             | System                                                                   |
| `node.unknownOs`             | 未知系统                                         | Unknown OS                                                               |
| `node.node`                  | 节点                                             | Node                                                                     |
| `node.tags`                  | 标签                                             | Tags                                                                     |
| `node.uptime`                | 运行时间                                         | Uptime                                                                   |
| `node.memory`                | 内存                                             | Memory                                                                   |
| `node.used`                  | 已用                                             | Used                                                                     |
| `node.disk`                  | 硬盘                                             | Disk                                                                     |
| `node.traffic`               | 流量                                             | Traffic                                                                  |
| `node.rate`                  | 速率                                             | Rate                                                                     |
| `node.latency`               | 延迟                                             | Latency                                                                  |
| `node.packetLoss`            | 丢包                                             | Packet loss                                                              |
| `node.networks`              | 三网                                             | Networks                                                                 |
| `node.sortAscending`         | {label}，升序                                    | {label}, ascending                                                       |
| `node.sortDescending`        | {label}，降序                                    | {label}, descending                                                      |
| `node.pingDetails`           | {name} 延迟 / 丢包                               | {name} latency / packet loss                                             |
| `ping.loading`               | 加载中                                           | Loading                                                                  |
| `ping.failed`                | 加载失败                                         | Failed to load                                                           |
| `ping.disabled`              | 未启用记录                                       | History disabled                                                         |
| `ping.averageLatency`        | 平均延迟 {value} ms                              | Average latency {value} ms                                               |
| `ping.averageLoss`           | 平均丢包 {loss}%                                 | Average packet loss {loss}%                                              |
| `ping.averageLossVolatility` | 平均丢包 {loss}%，平均波动 {volatility}          | Average packet loss {loss}%, average volatility {volatility}             |

#### Summary, map, and visitor

| Key                          | zh-CN                          | en-US                               |
| ---------------------------- | ------------------------------ | ----------------------------------- |
| `summary.memoryUsage`        | 内存用量                       | Memory usage                        |
| `summary.diskUsage`          | 硬盘用量                       | Disk usage                          |
| `summary.remainingValue`     | 剩余价值                       | Remaining value                     |
| `summary.totalValue`         | 总价值                         | Total value                         |
| `summary.monthlySpend`       | 月均支出                       | Average monthly spend               |
| `summary.expandFinance`      | 展开剩余价值详情               | Show remaining value details        |
| `summary.collapseFinance`    | 收起剩余价值详情               | Hide remaining value details        |
| `summary.todayRates`         | 今日汇率                       | Today's exchange rates              |
| `summary.changeBaseCurrency` | 切换汇率基准币种               | Change exchange-rate base currency  |
| `summary.rateList`           | 今日汇率列表                   | Today's exchange rates              |
| `summary.totalTraffic`       | 累计流量                       | Total traffic                       |
| `summary.realtimeUpload`     | 实时上行                       | Live upload                         |
| `summary.realtimeDownload`   | 实时下行                       | Live download                       |
| `summary.perMonth`           | / 月                           | / month                             |
| `map.onlineOffline`          | 在线 {online} · 离线 {offline} | Online {online} · Offline {offline} |
| `map.loadFailed`             | 地图资源加载失败               | Failed to load map resources        |
| `visitor.desktop`            | 桌面设备                       | Desktop                             |
| `visitor.android`            | Android 手机                   | Android phone                       |
| `visitor.tablet`             | 平板电脑                       | Tablet                              |
| `visitor.unknownBrowser`     | 未知浏览器                     | Unknown browser                     |
| `visitor.detecting`          | 检测中                         | Detecting                           |
| `visitor.locating`           | 正在定位访客来源               | Locating visitor                    |
| `visitor.unknownIsp`         | 未知运营商                     | Unknown ISP                         |
| `visitor.unknownLocation`    | 未知位置                       | Unknown location                    |
| `visitor.ipUnavailable`      | 暂无法获取                     | Unavailable                         |
| `visitor.networkUnavailable` | 网络信息不可用                 | Network information unavailable     |
| `visitor.networkVisitor`     | 网络访客                       | Network visitor                     |
| `visitor.expand`             | 展开访客信息                   | Show visitor details                |
| `visitor.collapse`           | 收起访客信息                   | Hide visitor details                |

#### Node detail

| Key                      | zh-CN                | en-US                     |
| ------------------------ | -------------------- | ------------------------- |
| `detail.notFound`        | 节点不存在或已被删除 | Node not found or deleted |
| `detail.nodePrice`       | 节点价格             | Node price                |
| `detail.monthlySpend`    | 月均支出             | Average monthly spend     |
| `detail.remainingTime`   | 剩余时间             | Time remaining            |
| `detail.remainingValue`  | 剩余价值             | Remaining value           |
| `detail.notApplicable`   | 不适用               | N/A                       |
| `detail.architecture`    | 架构                 | Architecture              |
| `detail.virtualization`  | 虚拟化               | Virtualization            |
| `detail.operatingSystem` | 操作系统             | Operating system          |
| `detail.kernelVersion`   | 内核版本             | Kernel version            |
| `detail.lastReport`      | 最后上报             | Last report               |
| `detail.swapMemory`      | 内存交换             | Swap memory               |
| `detail.swap`            | 交换                 | Swap                      |
| `detail.load`            | 负载 {value}         | Load {value}              |
| `detail.usedPercent`     | 已用 {value}%        | {value}% used             |
| `detail.liveUpload`      | 实时上行             | Live upload               |
| `detail.liveDownload`    | 实时下行             | Live download             |
| `detail.totalTraffic`    | 总流量               | Total traffic             |
| `detail.accumulated`     | 累计 {value}         | Total {value}             |
| `detail.connections`     | 连接                 | Connections               |
| `detail.processes`       | 进程 {count}         | Processes {count}         |
| `detail.hardwareInfo`    | 硬件信息             | Hardware                  |
| `detail.systemInfo`      | 系统信息             | System                    |
| `detail.storageInfo`     | 存储信息             | Storage                   |
| `detail.networkInfo`     | 网络信息             | Network                   |
| `detail.networkRate`     | 网络速率             | Network rate              |

#### Uptime

| Key                     | zh-CN        | en-US                                             |
| ----------------------- | ------------ | ------------------------------------------------- |
| `uptime.days`           | {count} 天   | {count} day (`one`); {count} days (`other`)       |
| `uptime.hours`          | {count} 小时 | {count} hour (`one`); {count} hours (`other`)     |
| `uptime.minutes`        | {count} 分钟 | {count} minute (`one`); {count} minutes (`other`) |
| `uptime.seconds`        | {count} 秒   | {count} second (`one`); {count} seconds (`other`) |
| `uptime.lessThanDay`    | 不足 1 天    | Less than 1 day                                   |
| `uptime.lessThanHour`   | 不足 1 小时  | Less than 1 hour                                  |
| `uptime.lessThanMinute` | 不足 1 分钟  | Less than 1 minute                                |
| `uptime.lessThanSecond` | 不足 1 秒    | Less than 1 second                                |

#### LoadChart and PingChart

| Key                    | zh-CN                       | en-US                                         |
| ---------------------- | --------------------------- | --------------------------------------------- |
| `load.realtime`        | 实时                        | Live                                          |
| `load.rangeLabel`      | 负载历史时间段              | Performance history range                     |
| `load.failed`          | 获取负载数据失败            | Failed to load performance data               |
| `load.empty`           | 暂无负载数据                | No performance data                           |
| `load.systemLoad`      | 系统负载                    | System load                                   |
| `load.memory`          | 内存                        | Memory                                        |
| `load.disk`            | 磁盘                        | Disk                                          |
| `load.diskUsed`        | 磁盘已用                    | Disk used                                     |
| `load.network`         | 网络                        | Network                                       |
| `load.download`        | 下载                        | Download                                      |
| `load.upload`          | 上传                        | Upload                                        |
| `load.speed`           | 速度                        | Speed                                         |
| `load.connections`     | 连接                        | Connections                                   |
| `load.connectionCount` | 连接数                      | Connections                                   |
| `load.process`         | 进程                        | Processes                                     |
| `load.processCount`    | 进程数                      | Process count                                 |
| `range.hours`          | {count} 小时                | {count} hour (`one`); {count} hours (`other`) |
| `range.days`           | {count} 天                  | {count} day (`one`); {count} days (`other`)   |
| `ping.rangeLabel`      | 延迟历史时间段              | Latency history range                         |
| `ping.failedData`      | 获取延迟数据失败            | Failed to load latency data                   |
| `ping.empty`           | 暂无延迟数据                | No latency data                               |
| `ping.taskSelection`   | 延迟历史任务选择            | Latency task selection                        |
| `ping.selectAll`       | 全选                        | Select all                                    |
| `ping.selectNone`      | 全不选                      | Select none                                   |
| `ping.selected`        | 已选择 {selected} / {total} | Selected {selected} of {total}                |
| `ping.displayOptions`  | 延迟图表显示选项            | Latency chart display options                 |
| `ping.smoothPeaks`     | 平滑峰值                    | Smooth peaks                                  |
| `ping.axisLatency`     | 延迟 (ms)                   | Latency (ms)                                  |

#### Finance/expiry, Footer, toast

| Key                       | zh-CN                                    | en-US                                                 |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `billing.month`           | 月                                       | Month                                                 |
| `billing.quarter`         | 季                                       | Quarter                                               |
| `billing.semiAnnual`      | 半年                                     | Semi-annual                                           |
| `billing.year`            | 年                                       | Year                                                  |
| `billing.biennial`        | 两年                                     | Two years                                             |
| `billing.triennial`       | 三年                                     | Three years                                           |
| `billing.quinquennial`    | 五年                                     | Five years                                            |
| `billing.once`            | 一次性                                   | One-time                                              |
| `billing.customDays`      | {count} 天                               | {count} day (`one`); {count} days (`other`)           |
| `expiry.expired`          | 已过期                                   | Expired                                               |
| `expiry.longTerm`         | 长期                                     | Long-term                                             |
| `expiry.days`             | {count} 天                               | {count} day (`one`); {count} days (`other`)           |
| `expiry.remaining`        | 剩余 {count} 天                          | {count} day left (`one`); {count} days left (`other`) |
| `finance.free`            | 免费                                     | Free                                                  |
| `footer.poweredBy`        | Powered by                               | Powered by                                            |
| `footer.themeBy`          | Theme by                                 | Theme by                                              |
| `toast.websocketFallback` | WebSocket 无法连接，尝试回落 POST 模式。 | WebSocket unavailable. Falling back to POST mode.     |

Locale-neutral visible literals not required in the catalog: product/brand names, `Star`, `Command · Ctrl K`, `Esc`, `CPU`, `GPU`, `RAM`, `Swap`, `TCP`, `UDP`, `IP`, `N/A`, byte units, `/s`, `%`, `ms`, currency symbols/codes, node/Ping task content.

## 8. Component requirements matrix

| Surface                                           | Required implementation behavior                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `i18n/messages.ts`, `i18n/index.ts`, `useI18n.ts` | Typed complete catalogs, pure language helpers, and stable React binding per FR-06.                                |
| `app/layout.tsx`                                  | Static fallback lang only; no runtime catalog import.                                                              |
| `app/page.tsx`                                    | Translate loading aria and skip link. Dynamic fallback components call `useI18n`.                                  |
| `stores/app.ts`                                   | Import `Lang`; resolve, validate, persist, set.                                                                    |
| `Provider.tsx`                                    | Layout-phase hydration and `<html lang>` sync.                                                                     |
| `Header.tsx`                                      | Translate all theme-owned action text; add target-language control.                                                |
| `CommandMenu.tsx`                                 | Translate complete shell/actions/status; current-language region description; stable IDs; bilingual keywords.      |
| `ui/dialog.tsx`                                   | Required `closeLabel`; no catalog/store dependency.                                                                |
| `ui/empty.tsx`                                    | Required `description`; no default locale copy.                                                                    |
| `utils/chartRange.ts`                             | Pure preservation-limit sanitation, numeric candidates, and effective-selection normalization shared by Load/Ping. |
| `ui/back-top.tsx`                                 | Current-language accessible name.                                                                                  |
| `LoadingCover.tsx`                                | Current-language status name.                                                                                      |
| `Footer.tsx`                                      | Catalog-owned connector copy; external version/filing unchanged.                                                   |
| `HomeView.tsx`                                    | Translate alerts, groups, empty states, view labels, dialog title, fallback aria.                                  |
| `NodeCard.tsx`                                    | Translate labels/status/aria; localized region alt and uptime; external tag/name unchanged.                        |
| `NodeList.tsx`                                    | Stable typed columns; labels/sort names/status/aria; localized region alt and uptime.                              |
| `useNodePingDisplay.ts`                           | Translate render-derived fallbacks/tooltips; no text stored in shared cache.                                       |
| `NodePingListCell.tsx`                            | No new state; consumes translated bar tooltips.                                                                    |
| `NodeGeneralCards.tsx`                            | Translate summary/disclosure; locale finance/rates; no refetch on language.                                        |
| `NodeEarthMaps.tsx`                               | Locale region names/tooltips/fallback; stable country code identity.                                               |
| `NodeEarthGlobe.tsx`                              | Locale accessible region/status labels without reinitializing globe.                                               |
| `VisitorInfoCard.tsx`                             | Semantic state per FR-09; locale date; external geo unchanged.                                                     |
| `InstanceDetail.tsx`                              | Structured finance/expiry values; stable IDs; full labels and region alt.                                          |
| `LoadChart.tsx`                                   | Stable range/series IDs; translated chart option and errors; no data effect language dependency.                   |
| `PingChart.tsx`                                   | Numeric range and task series IDs; translated controls/options/errors; no fetch on language.                       |
| `utils/displayError.ts`                           | Render-time remote-message policy from explicit origin only.                                                       |
| `regionHelper.ts`                                 | Canonical emoji/ISO lookup shared by localized display, flag code, emoji, and bilingual search helpers.            |
| `utils/api.ts`, `utils/rpc.ts`                    | Required error-origin options on every constructor; wire methods/payloads unchanged.                               |
| `useNodePingStats.ts`                             | Raw errors in shared cache; request/cache semantics unchanged.                                                     |
| `helper.ts`                                       | Explicit-language uptime/date formatters.                                                                          |
| `financeHelper.ts`                                | Explicit-language amount formatting; calculations and `白嫖中` token unchanged.                                    |
| `tagHelper.ts`                                    | Use catalog; explicit Lang; plural-correct English.                                                                |
| `init.ts`                                         | Resolve current store language when toast fires.                                                                   |

## 9. State preservation acceptance table

After switching language, these values MUST be identical to immediately before the switch:

| State                                                                  | Source                        |
| ---------------------------------------------------------------------- | ----------------------------- |
| Theme mode                                                             | `AppStoreState.themeMode`     |
| Node group                                                             | `nodeSelectedGroup`           |
| Home search                                                            | `homeSearchText`              |
| Card/list mode                                                         | derived `nodeViewMode`        |
| Home scroll                                                            | `homeScrollPosition`          |
| Finance base currency and disclosure open state                        | component/localStorage state  |
| Visitor disclosure open state and visit timestamp                      | component state               |
| LoadChart selected range and loaded record array                       | component state               |
| PingChart selected hours, tasks, selected IDs, delay/loss/peak toggles | component state               |
| Shared Ping records and refresh timer                                  | module cache                  |
| Current route and selected node                                        | client router/component state |

## 10. Testing and verification strategy

No permanent test suite is introduced. Verification has four layers.

### 10.1 Static contract

Run `bun run type-check` after the catalog/core tasks and after each exported helper signature migration. It MUST catch:

- Missing or extra English catalog keys.
- Wrong dynamic-message argument shapes.
- Unmigrated formatter callers.
- Missing required `DialogContent.closeLabel` or `Empty.description`.
- Missing required error origins at every `ApiError`/`RpcError` constructor.

One-off, non-permanent smokes MUST cover the FR-01 resolver table, catalog plurals, `useI18n` translator identity across same-language rerender and language change, FR-08 formatters, FR-10 emoji/ISO/unknown region behavior, FR-11 empty/remote/local display, and FR-07 invalid-limit/single-effective-fetch range transitions.

### 10.2 Source audit

Search `src/**/*.ts` and `src/**/*.tsx` for Han-character string literals. Every result MUST be classified as one of:

1. Catalog value.
2. Region/alias data.
3. Operator token `白嫖中`.
4. Developer comment/log/metadata.
5. A defect to migrate.

Also search for translated-label control flow:

- comparisons against Chinese labels;
- `.find(...label...)` for tab selection;
- translated values used as keys/state;
- fetch effects depending on `lang` or `t`;
- raw versus effective chart range dependencies and stale-state reconciliation;
- region display/code/search helpers bypassing the canonical resolver;
- `ApiError`/`RpcError` constructors without an explicit origin or remote constructors that synthesize local fallback text.

No unexplained visitor-facing literal may remain.

### 10.3 Real-browser behavior

Start `bun run dev:demo` and use Chromium automation. Run the Header matrix in two separately started dev servers: `CF_PAGES=0 bun run dev:demo` for the admin branch and `CF_PAGES=1 bun run dev:demo` for the GitHub branch. `next.config.ts` derives `NEXT_PUBLIC_IS_CLOUDFLARE_PAGES`; do not set that public variable directly.

Matrix:

- Languages: `zh-CN`, `en-US`.
- Viewports: 320×800, 768×900, 1280×900.
- Themes: light and dark.
- Routes: home, one real node detail, nonexistent node detail.
- Header configurations at 320px: `CF_PAGES=1` produces `NEXT_PUBLIC_IS_CLOUDFLARE_PAGES=true` with GitHub Star; `CF_PAGES=0` produces the admin branch. Each is a separate dev-server run because Next public env values are compile-time in this app.

Scenarios:

1. Clear `lang`; emulate `zh-CN`; load and assert Chinese UI plus `<html lang="zh-CN">`, and assert hydration did not create the `lang` storage key.
2. Clear `lang`; emulate unsupported language; load and assert English UI plus `<html lang="en-US">`, and assert hydration did not create the `lang` storage key.
3. Seed each valid stored language against the opposite browser preference; stored value wins.
4. Seed invalid stored value; browser preference wins and the invalid stored value remains untouched until an explicit switch.
5. Switch via Header; assert immediate copy, target button text, `<html lang>`, and localStorage.
6. Reload; persisted language remains.
7. Switch via Command Menu using keyboard only.
8. Search the Command Menu with English and Chinese synonyms; node/region searches still match.
9. Set group, search, list/card, theme, finance currency, and scroll; switch language; state persists.
10. Open Visitor card; switch language; visit time instant, IP, geo data, and disclosure state remain.
11. Open finance disclosure; switch language; rates are reformatted, not refetched.
12. Choose non-default LoadChart range; switch language; selected range and data remain; tooltip labels change.
13. Select a subset of Ping tasks and toggle delay/loss/peak; switch language; all controls and records remain.
14. Inspect network/RPC traffic around language switch; no new request attributable to `lang`.
15. Trigger or simulate invalid node route and map failure where feasible; fallback text follows language.
16. Inspect accessibility tree for Header language control, Command dialog/close, skip link, sort controls, BackTop, Visitor disclosure, and Ping controls.
17. At 320px in separate Cloudflare/GitHub and admin runs, assert document width does not exceed viewport and all Header actions remain reachable.
18. Assert no hydration warning or runtime console error.

If the demo backend has no map failure or RPC failure, report those two paths as structurally verified but not runtime-induced; do not fabricate a successful runtime exercise.

### 10.4 Repository gates

```bash
bun run lint
bun run build
```

Both MUST pass. Packaging contents and names MUST remain unchanged.

## 11. Performance constraints

- Translation lookup: O(1), no network, no JSON parsing, no merged catalog allocation.
- Catalogs are statically imported and add no dependency, request, parsing, or lazy-load path. No independent bundle-delta gate is required; final build output is retained as delivery evidence.
- Formatter objects SHOULD be cached by language/options.
- No avoidable array copy is added to per-node render paths.
- Language switch may rebuild display arrays/chart options; it MUST NOT copy record history solely to translate labels.
- No new polling, observer, global event listener, or timer is added except existing effects.

## 12. Security and content safety

- Catalog text contains no HTML.
- ECharts HTML tooltips continue escaping all external strings, including node/region/task-derived values.
- Language codes are validated at storage/browser boundaries before entering state.
- No remote translation content is fetched or evaluated.
- No backend error is inserted into HTML tooltip markup without existing escaping.
- External links, `noopener/noreferrer`, Markdown behavior, and operator content rendering are unchanged.

## 13. Boundaries

### Always

- Use `@/` source imports.
- Reuse app store, region helper, tag helper semantics, Base UI primitives, and existing storage helpers.
- Keep semantic state independent of display text.
- Preserve backend/operator content.
- Run type-check after exported signature changes.
- Browser-verify actual surfaces before final lint/build.

### Ask first

- Adding a language beyond `zh-CN`/`en-US`.
- Translating or changing administrator-managed content.
- Adding dependencies, routes, cookies, middleware, CI, or a test framework.
- Changing Komari API/RPC or manifest schema.
- Changing the static metadata strategy.

### Never

- Store translated strings as state/cache identifiers.
- Machine-translate backend/operator content.
- Add locale shims, deprecated aliases, or two translation APIs.
- Suppress type/lint errors to complete migration.
- Alter package artifact names or contents.
- Claim runtime verification for an error path that was not induced.

## 14. Definition of Done

All are required:

- [ ] FR-01 through FR-15 implemented.
- [ ] Both language controls work without reload.
- [ ] Language resolution, persistence, and `<html lang>` match the specified precedence.
- [ ] Catalog parity and function parameters pass TypeScript.
- [ ] All in-scope visible and accessible theme-owned strings are catalog-backed.
- [ ] No translated text remains in state, cache, equality, keys, branches, or fetch dependencies.
- [ ] Locale-aware uptime/date/finance/plural examples match this spec.
- [ ] External/operator content remains unchanged.
- [ ] Language switch preserves every state in Section 9 and causes zero API/RPC requests.
- [ ] Browser matrix passes, including 320px layout and accessibility checks.
- [ ] Hardcoded-string audit has no unexplained result.
- [ ] `bun run lint` passes with zero warnings.
- [ ] `bun run build` and theme packaging pass.
- [ ] No dependency, manifest, lockfile, API/RPC wire contract, route, or package artifact change; internal typed error-origin metadata is allowed only as specified in FR-11.

## 15. Open questions

None. Any newly discovered ambiguity MUST update this spec before implementation proceeds.
