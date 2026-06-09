---
layout: asset-3d
title: "La geometria dell'attacco a baionetta"
category: 3D Printing
excerpt: "Seconda parte del tutorial OpenSCAD: analizziamo la geometria dell'attacco a baionetta del passacavo parametrico. Pin radiali, slot a L, tolleranze e scelte progettuali per un incastro stampabile senza supporti."
master: /assets/images/3d/customizable-cable-grommet-ortho.png
header:
  overlay_filter: 0.5
  transform: keystone
  intensity: high
tags: [OpenSCAD, 3D Printing, CAD, parametric, tutorial, baionetta, tolleranze]
series:
  id: "passacavo-parametrico-scrivania"
  title: "Passacavo parametrico da scrivania"
  part: 2
  total_parts: 3
broadcast:
  channels: [linkedin, mastodon]
  linkedin_image:
    logo: true
    caption: true
    color: white
    transform: keystone
    intensity: high
  mastodon_image:
    logo: true
    caption: true
    color: white
    transform: keystone
    intensity: high
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
    label: "Sintassi OpenSCAD (parte 1 della serie)"
    importance: required
difficulty_declared:
  conceptual: 3
  technical: 4
  mathematical: 2
---

Nella {% post_link /3d-printing/openscad-tutorial-parte-1/ "prima parte" role="prerequisite" context="provides-context" target="internal" %} abbiamo visto la struttura generale del codice e le operazioni fondamentali di OpenSCAD. Ora scendiamo nel dettaglio del componente più interessante del passacavo: **l'attacco a baionetta**.

Un attacco a baionetta è un meccanismo di fissaggio che unisce due pezzi tramite una combinazione di inserimento assiale e rotazione. Lo troviamo negli obiettivi fotografici, nei tappi dei radiatori e — nel nostro caso — in un passacavo da scrivania che deve restare saldo senza viti, colla o incastri a pressione impossibili da stampare.

---

## Perché una baionetta e non una filettatura

La scelta non è estetica: è dettata dai vincoli della stampa 3D FDM. Una filettatura su un pezzo di 60 mm di diametro con pareti di 3 mm avrebbe questi problemi:

1. **Supporti inevitabili**. Il profilo di un filetto crea sporgenze che richiederebbero supporti, rovinando la finitura superficiale.
2. **Tolleranze critiche**. Una filettatura stampata in PLA ha giochi imprevedibili: troppo stretta si grippa, troppo larga balla.
3. **Orientamento di stampa**. I tre pezzi del passacavo vengono stampati in orientamenti diversi. Una filettatura sul manicotto sarebbe stampata in verticale (ok), ma sull'anello sarebbe orizzontale (pessimo).

L'attacco a baionetta risolve tutti e tre i problemi: i pin e gli slot sono geometrie semplici, stampabili senza supporti, e le tolleranze si controllano con un unico parametro.

---

## L'anatomia della baionetta

Il meccanismo si compone di due elementi:

- **Pin radiali** sul collare dell'anello inferiore (`bottom_part`). Sono denti che sporgono verso l'esterno.
- **Slot a L** scavati nella parete interna del manicotto superiore (`top_part`). Ogni slot ha tre zone: un ingresso verticale, un corridoio orizzontale e una tacca di ritenzione.

L'assemblaggio funziona così: si allineano i pin con gli ingressi verticali, si spinge l'anello fino in fondo, si ruota in senso orario. I pin percorrono il corridoio orizzontale e scattano nella tacca di ritenzione, dove restano bloccati.

<!-- TODO_SCREENSHOT: Screenshot della vista ortho-top del grommet con annotazioni che mostrano pin, slot verticale, corridoio orizzontale e tacca di ritenzione. Posizionare qui sopra. -->

---

## Il pin: un dente radiale

Il pin è sorprendentemente semplice. Non è un cilindro: è un settore di anello, generato dalla primitiva `ring_sector` che abbiamo introdotto nella parte 1:

```openscad
module bayonet_pin(r_inner, h, w_deg, t) {
    rotate([0, 0, -w_deg/2])
        ring_sector(r_inner, r_inner + t, h, w_deg);
}
```

I parametri del pin sono:

- `r_inner`: il raggio interno a cui inizia il dente (tipicamente il raggio esterno del collare)
- `h` (`bayo_pin_h = 2.4`): l'altezza assiale
- `w_deg` (`bayo_pin_w_deg = 14`): la larghezza angolare in gradi
- `t` (`bayo_pin_t = 1.4`): la sporgenza radiale

La `rotate([0, 0, -w_deg/2])` centra il pin sull'angolo zero, semplificando il posizionamento nel pattern circolare:

```openscad
for (i = [0 : bayo_pins-1]) {
    rotate([0, 0, i * 360/bayo_pins])
        translate([0, 0, pin_z_on_collar])
            bayonet_pin(
                r_inner = collar_od/2,
                h       = bayo_pin_h,
                w_deg   = bayo_pin_w_deg,
                t       = bayo_pin_t
            );
}
```

Tre pin (`bayo_pins = 3`) equidistanti a 120°. Tre è il numero ottimale: due potrebbero basculare, quattro sarebbero sovrabbondanti e ridurrebbero la superficie di contatto di ciascuno.

---

## Lo slot a L: tre settori sovrapposti

Lo slot è più articolato del pin. Deve permettere l'inserimento assiale, la rotazione e infine il bloccaggio. Si realizza con tre `ring_sector` sovrapposti:

