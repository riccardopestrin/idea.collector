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
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase.channel("app-db-changes");
    for (const table of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
