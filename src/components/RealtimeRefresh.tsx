"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

// Tabelle le cui modifiche devono riflettersi live. La RLS (che Realtime
// rispetta) limita gli eventi alle righe leggibili da chi ascolta: un utente
// riceve solo i cambiamenti dei propri progetti.
const REALTIME_TABLES = [
  "proposals",
  "status_history",
  "comments",
  "rice_votes",
  "projects",
  "project_members",
] as const;

// Aggiornamento sincrono cross-utente (#3): sottoscrive i cambiamenti Postgres e
// fa refresh dell'albero RSC corrente. Debounce per accorpare i burst (un move =
// update proposta + insert history = 2 eventi → 1 refresh). Montato una volta nel
// root layout: copre board, dettaglio, lista progetti, classifica, impostazioni.
export function RealtimeRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase.channel("app-db-changes");
    for (const table of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    // Il join deve già portare il JWT utente: supabase-js lo risolve in modo asincrono
    // e se il socket apre prima, il canale entra come `anon` e la RLS gli nega ogni
    // evento in silenzio (Subscribed ok, zero messaggi) finché non scade il token.
    void supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      await supabase.realtime.setAuth(token);
      if (!cancelled) channel.subscribe();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
