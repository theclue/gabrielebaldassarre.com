---
category: Fisica
title: Sistemi classici e sistemi quantistici
excerpt: Prima di iniziare lo studio della meccanica quantistica, è importante chiarire cosa si intende per sistema e cosa differenzia un sistema quantistico da un sistema classico.
header:
  overlay_image: /assets/images/sistemi-classici-quantistici-overlay.jpg
  teaser: /assets/images/sistemi-classici-quantistici-teaser.jpg
  overlay_filter: 0.5
---

Molto banalmente, per __sistema fisico__ si intende un sistema chiuso, nel senso che non interagisce con l'esterno, in cui le caratteristiche interne (ovvero il suo __stato__) sono predicibili con esattezza. Supponendo di avere a disposizione tutte le informazioni e la conoscenza necessari per calcolare suddetto stato, questo è _deterministico_ e _predicibile con assoluta esattezza_ e senza ambiguità.

Tutti gli stati possibili di un sistema (sia esso classico o quantistico) formano una astrazione matematica chiamata __spazio degli stati__. La differenza tra un sistema classico e uno quantistico sta proprio nella natura di tale spazio.

Sistemi classici
----------------

Supponiamo di voler modellare come sistema il lancio di una moneta (un classico, no?). Nota che stiamo modellando come sistema il _lancio_ della moneta, non la _moneta_ in sé (come oggetto con delle caratteristiche fisiche ben precise e che esiste in un punto ben preciso dello spazio). Come tale, questo sistema può trovarsi solo in uno dei due possibili stati:

![Stati possibili nel lancio di una moneta](/assets/images/testacroce.jpg)

Ad ogni lancio, otterremo solo uno dei due possibili stati, senza alcuna ambiguità. Non importa quanti lanci effettuiamo: otterremo sempre testa _oppure_ croce. E mai _un po' testa e un po' croce_.

