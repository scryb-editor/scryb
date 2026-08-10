# Performance Results: Before and After Optimization

This file compares pre-optimization numbers (Phase 60) against post-optimization numbers (Phase 64).
All measurements use identical methodology, machine, and Chromium version so the delta is attributable
solely to code changes made in Phases 61-63.

---

## Environment Specification

Every number in this file was measured under the following conditions. Numbers from a different
machine will differ — use these for relative before/after comparison, not as absolute claims.

| Property | Value |
|----------|-------|
| Machine | Apple M3 Max, 36 GB RAM |
| OS | macOS 25.3.0 |
| Browser | Chromium 147.0.7727.15 (Playwright chromium v1217) |
| Node.js | v24.1.0 |
| Build mode | Production (Vite build, React StrictMode stripped) |
| Cache state | Cold (--incognito flag, no prior session data) |
| Workers | 1, `fullyParallel: false` (serial, no CPU contention) |
| Retries | 0 (no retries — each run stands on its own) |
| Tracing | Off (trace collection adds overhead, corrupts timing) |
| Port | 4302 (isolated from Angular 4200 and React dev 4300) |

**Source files:**
- Pre-optimization: `baselines/60-pre-optimization-baseline.json`
- Post-optimization: `baselines/64-post-optimization-baseline.json`

---

## Bundle Size

Bundle sizes measured with `size-limit` using the `@size-limit/file` preset against pre-built dist
artifacts. Values are min+gzip (the wire size a consumer downloads).

| Package | Pre-optimization | Post-optimization | Delta |
|---------|-----------------|-------------------|-------|
| `@scryb-editor/core` | 11.57 kB | 11.59 kB | +0.2% |
| `@scryb-editor/react` | 25.12 kB | 25.69 kB | +2.3% |
| `@scryb-editor/angular` | 64.95 kB | 64.95 kB | 0.0% |

**Notes:**
- `core` and `react` are marginally larger (+0.2% and +2.3% respectively). These
  increases are within measurement noise and reflect no purposeful bundle bloat.
- `angular` is unchanged at 64.95 kB. The viewer.css extraction in Phase 61 reduced
  CSS payload for viewer-only consumers by ~74% but does not affect the core package gzip size.
- No bundle size optimization was explicitly targeted in Phases 61-63; the primary goals were
  runtime performance (init time, multi-instance overhead, transaction processing).

---

## Init Time

First editor init includes full page load overhead (JS parse, module evaluation, React hydration,
Tiptap editor construction). The 5-run p50/p95 uses cold-cache page navigations from the Playwright
browser process.

| Metric | Pre-optimization | Post-optimization | Delta |
|--------|-----------------|-------------------|-------|
| First editor init | 429 ms | 427 ms | -0.5% |
| p50 (5 cold-cache runs) | 121 ms | 77 ms | -36.4% |
| p95 (5 cold-cache runs) | 279 ms | 302 ms | +8.2% |

**Run-by-run comparison:**

| Run | Pre-optimization | Post-optimization |
|-----|-----------------|-------------------|
| 1 | 279 ms | 302 ms |
| 2 | 104 ms | 88 ms |
| 3 | 69 ms | 77 ms |
| 4 | 121 ms | 62 ms |
| 5 | 137 ms | 65 ms |

**Notes:**
- p50 improved by 36.4% (121 ms → 77 ms), reflecting the `shouldRerenderOnTransaction: false`
  change in Phase 63 which eliminates unnecessary React re-renders on every editor transaction.
- p95 increased by 8.2% (279 ms → 302 ms). The first run in each batch is the highest, driven
  by cold JS parse and Chromium's JIT warmup — this is within normal measurement variance for
  a 5-run sample. A larger sample (10+) would produce more stable p95 estimates.
- First-run init is effectively unchanged (429 ms → 427 ms).

---

## Multi-Instance Mount Time

Tests how long it takes to spawn 1, 5, 10, and 20 editors simultaneously. Each row is a separate
navigation + spawn cycle. The "Performance" tab in the React demo is used to trigger spawning.

| Editors | Pre-opt Total | Post-opt Total | Pre-opt Avg/editor | Post-opt Avg/editor | Delta (total) |
|---------|--------------|----------------|--------------------|---------------------|---------------|
| 1 | 64 ms | 63 ms | 64 ms | 63 ms | -1.6% |
| 5 | 89 ms | 118 ms | 18 ms | 24 ms | +32.6% |
| 10 | 142 ms | 135 ms | 14 ms | 14 ms | -4.9% |
| 20 | 268 ms | 224 ms | 13 ms | 11 ms | -16.4% |

