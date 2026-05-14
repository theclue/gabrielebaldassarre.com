---
category: Approfondimenti
title: Lo spazio degli stati
excerpt: "Senza un minimo di concetti base di Meccanica Razionale non si va molto oltre, nello studio della fisica. La materia è certamente ostica, ma come di consueto cercheremo di limitarci al minimo (teorico) necessario. Cominciando dal principio."
header:
  overlay_image: /assets/images/focault-pendulum-overlay.jpg
  teaser: /assets/images/focault-pendulum-teaser.jpg
  overlay_filter: 0.5
editor_options:
  chunk_output_type: inline
---



Supponiamo di voler studiare la dinamica di un sistema inerziale composto da un singolo punto materiale in moto nello spazio. In quanto tale, suddetto punto e soggetto alla legge del moto di Newton:

$$ ma = F $$

La dinamica di questo sistema inerziale è rappresentata dal _movimento_ del punto materiale, ovvero l'incognita è rappresentata dalla posizione del punto nel tempo:

$$ x = x(t) $$

Il che ci porta a concludere che la legge di Newton non solo è una equazione funzionale, ma è anche una equazione differenziale ordinaria di secondo ordine, perché l'incognita (la posizione) vi compare con il termine di derivata seconda (l'accelerazione, ricordando che $$ a(t) = \ddot{x(t)}) $$). In quanto tale, risolverla analiticamente è quasi sempre molto complicato e in ogni caso dipende molto dalla complessità del sistema.

Poiché ogni soluzione dell'equazione di Newton è individuata da una coppia di vettori (e dalle rispettive condizioni iniziali di posizione $$ x_0 $$ e velocità $$ v_0 $$), l'intera dinamica del sistema è descrivibile come l'insieme di tutte le coppie ordinate _{x, v}_, che individuano uno spazio vettoriale in $$ \mathbb{R}^3 \times \mathbb{R}^3 $$. Lo spazio generato da questo prodotto cartesiano descrive ogni possibile stato dinamico del sistema e prende il nome, per l'appunto, di spazio degli stati o __spazio delle fasi__.

