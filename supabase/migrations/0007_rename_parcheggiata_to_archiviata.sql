-- Rinomina lo stato 'parcheggiata' in 'archiviata' (dati esistenti migrati automaticamente).
alter type proposal_status rename value 'parcheggiata' to 'archiviata';