In un sistema classico, lo stato è sempre univocamente specificato. Non solo: in un sistema classico, se conosciamo lo stato conosciamo __tutto__ del sistema, incluso il risultato della misurazione (nel caso del lancio della moneta, l'esito della misurazione/esperimento è banale: coincide con la rappresentazione dello stato interno).

E il determinismo? Il lancio della moneta non è il tipico esempio di processo aleatorio? In particolare, quello che ha eguale probabilità di presentare in uscita ognuno dei due risultati possibili?

Beh, sì. Ma solo se si considera la moneta utilizzando un modello astratto, semplificato, della realtà.

Se avessimo a disposizione, prima del lancio, tutte le informazioni sul momento della moneta, le forze a cui è soggetta, l'angolo con cui è stata lanciata, la pressione atmosferica che agisce su di essa (sto volutamente esagerando) e in linea generale tutto ciò che serve per modellare la traiettoria della moneta nello spazio, il risultato sarà un processo __assolutamente deterministico__. Esattamente come prevede la fisica classica.

Lo spazio degli stati di un sistema classico è, matematicamente, ascrivibile a un __insieme__. Tale insieme può avere un numero finito (per esempio, il lancio della moneta o il lancio di un dado) o infinito di membri (per esempio, la posizione di una particella in una retta), purché sia un insieme numerabile.

In quanto insieme, valgono su di esso le regole dell'insiemistica (unione e intersezione) e la logica booleana per individuare dei sottoinsiemi mediante proposizioni.

Per esempio, nel lancio del dado (sempre inteso in senso astratto), un sottoinsieme dello spazio degli stati (formato dai sei elementi {1, 2, 3, 4, 5, 6}) può essere la proposizione "numeri pari":

$$ P = \{2,4,6\} $$

E un'altra la proposizione "tutti i numeri maggiori o uguali a tre"

$$ M = \{3,4,5,6\} $$

Per la logica combinatoria, anche le seguenti proposizioni sono valide:

$$ P \cap M = \{4, 6\} $$

$$ P \cup M = \{2,3,4,5,6\} $$

Sistemi quantistici (e il ruolo della matematica)
-------------------------------------------------

Quando abbiamo a che fare con un sistema quantistico, praticamente tutto ciò che abbiamo appena detto su un sistema classico _non vale più_ e ci sono, invece, altre leggi che vedremo successivamente.

Ma prima di procedere, cosa vuol dire esattamente che i sistemi quantistici presentano leggi diverse? Esistono due tipologie di sistemi fisici nell'Universo? Oppure Newton aveva torto?

Nessuna delle due. Non esistono sistemi "classici" e sistemi "quantistici" nel nostro (unico) Universo e Newton non aveva torto.

In effetti, il comportamento di un sistema quantistico è così controintuitivo che la gente è portata a dire che la meccanica quantistica è "illogica" oppure che _"gli elettroni si comportano in modo strano"_.

Gli elettroni non si comportano in modo strano. Gli elettroni fanno quello che gli elettroni fanno e, per tutto il XX Secolo, i fisici sperimentali hanno lavorato per dimostrare, e ci sono riusciti, che è esattamente così che si comportano. La realtà è inequivocabilmente quantistica.

Molto banalmente, per noi che siamo troppo grandi e abbiamo sensi troppo lenti per essere sensibili agli effetti quantistici, la realtà che percepiamo può essere descritta, perfettamente, dalla fisica newtoniana. In altre parole, la fisica classica è una __approssimazione__ della fisica quantistica. O ancora, per sistemi grandi e lenti come quelli con cui siamo abituati a interagire (gattini, tostapane, manuali di Dungeons&Dragons e montagne), gli effetti quantistici della realtà sono trascurabili e la fisica classica può tranquillamente essere adoperata.

Se, invece, vogliamo studiare sistemi microscopici, che non a caso sono definiti _sistemi a scala quantistica_, come il moto di una molecola o le caratteristiche di un elettrone, gli effetti quantistici non sono più trascurabili e le leggi di Newton (di Coulomb, di Maxwell, ecc. ecc.) non bastano più.

Il problema è che i nostri sensi, e con essi il nostro cervello, non sono "ingegnerizzati" per comprendere i fenomeni a scala quantistica. Ecco perché ci sembra tutto così incomprensibile. E non è una questione di preparazione: il cervello di Feynman non è in grado di comprendere la meccanica quantistica meglio di uno studente delle superiori.

Quello che, però, può fare chi è preparato è __visualizzare i fenomeni quantistici attraverso una opportuna astrazione matematica__.

Non sforzatevi di capire la meccanica quantistica con i vostri sensi. Non è possibile e arriverete a conclusioni sbagliate. Quello che bisogna fare è padroneggiare il modello matematico _astratto_ che è in grado di descriverla.

E tanto per essere ancora più chiari: guardare i video divulgativi su YouTube con titoli tipo "Quantum Mechanics finally explained!" possono aiutare all'inizio, ma senza una trattazione rigorosa (già...matematica), non si va molto avanti.

Ma non preoccupatevi: paradossalmente, la matematica della meccanica quantistica è incredibilmente semplice. Molto più semplice di quella della meccanica classica, tanto per dire.

Ok, fatta la doverosa premessa, dicevamo che la meccanica quantistica sovverte tutto ciò che abbiamo detto sui sistemi classici. Cominciamo a enunciare il tutto, e piano piano approfondiremo singolarmente i singoli punti.

* Se in un sistema quantistico conosci lo stato, __non__ conosci tutto ciò che c'è da sapere sul sistema. In particolare, non è detto che tu sia in grado di prevedere il risultato di un esperimento.
* Lo spazio degli stati di un sistema quantistico __non__ è un insieme numerabile.
* In un sistema quantistico gli stati non sono necessariamente distinguibili gli uni dagli altri in modo totalmente non ambiguo.
* In un sistema quantistico, non è possibile effettuare un esperimento (una misura) che lasci il sistema imperturbato, indipendentemente da quanto gentile la misura stessa sia stata.

Niente male, eh?
