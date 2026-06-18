---
layout: asset-3d
title: "Passacavi da scrivania: geometrie interne e innesto a baionetta"
category: 3D Printing
excerpt: "Seconda parte del tutorial OpenSCAD: analizziamo la geometria dell'innesto del passacavo parametrico. Vedremo i pattern iterativi, la gestione delle tolleranze e le scelte progettuali  affinché il nostro oggetto sia effettivamente stampabile."
master: /assets/images/3d/customizable-cable-grommet-ortho.png
header:
  overlay_filter: 0.5
  transform: keystone
  intensity: high
tags: [OpenSCAD, 3D Printing, CAD, modellizzazione parametrica, incastri stampabili]
series:
  id: "passacavi-parametrico-scrivania"
  title: "Passacavi parametrico da scrivania"
  part: 2
  total_parts: 3
broadcast:
  channels: [linkedin, mastodon]
  linkedin_image:
    logo: openscad.png
    caption: "OpenSCAD Tutorial: Gli innesti a baionetta"
    color: white
    transform: keystone
    intensity: high
  mastodon_image:
    logo: openscad.png
    caption: 'OpenSCAD Tutorial pt.2: Bayonet mount parametric design'
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
  - concept: openscad
    label: "OpenSCAD"
    url: "https://openscad.org/"
    sameAs: "https://www.wikidata.org/wiki/Q3353120"
    importance: required
    depth: 2
  - concept: stampa-3d-fdm
    label: "Stampa 3D FDM"
    url: "https://it.wikipedia.org/wiki/Stampa_3D"
    sameAs: "https://www.wikidata.org/wiki/Q229367"
    importance: recommended
    depth: 2
  - concept: filettatura
    label: "Filettatura"
    url: "https://it.wikipedia.org/wiki/Filettatura"
    sameAs: "https://www.wikidata.org/wiki/Q749400"
    importance: recommended
    depth: 1
  - concept: csg
    label: "CSG (Constructive Solid Geometry)"
    url: "https://en.wikipedia.org/wiki/Constructive_solid_geometry"
    sameAs: "https://www.wikidata.org/wiki/Q1128371"
    importance: recommended
    depth: 3
  - concept: supporti-di-stampa
    label: "Supporti di stampa 3D"
    importance: recommended
    depth: 1
  - concept: tolleranze-meccaniche
    label: "Tolleranze meccaniche"
    importance: recommended
    depth: 2
  - concept: orientamento-di-stampa
    label: "Orientamento di stampa 3D"
    importance: recommended
    depth: 2
  - concept: geometria-non-manifold
    label: "Geometria non-manifold"
    url: "https://en.wikipedia.org/wiki/Manifold"
    importance: helpful
    depth: 3
  - concept: stl
    label: "STL (formato di file)"
    url: "https://it.wikipedia.org/wiki/STL_(formato_di_file)"
    sameAs: "https://www.wikidata.org/wiki/Q1238229"
    importance: helpful
    depth: 1
  - concept: 3mf
    label: "3MF (3D Manufacturing Format)"
    url: "https://en.wikipedia.org/wiki/3D_Manufacturing_Format"
    sameAs: "https://www.wikidata.org/wiki/Q15029253"
    importance: helpful
    depth: 2
  - concept: cad-parametrico
    label: "CAD parametrico"
    url: "https://it.wikipedia.org/wiki/Computer-aided_design"
    importance: helpful
    depth: 2
  - concept: pla
    label: "PLA (acido polilattico)"
    url: "https://it.wikipedia.org/wiki/Acido_polilattico"
    sameAs: "https://www.wikidata.org/wiki/Q413769"
    importance: helpful
    depth: 1
  - concept: petg
    label: "PETG"
    url: "https://en.wikipedia.org/wiki/Polyethylene_terephthalate#Glycol-modified_PET"
    importance: helpful
    depth: 2
  - concept: innesto-a-baionetta
    label: "Innesto a baionetta"
    url: "https://it.wikipedia.org/wiki/Innesto_a_baionetta"
    importance: helpful
    depth: 2
  - concept: aritmetica-virgola-mobile
    label: "Aritmetica a virgola mobile"
    url: "https://it.wikipedia.org/wiki/Numero_in_virgola_mobile"
    sameAs: "https://www.wikidata.org/wiki/Q47296719"
    importance: helpful
    depth: 2
  - concept: pattern-eps
    label: "Pattern epsilon (eps)"
    importance: helpful
    depth: 2
  - concept: for-openscad
    label: "Ciclo for in OpenSCAD"
    importance: helpful
    depth: 2
  - concept: intersection-for
    label: "intersection_for in OpenSCAD"
    importance: helpful
    depth: 3
  - concept: slot-a-l
    label: "Slot a L (innesto a baionetta)"
    importance: helpful
    depth: 2
  - concept: pin-radiale
    label: "Pin radiale"
    importance: helpful
    depth: 1
  - concept: unione-implicita-openscad
    label: "Unione implicita in OpenSCAD"
    importance: helpful
    depth: 2
  - concept: delaminazione
    label: "Delaminazione (stampa 3D)"
    importance: helpful
    depth: 2
  - concept: sovra-estrusione
    label: "Sovra-estrusione"
    importance: helpful
    depth: 2
  - concept: ugello
    label: "Ugello (stampa 3D)"
    importance: helpful
    depth: 1
  - concept: infill
    label: "Infill (riempimento)"
    importance: helpful
    depth: 1
  - concept: gyroid
    label: "Gyroid"
    url: "https://en.wikipedia.org/wiki/Gyroid"
    importance: helpful
    depth: 2
