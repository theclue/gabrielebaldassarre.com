---
category: Fisica
title: L'effetto fotoelettrico
excerpt: Un breve articolo che spiega cos'è l'effetto fotoelettrico e di come la spiegazione del fenomeno fornita da Einstein gli valse il premio Nobel nel 1921.
header:
  overlay_image: /assets/images/effetto-fotoelettrico-overlay.png
  teaser: /assets/images/effetto-fotoelettrico-teaser.jpg
  overlay_filter: 0.5
---

Agli albori della meccanica quantistica, agli inizi del XX secolo, Planck contribuì con una importante osservazione relativa alla [radiazione di corpo nero](https://it.wikipedia.org/wiki/Corpo_nero), ovvero di un oggetto reale che, a temperatura $$ T $$, assorbe tutta la radiazione elettromagnetica incidente senza rifletterla (da cui, appunto, _nero_). Esso, secondo l'interpretazione classica e per via della conservazione dell'energia, re-irradia tutta l'energia  assorbita e, secondo Planck, lo fa in uno spettro di emissione quantizzato. In particolare, la radiazione emessa ha energia $$ h\nu $$, con $$ h = 6,626 \cdot 10^{-34} J \cdot s $$ la costante di Planck e $$ \nu $$ la frequenza della radiazione emessa.

Einstein partì da queste considerazioni per spiegare un fenomeno già noto all'epoca (siamo nel 1905) relativo all'assorbimento di una radiazione elettromagnetica di frequenza $$ \nu $$ da parte di un campione metallico con conseguente emissione di elettroni. L'effetto fotoelettrico, appunto.

Il fenomeno
-----------
Supponiamo, come detto, che una radiazione elettromagnetica monocromatica di frequenza $$ \nu $$ incida su un campione metallico di temperatura $$ T $$ nel vuoto. Gli elettroni del metallo assorbiranno l'energia della radiazione elettromagnetica ed alcuni di essi ne assorbiranno abbastanza da _saltar via_ dalla loro orbita intorno ai rispettivi nuclei atomici ed essere espulsi dal metallo. Questi elettroni in fuga possono essere rilevati da un opportuno apparato posto nelle vicinanze del metallo formato da un potenziale e un circuito in cui l'elettrone in movimento induce una corrente; in questo modo l' energia degli elettroni emessi può essere misurata.

Andando a misurare la massima energia $$ E_m $$ degli elettroni espulsi si può osservare che dipende _non_ dall'intensità della radiazione incidente, come ci saremmo aspettati dalla fisica classica, bensì dalla __frequenza__ $$ \nu $$ della radiazione stessa. Al di sotto di una frequenza di soglia $$ \nu_0 $$, inoltre, non vi è emissione alcuna di elettroni. L'intensità della radiazione influisce, invece, solo nella __quantità__ di elettroni emessi.

La dipendenza tra la frequenza $$ \nu $$ e l'energia $$ E_m $$ è lineare con un coefficiente pari alla costante di Planck. Più nel dettaglio, vige la relazione:

$$ E_m = h\nu - q\Phi $$

con $$ q $$ la carica dell'elettrone  e $$ \Phi $$ un potenziale (misurato in Volt) dipendente dalle caratteristiche fisiche del metallo. $$ E_m $$ rappresenta l'energia _minima_ necessaria all'elettrone per essere espulso dal metallo e viene detto __lavoro di estrazione__.

Detto in altri termini, l'elettrone assorbe una energia $$ h\nu $$ dalla radiazione elettromagnetica incidente e perde una energia $$ q\Phi $$ per poter essere espulso dal metallo, il che risulta in una energia netta posseduta dall'elettrone emesso pari a $$ E_m $$.

Più spesso, in luogo della frequenza si utilizza una formulazione avente come termine la pulsazione e chiamata __Relazione di Planck__

$$ E = \frac{h(2\pi\nu)}{2\pi } = \hbar\omega $$

Questo fenomeno mostra la natura quantizzata della radiazione elettromagnetica, trasferita (sarebbe più corretto dire _mediata_) da particelle discrete chiamate __fotoni__.

L'esperimento della doppia fenditura ha, successivamente, dimostrato la doppia natura (ondulatoria e corpuscolare) dei fotoni, mentre lo stesso esperimento effettuato con, ad esempio, dei raggi catodici ha consentito di stabilire che anche le particelle cosiddette di materia, come gli elettroni, hanno una doppia natura. In particolare, Louis de Broglie ipotizzò che una particella avente momento $$ p = mv $$ abbia una lunghezza d'onda di

$$ \lambda = \frac{h}{p} = \frac{h}{mv} $$

e, quindi,

$$ p = \frac{h}{\lambda} = \frac{h}{2\pi} = \frac{\hbar}{\lambda} = \frac{\hbar}{k} $$

con $$ k $$ il numero d'onda.

Queste relazioni, insieme alla relazione di Planck, connettono (in un sistema a scala quantistica, ovviamente) la natura ondulatoria dei fenomeni (con grandezze quali frequenza e lunghezza d'onda) con la descrizione delle particelle dal punto di vista corpuscolare (dotati di energia e momento).

È molto importante notare che la relazione esistente tra frequenza e lunghezza d'onda, chiamata relazione di dispersione, __non è__ la stessa per tutte le particelle elementari.

Per esempio, nei fotoni si ha:

$$ \nu = \frac{c}{\lambda} \Rightarrow E = \hbar\omega = \hbar(2\pi\nu) = \hbar2\pi(\frac{c}{\lambda}) = \hbar ck = cp $$

ma per gli elettroni, tanto per dire, la funzione $$ E(k) $$ è diversa. Questa proprietà è essenziale nello studio dei semiconduttori.

Le conclusioni di Einstein
-----------

In definitiva, nella radiazione elettromagnetica, l'energia non è distribuita uniformemente e con continuità sull'intero fronte d'onda, ma concentrata in singoli pacchetti discreti (o __quanti__) di energia - i fotoni - che interagiscono una alla volta con i singoli elettroni a cui cedono la loro energia. Questo, a patto che tale energia, ottenuta tramite la relazione di Planck, sia pari almeno al lavoro di estrazione necessario per rompere il legame elettrostatico che lega gli elettroni ai rispettivi nuclei.

Aumentando l'intensità della radiazione elettromagnetica, ovvero il __numero__ di fotoni con la stessa lunghezza d'onda che vanno a incidere sul metallo non andrà ad aumentare l'energia cinetica degli elettroni emessi, ma il loro numero.

Se l'energia posseduta dai fotoni non è sufficiente per vincere il lavoro di estrazione, nessun elettrone è emesso dal metallo e l'effetto fotoelettrico non è osservato, indipendentemente da quanto intensa è la radiazione che lo ha illuminato.

Questo fenomeno, confermato sperimentalmente, contraddice apertamente quanto previsto dalla fisica classica attraverso le equazioni di Maxwell, secondo cui l'intera onda interagisce nel suo complesso con tutti gli elettroni del metallo.

Questa diretta conseguenza della quantizzazione dell'energia, per cui fotoni ed elettroni interagiscono uno per uno, portò  Einstein a vincere il suo unico premio Nobel nel 1921.

{% figure caption:"Ironicamente, il grande fisico tedesco non vinse mai l'ambito premio per il lavoro che lo avrebbe consegnato alla storia, quello sulla Relatività Generale, ma solo per questo suo contributo che, di fatto, diede il via alla meccanica quantistica. Una teoria per alcuni aspetti della quale egli nutrì molte riserve, per non dire profonda avversione, durante tutta la sua vita." %}
![Albert Einstein nel 1915](/assets/images/einstein.jpg)
{% endfigure %}
