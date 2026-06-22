// Calcolo del punteggio di priorità. RICE = (Reach × Impact × Confidence) / Effort.
// ICE = Impact × Confidence × Ease (triage rapido, scala 1–10). Vedi spec §5.

export type Method = "rice" | "ice";

export type Criteria = {
  reach?: number | null;
  impact?: number | null;
  confidence?: number | null; // RICE: 0..1 · ICE: 1..10
  effort?: number | null; // RICE: persona-settimane · ICE: "ease" 1..10
};

// Ritorna null finché mancano i valori necessari o l'effort RICE è ≤ 0.
export function score(method: Method, c: Criteria): number | null {
  const { reach, impact, confidence, effort } = c;
  if (method === "ice") {
    if (impact == null || confidence == null || effort == null) return null;
    return impact * confidence * effort; // effort = ease
  }
  if (reach == null || impact == null || confidence == null || effort == null) return null;
  if (effort <= 0) return null;
  return (reach * impact * confidence) / effort;
}
