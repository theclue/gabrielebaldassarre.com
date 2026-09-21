# /create_cad

Crea un nuovo asset 3D parametrico (OpenSCAD) sotto `_cad/<slug>/` a partire
da una descrizione in linguaggio naturale.

## Scopo

Generare il file `.scad` archetipico per un modello 3D parametrico
destinato al blog gabrielebaldassarre.com. Il comando **non** crea un post
associato: il tutorial corrispondente va creato successivamente con
`/create_post`, referenziando l'asset tramite il blocco `3d_model:`.

## Architettura

1. **Interpretazione** della descrizione utente (derivazione slug e titolo)
2. **Chiamata** al Rake task `new_3d` per creare lo scheletro `.scad`
3. **Popolamento** del `.scad` con parametri, moduli e geometria iniziale
4. **Restituzione** di recap e specifiche per il rendering

## Workflow

### Fase 1 — Estrazione parametri

Dalla descrizione fornita, estrai:

- **`title`** — Nome del progetto (es. "Passacavi parametrico da scrivania").
  Inserito come commento header del `.scad`. In italiano.

- **`slug`** — Identificatore univoco kebab-case. Stesse regole di
  `/create_post` (SEO/GEO):
  - Solo `[a-z0-9-]`
  - Massimo 4-5 parole chiave
  - Keyword primaria all'inizio
  - Rimuovere stopword
  - Esempi: `passacavi-parametrico-scrivania`, `supporto-cuffie-ikea`,
    `adattatore-aspirapolvere-makita`

- **Parametri Customizer** — Identifica dalla descrizione:
  - Dimensioni principali regolabili (diametro, larghezza, altezza, spessore)
  - Tolleranze (clearance, interferenza)
  - Opzioni binarie (con/senza foro, orientamento)
  - Range numerici con step

- **Geometria** — Descrivi la forma base e le operazioni CSG:
  - Primitive coinvolte (cube, cylinder, sphere, etc.)
  - Trasformazioni (translate, rotate, scale, mirror)
  - Operazioni booleane (difference, union, intersection)
  - Estrusioni (linear_extrude, rotate_extrude)
  - Operazioni avanzate (hull, minkowski, offset)

### Fase 2 — Chiamata Rake

Esegui: `rake new_3d["<title>","<slug>"]`

Il Rake task:
- Crea `_cad/<slug>/` con il file `<slug>.scad`
- Inserisce l'header con licenza MIT e copyright
- Crea lo scheletro base: parametri d'esempio, `main_part()`, `assembly()`

### Fase 3 — Popolamento .scad

Partendo dallo scheletro creato dal Rake, personalizza il `.scad` seguendo
rigorosamente le convenzioni in `.opencode/agents/cad-author.md`:

**Struttura obbligatoria:**

```
// ─── <Title> — <Short description> ───────────────────────────
// License : MIT License
// Author  : Gabriele Baldassarre
// Created : YYYY-MM-DD

/* [Parameters] */
param_name = default;   // [min:step:max]  Descrizione in italiano

/* [Quality] */
$fn = 128;

// ─── Geometry helpers ────────────────────────────────────────
// Derived dimensions, tolerances

// ─── Modules ─────────────────────────────────────────────────
module PieceOne() { ... }
module PieceTwo() { ... }

// ─── Assembly ────────────────────────────────────────────────
module assembly(explode = 0, explode_distance = 25) { ... }

// ─── Export ──────────────────────────────────────────────────

/* [View] */
mode = "print"; // [assembly:Assembly, exploded:Exploded, print:Print layout]
```

Applica integralmente le 12 regole + sezione Customizer di `.opencode/agents/cad-author.md` (fonte unica; non duplicare qui).

**Linee guida per la geometria iniziale:**
- Inizia con la forma primaria che cattura l'80% del design
- Aggiungi gli elementi secondari come moduli separati
- Usa `difference()` per fori, tagli, cave
- Le tolleranze sono sempre variabili named (es. `hole_clearance = 0.3`)
- Commenta ogni operazione CSG non ovvia

### Fase 4 — Output per l'utente

Al termine, restituisci:

```
## /create_cad completato

**Asset creato:** `_cad/<slug>/<slug>.scad`
**Titolo:** <title>
**Slug:** <slug>

### Parametri Customizer definiti
| Parametro | Default | Range | Descrizione |
|-----------|---------|-------|-------------|
| <name>    | <val>   | <min>:<step>:<max> | <descrizione ITA> |
...

### Moduli creati
- `<ModuleName>()` — <descrizione del pezzo>
...

### Specifiche di stampa stimate
- **Materiale consigliato:** PLA / PETG / ...
- **Dimensione stimata:** <X> × <Y> × <Z> mm
- **Supporti:** sì / no
- **Infill suggerito:** <percentuale e pattern>

### Prossimi passi
1. Verificare il `.scad` in OpenSCAD (F5/F6)
2. Regolare i parametri nel Customizer
3. Testare l'assembly con `explode=0` e `explode=1`
4. Eseguire `make cad CAD_ARGS="--slug <slug>"`
   per generare STL, 3MF e preview blueprint
5. Creare il tutorial con `/create_post` referenziando l'asset:
   `/create_post "Tutorial su <title>: ..."` — includerà il blocco
   `3d_model:` con `sources.scad: _cad/<slug>/<slug>.scad`
6. Creare/aggiornare il fork `<slug>-thingiverse.scad` (inglese,
   ASCII-only — convenzione dual-file in `.opencode/agents/cad-author.md`
   §Thingiverse Customizer Compatibility) e, prima di allegarlo, eseguire
   la guardia:
   `_scripts/cad/customizer_compat_check.sh _cad/<slug>/<slug>-thingiverse.scad`
   (deve uscire 0)
7. Caricare su Printables/Thingiverse e aggiornare `3d_model.downloads`

### Prompt Midjourney (master blueprint preview)
/imagine prompt: <prompt per generare un'immagine stilizzata del modello 3D finito, stile blueprint/technical drawing, --ar 16:9 --style raw>
```

## Slug derivation (SEO/GEO)

Stesse regole di `/create_post`, con enfasi su:

- Usare termini inglesi se sono nomi propri di prodotto (es. `ikea-skadis`,
  `makita-18v`, `nespresso-original`)
- Preferire italiano per concetti generici (es. `passacavi`, `supporto`,
  `adattatore`)
- Esempi:
  - "Supporto per cuffie IKEA Skadis" → `supporto-cuffie-ikea-skadis`
  - "Adattatore aspirapolvere Makita 18V" → `adattatore-makita-18v`
  - "Passacavi parametrico scrivania con baionetta" → `passacavi-baionetta-scrivania`

## Note

- Lo scheletro `.scad` generato è un **punto di partenza**. L'utente dovrà
  raffinare la geometria in OpenSCAD.
- Non creare il file README.md (regola #12 di cad-author.md).
- Il nome del file `.scad` DEVE corrispondere allo slug.
- La data `Created` nel commento header è quella corrente.
- L'utente può richiedere `/create_cad` anche per modificare un `.scad`
  esistente: in tal caso, non chiamare `rake new_3d` ma modifica
  direttamente il file.
