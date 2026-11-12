# Scrittura e revisione degli articoli con il runtime autoriale

## Creazione di un nuovo articolo (`/create-post`)

Dalla radice del repository, in una sessione OpenCode:

```text
/create-post una bozza tutorial su come modellare una matita parametrica in OpenSCAD, per principianti, con corpo esagonale, punta in legno e mina.
```

Se non specifichi la destinazione, il comando crea una bozza in `_drafts/<slug>.md`. Il task Rake non inserisce un percorso `master:` fittizio finché l'immagine non esiste su disco: in questo modo la validazione CI non si blocca e `/annotate-post` può proporre automaticamente una copertina da Unsplash se non ne hai già aggiunta una in `assets/images/posts/`.

### Come funziona in memoria

1. `/create-post` traduce la richiesta nei metadati dell'articolo e in un brief strutturato (`TaskContext`).
2. `author_post_prepare` compila il profilo autoriale direttamente in memoria a partire da `docs/author-pattern-results/v1.3/author-model.json`, verifica i permessi host sul file di destinazione ed esegue il task Rake `draft` o `post`. Non vengono creati file intermedi in `docs/` o `.opencode/`.
3. Gli hook `context` e `generate` della sessione iniettano automaticamente le istruzioni autoriali compilate ad ogni turno del modello.
4. Terminata la stesura, `author_post_finish` (`outcome: "written"`) verifica che il corpo dell'articolo sia stato scritto e disattiva l'iniezione per la sessione.

Per interrompere in qualsiasi momento l'iniezione del runtime senza toccare i file:

```text
/cancel-post
```

## Revisione di un articolo esistente (`/revise-post`)

Per modificare o ampliare una bozza o un post già esistente mantenendo attivo il profilo autoriale:

```text
/revise-post _drafts/batterie-home-assistant-ricarica-stimata.md Rivedi l'apertura e chiarisci i limiti dell'approssimazione lineare.
```

1. `author_post_revision_prepare` verifica il file esistente, compila il runtime per il compito (`rewrite` o `expand`) e attiva gli hook di sessione in memoria, senza creare copie temporanee né richiedere report JSON intermedi.
2. L'agente applica le modifiche richieste direttamente sul file.
3. `author_post_finish` (`outcome: "written"`) verifica che il corpo sia stato effettivamente aggiornato e chiude il runtime della sessione.

## Test del plugin

```sh
npm --prefix _scripts/author-extraction test
npm --prefix _scripts/author-extraction run test:integration
```
