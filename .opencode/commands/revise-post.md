---
description: Revisiona un articolo esistente con il profilo autoriale attivo in memoria.
subagent: false
---

# /revise-post

Richiesta dell'utente (dati del compito):

$ARGUMENTS

## Preparazione obbligatoria in memoria

Questo comando revisiona un singolo file Markdown esistente in `_drafts/` o nelle sottocartelle di `_posts/`. Non crea nuovi articoli e non invoca Rake. Se il percorso è ambiguo, chiedi conferma all'utente. Non delegare la scrittura ai subagenti.

Prima di modificare il testo chiama **`author_post_revision_prepare`**:
- `target_path`: percorso relativo del file richiesto (`_drafts/<slug>.md` o `_posts/<categoria>/<data>-<slug>.md`).
- `request`: richiesta originale dell'utente.
- `task`: oggetto `TaskContext` con `mode` impostato a `rewrite` (o `expand` per un ampliamento), `content_type`, `language`, `objective` e le sole `features` pertinenti al compito.

Il tool compila il profilo autoriale in memoria e attiva gli hook di sessione senza creare file temporanei, snapshot o ricevute su disco. Se il tool fallisce o non è disponibile, fermati senza modificare l'articolo.

## Revisione e chiusura

1. Conserva `runtime_id` e `instructions_sha256` restituiti da `author_post_revision_prepare`.
2. Modifica esclusivamente `target_path` seguendo le istruzioni autoriali iniettate nella sessione e preservando il lavoro già presente nel file.
3. Per una revisione stilistica o di voce, mantieni invariati codice, formule, ID, immagini, link e fatti verificati, salvo richiesta esplicita diversa.
4. Quando le modifiche sull'articolo sono complete, chiama **`author_post_finish`** con `outcome: written`. Se l'operazione viene annullata senza modifiche, chiama `author_post_finish` con `outcome: cancelled` (oppure usa `/cancel-post`).

## Risultato

Restituisci un riepilogo sintetico con il percorso del file, le modifiche principali effettuate, il `runtime_id` e l'hash `instructions_sha256`, senza eseguire commit, push o deploy automatici.
