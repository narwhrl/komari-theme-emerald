# AGENTS.md

Repo guide for `komari-theme-emerald`.

## What this repo is

- Builds a Komari theme, not a generic web app
- Canonical repository: `narwhrl/komari-theme-emerald`; it has diverged from its historical upstream and is developed, released, and deployed independently
- Release artifact is a zip package Komari can import
- Runtime app code lives under `src/`
- Runtime static assets include `public/images/` and `public/maps/`
- Release preview image is `docs/preview.png`

## Repository ownership and Git policy

- `narwhrl/komari-theme-emerald` is the sole development, push, pull request, CI, release, and deployment target for this project.
- The Git remote `origin` MUST point to `https://github.com/narwhrl/komari-theme-emerald.git`. Push branches and tags only to `origin`.
- `Tokinx/komari-theme-emerald` is historical upstream reference only. The repositories have diverged into different implementations; do not assume compatibility or an ongoing fork-sync workflow.
- Do not pull, merge, rebase, cherry-pick, push, or open pull requests against the historical upstream unless the user explicitly requests that exact operation.
- Start every new work branch from a clean `origin/master`, not from `upstream/master` or a locally diverged `master`:

  ```bash
  git fetch origin
  git switch -c <branch> origin/master
  ```

- Pull requests MUST target `narwhrl/komari-theme-emerald:master`. Before creating one, verify that `origin/master..HEAD` contains only the intended commits and that `git diff origin/master...HEAD` contains only the intended files.
- Never use upstream divergence as a reason to sync, rewrite, or replace this repository's implementation. Treat upstream code as external reference material unless directed otherwise.

## Toolchain

- App: Next.js + React + coss-ui/Base UI + Tailwind CSS v4
- Package manager: `bun` (`packageManager` is `bun@1.3.14`; `engines.bun` is `>=1.2.0`)
- Node: `^20.19.0 || >=22.12.0` (CI uses Node 24)
- Theme manifest: `komari-theme.json`

## Root structure

- `src/` app source
- `public/images/` runtime image contract, especially flags and logos
- `public/maps/` runtime map contract (`world.json` served as `/maps/world.json`)
- `scripts/` implementations for root commands
- `.github/workflows/` CI and release workflows
- `docs/coss-ui.md` local coss-ui-style component usage notes
- `docs/preview.png` release preview image
- `komari-theme.json` theme manifest consumed by the zip build
- `next.config.ts` Next static export configuration and public build env
- `package.json` root commands and pinned dependency versions
- `bun.lock` resolved lockfile (managed by bun)

## Root commands

Run from repo root only.

```bash
bun run dev
bun run dev:demo
bun run build
bun run build-only
bun run preview
bun run lint
bun run publish
```

Notes:

- `bun run dev` and `bun run preview` both run `bun scripts/dev.ts` (Next dev server). `preview` does not serve `dist/` or `out/`.
- `bun run dev:demo` starts the same server with a local API proxy to the demo backend.
- `bun run build` runs `clean-output` → `type-check` → `next build` → `package-theme`. Next writes `out/`; `scripts/build-theme.ts` then copies it to `dist/` and deletes `out/`.
- `bun run build-only` is `next build` and leaves `out/` in place for Cloudflare Pages.
- `bun run publish` writes the same version into `package.json` and `komari-theme.json`, then `git add`s both files. Do not bump only one of them.
- `bun run lint` is a zero-warning eslint check; use `bun run lint:fix` to apply eslint fixes locally.
- There is no test suite in this repository.
- Do not invent `bun test` or Vitest commands here.

## Build paths

There are two production outputs. Do not collapse them.

### Komari theme package

`bun run build` must preserve the packaging flow in `scripts/build-theme.ts`.

Expected output:

- `dist/`
- `komari-theme-emerald-build-<sha>.zip`

Zip contents:

- `dist/`
- `komari-theme.json`
- `preview.png` (copied from `docs/preview.png`)

Do not change zip naming, manifest filename, or preview filename without updating the real build contract.

### Cloudflare Pages

Pages uses `bun run build-only` and publishes `out/`. It does not create or upload the theme zip.

## Version lock

`package.json.version` and `komari-theme.json.version` must stay identical. The release workflow fails the job if they differ.

## CI facts

### `.github/workflows/ci.yml`

Runs on push and pull request to `master` and `dev`:

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run build`
4. Upload `komari-theme-emerald-build*.zip` as an artifact

It does not run tests, because there is no test suite.

### `.github/workflows/release-on-version-bump.yml`

Runs on push to `master`:

1. `bun install --frozen-lockfile`
2. Fail if `package.json.version` !== `komari-theme.json.version`
3. Release only when `package.json` version changed relative to the previous commit
4. `bun run build`
5. Create `v<version>` tag if missing
6. Create or update the GitHub release with `komari-theme-emerald-build*.zip`

Changing `komari-theme.json` version alone does not trigger a release.

## Where to look

- Start at `package.json` for root commands
- Check `scripts/` for command implementations (`dev.ts`, `dev-api-proxy.ts`, `build-theme.ts`, `publish.ts`, `clean-output.ts`)
- Check `next.config.ts` for Next static export behavior and public env values
- Check `scripts/build-theme.ts` for zip packaging
- Check `scripts/publish.ts` for the version-bump helper
- Check `komari-theme.json` for theme metadata and managed configuration schema
- Check `src/` for app behavior
- Check `public/images/` when code references flag or logo filenames
- Check `public/maps/world.json` when code references `/maps/world.json`
- Check `.github/workflows/ci.yml` for lint and build CI
- Check `.github/workflows/release-on-version-bump.yml` for release expectations

Contributor density, useful for triage:

- `src/components/` is a dense UI change area
- `src/views/` and `src/app/` own the shell and pages
- `src/utils/` is a dense logic and helper area
- `src/stores/` is central state, usually affected by cross-cutting changes
- `src/composables/` and `src/i18n/` are shared view-layer helpers

## Conventions seen in this repo

- Use `bun`, not pnpm/npm/yarn. CI and `packageManager` pin `1.3.14`.
- Dependency versions are declared directly in `package.json`; add new ones with `bun add` / `bun add -d`.
- Keep root guidance focused on build, packaging, manifest, and repo structure.
- Preserve the `@` alias to `src` defined in `tsconfig.json`.
- Treat `komari-theme.json` as release input, not optional metadata.
- Treat `docs/preview.png` as release input, not just documentation art.
- Respect existing generated outputs and naming patterns, especially `komari-theme-emerald-build-<sha>.zip`.
- Root verification is lint plus build, not tests.
- UI stack, component, store, and navigation rules live in `src/AGENTS.md`. Check `docs/coss-ui.md` before adding or changing grouped controls or other coss-ui-style primitives.

## Repo grounded anti-patterns

- Do not rename `komari-theme.json`
- Do not move or rename `docs/preview.png` casually
- Do not bump only one of `package.json` / `komari-theme.json` version fields
- Do not treat a Pages/`out/` build as a substitute for the theme zip
- Do not rename files under `public/images/flags/` or `public/images/logo/` without checking code references in `src`
- Do not change asset path conventions like `/images/flags/<CODE>.svg`, `/images/logo/...`, or `/maps/world.json` blindly
- Do not add generic framework or UI-library advice here that belongs in `src/AGENTS.md`

## Child guides

For local rules, defer to the nearest child guide:

- `src/AGENTS.md` for app code, component, store, client navigation, and utility changes

If a child guide exists, it overrides this root file for its subtree.
