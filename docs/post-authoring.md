# Scrivere nuovi articoli con il runtime autoriale

## Uso normale

Dalla root del repository, in una nuova sessione OpenCode:

```text
/create-post una bozza tutorial su come modellare una matita parametrica in OpenSCAD, per principianti, con corpo esagonale, punta in legno e mina. Includi il codice completo e spiega i parametri.
```

Oppure:

```text
/create-post un articolo divulgativo nella categoria Fisica sul significato dell'elettronvolt, con un esempio numerico illustrativo. Non in bozza.
```

Non occorre conoscere Step 5, i profili C01/C02, i nomi degli script o gli hash.
Il comando locale porta con sé le istruzioni necessarie, anche senza la memoria
di questa conversazione. Non sceglie un altro modello/provider: resta quello
attivo nella sessione. Non avvia subagenti.

Se non specifichi la destinazione, il comando sceglie **bozza**. Il percorso
restituito da Rake è `_drafts/<slug>.md` oppure
`_posts/<categoria>/<data>-<slug>.md`. Creare un file in `_posts` non esegue
commit, push, build, deploy o broadcast. Le bozze esistenti non vengono
sovrascritte o pubblicate da questo flusso.

Per abbandonare il compito, anche se il runtime è diventato invalido:

```text
/cancel-post
```

È un comando del plugin senza chiamata al modello: termina l'iniezione della
sessione, lasciando intatti template, eventuale contenuto ed evidenze. Se una
preparazione è ancora in corso, interrompila prima con i normali controlli
OpenCode. Non basta cambiare argomento per terminare un'attivazione interrotta.

## Che cosa succede

1. `/create-post` interpreta la richiesta in metadati e un brief strutturato.
   Chiede chiarimento solo per ambiguità rilevanti; la categoria non determina
   automaticamente il genere del testo.
2. `author_post_prepare` valida il brief e compila un **nuovo runtime per quel
   compito** dal modello governato. Verifica le autorizzazioni host di modifica
   e di esecuzione Rake, senza aggirare le normali richieste di permesso.
3. Materializza profilo, istruzioni e manifest con la politica create-only, poi
   controlla che gli artefatti coincidano con la compilazione. Solo allora
   chiama il task Rake `post` o `draft`, senza shell e senza sovrascritture.
4. Attiva il runtime per l'ID di quella sessione. Gli hook V2 `context` e
   `generate` ricontrollano l'integrità e inseriscono **l'intero Markdown
   operativo** nelle istruzioni di sistema delle richieste successive.
5. L'agente riempie esclusivamente il nuovo file, con le convenzioni editoriali
   del comando. `author_post_finish` termina l'iniezione; `written` richiede
   almeno un'applicazione dell'hook e un corpo non vuoto, non il solo template.

Il comando non fa scegliere all'utente una lista di dispositivi. Un dispositivo
`required` richiede comunque una richiesta esplicita nel brief: essere un
tutorial non rende obbligatori né calcoli, né analogie, né anticipazioni.
Per esempio la matita OpenSCAD usa il percorso tutorial C02, senza ereditare
obblighi dall'esempio eV. Non vengono creati asset CAD o download implicitamente.

## Garanzie e confini

- **Gate del tool:** nessun template viene creato tramite `author_post_prepare`
  se compilazione, verifica o autorizzazione falliscono. In caso di errore Rake
  o interruzione possono restare evidenze o un template appena creato: vengono
  segnalati, mai rimossi o riscritti automaticamente. Una nuova preparazione su
  un percorso esistente fallisce, anche se è un template di un tentativo interrotto.
- **Caricamento automatico:** con plugin attivo e preparazione riuscita, gli hook
  inseriscono le istruzioni nel contesto assemblato dall'host. Non dipendono da
  una promessa dell'agente di leggere un file; restano attivi dopo compattazione
  e reload, fino a fine o annullamento del compito.
