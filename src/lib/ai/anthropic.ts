import Anthropic from "@anthropic-ai/sdk";

// Factory del client Anthropic (ADR-0003). Unico punto che legge la API key;
// solo lato server, mai da un componente.
export function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata");
  return new Anthropic({ apiKey });
}

// Modello unico per tutte le chiamate AI (eval RICE + scan duplicati).
export const AI_MODEL = "claude-opus-4-8";

// Esiti non-completi comuni a ogni chiamata: rifiuto e troncamento.
// `subject` entra nel messaggio ("la valutazione", "lo scan locale", …).
export function assertCompleted(response: Anthropic.Message, subject: string): void {
  if (response.stop_reason === "refusal") {
    throw new Error(`il modello ha rifiutato ${subject}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("risposta del modello troncata (max_tokens): riprova");
  }
}

// Variante per le chiamate a testo singolo (structured output): valida
// l'esito e ritorna il primo blocco di testo.
export function completedText(response: Anthropic.Message, subject: string): string {
  assertCompleted(response, subject);
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("risposta del modello senza contenuto");
  return text;
}
