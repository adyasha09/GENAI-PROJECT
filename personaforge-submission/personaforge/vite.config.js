import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // When running `vercel dev`, Vercel's CLI serves /api/* itself and
    // proxies frontend requests to this Vite dev server automatically —
    // no manual proxy config needed here.
  },
});