difficulty_declared:
  conceptual: 3
  technical: 4
  mathematical: 2
difficulty_computed:
  semantic:
    concept_count: 12
    concept_density: 0.3
    jargon_ratio: 7.5
    definition_coverage: 0.54
    external_knowledge_demand: 11
    prerequisite_depth: 1.8
    math_density: 0.0
    code_density: 2.3
    blocking_prerequisite_count: 1
image_meta:
  role: illustration
  context: ambient
  caption: "Vista ortografica del passacavo parametrico con innesto a baionetta"
---

Nella {% post_link /3d-printing/openscad-tutorial-parte-1/ "prima parte" role="prerequisite" context="provides-context" target="internal" %} abbiamo visto la struttura generale del codice e le operazioni fondamentali di OpenSCAD. Ora scendiamo nel dettaglio del componente più interessante del passacavo, e che ci consentirà di scendere più nel dettaglio dei pattern geometrici più utilizzati nella progettazione: **l'innesto a baionetta**.

Un innesto a baionetta è un meccanismo di fissaggio, tipico degli obiettivi fotografici, che unisce due pezzi tramite una combinazione di inserimento assiale e rotazione. Lo troviamo negli obiettivi fotografici, nei tappi dei radiatori e — nel nostro caso — in un passacavo da scrivania che deve restare saldo senza viti, colla o incastri a pressione. Lo so, lo so, per la destinazione d'uso, non c'era alcun motivo di realizzare questa componente. Ma mi è sembrato un ottimo approfondimento per gli scopi prettamente divulgativi di questa serie.

Quindi, appurata la necessità "divulgativa" di avere un elemento inferiore nell'assieme, la prima domanda è...

---

## Perché una baionetta e non una filettatura

La scelta è puramente pratica e dettata dai vincoli della {% xlink "https://it.wikipedia.org/wiki/Stampa_3D" "stampa 3D FDM" role="prerequisite" context="provides-context" target="external-authoritative" description="Tecnica di manifattura additiva che costruisce oggetti per deposizione di materiale fuso strato dopo strato." sameAs="https://www.wikidata.org/wiki/Q229367" %}. Una {% xlink "https://it.wikipedia.org/wiki/Filettatura" "filettatura" role="prerequisite" context="provides-context" target="external-authoritative" description="Rilievo elicoidale continuo su superficie cilindrica o conica usato come meccanismo di fissaggio o trasmissione del moto." sameAs="https://www.wikidata.org/wiki/Q749400" %} su un pezzo di 60 mm di diametro con pareti di 3 mm avrebbe questi problemi:

