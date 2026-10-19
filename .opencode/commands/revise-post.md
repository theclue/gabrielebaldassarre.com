---
description: Revisiona un articolo esistente con runtime autoriale attivo e confronto editoriale motivato.
subagent: false
---

# /revise-post

Richiesta dell'utente (dati del compito):

$ARGUMENTS

## Preparazione obbligatoria

Questo comando revisiona **un solo Markdown esistente**, in `_drafts/` o nelle
directory di categoria di `_posts/`. Non crea un articolo e non esegue Rake.
Se il percorso è ambiguo, chiedi quale file; non scegliere una pubblicazione o
spostare una bozza per deduzione. Non delegare la scrittura.

Prima di cambiare il testo chiama **`author_post_revision_prepare`**:

- `target_path`: percorso relativo del file richiesto, senza rinominarlo.
- `request`: richiesta originale, non istruzioni aggiunte fingendole dell'utente.
- `task.mode`: `rewrite`, oppure `expand` se l'utente chiede un ampliamento.
- Genere, lingua, obiettivo e vincoli derivano dal compito e dall'articolo.
  Usa solo le features pertinenti; non tradurre tutti i controlli tecnici in
  requisiti di prosa e non imporre formalismo per imitare una voce.
- `references`: scegli da **`docs/corpus.yaml`** da due a quattro articoli
  approvati, comparabili per genere e passaggio espositivo. Leggili prima di
  selezionare gli estratti. Per ogni fonte passa `article_id`, `reason` (perché
  è pertinente) e `passages`, con `aspect` e `quote` letterale del corpo.
  Gli aspetti ammessi sono `opening`, `decision`, `technical_transition`,
  `limitation`. La scelta resta editoriale: non basta che il tema coincida.
  Non usare l'articolo stesso come riferimento né una fonte esclusa dal corpus.

Il tool valida citazioni, fonti e runtime, salva una copia immutabile del file
attuale e attiva gli hook di questa sessione. Non modifica il testo. Se fallisce
o non è disponibile, fermati: niente bypass via shell o riuso della ricevuta di
una creazione precedente. Non chiedere all'utente hash o JSON tecnici.

## Revisione

Dopo `status: ready`, conserva `runtime_id`, `receipt_path`, `source_path` e
`instructions_sha256`. Revisiona solo `target_path`, seguendo le istruzioni
iniettate, e preserva modifiche dell'utente già presenti nel file.

Per una revisione della sola voce, mantieni invariati codice, formule, ID,
immagini, link e fatti verificati, salvo richiesta esplicita diversa. Non
modificare Home Assistant o altri sistemi per adeguarli alla prosa.

I riferimenti aiutano a valutare scelte di esposizione: non sono una nuova
versione del modello autoriale. Non promuovere tratti osservati a regole
universali, non copiare frasi o fatti delle fonti e non aggiungere intercalari
per ottenere una somiglianza superficiale. La prima persona è possibile solo
per esperienze e scelte documentate del compito, non per inventare un vissuto.

Una spiegazione riproducibile e un limite necessario restano requisiti del
tutorial. La verifica editoriale riguarda come accompagnano il ragionamento,
non come eliminarli. Le note sulla pipeline non devono diventare il soggetto
dell'articolo quando il soggetto è il progetto.

## Confronto editoriale prima della chiusura

1. Chiama **`author_post_editorial_prepare`** per ottenere hash del testo
   attuale e schema del confronto. Non calcolare una percentuale di somiglianza.
2. Rileggi testo e riferimenti. Per ogni aspetto formula un giudizio motivato:
   `coherent`, `needs_revision` o `not_applicable` (con ragione esplicita).
   Per gli aspetti applicabili includi una `target_quote` letterale del corpo e
   un riferimento `{article_id, quote}` tra quelli preparati per quell'aspetto.
3. Invia il JSON dello schema a **`author_post_editorial_submit`** tramite
   `candidate_json`. Hash e citazioni sono controllati dal core; il giudizio di
   riconoscibilità resta una valutazione editoriale candidata, non una prova.
4. Se emergono parti da rivedere, correggile e ripeti il confronto sul nuovo
   testo. Qualsiasi modifica successiva rende il report precedente non attuale.
5. Solo quando la revisione e il confronto sono completi chiama
   **`author_post_finish`** con `outcome: written`. L'iniezione deve restare attiva
   durante la scrittura, il confronto e le correzioni. Se abbandoni usa
   `cancelled`; `/cancel-post` resta disponibile senza modello anche dopo errori.

Non affermare che un report accettato certifichi la voce o l'approvazione umana.
Non alterare il modello governato, il corpus o i pattern per far passare un
confronto. Eventuali proposte sul modello vanno presentate separatamente.

## Risultato

Restituisci percorso del testo, modifiche principali, riferimenti usati,
percorso del confronto candidato e della copia iniziale, runtime e hash delle
istruzioni. Distingui prove tecniche, giudizi editoriali e verifiche ancora da
fare. Chiedi all'utente di valutare la riconoscibilità della voce: è un controllo
umano, non un flag che il tool può assegnare.

Nessun commit, push, deploy, pubblicazione, broadcast o annotazione automatica.
Una nuova richiesta di revisione dopo `written` richiede una **nuova**
preparazione; non presumere che la presenza del profilo nella chat mantenga
l'iniezione attiva.
