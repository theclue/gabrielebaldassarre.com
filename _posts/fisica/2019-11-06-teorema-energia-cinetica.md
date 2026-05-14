---
category: Fisica
title: Il teorema dell'energia cinetica
redirect_from:
  - /teorema-energia-cinetica/
excerpt: "La meccanica quantistica non è strana al punto da mettere _del tutto_ in discussione il principio di conservazione dell'energia. Ma cosa possiamo dire, esattamente, su questo principio?"
header:
  overlay_image: /assets/images/jordan-discourse-overlay.jpg
  teaser: /assets/images/lagrange-teaser.jpg
  overlay_filter: 0.5
---

All'atto pratico, come l'elettromagnetismo parte dalle leggi di Maxwell, la dinamica classica parte dalle equazioni di Lagrange, che a loro volta sono semplicemente una riscrittura delle leggi di Newton in forma _generale_ e _universale_, cioè che non dipende dal sistema di riferimento e di coordinate (es. cartesiane o polari), ottenibile mediante la derivazione di un'unica funzione scalare, chiamata appunto _lagrangiana_.

Questo aspetto, attraverso la formulazione hamiltoniana che ne deriva e che vedremo successivamente, è essenziale in meccanica quantistica perché mette in luce il formalismo algebrico della cinematica e della dinamica, formalismo utilizzato più volte nella teoria. Quindi ci tocca sbatterci un po' la testa, temo.

Ma prima di cominciare, ci serve qualche nozione iniziale.

Partiamo da Newton
------------------

Supponiamo di avere un sistema in cui un punto materiale si muove, rispetto ad esso, di moto rettilineo uniforme. In questo sistema, più specificatamente chiamato __sistema di riferimento inerziale__ vale la legge di Netwon che ne regola il movimento:

$$ ma = F$$

e, più in generale con _N_ punti materiali vale per ognuno:

$$ m_ka_k = F_k (k=1,\dots N) $$

Poiché l'accelerazione è la derivata seconda della posizione, ne consegue che la legge di Newton non è una equazione qualunque, ma è una equazione differenziale di secondo ordine dove l'incognita è _x(t)_ e dove vi compare, nell'equazione anche attraverso le sue derivate:

$$ \dot{x}(t) = \frac{dx}{dt}(t), \ddot{x}(t) = \frac{d^2x}{dt^2}(t) $$

che ci consentono di esprimere l'equazione di Newton in forma esplicitamente differenziale:

$$ \ddot{x}(t) = \frac{1}{m}F(x, \dot{x}, t) $$

Il __principio di determinismo__ che regola la meccanica classica ci consene di scrivere che, assegnata una forza _F_, ogni soluzione dell'equzione di Newton è univocamente individuata dalle condizioni iniziali del sistema.

$$ x(0) = x_0, \dot{x} = v_0 $$

ovvero la posizione e la velocità iniziale a $$ t_0 $$.

Il motivo per cui Newton ritenne che il moto fosse determinato dalla posizione e dalla velocità iniziali è dovuto al fatto che l'equazione fosse descrivibile mediante sviluppo in serie e, pertanto, come soluzione di certe equazioni differenziali con particolari scelte dei dati iniziali (per i quali è anche possibile estrarre il relativo [ritratto]({% post_url meccanica/2019-10-31-spazio-degli-stati %})). È il teorema di Cauchy-Kowalewska, ma avrò pietà e non lo approfondiremo in questa sede. Piuttosto,c ominciamo a parlare di energia.

Il teorema dell'energia
-----------------------

Supponiamo di avere un sistema composto da un unico punto materiale soggetto a una forza _F(x, v, t)_, ovvero genericamente dipendente dalla velocità, dalla posizione nello spazio e dal tempo. Il __teorema dell'energia cinetica__ afferma che l'energia cinetica posseduta da un corpo è pari all'energia cinetica iniziale più il lavoro compiuto da una forza che agisce sul corpo stesso lungo una determinata traiettoria.

In termini meccanici, l'__energia cinetica T__ è espressa come:

$$ T = \frac{1}{2}mv^2 = \frac{1}{2}mv v $$

che, derivato rispetto al tempo,

$$  \frac{d}{dt}\frac{1}{2}m(v v) = 2v m\frac{dv}{dt} = ma \Rightarrow $$

$$ \dot{T} = F v \tag{*}$$

La detivata $$ \dot{T} $$ dell'energia rappresenta la __potenza della forza__ mentre la forma integrale

$$ T(t_1) - T(t_0) = \int_{t_0}^{t_1} Fv dt \tag{**} $$

è il __lavoro della forza__.

Quindi, come volevasi dimostrare, le due forme _(*)_ e _(**)_, ovvero le forme differenziale e integrale dell'espressione, ci consentono di affermare che:

* Il tasso di variazione dell'energia cinetica è pari alla _potenza_ della forza;
* La variazione netta dell'energia cinetica è pari al _lavoro_ della forza.

Ovviamente stiamo assumendo che (come avviene nella stragrande maggioranza dei casi) la massa _m_ sia costante; per la legge di Newton, la forza impressa sul corpo ne farà variare solo la velocità.

