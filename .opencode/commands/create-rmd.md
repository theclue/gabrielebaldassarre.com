---
description: Crea un nuovo post o bozza R Markdown (.Rmd) a partire da una descrizione in linguaggio naturale.
subagent: false
---

# /create-rmd

Crea un post tecnico-scientifico in formato `.Rmd` (R Markdown) a partire da una descrizione in linguaggio naturale:

$ARGUMENTS

## Scopo

Generare contenuti completi in formato `.Rmd` per il blog gabrielebaldassarre.com. L'articolo viene creato come `.Rmd` in `_posts/<category>/` oppure in `_drafts/` (default bozza se non specificato diversamente). Il file `.md` e i grafici SVG in `assets/figures/<slug>/` vengono poi prodotti tramite `rake knit["<percorso>.Rmd"]` o `make knitr`.

## Flusso operativo

### Fase 1: estrazione dei parametri

Dalla descrizione fornita, ricava:
- **`title`** (obbligatorio): titolo del post in italiano.
- **`category`** (obbligatorio): una tra `3D Printing`, `DevOps`, `Fisica`, `Home Assistant`, `Meccanica`, `Reti Sociali`.
- **`slug`** (obbligatorio): derivato dal titolo secondo le stesse regole di `/create-post`.
- **Pacchetti R necessari**: identifica quali pacchetti R servono (`tidyverse`, `igraph`, `ggplot2`, `ggraph`, ecc.) per includerli nel chunk `setup` tramite `p_load(...)`.

### Fase 2: creazione del file `.Rmd` con Rake

Esegui il comando Rake corrispondente:
- Bozza (default): `rake new_rmd_draft["<title>","<category>","<slug>"]`
- Post pubblicato: `rake new_rmd["<title>","<category>","<slug>"]`

Il task copia `R/includes/template.Rmd` e imposta `title` e `category`.

### Fase 3: stesura del contenuto `.Rmd`

Compila il corpo del file `.Rmd` dopo il frontmatter:
- Ogni chunk di grafico deve avere nome univoco in inglese, `fig.alt`, `fig.cap`, `fig.role` (`chart`, `diagram`, `screenshot`, `photo`, `illustration`) e `fig.context` (`result`, `step`, `architecture`, `comparison`, `evidence`, `reference`).
- Durante il knit (`R/build_one.R`), i grafici vengono salvati automaticamente in `assets/figures/<nome-file-senza-ext>/` in formato SVG (`svglite`) con tag `{% cloudinary %}`.
- Usa formule LaTeX inline `$...$` o display `$$...$$`, tabelle `knitr::kable()` e valori calcolati inline `` `r <espressione>` ``.

### Fase 4: aggiornamento del frontmatter

Aggiorna i campi YAML nel frontmatter:

```yaml
excerpt: "<massimo 160 caratteri, descrittivo>"
tags:
  - tag1
  - R
difficulty_declared:
  conceptual: <1-5>
  technical: <1-5>
  mathematical: <0-5>
```

Non inserire percorsi `master:` o `overlay_image` verso file non ancora esistenti su disco. Mantieni invariato `editor_options: {chunk_output_type: inline}`.

### Fase 5: riepilogo per l'utente

Restituisci:
1. Percorso del file `.Rmd` creato, titolo, categoria e pacchetti R richiesti.
2. Elenco dei chunk R generati e indice delle sezioni.
3. Prossimi passi:
   - Revisionare il file `.Rmd`.
   - Eseguire `rake knit["<percorso>.Rmd"]` (oppure `make knitr`) per generare il `.md` e i grafici SVG in `assets/figures/`.
   - Eseguire `/annotate-post` sul file `.md` generato.
