# Frontend

React 18 + TypeScript + Vite. 3D globe on `react-globe.gl`, charts on ECharts, first-person view on raw three.js.

## Running

```bash
docker compose up -d --build backend   # API on localhost:8000
npm install
npm run dev                            # http://localhost:5173
```

The dev proxy forwards `/api/*` to `http://localhost:8000` (override with `VITE_API_TARGET`). In Docker, nginx does the same.

## Structure

`src/` follows a trimmed [Feature-Sliced Design](https://feature-sliced.design/): layers from top to bottom, and a module may import only from layers **below** its own.

| Layer | What lives there | Current slices |
|---|---|---|
| `app/` | Entry point, global styles, top-level view routing | `main.tsx`, `App.tsx`, `styles.css` |
| `pages/` | Screens composed from widgets | `observer` (globe + analytics), `surface` (first-person) |
| `widgets/` | Self-contained blocks of UI | `moon-globe`, `analytics-panel`, `sky-view` |
| `features/` | User actions and the state they produce | `select-point` (point, time and view mode, mirrored to the URL) |
| `entities/` | Domain data: API calls, types, hooks, data views | `surface-observation` (`/positions/surface`), `insolation` (chart) |
| `shared/` | Reusable code with no domain knowledge | `api` (fetch helper), `ui` (view toggle), `lib` (format/time), `config` (textures, colors) |

Conventions:

- Every slice exposes a public API through its `index.ts`; import `@/widgets/moon-globe`, never `@/widgets/moon-globe/MoonGlobe`.
- `@/` is an alias for `src/` (see `tsconfig.json` and `vite.config.ts`).
- A slice's CSS sits next to its component and is imported by it; `app/styles.css` holds only tokens and `body` defaults.
- Same-layer imports are avoided; the one exception is `entities/surface-observation` reusing the `InsolationPoint` type from `entities/insolation`, since an observation contains an insolation series.
