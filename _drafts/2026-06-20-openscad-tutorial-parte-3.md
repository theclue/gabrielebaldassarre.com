---
layout: asset-3d
title: "Mode system, rendering ed esportazione"
category: 3D Printing
excerpt: "Terza parte del tutorial OpenSCAD: il sistema di modalità archetipico (assembly, exploded, print), il rendering blueprint, l'esportazione STL/3MF per la stampa e la geometria dell'apertura parabolica del tappo."
master: /assets/images/3d/customizable-cable-grommet-ortho.png
header:
  overlay_filter: 0.5
  transform: cinematic
  intensity: medium
  overlay: /assets/overlays/customizable-cable-grommet.png
tags: [OpenSCAD, 3D Printing, CAD, parametric, tutorial, rendering, esportazione, STL, 3MF]
series:
  id: "passacavo-parametrico-scrivania"
  title: "Passacavo parametrico da scrivania"
  part: 3
  total_parts: 3
broadcast:
  channels: [linkedin, mastodon]
  linkedin_image:
    logo: true
    caption: true
    color: white
    transform: keystone
    intensity: medium
  mastodon_image:
    logo: true
    caption: true
    color: white
    transform: keystone
    intensity: medium
3d_model:
  sources:
    scad: _cad/customizable-cable-grommet/customizable-cable-grommet.scad
  exports:
    stl: /assets/3d/customizable-cable-grommet/customizable-cable-grommet.stl
    3mf: /assets/3d/customizable-cable-grommet/customizable-cable-grommet.3mf
  previews:
    isometric: /assets/images/3d/customizable-cable-grommet-isometric.png
    ortho: /assets/images/3d/customizable-cable-grommet-ortho.png
    overlay: /assets/overlays/customizable-cable-grommet.png
  designed_for: "Desk cable management, 60 mm hole"
  material: "PLA, PETG"
  print_settings:
    nozzle: 0.4
    layer_height: 0.2
    infill: "15% gyroid"
    supports: false
  dimensions:
    width: 76
    depth: 76
    height: 28
intended_audience: practitioner
proficiency_level: intermediate
knowledge_prerequisites:
  - concept: openscad-basics
    label: "Sintassi OpenSCAD e baionetta (parti 1-2)"
    importance: required
difficulty_declared:
  conceptual: 2
  technical: 3
  mathematical: 2
_computation:
  r_version: "4.5.3"
  packages:
    - ggplot2
    - dplyr
  rendered_at: "2026-06-08 00:51:30.374482"
  knitr_device: svglite
---

Nelle prime due parti di questa serie abbiamo imparato la sintassi di OpenSCAD e la geometria dell'attacco a baionetta. In quest'ultima parte vediamo come si *usa* il modello: il sistema di modalità che permette di passare dalla vista d'assieme all'esportazione per la stampa, il rendering blueprint e la geometria dell'apertura parabolica del tappo.

---

## Il `mode` system: un interruttore per il modello

Nei miei progetti OpenSCAD, ogni file contiene un parametro `mode` che controlla *cosa* viene visualizzato. Non è un'idea originale — molti designer lo usano — ma la versione che ho standardizzato è diventata archetipica per tutti i miei modelli:

```openscad
/* [View] */

// Which part(s) to display
mode = "exploded"; // [assembly:Assembly, exploded:Exploded, top:Top part, bottom:Bottom part, cap:Cap only, print:Print layout]
```

Le sei modalità disponibili:

| Mode | Cosa mostra | A cosa serve |
|---|---|---|
| `assembly` | I tre pezzi in posizione di montaggio | Capire come si incastrano |
| `exploded` | I tre pezzi distanziati lungo l'asse Z | Vedere ogni componente isolato |
| `top` | Solo il manicotto superiore | Ispezionare slot e flange |
| `bottom` | Solo l'anello inferiore | Ispezionare pin e collare |
| `cap` | Solo il tappo | Ispezionare l'apertura parabolica |
| `print` | I tre pezzi appoggiati sul piano di stampa | Esportare per lo slicer |