1. **Supporti inevitabili**. Il profilo di un filetto crea sporgenze che richiederebbero supporti, peraltro di quelli difficilmente rimovibili. E io _odio_ i supporti difficilmente rimovibili (come tutti).
2. **Tolleranze critiche**. Una filettatura stampata in PLA è molto sensibile alle tolleranze: troppo stretta si grippa, troppo larga balla.
3. **Orientamento di stampa**. I tre pezzi del passacavo vengono stampati in orientamenti diversi. Una filettatura sul manicotto sarebbe stampata in verticale (ok), ma sull'anello sarebbe orizzontale (pessimo). La resistenza alla delaminazione, infatti, dipende da come è orientato l'oggetto e, quindi, dall'asse di carico. Di nuovo, in questo caso parliamo di quasi totale assenza di carico, ma teniamolo come principio generale che male non farà.

L'innesto a baionetta risolve tutti e tre i problemi: i pin e gli slot sono geometrie semplici, stampabili senza supporti o con supporti minimi e le tolleranze si controllano con un unico parametro a prescindere dall'orientamento sul piano di stampa dei vari componenti dell'assieme. E poi, è anche bello da vedere!

{% cloudinary /assets/images/3d/thread-vs-bayonet-comparison.svg alt="Diagramma comparativo: sezione di una filettatura con supporti e tolleranze critiche (a sinistra) e sviluppo piano di un innesto a baionetta con slot a L e pin (a destra)" caption="Filettatura vs innesto a baionetta: la filettatura genera sporgenze che richiedono supporti e ha tolleranze critiche, il che la rende una geometria difficile da stampare; la baionetta è geometricamente autosupportante e con gioco costante." role="diagram" context="comparison" long_description="A sinistra: sezione trasversale di un accoppiamento filettato tra manicotto (azzurro) e vite (grigio). I denti trapezoidali della filettatura creano sporgenze superiori a 45° (evidenziate) che richiedono supporti di stampa. La zona di tolleranza critica è indicata da frecce in arancione. A destra: sviluppo piano della parete interna del manicotto con slot a L composto da ingresso verticale (1), corridoio orizzontale (2) e tacca di ritenzione (3). Il pin (verde) compie un percorso a baionetta: inserimento assiale, rotazione, scatto nella tacca." %}

---

## L'anatomia della baionetta

Il meccanismo si compone di due elementi:

- **Pin radiali** sul collare dell'anello inferiore (`bottom_part`). Sono denti che sporgono verso l'esterno.
- **Slot a L** scavati nella parete interna del manicotto superiore (`top_part`). Ogni slot ha tre zone: un ingresso verticale, un corridoio orizzontale e una tacca di ritenzione.

L'assemblaggio funziona così: si allineano i pin con gli ingressi verticali, si spinge l'anello fino in fondo, si ruota in senso orario. I pin percorrono il corridoio orizzontale e scattano nella tacca di ritenzione, dove restano bloccati.

---

## Il pin: un dente radiale

Il pin è un piccolo settore di anello, generato dalla primitiva `ring_sector` che abbiamo introdotto nella parte 1:

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

La `rotate([0, 0, -w_deg/2])` centra il pin sull'angolo zero, a quel punto serve solo un ciclo ```for``` per definire il pattern circolare:

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

Tre pin (`bayo_pins = 3`) equidistanti a 120°. Tre è il numero ottimale: due potrebbero basculare, quattro sarebbero sovrabbondanti e ridurrebbero la superficie di contatto. Tre è il numero perfetto, tanto per cambiare.

---

## Il ciclo `for`: iterazione geometrica

Il posizionamento dei tre pin introduce una feature di OpenSCAD che non avevamo ancora incontrato: il ciclo **`for`**. Diversamente dai linguaggi imperativi, in OpenSCAD `for` non esegue istruzioni ripetutamente: genera _copie multiple_ dell'oggetto che segue, ciascuna con un valore diverso della variabile di iterazione.

```openscad
for (i = [0 : bayo_pins-1]) {
    rotate([0, 0, i * 360/bayo_pins])
        translate([0, 0, pin_z_on_collar])
            bayonet_pin(...);
}
```

La sintassi `[start : end]` produce un range: con `bayo_pins = 3`, la sequenza è `[0, 1, 2]`. Si può usare anche `[start : step : end]` per controllare l'incremento. Il pattern `i * 360 / N` distribuisce N oggetti in cerchio: ogni copia viene ruotata di un angolo proporzionale al suo indice.

