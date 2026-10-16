---
description: Crea un nuovo post o una bozza con il profilo autoriale contestuale verificato.
subagent: false
---

# /create-post

Richiesta dell'utente (dati del compito):

$ARGUMENTS

## Preparazione obbligatoria — non dipende dalla memoria della chat

Questo repository espone il plugin locale `.opencode/plugins/post-authoring.js`.
Prima di scrivere il corpo o creare file, chiama **`author_post_prepare`**.
Il tool compila il profilo autoriale dal modello governato, lo materializza e lo
verifica, esegue Rake `post`/`draft` e attiva l'iniezione automatica delle istruzioni
nelle successive chiamate al modello **di questa sessione**. Non riutilizzare il
runtime di un esempio e non chiedere all'utente hash, JSON o comandi tecnici.
Non delegare la scrittura: l'attivazione non si trasferisce ai subagenti.

Se il tool non è disponibile o fallisce, fermati e segnala il problema; non creare
un post tramite shell/Rake, non ripiegare su uno stile generico e non dichiarare
che il profilo è stato usato. Non generare un articolo come test del plugin.

Traduci la richiesta in un input del tool:
- `request`: richiesta originale; `title`, `category`, `slug`, `destination` e
  l'eventuale `date` secondo le regole sotto. Se la destinazione non è chiara,
  scegli **draft**; usa `post` solo se l'utente richiede un articolo non in bozza.
- `task.mode`: `generate`; `language`: `it`, salvo richiesta diversa.
- `task.content_type`: `tutorial`, `project_article`, `scientific_explainer` oppure
  `mixed` con `mixed_content_types` espliciti. La categoria non determina il genere.
  Per un genere non supportato, chiedi chiarimento; non forzarlo nel più vicino.
- `objective`, `audience`, `topic`, `constraints`: ricava ciò che serve dalla
  richiesta. Non inventare esperienze, test, misure, piani di serie o dipendenze.
- `features`: solo segnali effettivi del compito. I valori ammessi sono
  `practical_relevance`, `approximation_assessment`, `mathematical_formalism`,
  `physical_quantities`, `variable_conditions`, `quantitative_calculation`,
  `hypothetical_scenario`, `mathematical_connection`, `historical_context`,
  `familiar_reference`, `interpretation_of_data`, `mutable_information`,
  `configuration_choices`, `information_loss`, `external_dependencies`,
  `scope_delimitation`, `implementation_choices`.
- `series_context`: dichiara una prosecuzione solo se realmente pianificata;
  appartenere a una serie non basta. Non creare altre parti automaticamente.
- Ometti `local_topics`, `semantic_topics` e `device_requests` di norma. Non
  aggiungere concetti semantici o dispositivi required per il solo genere.
  Se servono esplicitamente, consulta `docs/author-runtime.md` per il contratto.

Per esempio, una matita parametrica in OpenSCAD è un `tutorial` con
`implementation_choices` e `configuration_choices`, non una spiegazione fisica
con calcolo numerico obbligatorio. Chiedi solo i dettagli editoriali davvero
mancanti; fai assunzioni ragionevoli e dichiarale per quelli non bloccanti.

Dopo `status: ready`, conserva `target_path`, `receipt_path`, `runtime_id` e
`instructions_sha256`. Scrivi **solo nel nuovo `target_path` restituito**,
applicando le istruzioni autoriali iniettate e i requisiti editoriali seguenti.
Al termine chiama `author_post_finish` con `outcome: written`; se abbandoni il
compito, usa `cancelled`. Il tool termina l'iniezione, non pubblica né elimina.
Il conteggio delle applicazioni dell'hook non dimostra conformità della prosa.

Crea un post tutorial/divulgativo tecnico-scientifico a partire da una
descrizione in linguaggio naturale.

## Scopo

Generare contenuti completi (tutorial o articolo divulgativo) per il blog
gabrielebaldassarre.com. L'articolo viene creato come `.md` in `_posts/<category>/`
(o `_drafts/` se la descrizione indica "in bozza").

## Architettura

1. **Interpretazione** della descrizione utente (estrazione metadati)
2. **Preparazione nativa** di runtime verificato e template Rake `post`/`draft`
3. **Riempimento** del template con contenuto completo (body del post)
4. **Restituzione** di recap, indice, stima accessibilità, prompt Midjourney

## Workflow

### Fase 1 — Estrazione parametri

Dalla descrizione fornita, estrai mediante analisi LLM:

