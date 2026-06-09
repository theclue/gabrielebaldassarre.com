# /create_post

Crea un post tutorial/divulgativo tecnico-scientifico a partire da una
descrizione in linguaggio naturale.

## Scopo

Generare contenuti completi (tutorial o articolo divulgativo) per il blog
gabrielebaldassarre.com. L'articolo viene creato come `.md` in `_posts/<category>/`
(o `_drafts/` se la descrizione indica "in bozza").

## Architettura

1. **Interpretazione** della descrizione utente (estrazione metadati)
2. **Chiamata** al Rake task `post` o `draft` per creare il template `.md`
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
  il blocco `series:` nel frontmatter. Per il primo post di una serie, il
  resto viene creato in `_drafts/`, per i successivi si crea direttamente
  in `_drafts/`.

- **Wikipedia/Wikidata link** — Se nella descrizione è presente un URL
  Wikipedia o Wikidata, questo rappresenta l'argomento centrale. Usalo per
  inquadrare il tutorial e per popolare `knowledge_prerequisites[0].sameAs`.

- **Contenuto** — La descrizione può contenere indicazioni sulla struttura:
  sezioni, punti da trattare, codice/strumenti da mostrare, formule,
  immagini necessarie.

### Fase 2 — Determinazione destinazione

- Se la descrizione contiene "bozza", "draft", "in bozza" → `_drafts/`
- Se parte di una serie con `part > 1` → `_drafts/`
- Altrimenti → `_posts/`

### Fase 3 — Chiamata Rake

Esegui il comando Rake corrispondente:

- Post: `rake post["<title>","<category>","<slug>"]`
- Draft: `rake draft["<title>","<category>","<slug>"]`

Il Rake task:
- Crea il file `.md` con frontmatter YAML precompilato
- Imposta `intended_audience`, `proficiency_level`, `broadcast` defaults
- Imposta `master: /assets/images/posts/<slug>.png`

### Fase 4 — Riempimento contenuto

Il corpo del post (dopo il frontmatter `---`) viene generato come contenuto
completo:

**Struttura per tutorial:**
1. Introduzione (problema, obiettivo, prerequisiti)
2. Sezioni step-by-step con codice/configurazioni
3. Verifica / testing
4. Conclusioni e next steps

**Struttura per articolo divulgativo:**
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

Al termine, restituisci un messaggio strutturato:

```
## /create_post completato

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
4. Se è una serie: eseguire `/create_post` per le parti successive
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
- Per `/create_post` che referenzia un asset CAD (`_cad/<slug>/`), includi
  il blocco `3d_model:` nel frontmatter usando il layout `asset-3d` e
  la categoria `3D Printing`.
- Il `broadcast.sent` rimane `false` (la pipeline CI lo imposta dopo il
  push social).