L'implementazione è un semplice `if` / `else if`:

```openscad
if (mode == "assembly") {
    assembly(gap = 0);
}
else if (mode == "exploded") {
    assembly(gap = explode_distance);
}
else if (mode == "top") {
    top_part();
}
else if (mode == "bottom") {
    bottom_part();
}
else if (mode == "cap") {
    cap_part();
}
else if (mode == "print") {
    translate([-(top_lip_od/2 + 5), 0, 0])
        rotate([180, 0, 0])
            translate([0, 0, -(sleeve_h + top_lip_h)])
                top_part();
    // ... bottom e cap analogamente
}
```

Il Customizer di Thingiverse interpreta il commento `// [choice1:Label1, choice2:Label2]` come un menu a tendina, rendendo la selezione della modalità banale anche per chi non ha mai aperto l'editor OpenSCAD.

---

## Vista esplosa: separare per capire

La vista esplosa è realizzata con un unico parametro `explode_distance`:

```openscad
module assembly(gap = 0) {
    color("DimGray")   top_part();
    color("SteelBlue") bottom_part_placed(extra_drop = gap);
    color("Khaki")     cap_part_placed(extra_lift = gap);
}
```

Quando `gap = 0`, i pezzi sono nella posizione di montaggio. Quando `gap > 0`, il bottom viene traslato verso il basso e il cap verso l'alto della stessa quantità. L'effetto è che i tre pezzi si separano lungo l'asse di assemblaggio, rivelando gli slot a L, i pin e la gola di snap.

Le chiamate `color()` non influenzano la geometria: servono solo a distinguere i pezzi nella vista di anteprima (F5). Ogni colore corrisponde a un pezzo specifico — una convenzione che rende immediatamente chiaro cosa si sta guardando.

---

## Layout di stampa: orientamento ottimale

La modalità `print` è quella che uso per esportare i file STL e 3MF. Non si limita a mostrare i pezzi: li posiziona già nell'orientamento ottimale per la stampa:

```openscad
// Top — lip face-down
translate([-(top_lip_od/2 + 5), 0, 0])
    rotate([180, 0, 0])
        translate([0, 0, -(sleeve_h + top_lip_h)])
            top_part();
```

Il manicotto superiore viene **ribaltato**: la flangia d'appoggio va sul piatto di stampa, il corpo tubolare punta verso l'alto. Così non servono supporti.

L'anello inferiore viene stampato con la flangia inferiore sul piatto (il collare punta verso l'alto). Il tappo viene ribaltato: il disco pieno sul piatto, la gonna verso l'alto.

Ogni pezzo è anche **traslato orizzontalmente** per non sovrapporsi agli altri. In questo modo, un unico comando produce un layout di stampa completo:

```bash
openscad -o customizable-cable-grommet.stl -D mode=\"print\" customizable-cable-grommet.scad
```

Il risultato è un unico file STL con tutti e tre i pezzi. Lo slicer li riconosce come oggetti separati e potete organizzarli sul piatto come preferite.

---

## Rendering blueprint: edge detection e palette

Il rendering delle viste isometriche e ortogonali che vedete in questa serie di articoli non esce direttamente da OpenSCAD. È il risultato di una piccola pipeline di post-processing che ho automatizzato con ImageMagick:

1. OpenSCAD esporta un PNG in modalità anteprima (`--preview`) con schema di colori `DeepOcean` (sfondo blu scuro, linee chiare).
2. ImageMagick applica un **edge detection morfologico** (`EdgeIn Diamond`) che estrae i contorni geometrici.
3. I contorni vengono **dilatati** (`Dilate Disk`) per renderli visibili anche dopo il downscaling per i social.
4. Lo sfondo blu scuro di OpenSCAD viene reso trasparente.
5. La palette viene rimappata sulla palette blueprint: sfondo `#002082` (Tech Dark Blue), linee `#3057E1` (Luminous), `#CED8F7` (Blue Cream).

Il risultato è un'immagine in stile "blueprint" tecnico che richiama le vecchie tavole di disegno — molto più d'impatto di uno screenshot di OpenSCAD.