- **`title`** (obbligatorio) — Titolo del post in italiano. Deve essere
  descrittivo, accattivante, SEO-friendly. Se contiene "parte N" o "part N",
  il post fa parte di una serie.

- **`category`** (obbligatorio) — Una tra le categorie Jekyll valide:
  `3D Printing`, `DevOps`, `Fisica`, `Home Assistant`, `Meccanica`, `Reti Sociali`.
  Se la descrizione non è categorizzabile, chiedi conferma all'utente.

- **`slug`** (obbligatorio) — Derivato dal titolo. Linee guida SEO/GEO:
  - Solo caratteri `a-z`, `0-9`, `-`
  - Massimo 5 parole chiave significative
  - Rimuovere stopword (il, la, un, per, e, di, etc.)
  - Mettere la keyword primaria all'inizio
  - No date, no numeri superflui
  - Esempi: `"Il cielo in salotto, parte 1: Sistema Terra-Luna"` → `cielo-salotto-sistema-terra-luna`
  - Per serie: includere `-parte-N` come suffisso

- **`intended_audience`** — Dedotto dal contenuto:
  `general` | `curious` | `student` | `practitioner` | `specialist`
  Default: `practitioner`

- **`proficiency_level`** — Dedotto dal contenuto:
  `beginner` | `intermediate` | `advanced` | `expert`
  Default: `intermediate`

- **`series`** — Se dal titolo o descrizione emergono indicatori di serie
  ("parte 1 di 3", "primo di tre articoli", "continua da..."), imposta
   il blocco `series:` nel frontmatter se i dati sono disponibili. Non creare
   altre parti e non inventarne il piano o il numero totale.

- **Wikipedia/Wikidata link** — Se nella descrizione è presente un URL
  Wikipedia o Wikidata, questo rappresenta l'argomento centrale. Usalo per
  inquadrare il tutorial e per popolare `knowledge_prerequisites[0].sameAs`.

- **Contenuto** — La descrizione può contenere indicazioni sulla struttura:
  sezioni, punti da trattare, codice/strumenti da mostrare, formule,
  immagini necessarie.

### Fase 2 — Determinazione destinazione

- Se la richiesta è per una bozza/draft → `_drafts/` (non confondere con "non in bozza")
- Se parte di una serie con `part > 1` → `_drafts/`
- Articolo non in bozza esplicitamente richiesto → `_posts/`
- Se non specificato → `_drafts/` (nessuna pubblicazione implicita)

### Fase 3 — Chiamata Rake

Non eseguire Rake direttamente: `author_post_prepare` chiama il task
corrispondente **solo dopo** compilazione e verifica del runtime:

- Post: `rake post["<title>","<category>","<slug>"]`
- Draft: `rake draft["<title>","<category>","<slug>"]`

Il Rake task:
- Crea il file `.md` con frontmatter YAML precompilato
- Imposta `intended_audience`, `proficiency_level`, `broadcast` defaults
- Imposta `master: /assets/images/posts/<slug>.png`

### Fase 4 — Riempimento contenuto

Il corpo del post (dopo il frontmatter `---`) viene generato come contenuto
completo:

Le seguenti sono strutture indicative, non scalette obbligatorie. Usa solo i
dispositivi attivati dal runtime, senza imporre storia, formalismo, diagrammi,
applicazioni o anticipazioni per il solo genere del testo.

**Possibile struttura per tutorial:**
1. Introduzione (problema, obiettivo, prerequisiti)
2. Sezioni step-by-step con codice/configurazioni
3. Verifica / testing
4. Chiusura pertinente all'obiettivo, senza annunciare seguiti non pianificati

**Possibile struttura per articolo divulgativo:**
1. Introduzione (contesto storico/scientifico)
2. Sviluppo concettuale (con diagrammi concettuali)
3. Formalizzazione matematica (se pertinente)
4. Implicazioni e casi d'uso
5. Riferimenti e approfondimenti

**Regole di contenuto:**
- Italiano tecnico ma accessibile
- Ogni blocco di codice è in ` ``` ` fence con linguaggio specificato
- I diagrammi Mermaid sono in ` ```mermaid ` fence
- I link esterni usano `{% xlink %}` (lasciare placeholder, verranno
  annotati da `/annotate-post`)
- I riferimenti interni usano `{% post_link %}` (placeholder)
- Le immagini usano `{% cloudinary %}` con path `assets/images/<slug>-*.png`
- Le formule matematiche sono inline `$...$` o display `$$...$$`
- Includere commenti HTML `<!-- TODO: ... -->` per segnalare punti da
  verificare/espandere

