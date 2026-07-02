// Campo di form etichettato (input o textarea), uncontrolled: il valore lo legge
// la Server Action dal FormData. Stile condiviso da tutti i form.
type FieldProps = {
  label: string;
  name: string;
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
};

// Stile base condiviso dei controlli form (input/select/bottoni secondari) — vedi dry-beyond-sx.md.
export const controlClass = "rounded-md border border-border px-3 py-2";

export function Field({ label, name, required, multiline, defaultValue }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={name}>
      {label}
      {multiline ? (
        <textarea id={name} name={name} required={required} rows={3} defaultValue={defaultValue} className={controlClass} />
      ) : (
        <input id={name} name={name} type="text" required={required} defaultValue={defaultValue} className={controlClass} />
      )}
    </label>
  );
}
