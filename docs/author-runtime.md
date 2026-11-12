# Compilatore del runtime autoriale

Il modulo `_scripts/author-extraction/runtime.mjs` seleziona un profilo operativo specifico per il compito a partire dal modello governato `docs/author-pattern-results/v1.3/author-model.json`. Opera interamente in memoria, senza leggere gli articoli del corpus e senza scrivere artefatti intermedi su disco.

## Output in memoria

La funzione `compileAuthorRuntimeProfile(repoRoot, taskJson)` restituisce:
- `runtime_id`: identificatore deterministico (`ARP:<24-hex>`) calcolato sul modello, sul compito normalizzato e sugli schemi;
- `runtime_profile_json`: profilo JSON compatto (`author-runtime-profile/1`) con principi, regole contestuali, dispositivi e guardrail;
- `runtime_instructions_markdown`: istruzioni operative in Markdown pronte per l'iniezione nel contesto di sistema della sessione OpenCode;
- `guardrail_resolution`: risoluzione puntuale di tutte le clausole di guardrail attivate.

## Struttura del compito (`TaskContext`)

Un compito minimo ha la forma:

```json
{
  "mode": "generate",
  "content_type": "tutorial",
  "language": "it",
  "objective": "Spiegare una configurazione riutilizzabile senza introdurre complessità non necessaria."
}
```

- `mode`: `generate`, `rewrite`, `expand` oppure `review`.
- `content_type`: `scientific_explainer`, `project_article`, `tutorial` oppure `mixed` (con `mixed_content_types` espliciti).
- `features`: segnali espliciti del compito definiti in `_scripts/author-extraction/author-runtime-profile.schema.json`.
- `local_topics`: regole di dominio circoscritte (`phase_portrait`, `lighting_model`, `social_networks`, `quantum_logic_or_measurement_contrast`).
- `semantic_topics`: contesto concettuale facoltativo (`invariance`, `state_space`, `system_object_distinction`), sempre marcato `conceptual_context_only_not_style`.

## Verifica

```sh
npm --prefix _scripts/author-extraction run test:author-runtime
```