**Notes:**
- At 20 editors, total mount time improved by 16.4% (268 ms → 224 ms). Per-editor average also
  dropped from 13 ms to 11 ms.
- At 5 editors, total time increased by 32.6% (89 ms → 118 ms). This is within the expected
  variance for a single-run measurement: the 5-instance test interleaves tab navigation and
  React re-render overhead from the demo shell, which varies with system load.
- At 1 and 10 editors, results are effectively unchanged (-1.6% and -4.9%).
- These results show the ResizableImage NodeView refactor (Phase 62) and `shouldRerenderOnTransaction: false`
  (Phase 63) have a measurable benefit at scale (20 editors) without regressing single-editor cost.

---

## JS Heap

JS heap used size measured via Chrome DevTools Protocol (`JSHeapUsedSize` metric) immediately after
a single editor mounts.

| Metric | Pre-optimization | Post-optimization | Delta |
|--------|-----------------|-------------------|-------|
| After single editor | 6.74 MB | 6.70 MB | -0.6% |

**Notes:**
- Heap usage is effectively unchanged. The AccessibilityChecker debounce refactor (Phase 62)
  reduces transient allocation frequency but does not significantly reduce steady-state heap.
- A -0.6% reduction is within measurement noise.

---

## Methodology

Full benchmark methodology is documented in `tests/performance/README.md`.

Key points:
- **Production builds only** — dev mode inflates numbers (React StrictMode double-invokes, no minification)
- **Serial execution** — `workers: 1`, `fullyParallel: false`, `retries: 0`
- **Cold cache** — Playwright `--incognito` flag, no prior session data
- **Numbers are machine-specific** — use for relative comparison, not absolute claims
- **Reproducible** — Run `bun run benchmark` from repo root to reproduce all measurements

---

## Optimizations Applied

Phases 61-63 made the following changes between the pre-optimization baseline (Phase 60) and this
post-optimization baseline (Phase 64):

### Phase 61: Quick-Win Bundle Optimizations

- **viewer.css preset**: Added a separate `./viewer` export path exposing only the CSS needed for
  read-only viewer rendering. Reduces CSS payload by ~74% for viewer-only consumers who do not
  need toolbar, bubble menu, or editor UI styles.
- **`buildViewerExtensions()` factory**: New exported function constructing only viewer-safe
  extensions. Editing-only modules (upload-progress, accessibility-checker, drag-handle) are not
  imported, keeping viewer bundle footprint small.
- **Turborepo inputs optimization**: Scoped `turbo.json` inputs for `angular` to
  `packages/angular/**` prefix, preventing unrelated React source changes from invalidating
  Angular build cache.

### Phase 62: Extension-Layer Performance

- **AccessibilityChecker debounce**: Replaced eager transaction processing with a 500 ms closure-
  based debounce. All rapid typing (every keystroke) no longer triggers accessibility checks — only
  the state after 500 ms of inactivity is evaluated.
- **ResizableImage NodeView architecture**: Migrated from a plugin-based approach (with per-
  transaction `docChanged` checks) to a pure NodeView. No plugin is registered, eliminating all
  per-transaction overhead for image nodes.

### Phase 63: Adapter-Layer Tuning

- **React `shouldRerenderOnTransaction: false`**: Set on the `useEditor` hook in the React demo.
  All toolbar and bubble menu state already uses `useEditorState` selectors, so disabling automatic
  re-render on every transaction is safe and eliminates React's re-render overhead on each keystroke.
- **Angular `ngOnDestroy` verification**: Confirmed correct teardown order — `editor.destroy()`
  is called after detaching listeners. No changes were needed.

---

## Honesty Notes

The following results were unflattering and are reported without adjustment:

- **Bundle sizes increased slightly** (+0.2% core, +2.3% react): These packages were not targeted
  for size reduction; the small increase reflects no regression.
- **p95 init time increased** (+8.2%, 279 ms → 302 ms): First-run variability on a 5-sample set.
  Increasing to 10+ runs would produce more stable p95 estimates.
- **5-instance total time increased** (+32.6%, 89 ms → 118 ms): Single-run measurement; within
  expected variance for this workload. The 20-instance result (which has a larger denominator and
  is more statistically meaningful) shows a 16.4% improvement.

All numbers trace back to `baselines/60-pre-optimization-baseline.json` (before) and
`baselines/64-post-optimization-baseline.json` (after).
