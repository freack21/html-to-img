import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.API_URL || "http://127.0.0.1:3003";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API checks Origin against Host, so keep the dev-server Host header (no changeOrigin).
    proxy: {
      "/api": { target: apiTarget },
      "/files": { target: apiTarget },
    },
  },
});
