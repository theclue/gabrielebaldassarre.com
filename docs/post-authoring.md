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
Richiede **OpenCode 2.0.29 o successivo**: prima di quella versione il contesto
dei plugin Promise non espone `permission.assert`. Il SDK è fissato alla
**2.0.31** nel package e nel lockfile Bun. Aggiornare il solo SDK non aggiunge
questa capacità a un processo host precedente.

Se l'API manca o non è una funzione, la preparazione si ferma con
`AUTHOR_POST_HOST_UNSUPPORTED`, prima della compilazione del runtime e di
qualsiasi scrittura. Non emula le regole dei permessi e non salta i controlli;
il plugin resta caricato e `/cancel-post` rimane disponibile. Dopo aver
aggiornato OpenCode occorre **riavviare il server**, non soltanto ricaricare
configurazione o plugin. Con il servizio in background, terminare prima le
operazioni attive e usare `opencode service restart`.

Se le dipendenze Node mancano, l'operatore può eseguire dalla root:

```sh
bun install --cwd _scripts/author-extraction --frozen-lockfile
```

Il caricamento usa le API V2 e il SDK già fissato nel lockfile. Se un processo
OpenCode già aperto non rileva il nuovo plugin, riaprire la sessione/progetto;
non è necessario reimpostare provider o modello. I comandi Markdown vengono
ricaricati da OpenCode. Il nome è **`/create-post`**, dal nome del file, non
`/create_post` del vecchio titolo del documento.

La creazione usa **`/create-post`**; la revisione di un Markdown esistente usa ora
il flusso separato **`/revise-post`** descritto sotto. `/create-rmd` e pubblicazione
di bozze non sono integrati: non dichiararne l'iniezione automatica.

## Revisioni con runtime continuo e confronto editoriale

```text
/revise-post _drafts/batterie-home-assistant-ricarica-stimata.md Rivedi la voce preservando il tutorial e il codice verificato. Confronta apertura, motivazioni, raccordi tecnici e gestione dei limiti con tutorial pertinenti del corpus approvato.
```

L'agente legge il file attuale e sceglie da `docs/corpus.yaml` due-quattro
riferimenti approvati, con citazioni letterali e motivazione della comparabilità.
Non vengono applicati nuovi tratti al modello governato: è un confronto
contestuale, non una promozione di pattern. Il significato e la pertinenza delle
citazioni rimangono giudizi editoriali, non risultati del controllo di substring.

Il flusso usa tre tool aggiuntivi del medesimo plugin:

1. **`author_post_revision_prepare`** riceve percorso, richiesta, task
   `rewrite`/`expand` e riferimenti. Prima di scrivere evidenze richiede il
   permesso host `edit`; non richiede `shell`, non esegue Rake e non tocca
   l'articolo. Compila un runtime per il nuovo compito, conserva i byte iniziali
   e vincola gli estratti alle versioni delle fonti approvate.
2. **`author_post_editorial_prepare`** restituisce l'hash attuale del testo e lo
   schema del confronto, senza scrivere file o valutare la prosa.
3. **`author_post_editorial_submit`** salva un report candidato con quattro
   aspetti: `opening`, `decision`, `technical_transition`, `limitation`. Ogni
   aspetto applicabile contiene una citazione del corpo attuale, una citazione
   di riferimento selezionata per quell'aspetto e un giudizio motivato. Un aspetto
   non pertinente può essere `not_applicable`, con ragione esplicita; non si
   richiedono quattro dispositivi retorici nel testo.

Snapshot, richiesta, ricevuta e report sono create-only sotto
`.opencode/authoring-revisions/<request-sha256>/<run-id>/`, **non** dentro `docs/`:
la copia di una bozza non va trasformata in una pagina pubblicabile da Jekyll.
Il runtime rimane nei percorsi hash-addressed esistenti. La preparazione ricontrolla
articolo e fonti dopo la richiesta di permesso; modifiche concorrenti prima
dell'attivazione fanno fallire il tentativo senza sovrascrivere l'articolo.
Durante l'editing il file rimane modificabile, ma il report deve corrispondere
agli ultimi byte. Non è un lock globale sulle modifiche di altri editor.

Gli hook iniettano sia il runtime verificato sia il contesto di confronto,
sempre nella stessa sessione e anche dopo reload/compattazione. L'attivazione
resta aperta durante scrittura, valutazione e correzioni. La chiusura con
`author_post_finish(written)` richiede testo modificato, hook osservato e un
report corrente senza aspetti ancora `needs_revision`. Un report interamente
`not_applicable` non basta. Qualsiasi modifica successiva al testo richiede un
nuovo report. Annullamento e `/cancel-post` non eliminano snapshot o modifiche.

**Accettato non significa autorialmente corretto.** Il core verifica schema,
versioni, hash e appartenenza letterale delle citazioni, non se un passaggio
suoni davvero come l'autore. Il report resta `candidate_pending_human`, con
`human_approval: false`, anche quando il verdetto candidato è
`ready_for_human_review`. La riconoscibilità va sottoposta all'utente. Non ci sono
score di somiglianza, quote di prima persona o inserimenti obbligatori di tic.

La creazione conserva il suo contratto create-only preesistente: il suo
`written` **non** attesta questo confronto. Se serve una revisione editoriale
successiva, anche nella stessa chat, avviare `/revise-post`; non affidarsi alle
istruzioni rimaste nella cronologia dopo la chiusura del primo runtime.

## Verifiche

```sh
npm --prefix _scripts/author-extraction run test:post-authoring
npm --prefix _scripts/author-extraction run test:integration
npm --prefix _scripts/author-extraction run test:post-revision
```

I test usano Rake reale solo in directory temporanee, controllano gate, titoli
con punteggiatura, sovrascritture, tampering, permessi, attivazione per sessione,
reload e annullamento. Verificano anche che un host senza `permission.assert`
fallisca senza scrivere file, lasciando disponibile l'annullamento. Un test VM
carica l'entrypoint effettivo con il SDK V2; un altro attraversa l'adapter Promise
del SDK installato e verifica l'inoltro dei dati e degli errori di autorizzazione
a un host simulato, senza definire manualmente l'API Promise sotto test.
Non generano articoli nel repository e non chiamano provider: un test end-to-end
live della generazione resta distinto da queste verifiche offline.

I test della revisione lavorano esclusivamente in directory temporanee e senza
Rakefile: controllano snapshot, fonti/citazioni, assenza di sovrascritture,
permessi, cancellazione, persistenza della sessione su reload, report obsoleti e
la distinzione fra report candidato e approvazione umana. Non misurano la qualità
autoriale di un testo e non generano articoli come test del plugin.
