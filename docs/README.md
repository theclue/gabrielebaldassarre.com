# Author modeling — guida rapida

Comandi shell **dalla root del repository**, con le dipendenze del package
`_scripts/author-extraction` già disponibili. I prompt si rivolgono al principale in OpenCode.

```text
corpus approvato
  → 1. estrazione per articolo
  → 2. consolidamento per dimensione
  → 3. review umana e rilascio dei pattern
  → 4. composizione di author-model.json
  → 5. profilo runtime e istruzioni per uno specifico testo
```

**Stato attuale:** corpus A01–A20, 52 gruppi revisionati, 29 pattern autoriali
approvati e 3 gruppi semantici mantenuti. Il modello governato è
[`author-model.json`](author-pattern-results/v1.3/author-model.json), composto in
6 principi. Gli artefatti approvati v1.3 non si sovrascrivono per rilanciarli.

## Quale step mi serve?

**Per l'uso quotidiano in OpenCode**, senza preparare JSON o comandi shell:

```text
/create-post una bozza tutorial su come modellare una matita parametrica in OpenSCAD, per principianti
```

Il comando prepara/verifica il runtime, crea il template con Rake e attiva
l'iniezione automatica delle istruzioni durante la scrittura. Dettagli, limiti e
annullamento: [scrittura governata dei nuovi post](post-authoring.md).

- **Voglio scrivere o revisionare un nuovo post:** solo **Step 5**.
- **Voglio ricomporre il modello dagli stessi pattern approvati:** **Step 4**,
  poi eventuale promozione del candidato e verifica del routing dello Step 5.
- **Voglio cambiare corpus, estrazioni o raggruppamenti:** nuovo ciclo
  **Step 1–5**, con versioni/destinazioni approvate e nuova review dei candidati.
- **Voglio solo verificare gli output attuali:** usa i comandi di controllo
  in fondo; non serve rieseguire inferenza.

## Step 1 — Estrarre un articolo

```text
Delega ad author-extractor una nuova estrazione del solo articolo A12.
Non avviare altri articoli, non usare fallback e non salvare o sovrascrivere file.
Restituisci il risultato nativo canonico e la sua provenienza.
```

Un articolo per sessione, fra A01–A20; per tutto il corpus autorizza 20 deleghe.
Il coordinatore salva il `canonical_json` accettato, con byte esatti e provenienza,
solo nella destinazione autorizzata. Non sostituirlo con un riepilogo o receipt manuali.

## Step 2 — Consolidare le osservazioni

```text
Delega ad author-pattern-consolidator il consolidamento della sola dimensione rhetorical.
Non rieseguire estrazioni, non riprovare dopo un rifiuto e non sovrascrivere file.
Riporta il risultato canonico accettato e la sua provenienza.
```

Ripeti per `epistemic`, `semantic` e `decisional`: una delega per dimensione.
`blocked` non va aggirato. Il coordinatore assembla i quattro risultati con
`finalizeConsolidation` offline: non esiste un tool nativo di finalizzazione.
Sono ancora candidati, non pattern approvati.

## Step 3 — Review umana

Chiedi una **review assistita della scheda candidata**, senza estrazioni o clustering:
candidato, evidenze e proposta completa, poi salvataggio delle sole decisioni
confermate. Una decisione per ogni gruppo, compresi i locali.

A review completa, valida e autorizza separatamente il suo **hash canonico**.
Il coordinatore può allora usare il core offline per salvare
`reviewed-author-patterns.json` e `reviewed-semantic-model.json`.
Il tool nativo `author_review_apply` resta bloccato: non aggirarlo. Non rigenerare
una scheda pending sopra quella completata.

## Step 4 — Ricomporre il modello operativo

```text
Usa il subagente author-model-compiler per rilanciare lo Step 4
dai pattern attualmente revisionati. Includi il contesto semantico facoltativo.
Non promuovere il candidato e non sovrascrivere il modello attuale.
```

Il subagente ricompone il modello senza riaprire la review. Salva un candidato in
`author-pattern-results/v1.3/author-model-candidates/` e restituisce percorsi e hash.
Per adottarlo occorre una tua autorizzazione esplicita al coordinatore, distinta
dal solo rilancio; non esiste una promozione automatica. Dopo una promozione,
verifica il routing runtime: lo Step 5 è vincolato all'hash del modello governato.