- **Isolamento:** l'attivazione non è globale, non si propaga a subagenti e non
  vale in un altro checkout o directory. Eseguire il comando dalla root. Gli hook
  non modificano modello/provider, parametri di generazione o altri tool.
- **Fail closed:** se artefatti, task o modello cambiano, la successiva richiesta
  di scrittura fallisce prima dell'iniezione. `/cancel-post` resta disponibile
  senza modello per sbloccare la sessione.
- **Non è una prova di obbedienza:** hash e conteggio degli hook provano la
  preparazione e l'applicazione al contesto dell'host, non ricezione byte-per-byte
  dal provider, attenzione del modello o conformità della prosa. Altri plugin
  possono intervenire dopo questo hook. Fatti, codice e stile vanno revisionati.
- **Non è una sandbox editoriale globale:** un agente con accesso generico a
  shell/edit può tecnicamente ignorare il comando. Il template gli vieta quel
  fallback, ma il plugin non revoca tutti i suoi strumenti e non pretende di
  governare le modifiche fatte fuori da questo flusso.

Una sessione senza plugin non deve aggirare il gate: il comando si ferma e
segnala `author_post_prepare` non disponibile. Nessun fallback implicito verso
Paseo, provider diversi o un profilo scientifico precompilato.

## Artefatti e manutenzione

- `.opencode/commands/create-post.md`: interfaccia in linguaggio naturale.
- `.opencode/plugins/post-authoring.js`: entrypoint auto-scoperto OpenCode V2.
- `_scripts/author-extraction/post-authoring.mjs`: gate runtime/Rake e ricevuta.
- `_scripts/author-extraction/post-authoring-plugin.mjs`: tool, hook e lifecycle.
- `docs/authoring-runs/<request-sha256>/`: richiesta originale/normalizzata,
  `task.json` e `preparation.json` immutabili; quest'ultimo collega il percorso
  del nuovo testo, hash del template iniziale, runtime, manifest e istruzioni.
- `docs/author-pattern-results/v1.3/author-runtimes/`: runtime hash-addressed
  già descritto in [author-runtime.md](author-runtime.md).

Il conteggio degli hook è nella storage della sessione e nel risultato del tool
di fine lavoro, non è un'attestazione aggiunta al modello autoriale. La ricevuta
iniziale non certifica il contenuto finale né costituisce un'approvazione umana.
La storage del plugin conserva l'attivazione attraverso i reload; dopo una fine
normale o `/cancel-post` non viene più iniettata.

Il plugin usa le dipendenze già presenti nel package `_scripts/author-extraction`
e il comando `rake` nell'ambiente host. Non installa Ruby, gem o provider.
Se le dipendenze Node mancano, l'operatore può eseguire dalla root:

```sh
npm --prefix _scripts/author-extraction ci
```

Il caricamento usa le API V2 e il SDK già fissato nel lockfile. Se un processo
OpenCode già aperto non rileva il nuovo plugin, riaprire la sessione/progetto;
non è necessario reimpostare provider o modello. I comandi Markdown vengono
ricaricati da OpenCode. Il nome è **`/create-post`**, dal nome del file, non
`/create_post` del vecchio titolo del documento.

Questa prima integrazione copre **nuovi file Markdown**. `/create-rmd`, revisioni
di articoli esistenti e pubblicazione di bozze rimangono flussi separati: non
dichiararne l'iniezione automatica senza integrarli esplicitamente.

## Verifiche

```sh
npm --prefix _scripts/author-extraction run test:post-authoring
npm --prefix _scripts/author-extraction run test:integration
```

I test usano Rake reale solo in directory temporanee, controllano gate, titoli
con punteggiatura, sovrascritture, tampering, permessi, attivazione per sessione,
reload e annullamento. Un test VM carica l'entrypoint effettivo con il SDK V2.
Non generano articoli nel repository e non chiamano provider: un test end-to-end
live della generazione resta distinto da queste verifiche offline.
