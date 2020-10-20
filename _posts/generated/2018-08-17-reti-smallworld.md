---
title: "Le caratteristiche di un mondo sorprendentemente piccolo"
excerpt: In questo articolo introdurremo concettualmente le reti _small-world_ e il modello Watts-Strogatz creato per studiare i fenomeni sociali che fanno si che gli esseri umani siano tra loro separati dai famosi sei gradi di separazione.
header:
  overlay_filter: 0.5
  overlay_image: /assets/images/small-world-overlay.jpg
  teaser: /assets/images/small-world-teaser.jpg
editor_options:
  chunk_output_type: inline
---

Se esiste un concetto della Social Network Analysis che è noto al grande pubblico è quello dei [sei gradi di separazione](https://it.wikipedia.org/wiki/Sei_gradi_di_separazione), per quanto questa sia principalmente l'interpretazione letteraria di una [teoria](https://it.wikipedia.org/wiki/Teoria_del_mondo_piccolo) a sua volta frutto di un esperimento empirico molto contestato (l'[esperimento di Milgram](https://en.wikipedia.org/wiki/Small-world_experiment) del 1967).

In natura, si sa, le coincidenze, se esistono, si danno la pena di non farsi trovare e il fatto che, andando a ben scavare, ci accorgiamo di essere distanti solo tre passaggi da Francesco Guccini e cinque da Isaac Newton potrebbe essere frutto del caso oppure della propensione innata della natura (e degli individui) di creare connessioni con i propri simili in punti imprevedibili della rete.

Quale che sia la causa non è importante, mentre lo sono gli effetti: il mondo è sorprendentemente piccolo.

### Gruppi e sottogruppi in una rete sociale

Più precisamente, viviamo in un mondo in cui due individui qualunque sono separati, in media, da non più di una mezza dozzina di intermediari; e non importa se il primo sia in Spagna e il secondo sull'Isola di Pasqua.

Strano, vero? Eppure questo fenomeno non dovrebbe sorprendere, perché è, almeno numericamente, plausibile.

L'antropologia sociale ci insegna che un individuo è in grado di intrattenere relazioni socialmente attive con un numero di consimili che varia da 250 a 500, grazie anche all'avvento dei Social Network. Facendo due conti ed essendo anche al massimo conservativi questi sono i numeri della mia rete sociale:

* \\( 250^1 = 250 \\) individui a un passo di distanza da me;
* \\( 250^2 = 62.500 \\) individui a due passi di distanza da me;
* \\( 250^3 = 15.625.000 \\) individui a tre passi di distanza da me.
* ...

È facile osservare come non ci sia nemmeno bisogno di arrivare a sei per includere l'intera umanità nella cerchia. Nonostante i due individui siano separati da migliaia di chilometri di oceani, deserti e montagne, la matematica non lascia adito a dubbi: sono _vicini_.

Eppure il numero magico è 6, non 3, ma nemmeno 12, 50 o 120, come si aspettava, intuitivamente e senza aver fatto troppi conti, Milgram durante il suo famoso esperimento.

Il punto è che, nelle loro relazioni, gli individui non scelgono le proprie connessioni in modo casuale, ma mantengono una certa coerenza _locale_.

In altri termini, la progressione matematica parte dal presupposto che ognuna delle, ipotizziamo, 250 connessioni di ognuno dei miei amici siano 250 individui distinti. Se ognuno di essi scegliesse, per i suoi 250 amici, degli individui completamente a caso potendoli pescare dall'intero genere umano, questa assunzione reggerebbe.

Ma gli esseri umani non hanno tutte queste libertà, perché sono soggetti a tanti vincoli,  sociali, geografici, di età di razza, ecc. che riducono di moltissimo le possibilità di scelta nella creazione della loro rete sociale. Che non sarà più casuale, ma imposta in modo tale da facilitare la creazione di sottogruppi _per prossimità_.

{% figure caption:"La scienza, certe volte, compie dei percorsi strani. Duncan Watts arrivò, con il suo relatore di dottorato Steven Strogatz, a formulare un credibile modello di reti sociali umane partendo dallo studio...dei grilli!" %}
![Un piccolo, simpatico grillo](/assets/images/girl-cricket-synronicity.jpg)
{% endfigure %}

Nel mondo reale, in effetti, i nostri amici si conoscono, molto probabilmente, anche tra di loro; un individuo che è parte della nostra cerchia non porterà 250 nuovi individui all'interno del gruppo, ma molti di meno, in quanto gran parte di quei 250 sono già componenti del gruppo stesso.

Attenzione: una parte, non tutti.

Se così non fosse, se cioè nessuno dei nostri amici avesse delle connessioni con individui all'esterno della cerchia, o ne avesse in numero trascurabile, ci ritroveremmo con una serie di "isole" fittissime del tutto sconnesse le une dalle altre, o connesse in modo così sporadico dal rendere irrealistico il numero magico dei sei gradi di separazione.

Empiricamente, se gli individui che compongono una rete sociale:

* hanno la maggior parte delle proprie connessioni con membri che sono a loro volta connessi tra di loro, individuando un sottogruppo ricco di connessioni reciproche;

e, contemporaneamente

* hanno anche un piccolo, ma non trascurabile, numero di connessioni con individui all'esterno di suddetto sottogruppo, in punti anche molto lontani, che fungono da "scorciatoie" in grado di abbattere le distanze medie tra tutti gli individui della rete;

ebbene, ci troviamo di fronte a un mondo piccolo, ovvero a una __rete small-world__.

Il mondo è, in definitiva, formato da piccole comunità (in letteratura chiamate _clique_) in cui solo una piccola parte dei loro componenti ha contatti con l'esterno. Se si può dire che il mondo è _connesso_ per via della presenza delle clique, è però _piccolo_ per via delle occasioni di connessione tra individui collocati in punti _molto distanti_ della rete.

L'intuizione empirica è tutta qui; quello che serve adesso è un modello analitico.

{% figure caption:"Eastern Island Parade in Jael, Spain, 2017" caption="Per riprendere l'esempio di prima, basta che un qualunque spettatore della parata di danze dell'Isola di Pasqua che si è tenuta a Jaén, in Spagna, nel 2017, sia venuto in contatto con un ballerino per abbattere le distanze che separano non solo i due diretti interessati, ma anche tutti i componenti delle rispettive cerchie." %}
![Parata dell'Isola di Pasqua a Jael, Spagna, 2017](/assets/images/eastern-island-parade-spain.jpg)
{% endfigure %}

### Il modello Watts-Strogatz

Per costruire un solido modello scientifico sono necessari due ingredienti: un'ipotesi e un po' d'ordine.

Per ciò che concerne l'ipotesi, la possiamo costruire a partire da una definizione in termini probabilistici di ciò che abbiamo appena detto. Una possibile, che calza a pennello potrebbe essere:

_"Una rete small-world è un grafo in cui la maggior parte dei nodi __non__ sono connessi tra di loro, ma le connessioni di un nodo qualsiasi della rete hanno elevata probabilità di essere anche connessi tra di loro e tutti i nodi siano, da qualunque punto, raggiungibile con un relativamente ridotto numero di passaggi."_

Per quanto riguarda l'ordine, questo comporta semplificare il problema.

Le reti sociali non sono, infatti, oggetti molto ordinati (le dinamiche che ne regolano la generazione sono molteplici) e non deve essere sembrato saggio a Duncan Watts e Steven Strogatz di tuffarsi in quella confusione. Molto meglio partire con qualcosa di controllabile.

Questo "qualcosa" sono le __reti ad anello__ ovvero reti estremamente regolari in cui gli \\( N \\) nodi si dispongono in, appunto, un anello e ognuno di questi ha \\( k \\) connessioni tra i nodi vicini. Qui sotto è schematizzata la più semplice rete ad anello possibile, quella in cui i nodi hanno connessioni solo con i vicini più prossimi alla loro destra e alla loro sinistra.

![plot of chunk watts-strogatz.ring](/assets/figures/watts-strogatz.ring-1.svg)

Questa caratteristica assolve alla prima parte dell'ipotesi; resta da simulare la parte relativa alle scorciatoie. Ma quali sono, in natura, le reti nelle quali il cammino minimo medio tra due punti qualunque è il più basso possibile?

Come dimostrato empiricamente poco fa, sono quelle reti in cui la probabilità, per un nodo, di instaurare una connessione con un nodo è indipendente dalla distanza tra i due nodi stessi. Le abbiamo viste prima: sono le reti casuali.

L'intuizione di Watts & Strogatz nel loro modello è stata esattamente questa: una volta costruita una rete regolare ad anello, si instaura un processo per cui, navigando tutte le \\(\frac{nk}{2} \\) connessioni nel grafo, queste hanno una probabilità \\( p \\) di essere "sganciate" dalla loro destinazione iniziale e "riconnesse" a un nodo qualunque della rete, anche (potenzialmente) molto distante.

Se per \\( p = 0 \\) il grafo rimane inalterato, al crescere di \\( p \\) esso assume una struttura sempre più disordinata fino a culminare, con \\(p = 1 \\), in uno stato in cui la rete è assimilabile a una rete casuale (ogni segmento è stato riconnesso a una nuova destinazione).

Qui sotto è schematizzato il processo per quattro valori di \\( p \\) in reti aventi \\( n = 20 \\) e \\(k = 4 \\):

![plot of chunk watts-strogatz-randomness](/assets/figures/watts-strogatz-randomness-1.svg)

Ora, dai grafici precedenti, è facile osservare che per valori di \\( p \\) vicini a 0 è massima la coesione nei sottogruppi locali, ma il cammino minimo medio è molto alto; per valori di \\( p \\) vicini a 1, invece, il cammino minimo assume un valore assimilabile a quello di una rete casuale (quindi, molto basso), a scapito di una perdita di una coesione locale tra i nodi vicini.

Ebbene, Watts & Strogatz hanno dimostrato che per un certo intervallo di valori _intermedi_ di \\( p \\), la rete presenta entrambe le caratteristiche di una rete _small-world_, ovvero un cammino minimo relativamente breve e una elevata presenza di _clique_ e sottogruppi.

Demando ad un prossimo articolo l'analisi quantitativa dei valori caratterizzanti della rete, in cui calcoleremo anche questo intervallo di valori leciti per \\( p \\).

### I limiti del modello

Per quanto abbia avuto, al momento della pubblicazione, l'effetto di una bomba atomica, il modello _small-world_ non è esente da difetti.

Rispetto al modello casuale in auge fino a quel momento (il cosiddetto [modello Erdős-Renyi](https://en.wikipedia.org/wiki/Erdős–Rényi_model)), il modello Watts-Strogatz ne mantiene - come abbiamo visto - la peculiarità di presentare dei cammini minimi relativamente ridotti tra tutti i nodi della rete (in media).

Ma il suo più grande limite è quello di costruire strutture in cui tutti i nodi hanno lo stesso numero \\( k \\) di connessioni, ovvero presuppone che tutti i nodi abbiano la stessa popolarità (importanza, ecc.). Il modello Erdős-Renyi, per questa grandezza, prevede una più realistica distribuzione di Poisson.

Come se non bastasse, nella realtà è facile accorgersi che nelle reti _small-world_ ci sono praticamente sempre dei nodi privilegiati, chiamati _hub_, che catalizzano l'attenzione (sono più popolari, ecc.) e sono caratterizzati da un numero molto consistente di connessioni - molto più alto del valor medio. Per questi, anche la distribuzione di Poisson non è realistica.

In queste reti la [distribuzione del grado]({% post_url SNA/2018-07-02-importanza-individui-rete-centralita %}) (_degree distribution_) è, piuttosto, assimilabile a una [legge di potenza]({% post_url generated/2018-08-12-legge-potenza-powerlaw %}). Modelli più recenti di descrizione delle reti, come il modello [Barabási–Albert](https://en.wikipedia.org/wiki/Barabási–Albert_model) tengono conto di questo comportamento asimmetrico dei nodi.

D'altra parte, né il modello Erdős-Renyi né il modello Barabási–Albert simulano correttamente, al contrario del modello Watts-Strogatz, la coesione locale. Nessuno di essi, in definitiva, può considerarsi un modello reliastico per descrivere la struttura di una rete sociale, ma solo una approssimazione.

{% figure caption:"La rete individuata dagli aeroporti e dalle rotte degli aerei è un'altra rete _small-world_ molto studiata, ma che bene mette in evidenza i limiti del modello Watts-Strogatz sull'incapacità di distinguere i nodi per impportanza. È evidente, infatti, come al Chicago International Airport confluiscano centinaia se non migliaia di rotte da molti altri scali e questo ne fa innegabilmente un _hub_, di gran lunga più importante dei molti scali regionali dissemninati in tutti gli Stati Uniti. Questa caratteristica delle reti _small-world_ è molto importante; basti pensare alle ripercussioni che si avrebbe sull'intero traffico aereo se un _hub_ dovesse essere non operativo, di gran lunga più serie di ciò che si avrebbe con uno scalo minore. Non a caso si dice che le reti _small-world_ sono molto vulnerabili ad attacchi mirati." %}
![Chicago Airport](/assets/images/chicago-airport.jpg)
{% endfigure %}
