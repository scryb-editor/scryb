# Performance Benchmark Suite

Reproducible, committed benchmarks for Scryb's editor init time and multi-instance mount performance.

## How to Run

From the repo root:

```bash
bun run benchmark
```

This command builds the React demo as a production Vite bundle, serves it on port 4301, and runs all specs serially via Playwright.

**First run will be slower** because the Vite production build is included in the `webServer.command`. Subsequent runs using an already-built `dist/` are not supported — the config always rebuilds to ensure a clean production build.

## What It Measures

| Spec file | What it measures |
|-----------|------------------|
| `editor-init.spec.ts` | Single editor init time (navigation → `.ProseMirror` visible) |
| `editor-init.spec.ts` | JS heap size after editor init (via CDP `JSHeapUsedSize`) |
| `editor-init.spec.ts` | 5-run p50 and p95 cold-start init times |
| `multi-instance.spec.ts` | Multi-instance mount timing for 1, 5, 10, and 20 editors |

## Methodology

### Execution

- **Production builds only** — The webServer command runs `vite build` before serving. React's `StrictMode` is active in development and double-invokes components, artificially inflating init times 2x. Production builds strip StrictMode.
- **Browser**: Chromium (via Playwright's bundled Chromium)
- **Mode**: Incognito (`--incognito` flag) — cold cache, no browser extensions, no prior session data
- **Serial execution**: `workers: 1`, `fullyParallel: false` — no CPU contention between tests
- **No retries**: `retries: 0` — retries hide variance; each run is a real measurement
- **No tracing**: `trace: "off"` — Playwright trace collection adds overhead that corrupts timing

### Port isolation

- Angular demo: 4200
- React dev server: 4300
- **Performance benchmark**: 4301 (this config)

### Timing measurement

- `measureEditorInit`: records `Date.now()` before `page.goto("/")`, waits for `.ProseMirror` to become visible, returns the delta in milliseconds
- Multi-instance timing: records `Date.now()` before clicking "Spawn", waits for the expected count of `.ProseMirror` elements via `page.waitForFunction`

### Heap measurement

Playwright CDP (`page.context().newCDPSession(page)`) is used to query Chrome's `Performance.getMetrics` domain. The `JSHeapUsedSize` metric reflects V8's current heap occupancy after the editor mounts.

## Environment

Results vary by machine. **Always disclose the following when sharing numbers:**

- CPU model and core count
- RAM (GB)
- OS and version
- Node.js version (`node --version`)
- Chromium version (printed in Playwright output)

Baseline file location: `baselines/60-pre-optimization-baseline.json`

## Caveats

- Numbers are **machine-specific** — use for relative comparison (before/after optimization), not absolute claims
- Cold-start p50/p95 runs 5 iterations; production CI should increase this to 10+ for stable statistics
- Multi-instance timing includes tab navigation and React re-render overhead from the demo shell; this is intentional — it measures real-world spawn cost, not isolated mount time
- Editor init time includes network latency to the local static server; keep other processes quiet during benchmarking
