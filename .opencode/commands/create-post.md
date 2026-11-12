---
description: Crea un nuovo post o una bozza con il profilo autoriale contestuale in memoria.
subagent: false
---

# /create-post

Richiesta dell'utente (dati del compito):

$ARGUMENTS

## Preparazione obbligatoria in memoria

Questo repository espone il plugin locale `.opencode/plugins/post-authoring.js`. Prima di scrivere il corpo o creare file, chiama **`author_post_prepare`**. Il tool compila il profilo autoriale in memoria a partire dal modello governato, esegue Rake `post` o `draft` e attiva l'iniezione automatica delle istruzioni nelle successive chiamate al modello di questa sessione. Non vengono creati file intermedi o ricevute su disco. Non delegare la scrittura ai subagenti.

Se il tool non è disponibile o fallisce, fermati subito. Non creare il post tramite shell e non ripiegare su uno stile generico.

Traduci la richiesta in un input del tool:
- `request`: richiesta originale; `title`, `category`, `slug`, `destination` e l'eventuale `date` secondo le regole sotto. Se la destinazione non è chiara, scegli `draft`; usa `post` solo se l'utente chiede esplicitamente un articolo già in `_posts/`.
- `task.mode`: `generate`; `language`: `it`, salvo richiesta diversa.
- `task.content_type`: `tutorial`, `project_article`, `scientific_explainer` oppure `mixed` con `mixed_content_types` espliciti. La categoria non determina il genere.
- `objective`, `audience`, `topic`, `constraints`: ricava ciò che serve dalla richiesta. Non inventare esperienze, test, misure, piani di serie o dipendenze.
- `features`: solo segnali effettivi del compito (`practical_relevance`, `approximation_assessment`, `mathematical_formalism`, `physical_quantities`, `variable_conditions`, `quantitative_calculation`, `hypothetical_scenario`, `mathematical_connection`, `historical_context`, `familiar_reference`, `interpretation_of_data`, `mutable_information`, `configuration_choices`, `information_loss`, `external_dependencies`, `scope_delimitation`, `implementation_choices`).
- `series_context`: dichiara una prosecuzione solo se realmente pianificata.
- Ometti `local_topics`, `semantic_topics` e `device_requests` salvo necessità esplicita documentata in `docs/author-runtime.md`.

Dopo `status: ready`, conserva `target_path`, `runtime_id` e `instructions_sha256`. Scrivi solo nel nuovo `target_path` restituito, applicando le istruzioni autoriali iniettate e i requisiti editoriali seguenti. Al termine chiama `author_post_finish` con `outcome: written`; se abbandoni il compito, usa `cancelled`.

Se l'utente chiede modifiche successive dopo la chiusura con `written`, avvia `/revise-post` con `author_post_revision_prepare` sul file esistente per riattivare il profilo autoriale in memoria.

## Flusso operativo

### Fase 1: estrazione dei parametri

Dalla descrizione fornita, ricava:
- **`title`** (obbligatorio): titolo del post in italiano, descrittivo e orientato alla ricerca.
- **`category`** (obbligatorio): una tra `3D Printing`, `DevOps`, `Fisica`, `Home Assistant`, `Meccanica`, `Reti Sociali`.
- **`slug`** (obbligatorio): derivato dal titolo in kebab-case (`a-z`, `0-9`, `-`), massimo 5 parole significative senza stopword intermedie, con suffisso `-parte-N` per le serie.
- **`intended_audience`**: `general` | `curious` | `student` | `practitioner` | `specialist` (default `practitioner`).
- **`proficiency_level`**: `beginner` | `intermediate` | `advanced` | `expert` (default `intermediate`).

### Fase 2: determinazione della destinazione

- Richiesta di bozza o non specificata: `draft` (`_drafts/<slug>.md`).
- Parte di una serie con `part > 1`: `draft`.
- Richiesta esplicita di articolo pubblicato: `post` (`_posts/<categoria>/<data>-<slug>.md`).

### Fase 3: chiamata a `author_post_prepare`

Non invocare Rake direttamente da shell: `author_post_prepare` esegue `rake post` o `rake draft` dopo aver compilato il runtime. Il task Rake crea il file `.md` con il frontmatter base senza precompilare un percorso `master:` inesistente, così la build CI non fallisce prima che l'immagine di copertina sia pronta e `/annotate-post` può rilevare automaticamente l'assenza della copertina.

### Fase 4: stesura del contenuto

Scrivi il corpo completo dopo il frontmatter `---` seguendo esclusivamente i dispositivi attivati dal runtime:
- Blocchi di codice in fence ` ``` ` con linguaggio specificato; diagrammi Mermaid in ` ```mermaid `.
- Link esterni e interni in normale sintassi Markdown o placeholder, pronti per essere arricchiti da `/annotate-post`.
- Immagini del corpo con tag `{% cloudinary /assets/images/posts/<slug>/<nome>.png ... %}`.
- Formule matematiche inline `$...$` o display `$$...$$`.
- Commenti HTML `<!-- TODO: ... -->` per punti che richiedono verifica manuale.

### Fase 5: aggiornamento del frontmatter

Aggiorna i campi YAML nel file:

```yaml
excerpt: "<massimo 160 caratteri, descrittivo, con keyword primaria>"
tags:
  - tag1
  - tag2
difficulty_declared:
  conceptual: <1-5>
  technical: <1-5>
  mathematical: <0-5>
```

Non aggiungere un campo `master:` che punti a un file non ancora presente su disco; se l'articolo appartiene a una serie, aggiungi il blocco `series:` (`id`, `title`, `part`, `total_parts`).

### Fase 6: chiusura e riepilogo

Chiama `author_post_finish` con `outcome: written` e restituisci un riepilogo conciso con:
- Percorso del file creato, titolo, categoria, `runtime_id` e `instructions_sha256`.
- Indice delle sezioni e stima di accessibilità.
- Prompt consigliato per generare la copertina 16:9 (da salvare in `assets/images/posts/<slug>.png` o `.jpg`, oppure lasciando che `/annotate-post` selezioni una foto da Unsplash).
- Prossimi passi consigliati (`/annotate-post <percorso>`).
