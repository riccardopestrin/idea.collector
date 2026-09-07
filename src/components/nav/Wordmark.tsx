import { STRINGS } from "@/lib/strings";
import { displayClass } from "@/lib/tokens";

// Wordmark testuale "Idea Collector" (Idea in paprika). Il logo grafico arriverà
// in seguito; il favicon in app/icon.svg resta la bozza attuale.
export function Wordmark({ className = "text-sm" }: { className?: string }) {
  return (
    <span className={`${displayClass} tracking-tight ${className}`}>
      <span className="text-paprika">{STRINGS.app.brandAccent}</span> {STRINGS.app.brandRest}
    </span>
  );
}
