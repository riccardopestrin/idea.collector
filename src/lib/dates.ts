// Formattazione date user-facing. timeZone ancorata a Europe/Rome: senza,
// i Server Component la formatterebbero nel fuso del server (UTC su Vercel) e i
// Client Component in quello del browser — stessa data mostrata con orari
// diversi. Un solo formatter condiviso (pannello proposta + commenti).
const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
