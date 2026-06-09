# /create_rmd

Crea un post tutorial/divulgativo tecnico-scientifico in formato `.Rmd`
(R Markdown) a partire da una descrizione in linguaggio naturale.

## Scopo

Generare contenuti completi in formato `.Rmd` per il blog
gabrielebaldassarre.com. L'articolo viene creato come `.Rmd` in
`_posts/<category>/` (o `_drafts/` se la descrizione indica "in bozza").

A differenza di `/create_post`, questo comando genera solo il file `.Rmd`.
Il `.md` knittato viene prodotto successivamente, previa revisione e
aggiustamenti del `.Rmd`.

## Architettura

1. **Interpretazione** della descrizione utente (estrazione metadati)
2. **Chiamata** al Rake task `new_rmd` o `new_rmd_draft` per creare
   il template `.Rmd`
3. **Riempimento** del template con contenuto R Markdown completo
4. **Restituzione** di recap, indice, stima accessibilità, prompt Midjourney

## Workflow

### Fase 1 — Estrazione parametri

Identica a `/create_post` (Fase 1). In aggiunta:

- **Contenuto matematico/statistico** — Se la descrizione menziona
  analisi dati, grafici, simulazioni, modelli statistici, reti, il post
  è candidato ideale per `.Rmd`.
- **Pacchetti R necessari** — Identifica dalla descrizione quali
  pacchetti R servono (tidyverse, igraph, ggplot2, etc.) e includili
  nel chunk `setup`.

### Fase 2 — Determinazione destinazione

Identica a `/create_post`.

### Fase 3 — Chiamata Rake

Esegui il comando Rake corrispondente:

- Post Rmd: `rake new_rmd["<title>","<category>","<slug>"]`
- Draft Rmd: `rake new_rmd_draft["<title>","<category>","<slug>"]`

Il Rake task:
- Copia il template da `R/includes/template.Rmd`
- Sostituisce `title` e `category` nel frontmatter YAML
- Include il chunk `setup` standard con pacman, tidyverse, rprojroot

### Fase 4 — Riempimento contenuto

Il corpo del `.Rmd` (dopo il frontmatter `---`) viene generato come
contenuto completo.

**Struttura del contenuto Rmd:**

```markdown
```{r setup, include=FALSE, cache=FALSE}
# ... standard setup dal template ...
# Aggiungere qui i p_load per i pacchetti specifici del post
p_load("igraph", "scales", "ggraph")  # esempio
```

## Introduzione
...

## Sezione 1: <titolo>
...

```{r <nome-chunk-1>, fig.asp=0.7,
      fig.alt="<alt text>",
      fig.cap="<caption>",
      fig.role="chart",
      fig.context="result"}
# codice R qui
```

...
```

**Regole per i chunk R:**
- Ogni chunk ha un nome univoco descrittivo in inglese
- `fig.alt` obbligatorio per accessibilità
- `fig.cap` descrive brevemente il grafico
- `fig.role`: `chart`, `diagram`, `screenshot`, `photo`, `illustration`
- `fig.context`: `result`, `step`, `architecture`, `comparison`, `evidence`, `reference`
- `fig.asp` controlla l'aspect ratio (default 0.7 = 7:10,黄金比 approssimato)
- Grafici salvati in `assets/images/<slug>-<nome>.svg` (svglite, default dal template)

**Regole generali:**
- Italiano tecnico ma accessibile
- Le formule LaTeX inline: `$...$` o display: `$$...$$`
- I link esterni: `[testo](url)` (verranno annotati dopo il knit)
- I commenti HTML `<!-- TODO: ... -->` per segnalare punti da verificare
- Le tabelle usano `knitr::kable()` con caption
- I valori numerici nel testo usano `` `r <espressione>` `` inline R

### Fase 5 — Aggiornamento frontmatter

Dopo aver generato il corpo, aggiorna i campi YAML:

```yaml
excerpt: "<160 caratteri, descrittivo>"
tags:
  - tag1
  - ...
  - R
header:
  overlay_filter: 0.5
  overlay_image: /assets/images/<slug>-overlay.jpg
  teaser: /assets/images/<slug>-teaser.jpg
```

Il blocco `editor_options: {chunk_output_type: inline}` è già presente
dal template. Non rimuoverlo.

### Fase 6 — Output per l'utente

Al termine, restituisci un messaggio strutturato:

```
## /create_rmd completato

**File creato:** `_posts/<category>/<date>-<slug>.Rmd`
**Titolo:** <title>
**Categoria:** <category>
**Destinazione:** _posts | _drafts
**Pacchetti R richiesti:** <p_load list>

### Indice dei contenuti
1. <Sezione 1>
2. <Sezione 2>
...

### Chunk R generati
- `<nome-chunk-1>`: <tipo grafico> — <descrizione>
- `<nome-chunk-2>`: <tipo grafico> — <descrizione>
...

### Stima accessibilità
- **Audience:** <intended_audience>
- **Livello:** <proficiency_level>
- **Difficoltà dichiarata:** concettuale <N>/5, tecnica <N>/5, matematica <N>/5
- **Prerequisiti chiave:** <elenco>

### Prompt Midjourney (master image)
/imagine prompt: <prompt in inglese, --ar 16:9 --style raw>

### Prossimi passi
1. Rivedere e correggere il contenuto `.Rmd`
2. Eseguire `rake knit["<path>.Rmd"]` per generare il `.md`
3. Verificare che i grafici SVG siano stati generati correttamente
4. Generare la master image con Midjourney
5. Eseguire `/annotate-post _posts/<category>/<date>-<slug>.md`
   sul file `.md` risultante
6. Se è una serie: eseguire `/create_rmd` per le parti successive
   specificando "in bozza", o `/create_post` per eventuali companion
   in solo markdown
```

## Slug derivation (SEO/GEO)

Stesse regole di `/create_post`.

## Note

- Il file `.Rmd` **non** viene knittato automaticamente. Il knit richiede
  Docker (`gabrielebaldassarre/knitr`) e va fatto dopo revisione.
- Il template include già il setup chunk standard. Aggiungere solo
  `p_load()` per pacchetti aggiuntivi.
- I grafici sono generati in SVG (svglite) con sfondo trasparente,
  ottimizzati per tema scuro e chiaro.
- Il font del blog (Roboto/Inter system font stack) è gestito via CSS;
  non serve specificarlo nei grafici R.
- Per post con molti grafici (>5), considera di usare `cache=TRUE`
  (già default nel template) per velocizzare i re-knit.