---

## La parabola del tappo

Il tappo del passacavo non è un semplice disco con un foro. L'apertura per i cavi ha una forma **parabolica**: il vertice della parabola è al centro del tappo e i due rami si aprono simmetricamente verso il bordo.

{% cloudinary /assets/figures/2026-06-20-openscad-tutorial-parte-3/parabola-plot-1.svg alt="Parametri geometrici dell'apertura parabolica: vertice al centro (0,0), rami simmetrici lungo l'asse y, arco esterno di raggio r_open" caption="Parametri geometrici dell'apertura parabolica: vertice al centro (0,0), rami simmetrici lungo l'asse y, arco esterno di raggio r_open" role="diagram" context="architecture" %}

La parabola è definita dall'equazione:

$$y(x) = \left(\frac{x}{x\_edge}\right)^2 \cdot y\_edge$$

dove $(x\_edge, y\_edge)$ sono le coordinate del punto in cui la parabola interseca il bordo del tappo. Questi valori derivano dai parametri `arc_deg` (l'apertura angolare) e `r_open` (il raggio effettivo):

```openscad
x_edge = r_open * sin(arc_deg/2);
y_edge = r_open * cos(arc_deg/2);
```

La curva viene discretizzata in `n_seg` segmenti e unita a un arco di cerchio che segue il bordo esterno del tappo. Il profilo 2D risultante viene estruso con `linear_extrude()` e sottratto dal corpo del tappo con `difference()`.

Un dettaglio importante: gli angoli vivi della parabola (il vertice e le giunzioni con l'arco) vengono **raccordati** con un offset bidirezionale:

```openscad
offset(r =  corner_r)
    offset(r = -corner_r)
        polygon(pts);
```

La prima `offset(r)` espande il poligono, la seconda `offset(-r)` lo contrae. Il risultato netto è che tutti gli angoli con raggio inferiore a `corner_r` vengono smussati. È un trucco elegante per ottenere raccordi senza calcolare manualmente le tangenti — e funziona su qualsiasi poligono.

Questo pattern — profilo 2D → estrusione lineare → sottrazione — è uno dei più potenti in OpenSCAD. Vale per qualsiasi forma che possa essere descritta da un perimetro 2D: asole, intagli decorativi, guide per cavi.

---

## Il workflow completo

Ricapitolando il flusso di lavoro per un progetto OpenSCAD secondo il mio metodo:

1. **Progettate** il modello nell'editor (F5 per anteprima veloce, F6 per render completo).
2. **Regolate** i parametri nel pannello Customizer finché non siete soddisfatti.
3. **Esportate** con `mode="print"` per ottenere STL/3MF pronti per lo slicer.
4. **Generate** i rendering blueprint con la pipeline ImageMagick.
5. **Pubblicate** sorgenti e file sul vostro repository.

L'intera pipeline è automatizzata tramite `make cad`, che esegue validazione, esportazione STL/3MF, rendering blueprint e compositing ortografico in un unico comando. I file generati finiscono nelle directory `assets/3d/` (per la stampa), `assets/images/3d/` (per le anteprime) e `assets/overlays/` (per il compositing).

---

## Conclusione della serie

In tre articoli abbiamo coperto l'intero flusso di lavoro OpenSCAD: dalla sintassi di base alla geometria complessa, dal sistema di modalità all'esportazione per la stampa. Il passacavo parametrico da scrivania è un progetto reale, stampabile e utile — non un esempio didattico fine a sé stesso.

Tutto il codice è disponibile su GitHub, e i file STL e 3MF pronti per lo slicer sono nella directory `assets/3d/`. Se stampate il passacavo, fatemi sapere come è venuto — e con quali parametri.

{% post_link /3d-printing/openscad-tutorial-parte-1/ "Parte 1: Primi passi nel CAD parametrico" role="prerequisite" context="provides-context" target="internal" %}
{% post_link /3d-printing/openscad-tutorial-parte-2/ "Parte 2: La geometria dell'attacco a baionetta" role="prerequisite" context="provides-context" target="internal" %}