Nel caso specifico, fissata una forza _F_ come una ben definita funzione delle condizioni iniziali e, genericamente, dal tempo _t_, ovvero _F(x, v, t)_, esiste una e una sola soluzione all'equazione di Newton che al tempo iniziale $$ t_0 $$ parte da un punto $$ {x_0, v_0} $$ dello spazio delle fasi e che determina l'evoluzione futura del sistema lungo _t_ secondo le leggi della meccanica (l'equazione differenziale del moto).

L'evoluzione del sistema altri non è che una _successione_ di punti nello spazio delle fasi o, se il sistema è continuo, una curva avente come tangente in ogni punto il vettore le cui componenti sono i due vettori _{x, v}_ al variare di _t_.

Questo consente di poter visualizzare lo spazio degli stati in un diagramma chiamato __ritratto di fase__ in cui andare a disegnare tutte le possibili _traiettorie_ del sistema (in che stato il sistema evolverà al variare di _t_) e definirne qualitativamente le peculiarità.

Ma forse è il caso di fare un esempio.

Il pendolo ideale
-----------------

Innanzitutto una precisazione. Il concetto di ritratto di fase è del tutto generale e non è legato necessariamente a un sistema meccanico (descritto dalle equazioni del moto di Newton), ma può essere utilizzato su sistemi dinamici di qualsiasi natura e con un numero qualsiasi di dimensioni.

Nulla vieta, per capirci, di descrivere un sistema attraverso l'uso di _N_ variabili, anche infinite, e relative condizioni iniziali in modo da individuare uno spazio di fase in $$ \mathbb{R}^N \times \mathbb{R}^N $$. Né siamo costretti a utilizzare vettori reali (in meccanica quantistica, ad esempio, [quei vettori sono complessi]({% post_url fisica/2019-10-04-spazio-stati-quantistici %})).

Il problema, più che altro, sta nell'efficacia della _rappresentazione_ di uno spazio degli stati quando la dimensionalità del sistema dinamico cresce.

Tuttavia, in meccanica classica la dinamica è espressa dalle variabili posizionali e dai loro gradienti (più spesso si usa il _momento_ in luogo della velocità, ma la sostanza non cambia perché il momento $$ p = mv $$). Per essere pratici, useremo perciò nel nostro esempio un sistema meccanico caratterizzato da un movimento in una dimensione, così da avere un diagramma di fase facilmente visualizzabile in un piano cartesiano con la posizione sull'asse delle ascisse e il relativo gradiente sull'asse delle ordinate.

Il pendolo ideale si adatta bene allo scopo.

Supponiamo di esprimerne la posizione come l'angolo che forma con il proprio asse verticale $$ \theta $$, quindi in uno spazio in $$ \mathbb{R} $$, e il gradiente attraverso la velocità angolare $$ \dot{\theta} $$.

L'equazione che ne regola il moto armonico è le seguente:

$$ \ddot{\theta} = -\frac{g}{l}sin\theta $$

Nell'immagine in basso, possiamo vedere i vari stati che assume il pendolo, in termini di coppie di angolo $$ \theta$$ e velocità angolare $$ \dot{\theta} $$, fissate delle condizioni iniziali per $$ \theta_0 $$ e $$ \dot{\theta_0} $$. L'oscillazione del pendolo da destra verso sinistra (per poi tornare indietro) descrive una traiettoria di __transizioni di fase__ che nel ritratto di fase disegna una circonferenza.

{% figure caption:"Andamento nel tempo e rappresentazione di stato del pendolo ideale scelta una coppia di condizioni iniziali. Si dice _ideale_ in quanto, nel sistema di riferimento inerziale preso in esame, si considerano nulle le forze di attrito. Il pendolo, insomma, continuerà a muoversi all'infinito di moto armonico sul piano _xy_." %}
![Ritratto di fase di un pendolo ideale](https://upload.wikimedia.org/wikipedia/commons/c/cd/Pendulum_phase_portrait_illustration.svg)
{% endfigure %}

Di fatto, note le condizioni iniziali ed i vettori che determinano le transizioni di stato al variare di _t_, possiamo prevedere l'evoluzione del sistema e quindi il suo futuro. È il concetto base del __determinismo laplaciano__, che però studieremo nel dettaglio in uno dei prossimi articoli.

Se, però, __non__ fissiamo una coppia di condizioni iniziali, i vettori di tutte le possibili transizioni di stato vanno a costruire un _campo vettoriale_ che descrive __tutti__ gli stati possibili del sistema: il ritratto di fase vero e proprio. Non offre una soluzione analitica dell'equzione differenziale che regola il moto del sistema (cosa che pure sarebbe stata possibile calcolare nell'esempio specifico del pendolo, ma che in genere è estremamente complicata), ma offre una buona vista di sintesi ed enfatizza la presenza di regioni particolari. Vediamole:

![plot of chunk phase.portait](/assets/figures/phase.portait-1.svg)

Interpretazione del diagramma
-----------------------------

Le traiettorie disegnate rappresentano sette possibili evoluzioni del sistema a partire da altrettante condizioni iniziali, che, ricordiamo, sono i "punti di partenza" e sul diagramma sono rappresentate dai cerchietti. Si notano subito tre regioni particolari:

* Le traiettorie in __arancione__ sono caratterizzate da un gradiente di velocità angolare che a un certo punto cambia segno. È il comportamento che subito associamo a un movimento pendolare: il peso che oscilla in avanti fino ad un angolo $$ \theta_{max} $$ (la distanza percorsa nella direzione delle ascisse $$ \theta $$ aumenta), riducendo progressivamente la sua velocità angolare (la traiettoria curva avvicinandosi all'asse delle ascisse) per poi, quando la velocità è zero, tornare indietro. Lo stesso movimento si ha nel verso opposto e così via, con oscillazioni infinite.

* Le traiettorie in __blu__ sono caratterizzate da velocità angolari iniziali sufficienti per far girare il pendolo su se stesso (attorno al proprio vincolo). Il pendolo oscilla, perde progressivamente velocità, ma la velocità non è nulla quando $$ \theta = 180° $$, quindi comincia a cadere nella direzione opposta, riprendendo velocità che ha il suo massimo quando $$ \theta = 0 $$ per poi ricominciare. La velocità, infatti, non è mai nulla (la traiettoria non interseca mai l'asse delle ascisse).

* Le traiettorie in __rosso__ sono gli unici due punti di equilibrio del sistema, che si hanno quando il pendolo ha velocità angolare iniziale nulla e giace sul suo asse in posizione di riposo (con $$ \theta = 0 $$ ma anche con $$ \theta = 180° $$).

Il tutto si ripete con periodicità $$ 2 \pi $$.

In definitiva dovrebbe essere chiaro il funzionamento di questa rappresentazione e come può essere utile per studiare l'evoluzione dinamica di un sistema, una volta che se ne è determinata la sua rappresentazione in termini di sistema di equazioni differenziali ordinarie.

Giacché non abbiamo risolto suddette equazioni, ne fornisce solo una vista approssimata, eppure la soluzione analitica non avrebbe evidenziato le differenti _regioni_ dinamiche del sistema in modo tanto lampante.

Certo, al crescere dell'ordine del sistema, la visualizzazione diventa complessa e inefficace, per non dire impossibile. Resta, tuttavia, uno strumento prezioso anche per visualizzare mentalmente come un sistema evolve e per spiegare come la sua dinamica è descritta da vettori in un campo. Questo concetto, tra l'altro, risulta essenziale nello studio della Meccanica Quantistica, oltre che ovviamente in Meccanica Razionale.

Prossimamente faremo qualche esempio pratico di realizzazione di ritratti di fase tramite R, visto che [esiste un package](https://cran.r-project.org/web/packages/phaseR/vignettes/my-vignette.html) semplice e intuitivo adatto allo scopo. Alla prossima!
