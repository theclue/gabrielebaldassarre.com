---
category: Fisica
title: Lo spazio degli stati di un sistema quantistico
excerpt: "In questo articolo introdurremo lo spazio vettoriale complesso che rappresenta l'ossatura del modello matematico utilizzato per studiare gli stati di un sistema quantistico"
header:
  overlay_image: /assets/images/spazi-vettoriali-overlay.jpg
  teaser: /assets/images/spazi-vettoriali-teaser.jpg
  overlay_filter: 0.5
---

A differenza di quanto avviene in un sistema classico, in un sistema quantistico lo spazio degli stati non è esprimibile attraverso la teoria degli insiemi (e la loro corrispondente logica combinatoria), ma per descriverlo è necessario costruire un opportuno modello matematico astratto.

A chi si avvicina per la prima volta allo studio della meccanica quantistica, l'adozione di un modello matematico apposito che descriva gli stati di un sistema è il primo scoglio da superare. Questo perché, mentre la logica insiemistica è molto intuitiva e adeguata a descrivere i sistemi macroscopici o _classici_ - quelli che il nostro cervello è ben allenato a comprendere - quando ragioniamo su scala quantistica dobbiamo abbandonare la pretesa di poter comprendere intuitivamente i fenomeni e fidarci della matematica.

Non mi stancherò mai di ripetere che gli elettroni, e in generale tutte le particelle che agiscono su scala quantistica, non si comportano in modo _strano_.

Gli elettroni fanno quello che gli elettroni fanno. Ed è del tutto logico e normale (dal loro punto di vista).

Siamo _noi_ a essere troppo grandi e troppo lenti per poterli studiare direttamente, ragion per cui abbiamo avuto bisogno di creare un modello matematico per studiarne il comportamento, mentre abbiamo avuto bisogno di un modello semplificato dell'Universo (la meccanica classica) per poter riportare i fenomeni che osserviamo direttamente a una scala che ci è più congeniale.

Ma non bisogna mai dimenticare che la realtà, è più che dimostrato, è decisamente __quantistica__.

Fatto questo atto di fede, andiamo al sodo.

Lo spazio vettoriale degli stati
--------------------------------

Come detto, la teoria degli insiemi non è adatta per descrivere lo spazio degli stati di un sistema quantistico, né lo è la logica booleana. Questo sembra piuttosto assurdo, ma piaccia o meno al nostro cervello, è così che funziona realmente l'Universo.

In un sistema quantistico, lo spazio degli stati è, piuttosto, descritto come uno _spazio vettoriale_ e la logica combinatoria tra i componenti di tale spazio è diversa dalla logica classica.

Non voglio scegliere nel dettaglio di cosa sia un _vettore_, do per scontato che lo sappiate già. È, però, importante segnalare che la nostra definizione di vettore va intesa in senso astratto. Non parliamo cioè, di vettori nello spazio _reale_ (con le loro componenti _{x, y, z, \\}_ per capirci), ma di oggetti matematici astratti, di dimensione $$ n $$ (anche infinita).

Di conseguenza, con spazio vettoriale intendiamo una _collezione di oggetti matematici astratti_ costruiti in modo tale che le relazioni tra di essi modellino in modo adeguato le relazioni tra i componenti di un sistema quantistico.

Tanto per non farci mancare niente, non solo gli stati di un sistema quantistico sono dei vettori, ma sono anche dei vettori piuttosto interessanti: sono dei vettori _generalmente complessi_ (nel senso che sono vettori le cui componenti sono nel dominio complesso, non che sono vettori complicati!).

La notazione di Dirac
---------------------

Per descrivere un vettore di stato complesso $$ a $$ nello spazio degli stati di un sistema quantistico si utilizza la seguente notazione (introdotta da Paul Dirac):

$$ \vert a \rangle $$

Questo "oggetto" prende il nome di __ket__ del vettore $$ a $$.

Poiché si può dimostrare (non lo faremo) che lo spazio degli stati è uno spazio di Hilbert, esso è chiuso all'addizione. Se $$ a $$ e $$ b $$ sono due vettori di stato di un sistema quantistico, il vettore $$ c $$ combinazione dei due è anche esso vettore di stato del medesimo sistema.

$$ \vert a \rangle + \vert b \rangle = \vert c \rangle $$

Similmente, è possibile moltiplicare un ket per uno scalare (genericamente complesso):

$$ z \vert a \rangle = \vert a^\prime \rangle $$

Anche le altre regole che definiscono gli spazi di Hilbert sono rispettate (esistenza di elemento neutro, commutatività, associatività, ecc.). Le riassumiamo tutte in un'unica proprietà, che lo spazio effettivamente rispetta: la __linearità__.

Possiamo lavorare anche con una rappresentazione più concreta dei ket, ovvero nella forma di _vettori colonna_, che ne esplicitano le componenti. Ad esempio, possiamo scrivere:

$$ \vert A \rangle = \begin{pmatrix} \alpha_1 \\ \alpha_2 \end{pmatrix} $$