Per **verificare il modello attuale**, senza una nuova sintesi:

```sh
npm --prefix _scripts/author-extraction run check:author-model
```

`compile:author-model` usa invece la composizione fissa su disco e crea il modello
solo se assente: non è un sostituto del subagente e non sovrascrive l'esistente.

## Step 5 — Preparare il runtime per un post

Crea un brief JSON, per esempio `docs/mio-post.task.json`:

```json
{
  "mode": "generate",
  "content_type": "tutorial",
  "language": "it",
  "objective": "Spiegare una configurazione riutilizzabile e le sue alternative utili.",
  "features": ["configuration_choices", "external_dependencies"]
}
```

Poi compila e verifica:

```sh
npm --prefix _scripts/author-extraction run compile:author-runtime -- --task docs/mio-post.task.json
npm --prefix _scripts/author-extraction run check:author-runtime -- --task docs/mio-post.task.json
```

Tipi supportati: `scientific_explainer`, `project_article`, `tutorial`; per `mixed`
specifica `mixed_content_types`. Modi: `generate`, `rewrite`, `expand`, `review`.
Aggiungi segnali e contesto semantico solo se pertinenti: non vengono dedotti
dalle parole del brief. Un dispositivo `required` va richiesto esplicitamente;
tutte le clausole di guardrail attivate sono obbligatorie. Il compiler 1.1
proietta solo quelle pertinenti e registra le scelte nel manifest.

Il comando restituisce i percorsi di `author-runtime-profile.json`,
`author-runtime-instructions.md` e manifest in una directory dedicata sotto
`author-pattern-results/v1.3/author-runtimes/`. Passa **il profilo oppure le
istruzioni risolte**, con gli eventuali materiali del post, all'LLM di scrittura.
Il brief è già incluso: se cambia il compito, ricompila il runtime. Non occorre
passare il modello completo. La compilazione non genera né pubblica il post.

Per una prova già pronta puoi sostituire il brief con
`_scripts/author-extraction/fixtures/runtime-tasks/A08-scientific-units.json`.

## Rilanciare tutto il processo

Non esiste un comando unico che salti i passaggi umani. Puoi chiedere al principale:

```text
Voglio avviare un nuovo ciclo completo di author modeling.
Prima verifica corpus, contratti, permessi e destinazioni: proponi un piano
versionato senza modificare gli artefatti v1.3 e attendi il mio consenso.
Poi delega un articolo per sessione ad author-extractor e una dimensione
per sessione ad author-pattern-consolidator, preservando i risultati nativi.
Fermati alla review assistita e salva solo le mie decisioni esplicite.
A review completa mostrami l'hash e chiedi l'autorizzazione al rilascio.
Quindi usa author-model-compiler per produrre un candidato separato.
Mostrami l'hash del candidato e chiedi conferma prima di adottarlo.
Dopo l'eventuale adozione verifica il routing runtime sul nuovo modello
e prepara un profilo per il brief che fornirò.
Nessun fallback, sovrascrittura, commit o deploy implicito.
```

Per un nuovo ciclo occorre aggiornare e verificare i contratti/configurazioni:
i percorsi nativi sono vincolati alla pipeline v1.3. Non basta cambiare il numero
di versione, aggiungere file alle vecchie receipt o copiare le approvazioni.
I nuovi contratti usano ID con un solo `:`; quelli conservati restano legacy.

## Verifiche e approfondimenti

```sh
npm --prefix _scripts/author-extraction test
npm --prefix _scripts/author-extraction run test:integration
npm --prefix _scripts/author-extraction run check:author-model
```

I test non lanciano una nuova estrazione LLM e non sono una nuova approvazione
autoriale. Per il runtime, usa anche `check:author-runtime` con il relativo brief.

- [Step 1–3 e contratti](author-extraction.md)
- [Uso dei subagenti, salvataggio e limiti nativi](../_scripts/author-extraction/INTEGRATION.md)
- [Step 4: composizione e compiler subagent](author-model.md)
- [Step 5: schema del brief, selezione e runtime](author-runtime.md)
- [Convenzione degli ID e compatibilità](author-identifiers.md)
- [Test runtime correnti sugli articoli reali](author-pattern-results/v1.3/author-runtime-validation-v1.1.md)