```openscad
module bayonet_slot_L(r_inner_wall, axial_in, h_pin, w_pin_deg, twist_deg, drop_extra) {
    eps = 0.05;
    r1 = r_inner_wall - eps;
    r2 = r_inner_wall + slot_depth_r + eps;

    rotate([0, 0, -w_pin_deg/2]) {
        // 1) Vertical entry slot (open at the bottom edge)
        translate([0, 0, -eps])
            ring_sector(r1, r2, axial_in + eps, w_pin_deg);

        // 2) Horizontal travel
        translate([0, 0, axial_in - h_pin - eps])
            ring_sector(r1, r2, h_pin + 2*eps, w_pin_deg + twist_deg);

        // 3) Retention notch at end of travel
        rotate([0, 0, twist_deg])
            translate([0, 0, axial_in - h_pin - eps])
                ring_sector(r1, r2, h_pin + drop_extra + 2*eps, w_pin_deg);
    }
}
```

Analizziamo i tre settori:

1. **Ingresso verticale** (settore 1). Parte dal bordo inferiore del manicotto (`z = -eps`) e sale per `axial_in` millimetri. Ha larghezza `w_pin_deg`: quanto basta per far passare il pin.

2. **Corridoio orizzontale** (settore 2). Si estende per `w_pin_deg + twist_deg` gradi. Qui il pin può ruotare dopo l'inserimento. La larghezza extra (`+ twist_deg`) è lo spazio di manovra.

3. **Tacca di ritenzione** (settore 3). Alla fine del corridoio, un piccolo gradino (`drop_extra = 0.5` mm) in cui il pin "cade" e si blocca. Questo è il segreto per cui la baionetta non si svita da sola: la gravità (o una leggera pressione della molla del tappo) tiene il pin nella tacca.

I tre settori sono **intenzionalmente sovrapposti** (`eps = 0.05` mm) per evitare che il motore CSG di OpenSCAD generi facce orfane (non-manifold) nelle zone di confine tra settori adiacenti. Senza questa sovrapposizione, l'operazione di `difference()` produrrebbe artefatti visibili e potenziali errori di esportazione STL.

---

## Tolleranze: il vero progetto

La differenza tra un incastro che funziona e uno che si inceppa sta nei parametri di tolleranza. Nel passacavo sono tutti espliciti:

```openscad
bayo_slot_play = 0.4;   // Radial and axial clearance inside the slots
bayo_drop_extra = 0.5;  // Extra axial drop for retention snap
```

`bayo_slot_play` aggiunge 0.4 mm di gioco in tutte le direzioni all'interno dello slot. È il parametro che regola la "morbidezza" dell'incastro: aumentatelo se la vostra stampante tende a sovra-estrudere, diminuitelo se l'incastro balla.

La profondità radiale dello slot è `bayo_pin_t + bayo_slot_play`: la sporgenza del pin più il gioco. L'altezza del pin nello slot è `bayo_pin_h + 2*bayo_slot_play`: altezza pin più gioco assiale sopra e sotto.

Questa disciplina — **ogni tolleranza è una variabile con nome** — è ciò che trasforma un modello "può funzionare" in un modello "funziona sulla *tua* stampante".

---

## Posizionamento e rotazione di lock

Un dettaglio importante: nella vista esplosa (e nell'assieme montato), i pin dell'anello inferiore appaiono già ruotati nella posizione di bloccaggio:

```openscad
module bottom_part_placed(extra_drop = 0) {
    translate([0, 0, -extra_drop])
        rotate([0, 0, -bayo_twist_deg])
            bottom_part();
}
```

La `rotate([0, 0, -bayo_twist_deg])` pre-ruota l'intero anello in modo che, nella visualizzazione, i pin appaiano già nella tacca di ritenzione — esattamente come sarebbero dopo l'assemblaggio reale. È un accorgimento puramente visivo, ma rende le viste renderizzate molto più chiare.

<!-- TODO_SCREENSHOT: Screenshot della vista isometrica esplosa blueprint che mostra i tre pin in posizione di lock. Posizionare qui sopra. -->

---

## Le dimensioni contano

Con 3 mm di spessore parete (`wall`), lo slot a L scava `slot_depth_r = bayo_pin_t + bayo_slot_play = 1.4 + 0.4 = 1.8` mm nella parete. Restano `3.0 - 1.8 = 1.2` mm di materiale residuo — abbastanza per la resistenza meccanica, abbastanza per la stampabilità. Se `wall` scendesse sotto i 2 mm, lo slot rischierebbe di perforare la parete. Il Customizer lascia all'utente la responsabilità di non scendere sotto i limiti fisici — ma almeno i numeri sono tutti lì, verificabili.

---

## Riepilogo: cosa abbiamo imparato

- Una baionetta è preferibile a una filettatura per pezzi stampati in FDM: **niente supporti, tolleranze controllabili, geometria semplice**.
- Il **pin** è un settore di anello, generato con `ring_sector`.
- Lo **slot a L** è composto da tre settori sovrapposti: ingresso, corsa, ritenzione.
- Le **tolleranze** (`bayo_slot_play`, `bayo_drop_extra`) sono parametri espliciti.
- La **sovrapposizione** dei settori (`eps`) previene artefatti CSG.

Nella terza e ultima parte della serie vedremo il sistema di **modalità di visualizzazione** (`mode`) che permette di passare dalla vista d'assieme alla vista esplosa, al layout di stampa e all'esportazione STL/3MF con un semplice parametro.

{% post_link /3d-printing/openscad-tutorial-parte-1/ "Parte 1: Primi passi nel CAD parametrico" role="prerequisite" context="provides-context" target="internal" %}
{% post_link /3d-printing/openscad-tutorial-parte-3/ "Parte 3: Mode system, rendering ed esportazione" role="deepening" context="extends-topic" target="internal" %}
