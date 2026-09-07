import type { ProposalStatus } from "@/lib/proposals";

// Catalogo IT di tutte le stringhe user-facing (UI + errori delle Server
// Action). Una lingua futura = un nuovo catalogo che soddisfa StringCatalog:
// il compilatore segnala le chiavi mancanti. I prompt AI (src/lib/ai) sono
// istruzioni al modello, non copy utente, e restano fuori.

export const STRINGS = {
  app: {
    title: "Idea Collector",
    // wordmark in due parti: la prima in paprika
    brandAccent: "Idea",
    brandRest: "Collector",
    description:
      "Raccogli, discuti e prioritizza le idee del tuo team.",
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
    settings: "Impostazioni",
    logout: "Esci",
    backToBoard: "Torna alla board",
    backToProjects: "Progetti",
  },

  projects: {
    heading: "Progetti",
    intro: "La lista dei tuoi progetti. Per crearne uno, clicca su Nuovo Progetto",
    newProject: "Nuovo progetto",
    nameLabel: "Nome del progetto",
    nameRequired: "Il nome è obbligatorio.",
    nameTooLong: "Il nome è troppo lungo (max 80 caratteri).",
    connectRepo: "Collega subito una repo GitHub (si apre la pagina Impostazioni)",
    create: "Crea progetto",
    noneYet: "Nessun progetto ancora. Crea il primo: sarai amministratore.",
    proposalCount: (n: number) => (n === 1 ? "1 proposta" : `${n} proposte`),
    noRepo: "nessuna repository collegata a questo progetto",
    settingsHeading: "Impostazioni progetto",
    rename: {
      heading: "Nome del progetto",
      intro: "Cambia il nome mostrato.",
      adminOnly: "Solo un admin del progetto può rinominarlo.",
    },
    delete: {
      heading: "Elimina progetto",
      intro: "Cancella il progetto con tutte le sue proposte.",
      button: "Elimina progetto",
      confirmBody:
        "Il progetto e tutte le sue proposte verranno eliminati definitivamente. L’operazione è irreversibile.",
      confirm: "Elimina definitivamente",
      adminOnly: "Solo un admin del progetto può eliminarlo.",
      failed: "Eliminazione non riuscita. Riprova.",
    },
    deleteConfirmHeading: (name: string) => `Eliminare “${name}”?`,
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
    email: {
      heading: "Email",
      intro:
        "Per cambiarla riceverai un link di conferma sia sulla casella nuova sia su quella attuale: vanno cliccati entrambi.",
      label: "Email",
      submit: "Cambia email",
      same: "È già la tua email.",
      sent: (email: string) =>
        `Link inviati a ${email} e alla casella attuale. Il cambio è effettivo quando li hai confermati entrambi.`,
      failed: "Invio non riuscito. Riprova.",
    },
    delete: {
      heading: "Elimina account",
      intro:
        "Esci da tutti i progetti; quelli in cui sei l’unico membro vengono eliminati con le loro proposte. Quello che hai scritto altrove resta, senza il tuo nome.",
      button: "Elimina account",
      confirmHeading: "Eliminare il tuo account?",
      confirmBody: "L’operazione è irreversibile. Per rientrare servirà un nuovo invito.",
      confirm: "Elimina definitivamente",
      failed: "Eliminazione non riuscita. Riprova.",
    },
    deleteSoleAdmin: (projects: string) =>
      `Sei l’unico admin di ${projects} e ci sono altri membri: nomina un altro admin o elimina il progetto, poi riprova.`,
  },

  members: {
    heading: "Membri",
    intro:
      "Chi può accedere a questo progetto. Gli invitati ricevono un'email con il link di accesso.",
    inviteEmailLabel: "Invita tramite email",
    inviteAsAdmin: "Admin",
    invite: "Invita",
    invited: (email: string) => `Invito inviato a ${email}.`,
    added: (email: string) => `${email} aggiunto al progetto.`,
    roleLabel: (email: string) => `Ruolo di ${email}`,
    remove: "Rimuovi",
    removeAria: (email: string) => `Rimuovi ${email}`,
    confirmRemove: "Conferma",
    you: "tu",
    adminOnly: "Solo un admin del progetto può gestire i membri.",
    invalidEmail: "Email non valida.",
    invalidRole: "Ruolo non valido.",
    inviteFailed: "Invito non riuscito. Riprova.",
    alreadyMember: "È già membro del progetto.",
    ownRole: "Non puoi cambiare il tuo stesso ruolo.",
    removeSelf: "Non puoi rimuovere te stesso.",
    removeFailed: "Operazione non riuscita. Riprova.",
    role: { admin: "Admin", contributor: "Contributor" },
  },

  github: {
    heading: "Repository progetto",
    intro:
      "La valutazione AI confronta le proposte con il contesto di questa repository (accesso in sola lettura via GitHub App).",
    connect: "Connetti GitHub",
    repoSelectLabel: "Repo del progetto",
    repoPlaceholder: "— scegli una repo —",
    saveRepo: "Salva repo",
    // prefisso: il nome repo segue in markup proprio (<span> evidenziato).
    connectedRepoPrefix: "Repo collegata: ",
    disconnect: "Scollega GitHub",
    adminOnly: "Solo un admin del progetto può configurare GitHub.",
    appNotConfigured: "GitHub App non configurata (manca GITHUB_APP_SLUG).",
    noInstallation: "Nessuna autorizzazione GitHub attiva. Connetti GitHub prima.",
    repoNotAllowed: "Repo non coperta dall'autorizzazione GitHub.",
    reposLoadFailed: "Impossibile leggere le repo da GitHub. Riprova o riconnetti.",
    connectFailed: "Connessione GitHub non riuscita. Riprova.",
    notConnected: "Collega GitHub e scegli la repo nelle impostazioni del progetto.",
  },

  board: {
    heading: "Board",
    newProposal: "Nuova proposta",
    noneMatchFilters: "Nessuna proposta corrisponde ai filtri.",
    noneYetCreate: "Nessuna proposta ancora. Crea la prima.",
    noneYet: "Nessuna proposta ancora.",
    invalidStatus: "Stato non valido.",
    movedByOther:
      "La proposta è stata spostata da qualcun altro. Ricarica la pagina.",
    dupBlocked:
      "Possibile duplicato: modifica l'idea per differenziarla, oppure spostala in Rifiutata o eliminala.",
  },

  filters: {
    searchPlaceholder: "Cerca per titolo o descrizione…",
    clearSearch: "Cancella ricerca",
    allStatuses: "Tutti gli stati",
    statusLabel: "Filtra per stato (più stati insieme)",
    submit: "Cerca",
    reset: "Reset",
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
    linksLabel: "Link (uno per riga)",
    create: "Crea proposta",
    titleRequired: "Il titolo è obbligatorio.",
    textTooLong: "Testo troppo lungo (max 20.000 caratteri per campo).",
    editAuth: "Solo l'autore o un admin può modificare la proposta.",
    gitRef: {
      heading: "Branch / PR",
      edit: "Modifica branch / PR",
      label: "Branch o numero PR",
      placeholder: "feature/nome-branch oppure 42",
      hint: "Riferimento sulla repo collegata. Lascia vuoto per rimuoverlo.",
      invalid: "Riferimento non valido: niente spazi, max 200 caratteri.",
      auth: "Solo l'autore o un admin può collegare branch o PR.",
    },
    taskUrl: {
      heading: "Task ClickUp",
      edit: "Modifica task ClickUp",
      label: "Link al task",
      placeholder: "https://app.clickup.com/t/…",
      hint: "Incolla l'URL del task ClickUp. Lascia vuoto per rimuoverlo.",
      invalid: "Link non valido: serve un URL https di app.clickup.com.",
      auth: "Solo l'autore o un admin può collegare un task.",
    },
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
    deleteOnlyOwn: "Puoi eliminare solo i tuoi commenti (o essere admin).",
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
    cueInProgress: "Valutazione AI in corso",
    cueFailed: "Valutazione AI fallita",
    cueCompleted: "Valutazione AI completata",
    retryEval: "Rilancia la valutazione AI",
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
    // precede il «titolo» linkato nella frase "Possibile duplicato (N% simile a «…» di …)".
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
    dupWarning: "Possibile duplicato",
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
    legend: "1 = minimo · 10 = massimo. Puoi aggiornare il tuo voto in seguito.",
    submit: "Invia voto",
    update: "Aggiorna voto",
    // #9d: avviso quando si vota una card non «In Valutazione»
    warnNotInEval: "Sei sicuro di voler votare? La proposta non è «In Valutazione».",
    invalid: "Assegna un valore da 1 a 10 a ogni parametro.",
    // #9c: voto consentito ovunque tranne che in «Nuova»
    notWhileNew: "Non puoi votare una proposta in «Nuova».",
    ownProposal: "Non puoi votare la tua stessa proposta.",
    contributorCoAuthor: "Come contributore accettato sei co-autore: non puoi votare.",
  },
} as const;

// Contratto per i cataloghi delle lingue future.
export type StringCatalog = typeof STRINGS;
