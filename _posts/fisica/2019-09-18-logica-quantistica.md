---
category: Fisica
title: Logica classica e logica quantistica
excerpt: Lo spazio degli stati di un sistema classico è governato dalla logica booleana. Vedremo oggi che, in un sistema quantistico le cose sono un po' più complicate e molto meno intuitive.
header:
  overlay_image: /assets/images/logica-quantistica-overlay.jpg
  teaser: /assets/images/logica-quantistica-teaser.jpg
  overlay_filter: 0.5
---

Lo spazio degli stati di un sistema classico è rappresentato dai componenti di un insieme. Lo spazio degli stati del sistema _lancio della moneta_, ad esempio, è costituito dai due elementi {Testa, Croce}, che rappresentano anche i due unici, possibili, valori della variabile misurata in un esperimento. Non sono possibili valori intermedi, così come il sistema non può trovarsi in una stato diverso da Testa o da Croce, in un dato momento.

La logica della teoria degli insiemi è l'arcinota _logica booleana_, che si basa sul concetto che una condizione di un sistema è esprimibile mediante una __combinazione di proposizioni__, ognuna rappresentata da una propria __tabella di verità__ che dipende dalle caratteristiche del sistema studiato. Facciamo un esempio.

Supponiamo di avere il sistema _Lancio di un dado_. Questo sistema può trovarsi in uno di sei possibili stati:

$$ D = {1, 2, 3, 4, 5, 6} $$

![Stati possibili nel lancio del dado](/assets/images/dado_insieme.svg)

Una possibile proposizione potrebbe essere: _"Tutti i risultati pari"_, che rappresenta un sottoinsieme dell'insieme D.

$$ P = {2, 4, 6} $$

![Stati possibili nel lancio del dado: risultati pari](/assets/images/dado_insieme_pari.svg)

Un'altra proposizione potrebbe essere _"Tutti i risultati maggiori di tre"_:

$$ T = {4, 5, 6} $$

![Stati possibili nel lancio del dado: risultati maggiori di tre](/assets/images/dado_insieme_tre.svg)

Logica classica
---------------

La logica formale booleana consente la combinazione di più proposizioni attraverso gli operatori insiemistici di __complemento__, __unione__ e __intersezione__. Per esempio la proposizione _"Tutti i risultati pari e maggiori di tre"_, ovvero l'operazione di __AND__ logico, può essere espresso come operazione di intersezione tra P e T, ovvero:

$$ A = P \cap T $$

![Stati possibili nel lancio del dado: intersezione](/assets/images/dado_insieme_and.svg)

Allo stesso modo valgono le operazioni di __OR__, di __NOT__ e tutte le possibili declinazioni (__NAND__, __XOR__...). Ebbene, in un sistema classico vale la commutatività delle proposizioni. Siano A e B due proposizioni (insiemi), allora:

$$ P \cap T  = T \cap P $$

Nella logica classica, non è importante l'ordine con cui sono valutate le proposizioni. La tabella di verità dell'espressione risultante sarà sempre definita in modo non ambiguo.

Logica quantistica
------------------

Quanto detto non è, invece, sempre vero in un sistema quantistico e questo per via del principio di indeterminazione. Sugli operatori unari possiamo essere abbastanza tranquilli:

$$ \sigma_z = 1 \implies NOT(\sigma_z) = -1 $$

Per ciò che concerne gli operatori binari la questione è più complessa. Supponiamo di codificare due proposizioni booleane attraverso due grandezze quantistiche che, come sappiamo, possono assumere solo due valori e supponiamo che tali proposizioni siano vere quando le grandezze assumono valore positivo:

$$ A: \sigma_z = 1 $$

$$ B: \sigma_x = 1 $$

Supponiamo che il sistema sia stato preparato nello stato di _up_ e di voler misurare l'OR logico.

$$ A OR B = ?$$

Supponiamo di iniziare la verifica di A. Poiché, per ipotesi, il sistema è nello stato di _up_, la misura di $$ \sigma_z $$ darà come valore misurato 1, il che è sufficiente per verificare la veridicità di A e, quindi, dell'intera espressione (A OR B è vera se A _oppure_ B sono vere). Possiamo fermarci qui.

Ripetiamo l'esperimento, verificando stavolta prima B. Poiché per ipotesi il sistema è nello stato di _up_, avremo un valore $$ \sigma_x $$ che sarà il risultato di una distribuzione statistica avente il 50% di probabilità di valere 1. Quindi, la sola misura di B _non è sufficiente_ per verificare l'espressione _A OR B_ e bisogna verificare anche A.

Ma la misura di B ha distrutto ogni informazione relativa a $$ \sigma_z $$, lasciando il sistema in uno stato compatibile con la misura perfettamente definita per $$ \sigma_x $$ (che si sia ottenuto 1 o -1). Di conseguenza, $$ \sigma_z $$ avrà il 50% di probabilità di valere 1, così come il 50% di probabilità di valere -1.

In definitiva, la proposizione $$ B OR A $$ ha il 25% di possibilità di essere falsa, mentre $$ A OR B $$ è certamente vera.

In un sistema quantistico, l'operatore OR __non__ collega gli operandi in modo simmetrico. È la rappresentazione logica del principio di indeterminazione.

Da notare che non tutte le grandezze si comportano in questo modo. In un sistema quantistico _esistono_ coppie di grandezze che possono essere misurate contemporaneamente, per restituire una tabella di verità di una proposizione perfettamente definita, come in un sistema classico. Queste grandezze hanno delle proprietà che possono essere desunte dalle caratteristiche del sistema, ovvero dal suo spazio degli stati.

Come vedremo, le due grandezze utilizzate in questo esempio, ovvero le componenti dello spin rispettivamente lungo la direzione z e lungo la direzione x, sono due grandezze che, per l'appunto, non possono essere misurate contemporaneamente e per le quali vige il principio di indeterminazione. Che, a sua volta, causa la componente di aleatorietà nella valutazione delle espressioni logiche.
