---
category: 3d Printing
title: "Un generatore di IKEA Billy con OpenSCAD"
excerpt: "Come trasformare l'archetipo di una libreria in un modello parametrico: carcassa, pannelli, modello parametrico, BOM e cutplanner."
master: /assets/images/posts/generatore-ikea-billy-openscad.png
image_meta:
  role: illustration
  context: ambient
  caption: ""
tags:
  - furniture design
  - cabinet design
  - OpenSCAD
  - CAD parametrico
  - distinta base
  - piano di taglio
header:
  overlay_filter: 0.5
broadcast:
  channels: [linkedin,mastodon]
  sent: false
intended_audience: curious
proficiency_level: intermediate
difficulty_declared:
  conceptual: 3
  technical: 3
  mathematical: 1
difficulty_computed:
  semantic:
    concept_count: 7
    concept_density: 0.3
    jargon_ratio: 7.4
    definition_coverage: 0.67
    external_knowledge_demand: 1
    prerequisite_depth: 1.8
    math_density: 0.0
    code_density: 2.4
    blocking_prerequisite_count: 2
knowledge_prerequisites:
  - concept: openscad
    label: OpenSCAD
    url: https://openscad.org/
    importance: required
    depth: 2
  - concept: cad-parametrico
    label: CAD parametrico
    importance: required
    depth: 2
  - concept: moduli-openscad
    label: Moduli di OpenSCAD
    url: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/User-Defined_Functions_and_Modules
    importance: recommended
    depth: 2
  - concept: carcassa-mobile
    label: Carcassa di un mobile
    importance: helpful
    depth: 1
  - concept: furniture-design
    label: Furniture design
    importance: recommended
    depth: 1
  - concept: woodworkers-lib
    label: woodworkers-lib
    url: https://github.com/fxdave/woodworkers-lib
    importance: recommended
    depth: 2
  - concept: distinta-base
    label: Distinta base (BOM)
    importance: recommended
    depth: 1
  - concept: json
    label: JSON
    url: https://www.json.org/json-it.html
    importance: recommended
    depth: 2
  - concept: cutplanner
    label: cutplanner
    url: https://github.com/uberbruns/cutplanner
    importance: recommended
    depth: 2
  - concept: ottimizzazione-taglio
    label: Piano di taglio dei pannelli
    importance: recommended
    depth: 2
  - concept: kerf
    label: Larghezza di taglio (kerf)
    importance: helpful
    depth: 1
  - concept: scanalatura
    label: Scanalatura per lo schienale
    importance: helpful
    depth: 1
  - concept: gioco-montaggio
    label: Gioco di montaggio
    importance: helpful
    depth: 1
  - concept: customizer-openscad
    label: Customizer di OpenSCAD
    url: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Customizer
    importance: helpful
    depth: 1
  - concept: csg
    label: Geometria solida costruttiva (CSG)
    url: https://it.wikipedia.org/wiki/Geometria_solida_costruttiva
    importance: helpful
    depth: 2
---

Prima delle quote, mi interessa il tipo di oggetto. Nel furniture design molti mobili si possono ricondurre all'archetipo del cabinet, o carcassa: una struttura che contiene un volume e ne mantiene la forma. I suoi elementi ricorrenti sono fianchi, piani, base, schienale e compartimenti o ripiani. Ante e cassetti sono opzionali; anche la base può assumere la forma di uno zoccolo, un telaio o semplici piedini.

La {% xlink "https://en.wikipedia.org/wiki/Cabinetry" "voce Cabinetry di Wikipedia" role="definition" context="provides-context" target="external-authoritative" description="Panoramica sui cabinet come mobili contenitore, sui loro componenti ricorrenti e sulle costruzioni frameless e face-frame." %} è un buon promemoria: non esiste una distinta universale del mobile, esiste una famiglia di relazioni che ricompare con soluzioni costruttive diverse. La carcassa è il sistema strutturale; ripiani, ferramenta, ante e finiture si appoggiano a quel sistema.

Una Billy è un esempio quasi disarmante: niente ante da parametrizzare, ma abbastanza elementi da rendere visibili queste relazioni. Il modello che ho scritto non vuole essere un disegno costruttivo ufficiale IKEA. È un esercizio sul passaggio dal volume finito ai pannelli, e soprattutto sul modo di non perdere quel legame quando si cambia una scelta progettuale.

