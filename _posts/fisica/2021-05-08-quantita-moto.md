---
category: Fisica
title: La quantità di moto e l'impulso (fisica classica)
excerpt: Studiando la fisica nei libri in lingua inglese, può capitare di fare un po' di confusione con i concetti di momento, quantità di moto e impulso, per via di come questi concetti sono, invece, espressi con la lingua di Newton. Questo breve articolo cercherà di fugare ogni possibile dubbio.
master: /assets/images/quantitamoto.png
broadcast:
  channels: [linkedin, mastodon]
header:
  overlay_filter: 0.5
---

Come quasi tutti ricorderanno dalla fisica studiata a scuola, Newton ci ha insegnato che la quantità di moto è una grandezza vettoriale data dal prodotto della massa del corpo per la sua velocità e si indica con _p_:

$$ \vec{p} = m\vec{v} $$

e si misura, di conseguenza, in $$ [kg][m]/[s] $$. Viene, talvolta, anche chiamato __momento lineare__ anche se, tecnicamente, non si tratta del momento di un vettore. Questa dicitura è un anglicismo dovuto al fatto che la quantità di moto in inglese è chiamata _momentum_. E questa è una prima causa di confusione, dato che in italiano il momento meccanico, o _coppia_ di forze, è un concetto totalmente distinto (e che, in inglese, si dice _moment_ o _torque_, appunto). È una grandezza vettoriale che ha direzione e verso del vettore velocità e modulo pari al modulo della velocità moltiplicato per la massa (che è una grandezza scalare sempre positiva).

Dalla meccanica classica, sappiamo che un corpo in movimento imprime una forza sul corpo che tenti di fermarlo. Tanto maggiori sono la massa e la velocità del corpo in movimento, tanto maggiore è la forza impressa. Per questo motivo un proiettile, che pur avendo inerzia ridotta per via della sua piccola massa, ma gran velocità, quando colpisce una piccola area di tessuto trasferisce una forza tale da generare molti danni (ma non abbastanza da far sbalzare violentemente il corpo del cattivo sulla vetrata retrostante così da farlo precipitare su una inferriata appuntita, come si vede nei film d'azione). Ugualmente, urtare contro un camion di grande massa, anche se si muove lentamente, ci provocherà ben più di un mal di testa.

Ebbene, questo fenomeno è ben espresso dalla quantità di moto che, in effetti, per la seconda legge della dinamica, può essere espressa anche in $$ [N][s] $$ e quindi rappresentare la forza trasferita per unità di tempo.

Ma qual'è questa forza impressa?

Per rispondere a questa domanda, supponiamo che un corpo di massa $$ m $$ e avente velocità iniziale $$ v_i $$ subisca una forza per un intervallo di tempo _t_ durante il quale ha un'accelerazione che lo porta alla velocità finale $$ v_f $$ (ignoriamo tutti gli effetti di attrito sul sistema): Abbiamo quindi le quantità di moto iniziale

$$ \vec{p_i} = m\vec{v_i} $$

e finale

$$ \vec{p_f} = m\vec{v_f} $$

Pertanto, la variazione per unità di tempo della quantità di moto sarà:

$$ \frac{\vec{p_f} - \vec{p_i}}{t} = \frac{m\vec{v_f} - m\vec{v_i}}{t} = m\frac{\vec{v_f} - \vec{v_i}}{t} $$ 

Passando alle variazioni infinitesime

$$ \frac{d\vec{p}}{dt}  = m\frac{d\vec{v}}{dt} $$ 


Poiché la variazione di velocità nell'intervallo di tempo infinitesimo rappresenta l'accelerazione, al secondo membro possiamo sostituire con la forza $$ \vec{F} $$ e quindi:

$$ \vec{F} = \frac{d\vec{p}}{dt} $$ 

Ovvero, la forza che agisce su un corpo produce una variazione della quantità di moto dello stesso. È una formulazione più generale della seconda legge del moto che tiene conto anche delle situazioni in cui la massa del corpo in moto varia, come ad esempio un razzo lanciato verso lo spazio, che brucia carburante riducendo la sua massa complessiva.

In questo caso, il secondo principio della dinamica andrebbe più correttamente scritto in forma differenziale (derivata della quantità di moto rispetto al tempo):

$$ \vec{F} = \frac{d\vec{p}}{dt} $$

dove la variazione della quantità di moto può rappresentare una variazione di velocità, di massa, o entrambe. Se la massa non varia, essa è costante rispetto alla derivazione per il tempo:

$$ \vec{F} = m\frac{d\vec{v}}{dt} = m\vec{a} $$

che è quanto già sappiamo.

## L'impulso

L'impulso è un'altra grandezza molto utile in fisica classica: rappresenta la quantità di moto effettivamente trasmessa da un corpo all'altro a seguito di un urto o, più in generale, gli effetti di una forza che agisce per un intervallo di tempo molto piccolo rispetto all'intero fenomeno osservato (sarebbe più corretto dire che un urto tra due corpi rigidi comporta l'intervento di una forza impulsiva). Ad esempio, un tennista che colpisce una pallina durante il servizio, imprime alla stessa una forza molto intensa e vi trasferisce una grande quantità di moto in un intervallo molto breve. Oppure la polvere da sparo che, esplodendo, causa l'espulsione del proiettile ad alta velocità dalla canna della pistola in pochi centesimi di secondo, e così via.

Poiché le forze di questo tipo non sono costanti nel tempo, pur agendo per intervalli di tempo molto piccoli, in questi casi, più che con il secondo principio della dinamica è conveniente lavorare con una quantità che è il prodotto tra la forza agente e l'intervallo in cui agisce. L'impulso, appunto. 

$$ \vec{I} = \vec{F}\Delta t $$

Questa grandezza, come si può vedere, si misura in [N][s], come la quantità di moto. Rappresenta, come dicevamo, la quantità di moto trasmessa da una cosiddetta __forza impulsiva__. Questo è l'enunciato del cosiddetto __teorema dell'impulso__:

$$ \vec{I} = \Delta \vec{p} $$


Quando la forza varia nel tempo, ha variazioni infinitesime:

$$ \vec{F} = \frac{d\vec{p}}{dt} $$

Integrando ambo i membri nell'intervallo di azione della forza abbiamo l'impulso:

$$ \Delta p = \int_{t_1}^{t^2} Fdt $$