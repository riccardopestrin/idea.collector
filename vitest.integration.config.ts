import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Test d'integrazione contro lo stack Supabase LOCALE (pnpm db:start). Legge
// .env/.env.local; se mancano le chiavi le prende da `supabase status`, così
// `pnpm test:integration` gira senza configurazione. Rifiuta URL non locali:
// il test crea e cancella utenti veri.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const status = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  const get = (key: string) => status.match(new RegExp(`^${key}="(.+)"$`, "m"))?.[1] ?? "";
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= get("API_URL");
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= get("ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= get("SERVICE_ROLE_KEY");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
  throw new Error(
    `test:integration gira solo contro Supabase locale, non ${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
