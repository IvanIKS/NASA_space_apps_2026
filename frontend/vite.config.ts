import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `backend` resolves only inside docker compose; for a local `npm run dev` against
// `docker compose up backend` (or a bare uvicorn) point it at localhost.
const API_TARGET = process.env.VITE_API_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // react-globe.gl and any other three.js consumer must share one copy of three.
    dedupe: ["three"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