Il {% repo_url "_cad/parametric-billy-bookcase/parametric-billy-bookcase.scad" "generatore parametrico" role="source" context="supports-claim" %} segue questa sequenza: descrive il volume, lo scompone in pannelli con {% xlink "https://github.com/fxdave/woodworkers-lib" "woodworkers-lib" role="tool" context="enables-step" target="external-community" description="Libreria OpenSCAD per scomporre un volume di mobile in pannelli orientati e riportarne le dimensioni nel log." %}, costruisce la vista del mobile e prepara una **BOM** (*bill of materials*, distinta dei pannelli) per {% xlink "https://github.com/uberbruns/cutplanner" "cutplanner" role="tool" context="enables-step" target="external-community" description="Strumento che legge pannelli da OpenSCAD o YAML e li dispone sui fogli di materiale disponibili." %}. Il piano di taglio arriva dopo: aiuta a fabbricare, ma non prende decisioni di furniture design.

<!-- IMAGE_PLACEMENT: Dopo questa introduzione: schema da produrre con carcassa, base, compartimenti, ripiani e schienale, distinguendo gli elementi ricorrenti da ante e cassetti opzionali. Alt proposto: "Elementi archetipici di una carcassa di mobile". Caption: "Il modello parte dalle relazioni del cabinet, non da una lista di quote." role=diagram, context=architecture, long_description="Schema di una carcassa con fianchi, piani, base, schienale e ripiani; ante e cassetti sono mostrati come elementi opzionali." -->

## Descrivere il volume

La prima scelta è partire dalle dimensioni esterne e non dai pezzi. Nel codice `width_l`, `depth_w` e `height_h` descrivono rispettivamente larghezza, profondità e altezza; `wood_thickness` e `back_thickness` descrivono i materiali. Il punto importante non sono i valori iniziali, ma le dipendenze:

```openscad
width_l = 800;
depth_w = 280;
height_h = 1900;
wood_thickness = 18;
back_thickness = 6;
has_back = true;
back_style = "nailed";
toekick_height = 70;

TH = wood_thickness;
carcass_h = height_h - toekick_height;
carcass_depth =
    (has_back && back_style == "nailed") ? depth_w - back_thickness : depth_w;
carcass = [width_l, carcass_depth, carcass_h];
```

La profondità della carcassa cambia in base a come si monta lo schienale. Applicato dietro, lo schienale occupa parte della profondità finita; inserito in scanalatura, resta dentro il volume e modifica il modo in cui si incontrano fianchi, fondo e cappello. È una relazione progettuale generale, non un dettaglio della Billy.

Lo stesso vale per un pannello inserito tra due fianchi: la sua larghezza deriva dalla luce interna, quindi dalla larghezza esterna meno i due spessori. Se cambio `wood_thickness`, la relazione continua a valere. Non devo rincorrere la quota del ripiano con una correzione manuale.

<!-- IMAGE_PLACEMENT: Qui, prima della sezione sui moduli: diagramma da produrre con una pianta astratta, larghezza esterna, due fianchi e luce interna. Alt proposto: "Relazione tra dimensione esterna e luce interna della carcassa". Caption: "La dimensione dei pannelli interni deriva dalla scatola e dallo spessore dei fianchi." role=diagram, context=architecture, long_description="Vista dall'alto astratta di una carcassa: due fianchi delimitano una luce interna calcolata sottraendo i loro spessori dalla larghezza esterna." -->

## Pensare per facce e pannelli

La {% xlink "https://github.com/fxdave/woodworkers-lib" "libreria di fxdave" role="source" context="supports-claim" target="external-community" description="README e API originali dei moduli planeLeft, planeRight, planeBottom, planeTop e planeBack per mobili a pannelli." %} propone una metafora che trovo utile: prima immagino una scatola, poi sostituisco le sue facce con pannelli. `planeLeft()` e `planeRight()` sono i fianchi; `planeBottom()` e `planeTop()` i piani; `planeBack()` lo schienale. I moduli generano la geometria e lasciano una traccia delle quote nella console.