**Differenza chiave**: in un linguaggio imperativo, un `for` esegue il corpo N volte _in sequenza_. In OpenSCAD, il `for` produce N _istanze geometriche_ che vengono automaticamente unite (è implicita una `union()`). Questo ha due conseguenze:

1. **Non potete creare o modificare una variabile dentro il ciclo** — le variabili sono immutabili, e comunque ogni iterazione è un contesto indipendente.
2. **Il risultato è sempre un singolo solido** (l'unione di tutte le copie), non N solidi separati. Se volete solidi indipendenti, dovete usare costrutti diversi (ad esempio moduli separati per ogni pezzo dell'assieme, come già fatto con `top_part()`, `bottom_part()` e `cap_part()`).

### `intersection_for`: quando serve l'intersezione

La `union()` implicita del `for` standard è pratica, ma rende impossibili altri tipi di combinazioni booleana. Il caso classico: volete l'intersezione di N copie di un oggetto, ciascuna ruotata progressivamente.

```openscad
// Questo NON funziona come ci si aspetta:
intersection() {
    for (n = [1 : 6]) {
        rotate([0, 0, n * 60])
            translate([5, 0, 0])
                sphere(r = 12);
    }
}
```

{% cloudinary /assets/images/openscad-tutorial-parte-2-1.png alt="Screenshot di OpenSCAD di una intersezione tra una collezione di sfere" caption="L'intersezione di una unione non funziona come ci si aspetterebbe" width=50 %}

Il problema è che il `for` interno raggruppa tutte le sfere in una `union()` prima ancora che `intersection()` le veda. L'intersezione viene calcolata tra... l'unione di tutte le sfere e nient'altro. Risultato: l'unionee.

**`intersection_for`** risolve esattamente questo: sintassi identica al `for`, ma l'unione implicita è sostituita dall'intersezione:

```openscad
// Questo SÌ che funziona:
intersection_for(n = [1 : 6]) {
    rotate([0, 0, n * 60])
        translate([5, 0, 0])
            sphere(r = 12);
}
```

{% cloudinary /assets/images/openscad-tutorial-parte-2-2.png alt="Screenshot di OpenSCAD dell'operazione di intersezione tra una collezione di sfere" caption="L'intersezione senza unione richiede l'uso di un costrutto for apposito" width=50 %}

---

## Lo slot a L: tre settori sovrapposti

Lo slot è più articolato del pin. Deve permettere l'inserimento assiale, la rotazione e infine il bloccaggio. La logica, però è la stessa, in quanto si realizza con tre `ring_sector` sovrapposti. Sono tutti concetti che abbiamo già visto:

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
{% cloudinary /assets/images/openscad-tutorial-parte-2-3.png alt="Screenshot OpenSCAD con dettaglio dello slot a baionetta" caption="Dettaglio di come si presenta uno slot per l'innesto a baionetta. È, di fstto, un set di tre scassi vagamente a forma di L, distanziati di 120° sulla superficie interna del cilindro" width=50 %}

Analizziamo i tre settori:

1. **Ingresso verticale** (settore 1). Parte dal bordo inferiore del manicotto (`z = -eps`) e sale per `axial_in` millimetri. Ha larghezza `w_pin_deg`: quanto basta per far passare il pin.

2. **Corridoio orizzontale** (settore 2). Si estende per `w_pin_deg + twist_deg` gradi. Qui il pin può ruotare dopo l'inserimento. La larghezza extra (`+ twist_deg`) è lo spazio di manovra.

3. **Tacca di ritenzione** (settore 3). Alla fine del corridoio, un piccolo gradino (`drop_extra = 0.5` mm) in cui il pin "cade" e si blocca. Questo è il segreto per cui la baionetta non si svita da sola: la gravità (o una leggera pressione della molla del tappo) tiene il pin nella tacca.

### Il pattern `eps`: sovrapposizione anti-artefatti

