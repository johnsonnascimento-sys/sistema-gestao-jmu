import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./client/src/test/setup.ts",
    include: ["server/src/**/*.{test,spec}.{ts,tsx}", "client/src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["conta-vinculada/**", "dist/**", "node_modules/**"],
  },
});