Per esempio, il fondo deve sapere che si trova tra i fianchi:

```openscad
include <woodworkers/std.scad>

box = [800, 280, 1900];
th = 18;

planeLeft(box, thick = th);
planeRight(box, thick = th);
planeBottom(box, l = -1, r = -1, thick = th);
```

Qui `l = -1` e `r = -1` esprimono la sottrazione di uno spessore per lato. Non è una quota da ricordare: è una relazione leggibile. Le correzioni assolute come `ff` e `BB` servono invece quando il pannello deve arretrare rispetto al fronte o al retro, per esempio per lasciare spazio allo schienale.

Nel {% repo_url "_cad/parametric-billy-bookcase/parametric-billy-bookcase.scad" "sorgente del progetto" role="source" context="supports-claim" %} i moduli sono incorporati, quindi quel file è autonomo. L'esempio ridotto qui sopra usa invece l'installazione separata descritta nel README; sono due modi diversi di provare la stessa idea.

<!-- IMAGE_PLACEMENT: Dopo l'esempio minimo: screenshot da produrre in OpenSCAD con fianchi, fondo e console che mostra gli ECHO dei pannelli. Alt proposto: "Anteprima dei pannelli di una carcassa con le quote nella console OpenSCAD". Caption: "Lo stesso modulo costruisce la geometria e rende leggibile la sua dimensione." role=screenshot, context=step, step=1 -->

## Una scelta costruttiva attraversa tutto il modello

Nel generatore i pannelli sono riusati per costruire la carcassa:

```openscad
module Sides() {
    planeLeft(carcass, bb = toekick_height, thick = TH);
    planeRight(carcass, bb = toekick_height, thick = TH);
}

module Shelves() {
    for (z = shelf_positions)
        translate([0, 0, z])
            planeBottom(carcass, l = -1, r = -1,
                        ff = -shelf_recess_front, BB = shelf_bb, thick = TH);
}
```

Il `for` non descrive un nuovo tipo di pezzo: ripete lo stesso ripiano in posizioni diverse. Per questo una modifica a `shelf_count` deve riflettersi sia nella vista sia nella distinta.

Lo schienale rende evidente il vantaggio di questo approccio. Con `back_style = "nailed"` riduce la profondità della cassa; con `back_style = "slot"` resta nella cassa e introduce scanalature, arretramenti e giochi di montaggio. La {% xlink "https://it.wikipedia.org/wiki/Geometria_solida_costruttiva" "geometria solida costruttiva (CSG)" role="definition" context="provides-context" target="external-authoritative" description="Modellazione di solidi tramite operazioni booleane come unione e differenza." %} entra in gioco quando `difference()` sottrae le scanalature ai pannelli. La vista 3D, la distinta e le lavorazioni devono restare coerenti: un cambio di assemblaggio non è solo un cambio di colore nella preview.

<!-- IMAGE_PLACEMENT: Dopo il confronto fra le due soluzioni di schienale: diagramma da produrre con due sezioni laterali dello stesso mobile. Alt proposto: "Confronto tra schienale applicato e schienale inserito in scanalatura". Caption: "La scelta dello schienale modifica profondità, arretramenti e lavorazioni." role=diagram, context=comparison, compare_with="Schienale applicato / schienale a scanalatura", long_description="Due sezioni laterali confrontano uno schienale applicato dietro la carcassa con uno inserito nelle scanalature: cambiano la profondità utile, la posizione dei ripiani e le lavorazioni richieste." -->

## Dalla geometria alla distinta

La console è un primo controllo, ma non è ancora una distinta affidabile. Per portare i pezzi fuori dalla preview il generatore costruisce una seconda rappresentazione: ogni voce di `bom` contiene nome, due lati della faccia e spessore.

```openscad
bom = concat(
    [["Fianco Sx", carcass_depth, side_h, TH],
     ["Fianco Dx", carcass_depth, side_h, TH],
     ["Fondo cassa", width_l - 2 * TH, carcass_depth, TH]],
    [for (i = [0 : 1 : len(shelf_positions) - 1])
        [str("Ripiano ", i + 1), width_l - 2 * TH,
         carcass_depth - shelf_recess_front + shelf_bb, TH]]
);

for (p = bom)
    echo(str("{\"name\":\"", p[0],
             "\",\"length\":", max(p[1], p[2]),
             ",\"width\":", min(p[1], p[2]),
             ",\"thickness\":", p[3], "}"));
```