### Fase 5 — Aggiornamento frontmatter

Dopo aver generato il corpo, aggiorna i campi YAML:

```yaml
excerpt: "<160 caratteri, descrittivo, contiene keyword primaria>"
tags:
  - tag1
  - tag2
  - ...
difficulty_declared:
  conceptual: <1-5>
  technical: <1-5>
  mathematical: <0-5>
```

Se è una serie, aggiungi il blocco `series:`:
```yaml
series:
  id: <slug-base-senza-parte-N>
  title: <titolo serie>
  part: <N>
  total_parts: <M>
```

### Fase 6 — Output per l'utente

Al termine, restituisci un riepilogo conciso. Aggiungi runtime ID, percorso della
ricevuta e hash delle istruzioni, riprendendoli dai risultati dei tool. Distingui
verifiche eseguite da TODO; non affermare che l'uso del runtime certifichi il testo.
Indice, difficoltà e prompt per l'immagine restano suggerimenti utili, non quote
autoriali obbligatorie. Non eseguire commit, push, deploy o pubblicazione.

Esempio di riepilogo:

```
## /create-post completato

**File creato:** `_posts/<category>/<date>-<slug>.md`
**Titolo:** <title>
**Categoria:** <category>
**Destinazione:** _posts | _drafts
**Tipo contenuto:** tutorial | articolo divulgativo

### Indice dei contenuti
1. <Sezione 1>
2. <Sezione 2>
...

### Stima accessibilità
- **Audience:** <intended_audience>
- **Livello:** <proficiency_level>
- **Difficoltà dichiarata:** concettuale <N>/5, tecnica <N>/5, matematica <N>/5
- **Prerequisiti chiave:** <elenco>

### Prompt Midjourney (master image)
/imagine prompt: <prompt in inglese, stile fotorealistico/illustrativo adatto al post, --ar 16:9 --style raw>

### Prossimi passi
1. Rivedere e correggere il contenuto
2. Generare la master image con Midjourney → salvare come
   `assets/images/posts/<slug>.png`
3. Eseguire `/annotate-post _posts/<category>/<date>-<slug>.md`
4. Se è una serie effettivamente pianificata: eseguire `/create-post` per le parti successive
   specificando "in bozza"
```

## Slug derivation (SEO/GEO)

Le regole precise per derivare lo slug dal titolo:

1. Convertire in lowercase
2. Rimuovere accenti: à→a, è→e, ì→i, ò→o, ù→u
3. Sostituire spazi e punteggiatura con `-`
4. Rimuovere caratteri non `[a-z0-9-]`
5. Collassare `--+` in singolo `-`
6. Rimuovere `-` iniziali e finali
7. **Rimuovere stopword italiane**: il, lo, la, i, gli, le, un, uno, una,
   e, ed, a, al, allo, alla, di, del, dello, della, in, con, su, per, tra,
   fra, da, che, è, sono, ho, ha, come, non, si, ci, vi, ne, se
   (solo se non sono la prima parola)
8. Limitare a 5 parole (parole = segmenti tra `-`)
9. Per serie: il suffisso `-parte-N` viene dopo lo slug base

### Esempi

| Titolo | Slug |
|--------|------|
| "Una shell history per ogni progetto" | `shell-history-per-progetto` |
| "Il cielo in salotto, parte 1: Sistema Terra-Luna" | `cielo-salotto-parte-1-sistema-terra-luna` |
| "Introduzione agli autovettori e autovalori" | `introduzione-autovettori-autovalori` |
| "Dashboard di astrometria, parte 2" | `dashboard-astrometria-parte-2` |

## Note

- Il file viene creato con data odierna (`YYYY-MM-DD`). Per post futuri,
  usare `ENV["date"]` (gestito dal Rake task).
- Non eseguire `/annotate-post` automaticamente: l'utente lo farà dopo
  aver revisionato il contenuto.
- Per `/create-post` che referenzia un asset CAD già rilasciato (`_cad/<slug>/`), includi
  il blocco `3d_model:` nel frontmatter usando il layout `asset-3d` e
   la categoria `3D Printing`. Un tutorial che mostra codice OpenSCAD non
   autorizza automaticamente a creare/rilasciare asset CAD o file scaricabili.
- Il `broadcast.sent` rimane `false` (la pipeline CI lo imposta dopo il
  push social).
