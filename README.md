# Squero Studio: OpenModelica

Squero Studio OM (`squero studio [ OM ]`) is an acausal Modelica editor in Paperboat's flat-mono
look: a library tree, a canvas of components and connectors, a split view of `.mo` and the
generated C++, and a dock that checks the model's balance and exports a Paperboat backend
(`<model>-cpp/`). Every edit goes through `omc`, so the `.mo` stays OMEdit-compatible.

This repo is the app (React + `@xyflow/react` on `@paperboat/shared`). The server it talks to,
`squero/0`, the `omc` bridge, the `.mo` importer (`extends` resolver, `Icon(graphics)` and
`iconTransformation` quantisers) and the backend generator are C++ in the
[`paperboat`](https://github.com/cyythanapong-netizen/paperboat) engine (`engine/modelica`).

## Layout

Clone side by side:

```
paperboat/           engine, `paperboat squero`, apps/web
paperboat-shared/    @paperboat/shared, the UI kit
squero-studio-om/    this repo
```

## Run

From the `paperboat` CLI, which fetches and builds this app from GitHub the first time:

```sh
paperboat squero [Model.mo]          # http://localhost:8790
paperboat pkg versions squero-studio-om
paperboat squero --version 0.2.0     # a release (default: the newest, else main)
```

From a checkout:

```sh
(cd ../paperboat-shared && npm install)
npm install
npm run build                       # dist/
bin/squero-om [Model.mo]            # server + app on http://localhost:8790
```

`squero-om` runs `paperboat squero --app dist`. It finds the binary from `$PAPERBOAT`, then
`paperboat` on `PATH`, then `../paperboat/engine/build/**/paperboat`. Build that engine with
`-DPAPERBOAT_BUILD_MODELICA=ON` and have `omc` installed.

For the UI alone: `npm run dev` (Vite on :3048; start `bin/squero-om` for the server).

## Check

```sh
npm run typecheck
npm test            # node tests against a fake StudioApi; no omc, no browser
npm run build
```

`test/e2e/*.mjs` drive a live server in headless Chromium (playwright-core; see `lib.mjs`);
`test/e2e/reset.sh` starts a fresh one. They are manual, not CI.

## Layout of the source

`src/omc` squero/0 client · `src/store` the `StudioApi` (omc is the only source of truth for the
model) · `src/library`, `canvas`, `split`, `simulate`, `shell` · `src/popover`, `sheet`, `dock` ·
`src/model/types.ts` the seam between the two halves.
