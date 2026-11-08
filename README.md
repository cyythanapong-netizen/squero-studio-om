# Squero Studio: OpenModelica

Squero Studio OM (`squero studio [ OM ]`) is an acausal Modelica editor in Paperboat's flat-mono
look: a library tree, a canvas of components and connectors, a split view of `.mo` and the
generated C++, and a dock that checks the model's balance and exports a Paperboat backend
(Download `.ppk`, or Start it as `ssom_<model>` on a free port and Stop it). Both generate into
`<tmp>/ssom_<model>` and run `paperboat pack`/`start` there: the sibling `../paperboat/bin/paperboat`,
else `$PAPERBOAT_BIN` or `paperboat` on PATH. The first export of a model builds the engine (minutes).
In the backend, the model's parameters (e.g. a `parameter Real C1F`) are props of its Station
object, edited on the Station page; the Flow block carries only the inputs and outputs. Every edit goes through `omc`, so the `.mo` stays OMEdit-compatible.

This repo contains both the React web application (`src/`) and the native C++ server & tools (`server/`).
The server provides `squero/0`, the `omc` bridge, the `.mo` importer (`extends` resolver, `Icon(graphics)` and
`iconTransformation` quantisers), the backend generator, and the `squero-om` binary.

## Layout

Clone side by side:

```
paperboat/           engine, paperboat CLI, apps/web
paperboat-shared/    @paperboat/shared, the UI kit
squero-studio-om/    this repo (server/ and src/)
```

## Run

From the `paperboat` CLI:

```sh
paperboat start squero-studio-om [Model.mo]  # http://localhost:8790
paperboat stop squero-studio-om
```

From a checkout:

```sh
(cd ../paperboat-shared && npm install)
npm install
npm run build                       # builds dist/
npm run build:server                # builds server/build/squero-om
bin/squero-om [Model.mo]            # server + app on http://localhost:8790
```

For the UI alone: `npm run dev` (Vite on :3048; start `bin/squero-om` for the server).

## Check

```sh
npm run typecheck
npm test            # node tests against a fake StudioApi; no omc, no browser
npm run test:server # C++ Catch2 tests ([modelica],[squero]; needs omc)
npm run build
```

`test/e2e/*.mjs` drive a live server in headless Chromium (playwright-core; see `lib.mjs`);
`test/e2e/reset.sh` starts a fresh one. They are manual, not CI.

## Layout of the source

`src/omc` squero/0 client · `src/store` the `StudioApi` (omc is the only source of truth for the
model) · `src/library`, `canvas`, `split`, `simulate`, `shell` · `src/popover`, `sheet`, `dock` ·
`src/model/types.ts` the seam between the two halves.
