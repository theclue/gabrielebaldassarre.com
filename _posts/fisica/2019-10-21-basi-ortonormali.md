---
category: Fisica
title: Basi ortonormali in un sistema quantistico
excerpt: "In questo articolo introdurremo il concetto di base di un sistema quantistico e di come questo rappresenti tutti i suoi stati possibili"
header:
  overlay_image: /assets/images/basi-ortonormali-overlay.jpg
  teaser: /assets/images/basi-ortonormali-teaser.jpg
  overlay_filter: 0.5
---

Chi ha un minimo di dimestichezza con l'algebra lineare conosce certamente il concetto di [base di uno spazio vettoriale](https://it.wikipedia.org/wiki/Base_(algebra_lineare)) come l'insieme massimo di vettori mutuamente ortogonali che generano lo spazio stesso e ne determinano la dimensionalità.

Ebbene, non c'è nulla in algebra che restringa tale concetto al fatto che i suoi vettori siano reali e individuino, di conseguenza, uno spazio reale (magari tridimensionale). È assolutamente sensato generalizzare il concetto di _base_ al campo complesso, per individuare l'intero spazio degli stati di un sistema quantistico. Tutti gli stati interni che il sistema può assumere, per intenderci.

Basi ortonormali di un sistema complesso
----------------------------------------

In maniera del tutto analoga a quanto si fa in un sistema reale, si cominciano a prendere dei vettori con modulo unitario che siano tutti tra di loro mutuamente ortogonali (che, nel campo complesso, significa prendere due vettori il cui [prodotto interno sia uguale a zero]({% post_url fisica/2019-10-04-spazio-stati-quantistici %}). Essendo tutti questi vettori di modulo unitario, l'informazione interessante che portano in dote è la _direzione_ che individuano.

Ebbene, continuando a prendere vettori (direzioni) ortogonali, si arriverà ad un punto in cui non è più possibile prendere altri preservando la condizione di mutua ortogonalità e saremo costretti a fermarci: i vettori presi fino a questo momento individueranno una __base ortonormale__ e il loro numero la dimensionalità dello spazio.

La cosa interessante (sempre in perfetta analogia con i vettori reali) è che tutti i vettori dello spazio sono esprimibili come combinazione lineare degli elementi della base.

Ora, tecnicamente parlando, l'algebra non prevede che i vettori di base siano _ortonormali_ (modulo unitario, ortogonali tra di loro), tuttavia per una serie infinita di ragioni, in meccanica quantistica normalmente lo sono. Per semplificare i calcoli, più che altro.

Basi ortonormali e meccanica quantistica
----------------------------------------

Supponiamo di avere una base ortonormale complessa di dimensione _N_. Esprimiamola in notazione di Dirac utilizzando un _ket_: $$ \vert i \rangle $$.

Tale base, per quanto detto, avrà $$ i_1 ... i_N $$ componenti ortogonali tra di loro.

Consideriamo ora un generico vettore di stato _A_ ed esprimiamolo come combinazione lineare con i componenti del vettore di base:

$$ \vert A \rangle = \sum_{i} \alpha_i \vert i \rangle $$

con gli $$ \alpha_i $$ coefficienti complessi chiamati _componenti della base_.

Effettuiamo ora il prodotto interno della precedente uguaglianza per un particolare vettore della base _j_ scelto arbitrariamente tra i vettori $$ i_N $$ della base.

$$ \langle j \vert A \rangle = \sum_{i} \alpha_i \langle j \vert i \rangle $$


Poiché i vettori sono ortogonali tra di loro e hanno modulo unitario, l'equazione precedente vale __0__ per qualsiasi coppia $$ \vert j \rangle \ne \vert i \rangle $$ e vale __1__ se $$ \vert j \rangle = \vert i \rangle $$.

La sommatoria quindi collassa a un unico termine diverso da zero:

$$ \langle j \vert A \rangle = \alpha_j $$

Quindi le componenti di un generico vettore _A_ sulla base ortonormale _i_  sono dati dal prodotto interno del vettore stesso con la base.

$$ \vert A \rangle = \sum_i \vert i \rangle \langle i \vert A \rangle $$

Questa formulazione è essenziale per poter studiare la dinamica di un sistema, ovvero come lo stato di un sistema quantistico varia nel tempo e come è possibile studiarne l'evoluzione. Lo vedremo in uno dei prossimi articoli. Alla prossima!