I tre settori sono **intenzionalmente sovrapposti** (`eps = 0.05` mm) per evitare che il motore {% xlink "https://en.wikipedia.org/wiki/Constructive_solid_geometry" "CSG" role="prerequisite" context="provides-context" target="external-authoritative" description="Tecnica di modellazione solida che combina primitive geometriche tramite operazioni booleane di unione, differenza e intersezione." sameAs="https://www.wikidata.org/wiki/Q1128371" %} di OpenSCAD generi facce orfane ({% xlink "https://en.wikipedia.org/wiki/Manifold" "non-manifold" role="prerequisite" context="provides-context" target="external-authoritative" description="In geometria computazionale, una superficie non-manifold contiene spigoli condivisi da più di due facce, causando ambiguità topologiche nella mesh." %}) nelle zone di confine tra settori adiacenti o perfettamente complanari. Senza questa abbondanza, l'operazione di `difference()` produrrebbe artefatti visibili e potenziali errori di esportazione STL.

Questo pattern è un accorgimento ricorrente nella modellazione CSG e merita un approfondimento.

**Il problema.** Quando due primitive condividono esattamente una faccia (sono _complanari_), il motore CSG non sa decidere se i punti su quella faccia appartengano a un solido, all'altro, o a nessuno dei due. Il risultato sono micro-fratture nella mesh, normali invertite, o il rifiuto dell'esportazione STL con errori del tipo "Object may not be a valid 2-manifold".

Ma perché succede? La causa è una proprietà intrinseca dell'aritmetica a virgola mobile con cui lavorano tutti i computer. Tre meccanismi cospirano:

1. **Numeri con la virgola.** I computer rappresentano i numeri reali con precisione finita (tipicamente 15-17 cifre significative). `1/3` non è `0.333...` all'infinito ma `0.3333333333333333`. È un'approssimazione talmente buona da essere indistinguibile nella stampa, ma sufficiente a confondere il CSG.
2. **Rotazioni e trigonometria.** Ogni `rotate([0, 0, 45])` chiama `sin(45°)` e `cos(45°)` che valgono `√2/2 ≈ 0.7071067811865476`. La radice di 2 è un numero irrazionale — ha infinite cifre decimali. Il computer la tronca. Dopo una rotazione, le coordinate dei vertici non sono mai esattamente dove la geometria "pura" le vorrebbe.
3. **Catena di operazioni.** Un `rotate()` seguito da `translate()`, poi `difference()`, poi un altro `rotate()`... ogni passaggio accumula errori di arrotondamento. Due facce che _dovrebbero_ essere a `z = 10.0` potrebbero trovarsi una a `9.999999999999996` e l'altra a `10.000000000000002`. Per noi sono `10`. Per il CSG sono due piani diversi.