Questi record sono stringhe JSON, una per pannello, riconoscibili da cutplanner. La {% xlink "https://www.json.org/json-it.html" "struttura JSON" role="definition" context="provides-context" target="external-authoritative" description="Formato testuale strutturato in coppie chiave-valore; qui ogni oggetto descrive un pannello." %} separa nome, lato maggiore, lato minore e spessore; {% xlink "https://github.com/uberbruns/cutplanner#panel-input-formats" "cutplanner documenta questi campi" role="source" context="validates-result" target="external-community" description="Il README definisce i campi dei pannelli e mostra come cutplanner legge i record echo di OpenSCAD." %}. La ferramenta, le scanalature e i fori restano informazioni diverse: non diventano rettangoli aggiuntivi nel piano di taglio.

<!-- IMAGE_PLACEMENT: Dopo questa spiegazione: screenshot da produrre con preview assemblata e console OpenSCAD, mettendo a confronto un ECHO leggibile e il record JSON dello stesso pannello. Alt proposto: "Console OpenSCAD con quote leggibili e record JSON della BOM". Caption: "La geometria e il formato per il pianificatore sono due rappresentazioni dello stesso pezzo." role=screenshot, context=result -->

## Il piano di taglio come controllo della pipeline

Una BOM dice cosa serve; un ottimizzatore prova a disporlo sui fogli disponibili. Il {% repo_url "_cad/parametric-billy-bookcase/inventory.yaml" "file inventory.yaml" role="source" context="supports-claim" %} descrive i materiali disponibili e il loro spessore. Non è un dettaglio secondario: un pannello sottile non deve finire fra quelli strutturali.

La {% xlink "https://github.com/uberbruns/cutplanner#commands" "documentazione di cutplanner" role="tool" context="enables-step" target="external-community" description="Il README documenta i comandi per leggere un modello OpenSCAD o una BOM e costruire un piano di taglio." %} riporta i comandi necessari. La prova reale del progetto è stata:

```sh
uvx --from git+https://github.com/uberbruns/cutplanner cutplanner serve parametric-billy-bookcase.scad inventory.yaml --kerf 3
```

`write-bom` ha trovato 12 pannelli. Il layout prodotto con l'inventario del progetto e `--kerf 3` ha collocato tutti i pannelli su fogli compatibili; non sono rimasti pannelli fuori. È una verifica della pipeline, non un certificato di progetto esecutivo: venatura, bordatura, rifili, lavorazioni e sicurezza del mobile richiedono ancora decisioni e controlli reali.

<!-- IMAGE_PLACEMENT: Dopo il risultato verificato: screenshot da produrre del layout realmente ottenuto da cutplanner con inventory.yaml e --kerf 3. Alt proposto: "Layout cutplanner con i 12 pannelli collocati su fogli compatibili". Caption: "La pipeline ha collocato tutti i pannelli; il layout non sostituisce i controlli di falegnameria." role=screenshot, context=result -->

## La regola che resta

Provare un altro valore di `width_l`, `wood_thickness` o `shelf_count` nel {% xlink "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Customizer" "Customizer di OpenSCAD" role="tool" context="enables-step" target="external-authoritative" description="Guida all'interfaccia che espone i parametri di un file OpenSCAD come controlli modificabili." %} serve a osservare la qualità del modello: cambiano insieme carcassa, ripiani e BOM. La relazione più semplice è anche la più istruttiva: se i fianchi diventano più spessi, la luce interna si riduce del loro spessore complessivo.

È questa, per me, la parte interessante del CAD parametrico applicato al legno. Non disegnare una Billy una volta, ma descrivere le regole di una famiglia di mobili. `woodworkers-lib` rende quelle regole leggibili attraverso facce e pannelli; `echo()` le porta dalla preview alla distinta; cutplanner permette di controllare un passaggio ulteriore. Il modello non decide come costruire un mobile, ma evita che una scelta cambi in un punto soltanto e venga dimenticata negli altri.
