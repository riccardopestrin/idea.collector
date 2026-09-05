import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // i test d'integrazione (DB locale) hanno la loro config: pnpm test:integration
    exclude: [...configDefaults.exclude, "tests/integration/**"],
  },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
