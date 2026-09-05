This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database (Supabase)

Il progetto remoto è `chmbafulghmyqydvzewp` (già linkato: `supabase/.temp/project-ref`). Sul free tier viene **messo in pausa dopo ~7 giorni di inattività**: se `supabase migration list --linked` fallisce con `Connection terminated due to connection timeout`, controllare lo stato con `pnpm exec supabase projects list` e riattivarlo dalla Dashboard (Project → Restore). Le migration si applicano con `pnpm exec supabase db push`.

### Stack locale (Docker)

```bash
pnpm db:start                    # avvia Postgres + API locali (serve Docker Desktop acceso)
pnpm exec supabase db reset      # ricrea il DB applicando tutte le migration in supabase/migrations
pnpm exec supabase test db       # test RLS pgTAP in supabase/tests
pnpm db:stop
```

Per puntare l'app al locale, in `.env.local` usare i valori stampati da `pnpm exec supabase status` (`API URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
