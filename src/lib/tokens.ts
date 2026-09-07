// Token condivisi (regola dry-beyond-sx): mai dimensioni o class string inline.
// Attenzione: Tailwind risolve i conflitti per ordine di emissione del CSS, non per
// ordine nel className. Non appendere a un token una utility che tocca la stessa
// proprietà: aggiungi qui una variante esplicita.
export const BOARD_COLUMN_WIDTH = "w-80";
export const BOARD_GAP = "gap-4";

// Controlli form (input / select / textarea).
export const controlClass = "border border-ink bg-paper px-3 py-2 text-sm";

const buttonBase = "border font-mono uppercase tracking-wider disabled:opacity-50";
const secondaryButton = `${buttonBase} border-ink bg-paper hover:bg-ink hover:text-paper`;
// Bottone secondario: outline che si inverte al hover.
export const buttonClass = `${secondaryButton} px-4 py-2 text-xs`;
// Variante compatta (rilancio AI sulla card).
export const smallButtonClass = `${secondaryButton} px-2 py-1 text-[10px]`;
// Bottone primario: pieno, vira al paprika al hover.
export const primaryButtonClass = `${buttonBase} border-ink bg-ink px-4 py-2 text-xs text-paper hover:border-paprika hover:bg-paprika`;
// Bottone distruttivo: paprika, vira al nero al hover (inverso del primario).
export const dangerButtonClass = `${buttonBase} border-paprika bg-paprika px-4 py-2 text-xs text-paper hover:border-ink hover:bg-ink`;

const linkBase = "underline decoration-1 underline-offset-4 disabled:opacity-50";
// Azioni testuali (modifica / annulla…) e link secondari.
export const linkClass = `${linkBase} hover:text-paprika`;
// Azioni testuali distruttive (elimina / conferma / rimuovi): paprika, nero al hover.
export const dangerLinkClass = `${linkBase} text-danger hover:text-ink`;

// Titoli in Archivo pesante: wordmark, nomi progetto, titolo proposta, intestazioni form.
export const displayClass = "font-display font-black uppercase leading-none";
// Titolo di pagina (Progetti, Board, Classifica…): peso medio, scelta dell'owner
// per alleggerire i titoli grandi rispetto al resto dei display.
export const pageTitleClass = "font-display font-medium text-4xl uppercase leading-none tracking-tight sm:text-6xl";
// Etichette di sezione e meta in mono maiuscolo (sul testo dell'etichetta, non
// sul <label>: i controlli figli erediterebbero mono/maiuscolo).
export const labelClass = "font-mono text-xs uppercase tracking-widest";
// Tag/badge quadrato (stato, ruolo, punteggio…); il colore lo aggiunge chi lo usa.
export const tagClass = "border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider";
// Card che si "solleva" al hover (ombra dura, niente blur).
export const liftClass = "lift hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard";
// Dialog di conferma (<dialog> nativo): scheda centrata su sfondo scurito.
export const confirmDialogClass = "m-auto w-full max-w-md border border-ink bg-paper p-6 text-ink shadow-hard-lg backdrop:bg-ink/60";
// Sezione delle pagine impostazioni/profilo (membri, GitHub, email, elimina…).
export const settingsSectionClass = "flex w-full max-w-lg flex-col gap-4 border-t border-ink pt-6";