La conseguenza pratica: **ogni `union()`, esplicita o implicita, richiede che le facce da fondere non siano coincidenti**. Se lo sono (o meglio: se il computer _pensa_ nell'incercezza della rappresentazione a virgola mobile che lo siano), il comportamento è indefinito: porzioni di mesh possono sparire dal render, apparire rovesciate, o lampeggiare nella preview. Non è un bug: è il prezzo della rappresentazione discreta dei numeri.

**La soluzione.** Si sommano o si sottraggono piccole quantità (`eps`, che in effetti sta per _epsilon_) alle dimensioni degli oggetti, in modo che le superfici adiacenti _compenetrino_ leggermente invece di toccarsi. Nel nostro slot:

- `r1 = r_inner_wall - eps` e `r2 = r_inner_wall + slot_depth_r + eps`: i settori partono _prima_ della parete e arrivano _oltre_ lo scavo.
- `translate([0, 0, -eps])` sul settore 1: l'ingresso inizia appena sotto il bordo inferiore del manicotto, garantendo che non ci sia una linea di giunzione esattamente a `z = 0`.
- `h_pin + 2*eps` nei settori 2 e 3: l'altezza è leggermente maggiorata per sfondare oltre i confini.

**Quanto piccolo?** `0.05` mm è un valore empirico che funziona bene con la risoluzione standard delle stampanti FDM (0.4 mm di ugello, 0.2 mm di layer). È abbastanza grande da risolvere le ambiguità del CSG, ma abbastanza piccolo da non produrre alterazioni visibili nella stampa finale. Se usate `$fn` molto alti (>200), potete ridurlo a `0.01`; se lavorate con mesh a bassa risoluzione, potrebbe servirvi `0.1`.

**Il compromesso.** L'`eps` modifica leggermente le dimensioni reali del modello. Per un passacavo non è un problema (0.05 mm su 60 mm di diametro è lo 0.08%), ma in applicazioni di alta precisione — ingranaggi, accoppiamenti meccanici stretti — va considerato nel calcolo delle tolleranze, aggiungendolo ai parametri di gioco come `bayo_slot_play`.

So che questo introduce tanta frizione nella modellazione, pazienza.

<!-- IMAGE_PLACEMENT: Confronto visivo tra mesh con artefatti CSG (facce orfane, normali invertite, micro-fratture) e mesh pulita dopo l'applicazione del pattern eps → role=diagram, context=comparison -->

---

## Tolleranze: benvenuti nel mondo reale

La differenza tra un incastro che funziona e uno che si inceppa sta nei parametri di tolleranza. Nel passacavo sono tutti espliciti:

```openscad
bayo_slot_play = 0.4;   // Radial and axial clearance inside the slots
bayo_drop_extra = 0.5;  // Extra axial drop for retention snap
```

`bayo_slot_play` aggiunge 0.4 mm di gioco in tutte le direzioni all'interno dello slot. È il parametro che regola la "morbidezza" dell'incastro: aumentatelo se la vostra stampante tende a sovra-estrudere, diminuitelo se l'incastro balla.

La profondità radiale dello slot è `bayo_pin_t + bayo_slot_play`: la sporgenza del pin più il gioco. L'altezza del pin nello slot è `bayo_pin_h + 2*bayo_slot_play`: altezza pin più gioco assiale sopra e sotto.

Questa disciplina — **ogni tolleranza è una variabile con nome** — è ciò che trasforma un modello "può funzionare" in un modello "funziona sulla *tua* stampante" e sotto tutte le condizioni di lavoro per cui è progettato.

Noterete anche un altro dettaglio: **ho più di una tolleranza nel mio progetto**. È uno scenario molto comune se lavorate su assiemi. Alcuni elementi del progetto probabilmente avranno, infatti, bisogno di una tolleranza maggiore rispetto agli altri: non dipende, quindi, solo dalla tua stampante, ma anche dal tipo di accoppiamento, dalla frizione meccanica, dal materiale, eccetera.

<!-- IMAGE_PLACEMENT: Sezione quotata del pin nello slot con evidenziato il gioco radiale (bayo_slot_play) e assiale (2*bayo_slot_play), con annotazioni delle quote → role=diagram, context=architecture -->

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

La `rotate([0, 0, -bayo_twist_deg])` pre-ruota l'intero anello in modo che, nella visualizzazione, i pin appaiano già nella tacca di ritenzione — esattamente come sarebbero dopo l'assemblaggio reale. È solo una mia convenzione visiva. In futuro conto di lavorare a delle piccole animazioni degli assiemi esplosi in OpenSCAD generate programmaticamente: aver creato questo modulo mi tornerà utile quel giorno.

---

## Riepilogo: cosa abbiamo imparato

- Una baionetta è preferibile a una filettatura per pezzi stampati in FDM: **niente supporti, tolleranze controllabili, geometria semplice**.
- Il **`for`** di OpenSCAD non è un ciclo imperativo: genera copie geometriche multiple, implicitamente unite in un unico solido. Il pattern `i * 360 / N` è il modo standard per distribuire oggetti in cerchio.
- Il **pin** è un settore di anello, generato con `ring_sector`.
- Lo **slot a L** è composto da tre settori sovrapposti: ingresso, corsa, ritenzione.
- Le **tolleranze** (`bayo_slot_play`, `bayo_drop_extra`) sono parametri espliciti.
- La **costante `eps`** previene artefatti CSG con 0.05 mm di sovrapposizione intenzionale tra primitive adiacenti: è un accorgimento universale per evitare geometrie __non-manifold__.

Nella terza e ultima parte della serie realizzeremo il tappo superiore e vedremo come i CAD parametrici possono sfruttare la math library molto di più dei CAD tradizionali. Poi ci concentreremo su un picclo **sistema di visualizzazione** (`mode`) che permette di passare dalla vista d'assieme alla vista esplosa, al layout di stampa e all'esportazione STL/3MF.
