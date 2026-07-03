import Anthropic from "@anthropic-ai/sdk";

// Factory del client Anthropic (ADR-0003). Unico punto che legge la API key;
// solo lato server, mai da un componente.
export function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata");
  return new Anthropic({ apiKey });
}
