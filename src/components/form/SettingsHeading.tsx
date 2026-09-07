import { displayClass } from "@/lib/tokens";

// Titolo + intro di una sezione impostazioni (settingsSectionClass).
export function SettingsHeading({ heading, intro }: { heading: string; intro: string }) {
  return (
    <>
      <h2 className={`${displayClass} text-2xl`}>{heading}</h2>
      <p className="text-sm text-foreground/60">{intro}</p>
    </>
  );
}
