# Handoff — OpenSCAD Drawing Blueprints

## Stato
**Parcheggiato / debito tecnico** (2026-09-21).

Scope: generazione di blueprint SVG quotati (A4 portrait, 4 quadranti) per
`_cad/parametric-billy-bookcase`.

## Perché abbandonato
La causa tecnica è strutturale e non un singolo bug del disegno:

- l'export SVG di OpenSCAD 2021.01 produce un unico compound path con un solo
  fill, quindi i segni sovrapposti alle sagome sono invisibili per costruzione;
- `text()` è 2D e viene scartato nelle union con geometria 3D;
- i cutout ottenuti con `difference()` vengono renderizzati pieni a causa del
  fill-rule;
- `projection()` non implementa hidden-line removal.

Conclusione: il drafting deterministico su questa toolchain non è raggiungibile
senza hack fragili. DraftSCAD (MIT, CameronBrooks11) è stato valutato e
scartato: il thin-3D-hack è incompatibile con il renderer di questa versione.

## Cosa funzionava e va riusato

### Sidecar e scope del modello
Il sidecar importava il modello senza introdurre un render spurio e impostava la
modalità blueprint:

```openscad
include <../parametric-billy-bookcase.scad>
mode = "blueprint";
```

### Prestazioni senza cambiare silhouette
Il trucco per evitare il costo CGAL dei fori interni era:

```openscad
shelf_holes = false;
```

Ha ridotto il render da circa 135 s a circa 1,3 s senza cambiare la silhouette.

### Scala e layout
La scala A4 era calcolata così:

```openscad
S = min(85 / width_l, 118 / height_h);
```

Il layout a 4 quadranti funzionava. Il modulo `chain_v`, con un tick per ogni
segmento, risolveva le quote orfane; il pattern era basato su una lista di
posizioni e sulle etichette tra due posizioni consecutive:

```openscad
front_chain_labels = [for (i = [0 : len(front_chain_ys) - 2])
    round((front_chain_ys[i + 1] - front_chain_ys[i]) / S)];
chain_v(q2[0] + QW - 8, front_chain_ys, front_chain_labels);
```

Per una riscrittura vanno ricordati questi moduli del kit: `sheet_a4`, `qo`,
`dim_h`, `dim_v`, `chain_v`, `chain_h`, `label`, `tick`, `view_title`.

## Strade future consigliate

In ordine di promessa:

1. provare OpenSCAD nightly o una versione con export SVG migliore;
2. esportare DXF e applicare post-processing con Inkscape o FreeCAD TechDraw
   per quote e cartigli;
3. realizzare un generatore SVG Python che legga ECHO/BOM del modello
   (`DIMCHECK` emette già tutti i valori) e disegni le quote esternamente,
   aggirando completamente i limiti di OpenSCAD;
4. rivalutare tra qualche mese.

## Vincoli se si riprende

- mai toccare il modello per il drawing: zero-diff;
- usare un sidecar al terzo livello per sfuggire a `_CAD_SCADS`/`build.py`;
- non usare più DraftSCAD su OpenSCAD 2021.01.

Riferimenti archiviati: il kit cancellato era `blueprint_kit.scad`; il ramo
valutato e scartato era `draftscad`.
