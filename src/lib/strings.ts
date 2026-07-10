import type { ProposalStatus } from "@/lib/proposals";

// Catalogo IT di tutte le stringhe user-facing (UI + errori delle Server
// Action). Una lingua futura = un nuovo catalogo che soddisfa StringCatalog:
// il compilatore segnala le chiavi mancanti. I prompt AI (src/lib/ai) sono
// istruzioni al modello, non copy utente, e restano fuori.

export const STRINGS = {
  app: {
    title: "Proposte feature",
    description:
      "Dashboard interna per raccogliere e prioritizzare le proposte di feature.",
  },

  common: {
    save: "Salva",
    cancel: "Annulla",
    edit: "Modifica",
    delete: "Elimina",
    comment: "Commenta",
    close: "Chiudi",
  },

  errors: {
    sessionExpired: "Sessione scaduta. Rientra e riprova.",
    saveFailed: "Errore nel salvataggio. Riprova.",
    deleteFailed: "Errore nell'eliminazione. Riprova.",
    proposalNotFound: "Proposta non trovata.",
    commentNotFound: "Commento non trovato.",
  },

  status: {
    nuova: "Nuova",
    in_valutazione: "In Valutazione",
    approvata: "Approvata",
    in_sviluppo: "In Sviluppo",
    rilasciata: "Rilasciata",
    rifiutata: "Rifiutata",
    archiviata: "Archiviata",
  } satisfies Record<ProposalStatus, string>,

  nav: {
    board: "Board",
    ranking: "Classifica",
    logout: "Esci",
    backToBoard: "← Torna alla board",
  },

  login: {
    heading: "Accedi",
    emailLabel: "Email",
    submit: "Invia link di accesso",
    // messaggio in due parti attorno a <strong>{email}</strong>: una locale
    // deve fornire entrambe le metà.
    sentBeforeEmail: "Ti abbiamo inviato un link di accesso a ",
    sentAfterEmail: ". Controlla la posta e clicca per entrare.",
  },

  profile: {
    heading: "Profilo",
    onboardingHeading: "Come ti chiami?",
    nameLabel: "Nome",
    nameRequired: "Il nome è obbligatorio.",
    nameTooLong: "Il nome è troppo lungo (max 80 caratteri).",
  },

  github: {
    heading: "Repository progetto",
    intro:
      "La valutazione AI confronta le proposte con il contesto di questo repository (accesso in sola lettura via GitHub App).",
    connect: "Connetti GitHub",
    repoSelectLabel: "Repo del progetto",
    repoPlaceholder: "— scegli una repo —",
    saveRepo: "Salva repo",
    // prefisso: il nome repo segue in markup proprio (<span> evidenziato).
    connectedRepoPrefix: "Repo collegata: ",
    disconnect: "Scollega GitHub",
    adminOnly: "Solo un admin può configurare GitHub.",
    appNotConfigured: "GitHub App non configurata (manca GITHUB_APP_SLUG).",
    noInstallation: "Nessuna autorizzazione GitHub attiva. Connetti GitHub prima.",
    repoNotAllowed: "Repo non coperta dall'autorizzazione GitHub.",
    reposLoadFailed: "Impossibile leggere le repo da GitHub. Riprova o riconnetti.",
    connectFailed: "Connessione GitHub non riuscita. Riprova.",
    notConnected: "Collega GitHub e scegli la repo nel profilo.",
  },

  board: {
    heading: "Proposte",
    newProposal: "Nuova proposta",
    noneMatchFilters: "Nessuna proposta corrisponde ai filtri.",
    noneYetCreate: "Nessuna proposta ancora. Crea la prima.",
    noneYet: "Nessuna proposta ancora.",
    invalidStatus: "Stato non valido.",
    moveNotAllowed: "Spostamento non consentito.",
    movedByOther:
      "La proposta è stata spostata da qualcun altro. Ricarica la pagina.",
    dupBlocked:
      "Possibile duplicato: modifica l'idea per differenziarla, oppure spostala in Rifiutata o eliminala.",
  },

  filters: {
    searchPlaceholder: "Cerca per titolo o descrizione…",
    clearSearch: "Cancella ricerca",
    allStatuses: "Tutti gli stati",
    submit: "Filtra",
    reset: "Azzera",
  },

  card: {
    deleteAria: (title: string) => `Elimina ${title}`,
    byLine: (names: string) => `di ${names}`,
    dupBadge: "possibile duplicato",
    scoreTitle: "Voto RICE-10 · Claude + utenti",
  },

  deleteDialog: {
    heading: (title: string) => `Eliminare “${title}”?`,
    body: "L’eliminazione è definitiva e cancella anche la cronologia degli stati. In alternativa puoi spostarla in Rifiutata: resta consultabile.",
    moveToRejected: "Sposta in Rifiutata",
    confirm: "Elimina definitivamente",
  },

  proposal: {
    titleLabel: "Titolo",
    descriptionLabel: "Descrizione",
    problemLabel: "Problema / motivazione",
    linksLabel: "Link (uno per riga)",
    create: "Crea proposta",
    titleRequired: "Il titolo è obbligatorio.",
    textTooLong: "Testo troppo lungo (max 20.000 caratteri per campo).",
    editAuth: "Solo l'autore o un admin può modificare la proposta.",
    notEditable: "La proposta non è più modificabile.",
    deleteAuth: "Solo l'autore o un admin può eliminare la proposta.",
  },

  comments: {
    heading: "Commenti e osservazioni",
    empty: "Nessun commento ancora.",
    badgePending: "candidato contributo",
    badgeAccepted: "contributo",
    staleAnchor: "testo modificato",
    addLabel: "Aggiungi un commento",
    anchoredLabel: "Commenta la selezione",
    editLabel: "Modifica commento",
    confirmDelete: "Conferma eliminazione",
    propose: "Proponi come contributo",
    accept: "Accetta",
    reject: "Rifiuta",
    revoke: "Revoca partecipazione",
    emptyBody: "Il commento non può essere vuoto.",
    tooLong: "Commento troppo lungo (max 4000 caratteri).",
    closed: "La proposta non accetta più commenti.",
    anchorInvalid: "Ancora del commento non valida.",
    anchorStale:
      "Il testo selezionato non corrisponde più alla proposta. Ricarica la pagina.",
    editOnlyOwn: "Puoi modificare solo i tuoi commenti.",
    deleteOnlyOwn: "Puoi eliminare solo i tuoi commenti.",
    mutationsClosed: "La proposta non accetta più modifiche.",
    revokeBeforeDelete: "Revoca la partecipazione prima di eliminare il contributo.",
  },

  promotion: {
    stale: "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.",
    onlyOwn: "Puoi proporre solo i tuoi commenti.",
    ownProposal: "I tuoi commenti sulla tua proposta non sono promuovibili.",
    closed: "La proposta non accetta più promozioni.",
    decideAuth: "Solo il proposer o un admin decide sulla promozione.",
    revokeAuth: "Solo l'autore, il proposer o un admin può revocare il contributo.",
    contributionsClosed: "La proposta non accetta più modifiche ai contributi.",
  },

  evaluation: {
    adminOnly: "Solo un admin può lanciare la valutazione AI.",
    scanAuth: "Solo l'autore o un admin può lanciare lo scan duplicati.",
    startFailed: "Errore nell'avvio della valutazione. Riprova.",
    scanStartFailed: "Errore nell'avvio dello scan duplicati. Riprova.",
    failed: (message: string) => `Valutazione fallita: ${message}`,
    scanFailed: (message: string) => `Scan duplicati fallito: ${message}`,
    cueInProgress: "Valutazione AI in corso",
    cueFailed: "Valutazione AI fallita",
    cueCompleted: "Valutazione AI completata",
    retryEval: "Rilancia valutazione",
    retryScan: "Rilancia scansione",
  },

  panel: {
    contributions: "Contributi",
    totalVote: "Voto totale RICE-10",
    claudePlusUsers: "Claude + utenti",
    usersOnly: "utenti",
    outOf10: "su 10",
    perTen: "/ 10",
    byLine: (name: string) => `di ${name}`,
    withLine: (names: string) => `con ${names}`,
    // precede il «titolo» linkato nella frase "⚠️ Possibile duplicato (N% simile a «…» di …)".
    dupLinkIntro: "a",
    similar: (pct: number) => `${pct}% simile`,
    linksHeading: "Link",
    evalFailed: (error?: string | null) =>
      error ? `Valutazione AI fallita: ${error}` : "Valutazione AI fallita.",
    evalInProgress: "Valutazione AI in corso…",
    claudeVote: "Voto di Claude",
    userVotes: "Voti utenti",
    internalNotes: "Note interne",
    historyHeading: "Cronologia stati",
    historyEmpty: "Nessuno spostamento ancora.",
    scanHeading: "Scansione duplicati",
    dupWarning: "⚠️ Possibile duplicato",
    dupBlockedHint:
      "Non può uscire da «Nuova» finché non la modifichi per differenziarla, la sposti in Rifiutata o la elimini.",
    scanInProgress: "Scansione delle idee simili in corso…",
    scanFailed: (error?: string | null) =>
      error ? `Scansione fallita: ${error}` : "Scansione fallita.",
  },

  rice: {
    heading: "Il tuo voto RICE-10",
    factors: {
      reach: "Reach",
      impact: "Impact",
      confidence: "Confidence",
      effort: "Ease",
    },
    legend: "1 = minimo · 10 = massimo. Il voto è definitivo e non modificabile.",
    submit: "Invia voto",
    invalid: "Assegna un valore da 1 a 10 a ogni parametro.",
    onlyInEvaluation: "Puoi votare solo le proposte in valutazione.",
    ownProposal: "Non puoi votare la tua stessa proposta.",
    contributorCoAuthor: "Come contributore accettato sei co-autore: non puoi votare.",
    alreadyVoted: "Hai già votato questa proposta.",
  },
} as const;

// Contratto per i cataloghi delle lingue future.
export type StringCatalog = typeof STRINGS;
