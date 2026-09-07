import { controlClass, labelClass } from "@/lib/tokens";

// Campo di form etichettato (input o textarea), uncontrolled: il valore lo legge
// la Server Action dal FormData. Stile condiviso da tutti i form.
type FieldProps = {
  label: string;
  name: string;
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
};

export function Field({ label, name, required, multiline, defaultValue }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={name}>
      <span className={labelClass}>{label}</span>
      {multiline ? (
        <textarea id={name} name={name} required={required} rows={3} defaultValue={defaultValue} className={controlClass} />
      ) : (
        <input id={name} name={name} type="text" required={required} defaultValue={defaultValue} className={controlClass} />
      )}
    </label>
  );
}
