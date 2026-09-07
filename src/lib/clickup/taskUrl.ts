// task_url di una proposta (migration 0026): URL di un task ClickUp incollato
// dall'utente. Vuoto → null (cancella); undefined se invalido. Solo https su
// app.clickup.com: è un link che gli altri membri cliccano fidandosi
// dell'etichetta "Task ClickUp".
export function parseTaskUrl(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  // stessa regex del check a DB (0026): host ancorato seguito da "/" esclude
  // suffissi (app.clickup.com.evil) e userinfo (u@app.clickup.com)
  if (value.length > 500 || !/^https:\/\/app\.clickup\.com\//.test(value)) return undefined;
  return value;
}