dove i coefficienti complessi $$ \alpha $$ rappresentano le componenti del vettore.

Come abbiamo detto per la linearità vale per la somma:

$$ \vert A \rangle  + \vert B \rangle = \begin{pmatrix} \alpha_1 \\ \alpha_2 \end{pmatrix} + \begin{pmatrix} \beta_1 \\ \beta_2 \end{pmatrix} = \begin{pmatrix} \alpha_1 + \beta_1 \\ \alpha_2 + \beta_2 \end{pmatrix}  $$

e per la moltiplicazione per uno scalare complesso:

$$ z \vert A \rangle  = z\begin{pmatrix} \alpha_1 \\ \alpha_2 \end{pmatrix}  = \begin{pmatrix} z\alpha_1 \\ z\alpha_2  \end{pmatrix}  $$

Bra e Ket
---------
Così come un numero complesso possiede il suo complesso coniugato, che corrisponde al numero originario con la parte immaginaria cambiata di segno, allo stesso modo un vettore ket possiede il suo corrispettivo avente come componenti i complessi coniugati del ket di partenza. Questo nuovo vettore è chiamato __bra__ e si indica con:

$$ \langle A \vert $$

È facile immaginare che ogni bra ha il suo ket corrispondente e viceversa. È importante, però, ricordare che bra e ket _non condividono lo stesso spazio vettoriale_. I bra, infatti, individuano uno spazio vettoriale _distinto_ che prende il nome di __spazio duale__.

I bra godono delle stesse proprietà già viste per i ket, però bisogna fare alcune precisazioni.

Innanzitutto, senza eccessive sorprese, data la seguente relazione:

$$ \vert A \rangle + \vert B \rangle $$

vale che

$$ \langle A \vert + \langle B | $$

Ma il corrispondente bra della relazione in ket

$$ z \vert A \rangle $$

è

$$ \langle A \vert z^* $$

dove $$ z^* $$ è il complesso coniugato di $$ z $$.

Nella rappresentazione delle componenti in colonna, per rendere ben evidente che i due spazi vettoriali individuati dai vettori bra e ket, i primi si rappresentano come vettori riga. In altre parole, al ket di A

$$ \vert A \rangle  = \begin{pmatrix} \alpha_1 \\ \alpha_2 \end{pmatrix}  $$

corrisponde il bra:

$$ \langle A \vert  = \begin{pmatrix} \alpha^*_1 & \alpha^*_2 \end{pmatrix}  $$

Questa rappresentazione duale suggerisce che i bra e i ket possono essere moltiplicati insieme attraverso una operazione che è l'equivalente complesso del prodotto scalare: il prodotto interno

Prodotto interno
----------------
Il prodotto interno è l'operazione analoga al prodotto scalare, ma avviene tra un bra e un ket. Se, quindi, il prodotto scalare è tra vettori _reali_, il prodotto interno è tra vettori _complessi_, pertanto può esserne visto come una generalizzazione.

In pratica, il prodotto interno è il prodotto di un vettore per il duale (il complesso coniugato) dell'altro vettore. Si indica con una notazione "a sandwitch":

$$ \langle B \vert A \rangle $$

Notate che i due vettori messi insieme fanno un bra-ket ("parentesi" in inglese): un modo mnemonico molto utile per non confondersi tra spazio e spazio duale!

Le regole del prodotto interno sono abbastanza facili da derivare. Per esempio, godono di linearità:

$$ \langle B \vert ( | A \rangle + \vert B \rangle) = \langle C \vert A \rangle + \langle C \vert B \rangle $$

Ma non della proprietà commutativa, ovvero in genere:

$$ \langle B \vert A \rangle \ne \langle A \vert B \rangle $$

ma vale la commutazione complessa:

$$ \langle A \vert B \rangle = \langle B \vert A \rangle^* $$

In pratica, scambiare bra con ket equivale a prendere il complesso coniugato.

Supponiamo di effettuare il prodotto interno di un vettore per se stesso. Per la commutazione complessa avremo

$$ \langle A \vert A \rangle = \langle A \vert A \rangle^* $$

che è un numero reale perché solo nei numeri reali il complesso coincide con il coniugato.

Inoltre,

$$ \begin{pmatrix} \alpha^*_1 & \alpha^*_2 \end{pmatrix} \begin{pmatrix} \alpha_1 \\ \alpha_2 \end{pmatrix} = \alpha^*_1\alpha_1 + \alpha^*_2\alpha_2 $$

non solo è reale, ma è anche positivo ed è il quadrato della lunghezza del vettore. Possiamo generalizzare e dire che vettori complessi hanno lunghezza reale.

Per finire una nota sull'ortogonalità: due vettori complessi sono ortogonali se il loro prodotto interno à zero.

$$ \langle A \vert B \rangle = 0 $$

L'ortogonalità si mantiene nello spazio duale.

In analogia con gli spazi reali, il massimo numero di vettori mutualmente ortogonali definisce la dimensionalità dello spazio (e la dimensione delle sue basi ortonormali, che vedremo nel prossimo articolo).