Supponiamo che sul corpo agisca una __forza posizionale__; non, quindi, una generica forza  $$ F(x, v, t) $$, ma una forza che dipende solo dalla posizione nello spazio in cui è applicata $$ F = F(x) $$. Poiché la foza permea, con la sua distribuzione, tutto lo spazio genera, appunto, un __campo vettoriale di forze__ (ovvero una legge che assegna una forza meccanica ad ogni punto dello spazio).

In questa circostanza, l'integrale in _(**)_ dipende solo dalla traiettoria seguita dal punto materiale nell'intervallo di tempo $$ t_0, t_1 $$; chiamiamo questa traiettoria $$ \gamma $$.

$$ T(t_1) - T(t_0) = \int_{\gamma}{F(x) dx} $$

(perché data la funzione di movimento $$ x = x(t) $$, all'incremento infinitesimo si ha $$ dx = vdt $$).

Se il campo di forze oltre a essere posizionale è __conservativo__, si dice che la funzione __ammette potenziale__, cioè che esiste una funzione $$ V(t) $$ tale che

$$ F = -gradV \Rightarrow F_x = -\frac{dV}{dx}, F_y = -\frac{dV}{dy}, F_z = -\frac{dV}{dz} $$

La funzione _V_ è chiamata __energia potenziale__ e il campo è definito conservativo perché in queste condizioni vale la __legge di conservazione dell'energia__ (o Teorema dell'Energia) che dice che, chiamata __energia__ la quntità

$$ E = T + V $$

(cioè la somma di energia cinetica e potenziale)

per un qualunque movimento $$ x = x(t) $$ soluzione dell'equazione di Newton $$ ma = F $$, si ha

$$ \dot{E} = 0 $$

Questo è vero nella misura in cui

$$ Fv = -\frac{dV}{dt} \frac{dx}{dt} = -\frac{dV}{dt} = -\dot{V} $$

Sostituendo nel teorema dell'energia cinetica visto a inizio paragrafo

$$ \dot{T} = Fv \Rightarrow \dot{T} = -\dot{V} \Rightarrow $$

$$ \frac{d}{dt}(T + V) = 0 $$

Per come è formulato, il Teorema dell'Energia vale per forze che variano nello spazio con legge _x(t)_ ed è, inoltre, una legge __invariante__. Al variare del sistema di riferimento inerziale considerato, infatti, variano le espressioni per l'energia, ma il suo gradiente complessivo è sempre identicamente nullo, così come può variare l'espressione per il lavoro, ma esso rappresenta, sempre e in ogni sistema, l'energia trasferita da un corpo a un altro attraverso l'applicazione di una forza.

Le costanti di moto
-------------------

L'energia, essendo una quantità dinamica, è una funzione definita nello [spazio degli stati]({% post_url fisica/2019-10-31-spazio-degli-stati %}) $$ E = E(x, v) $$ e, poiché, in ogni punto dello spazio degli stati passa un unico vettore (originato dalle condizioni iniziali $$ x_0, v_0) che è soluzione dell'equazione di Newton, allora si può esplicitare la dipendenza

$$ E(t) = E(x(t), v(t)) $$

che, derivata rispetto al tempo ricordando che $$ E = T(v) + V(x) $$

$$ \dot{E} = \frac{dT}{dv}a + \frac{dV}{dx}v = mva - Fv = v(ma - F) = 0 $$

(il valore della precedente è zero perché ci muoviamo nel luogo delle soluzioni dell'equazione di Newton)

Le variabili dinamiche che godo di questa proprietà di invarianza rispetto a un movimento (in un sistema inerziale) sono dette __costanti di moto__. L'energia _E_, che mantiene inalterato il proprio valore lungo qualsiasi movimento $$ x = x(t) $$ che sono soluzioni dell'equazione di Newton è, evidentemente, una di esse.

Costanti di moto e ritratti in fase
-----------------------------------

Come abbiamo detto in un precedente articolo, il ritratto in fase "fotografa" la dinamica del sistema _(x, v)_ a partire dalle diverse condizioni iniziali $$ (x_0, v_0) $$. Questi valori iniziali, a loro volta, determinano un valore iniziale _invariante_ di energia $$ E_0 $$, tant'è che il principio di conservazione dell'energia fa riferimento proprio a questo valore iniziale di energia, ovvero

$$ E = T + V = E_0 $$

Questo significa che i movimenti nel ritratto in fase sono distribuiti in "fogli" stratificati sui diversi livelli di energia iniziale, invariante, $$ E_0 $$. Per questo motivo, queste superfici sul diagramma delle fasi sono chiamate __superfici di livello dell'energia__.

Ora, non voglio insistere nella trattazione di argomenti di meccanica, ma questo formalismo razionale ci sarà utile in ambito hamiltoniano. Che, a sua volta, ci consente di trovare una correlazione nel corrispettivo concetto quantistico, tutt'altro che intuitivo.

Prendete, quindi, questo articolo come un ostico, ma utile, approfondimento formale per meglio capire i concetti che verranno in seguito. E possiate perdonarmi!
