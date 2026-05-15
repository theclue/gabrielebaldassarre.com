---
category: Fisica
title: Stati di Spin
excerpt: 'È giunto il momento di verificare se il modello matematico che abbiamo derivato
  per descrivere gli stati quantistici funziona. Mettiamolo alla prova con il sistema
  quantistico più semplice di tutti: uno spin'
master: /assets/images/stati-spin.png
broadcast:
  channels:
  - linkedin
  - mastodon
  sent: true
header:
  overlay_filter: 0.5
---

Negli articoli precedenti, abbiamo definito lo spazio degli stati di un sistema quantistico come [un sistema vettoriale composto da vettori complessi]({% post_url fisica/2019-10-04-spazio-stati-quantistici %}) e, come tale, caratterizzato da una direzione, un modulo e un verso (anche se intesi non in senso spaziale). Abbiamo anche visto che [una certa impredicibilità]({% post_url fisica/2019-09-13-esperimenti-quantistici-distribuzione %}) è tipica di un sistema quantistico e che la misura stessa, per quanto infinitamente gentile, altera (anzi, come abbiamo detto, _prepara_) il sistema.

Appurato che i vettori di stato predicono in modo perfettamente deterministico ciò che si può conoscere di un sistema (che, però, non è tutta l'informazione contenuta in un sistema; questo, per via del principio di indeterminazione), abbiamo tutti gli elementi per studiare un sistema concreto.

Quello più facile: uno spin singolo

Introduzione allo spin
----------------------

Innanzitutto è bene fare una precisazione: quando parliamo di sistema di spin singolo parliamo proprio di uno _spin_, ovvero una caratteristica intrinseca delle particelle che non ha un corrispettivo nel mondo classico.

Non è quindi lo _spin di un elettrone_. L'elettrone è la particella subatomica che porta uno spin a spasso per l'Universo. Quindi il sistema che individuano è diverso, e più complicato, di quello (per certi versi astratto) individuato dal solo spin.

E a maggior ragione non è la componente di rotazione dell'elettrone sul proprio asse, anche se spesso si ricorre a questa analogia per meglio rappresentarlo, visto che il vettore di spin può essere visto come un momento angolare magnetico caratterizzato da tre componenti sugli assi spaziali $$ {x, y, z} $$.

Lo spin fu introdotto da Pauli come un'astrazione puramente matematica per descrivere il modello delle particelle quantistiche; non fu mai pensato dallo scienziato come qualcosa di reale, sperimentalmente misurabile. Anzi, quando ne fu effettivamente misurato il valore, Pauli all'inizio non era del tutto certo che la grandezza misurata fosse proprio il _suo_ spin.

Come dicevamo, però, in questa fase ci concentriamo sull'idea astratta di spin, e in particolare sugli stati assunti dal sistema da esso individuato, non dal motivo per cui assume certi valori e non altri, né tantomeno sulla sua natura fisica.

Gli stati di spin lungo _z_
---------------------------

Come abbiamo detto più volte, condurre una misurazione di una grandezza su un sistema (in questo caso, lo spin) attraverso un apparato _A_ orientato lungo una determinata direzione lascia il sistema su quella direzione, giacché il valore misurato dall'apparato può assumere valori solo $$ \pm 1 $$.

Supponiamo di orientare l'apparato _A_ lungo l'asse _z_ e di effettuare una misurazione, per misurare la componente di spin su tale asse. Otteniamo, come ben sappiamo, $$ \sigma_z = \pm 1 $$ con uguale probabilità.

Chiamiamo gli stati che hanno determinato tale misurazione come $$ \vert u \rangle $$ (_up_) e $$ \vert d \rangle $$ (_down_) a seconda che l'apparato ci abbia restituito _+1_ o _-1_.

Adesso orientiamo l'apparato lungo l'asse _x_ per ottenere $$ \sigma_x = \pm 1 $$. La misurazione ha lasciato il sistema nello stato $$ \vert r \rangle $$ oppure (_righ, +1_) $$ \vert l \rangle $$ (_left, -1_).

Infine, effettuiamo la misura lungo l'asse _y_. La misurazione in questo caso ha lasciato il sistema nello stato che etichettiamo $$ \vert i \rangle $$ (_in, +1_) oppure $$ \vert o \rangle $$ (_out, -1_). In e out, qui, nel senso che _entrano_ o _escono_ dallo schermo, per capirci.

Il fatto che lo spin possa assumere solo due valori, ci suggerisce che __tutti i possibili stati di spin possono essere rappresentati da uno spazio vettoriale bidimensionale__.

Attenzione! Questo __non significa__ che il sistema-spin ammetta solo due stati, ma che presenta solo due possibili _valori misurati_. In meccanica quantistica, queste due informazioni non coindono.

Poiché lo spazo degli stati è bidimensionale, scegliamo due vettori qualunque, purché ortogonali, e utilizziamoli come base dello spazio. $$ \vert u \rangle $$ e $$ \vert d \rangle $$ andranno benissimo.

Consideriamo ora un generico vettore di stato $$ \vert A \rangle $$. Esso sarà esprimibile come combinazione lineare dei vettori della base attraverso dei coefficienti che rappresentano le componenti lungo la base stessa:

$$ \vert A \rangle = \alpha_u \vert u \rangle + \alpha_d \vert d \rangle $$

Abbiamo visto che [possiamo determinare le componenti lungo la base]({% post_url fisica/2019-10-21-basi-ortonormali %}) con l'operazione di prodotto interno del vettore di stato _A_ con i vettori della base:

$$ \alpha_u = \langle A \vert u \rangle  $$
$$ \alpha_d = \langle A \vert d \rangle  $$

Questi coefficienti complessi sono molto importanti perché il loro modulo al quadrato rappresenta una _probabilità_ che, data una misura lungo la direzione della base, lo stato $$ \vert A \rangle $$ sia $$ \vert u \rangle $$ o $$ \vert d \rangle $$.

$$ P_u = \alpha_u^*\alpha_u $$ che $$ \sigma_z = 1 $$ ovvero lo spin sia sullo stato $$ \vert u \rangle $$


$$ P_d = \alpha_d^*\alpha_d $$ che $$ \sigma_z = -1 $$ ovvero lo spin sia sullo stato $$ \vert d \rangle $$

Per questo motivo i coefficienti $$ \alpha $$ sono chiamati _ampiezze di probabilità_.

Recuperando _(*)_ e _(**)_ e ricordando che il _bra_ corrispondente a un _ket_ è il suo complesso coniugato:

$$ P_u = \langle A \vert u \rangle \langle u \vert A \rangle $$

$$ P_d = \langle A \vert d \rangle \langle d \vert A \rangle $$

Naturalmente, la somma delle probabilità di tutti gli eventi possibili è uguale a 1:

$$ P_u + P_d = 1 $$

ma questo significa che

$$  \alpha_u^*\alpha_u + \alpha_d^*\alpha_d = 1 $$

Poiché l'equazione sopra rappresenta tutti gli stati del sistema, il fatto che la loro somma sia 1 ci porta a completare la definizione di spazio degli stati.

Esso è definito in uno spazio vettoriale complesso __di lunghezza unitaria__. Tutti i vettori di base sono, pertanto, __normalizzati__. In più, i moduli al quadrato dei componenti su una base rappresentano le probabilità dei diversi risultati sperimentali ottenibili durante una misura.

La relazione di ortogonalità tra $$ \vert u \rangle $$ e $$ \vert d \rangle $$ è interessante perché significa (e si può provare sperimentalmente) che se uno spin è preparato nello stato _up_ __non può__ trovarsi nello stato _down_ ($$ P_d = 0 $$) e viceversa. Stati ortogonali rappresentano stati _fisici_ sperimentalmente distinti, senza alcuna ambiguità.

Se un apparato _A_ orientato lungo l'asse _z_ misura $$ \sigma_z = 1 $$, non vi è alcuna probabilità che lo stato sia $$ \vert d \rangle $$. Lo stato è certamente _up_ ed esperimenti ripetuti confermano la misurazione perché $$ P_d = 0 \Rightarrow P_u = 1 $$.

Attenzione, però. Dire che i vettori di stato sono ortogonali non ha nulla a che vedere con le direzioni spaziali. Lo spazio degli stati è un concetto matematico; le direzioni _up_ e _down_ dello spin magnetico non sono (generalmente) ortogonali nelle direzioni spaziali anche se i vettori di stato $$ \vert u \rangle $$ e $$ \vert d \rangle $$ lo sono.

Lungo le altre direzioni
------------------------

Apparentemente, $$ \vert l \rangle $$ e $$ \vert r \rangle $$, così come $$ \vert i \rangle $$ e $$ \vert o \rangle $$ sono vettori distinti che misurano componenti diverse dello spin (rispettivamente lungo l'asse _x_ e l'asse _y_.). Tuttavia, abbiamo verificato che lo spazio degli stati del sistema di spin è bidimensionale, il che vuol dire che tutti gli stati sono esprimibili come combinazione lineare di _due_ vettori di base.

Ora, supponendo di scegliere come base $$ \vert l \rangle $$ e $$ \vert r \rangle $$, quello che otterremo è perfettamente identico a quanto fatto prima per la componente _z_; semplicemente sceglieremmo una base ruotata di 90° rispetto alla precedente e con essa andremmo a misurare $$ \sigma_x $$. Nulla di interessante, qui.

Quello che, invece, è interessante è esprimere, ad esempio, lo stato (preparato) $$ \vert r \rangle$$ in termini di $$ \vert u \rangle $$ e $$ \vert d \rangle $$:

$$ \vert r \rangle = \alpha_u \vert u \rangle + \alpha_d \vert d \rangle $$

Se lo stato è stato effettivamente preparato in $$ \vert r \rangle $$ e successivamente l'apparato di misurazione viene ruotato per misurare $$ \sigma_z $$, la probabilità che il suo spin sia _up_ o _down_ è la stessa e, come sappiamo, vale $$ \frac{1}{2} $$:

$$ P_u = \alpha_u^* \alpha_u = \frac{1}{2} $$

$$ P_d = \alpha_d^* \alpha_d = \frac{1}{2} $$

Un vettore che soddisfa la precedente è (tralasciando il segno negativo di _down_, ininfluente):

$$ \vert r \rangle = \frac{1}{\sqrt{2}} \vert u \rangle + \frac{1}{\sqrt{2}} \vert d \rangle $$

Per quanto riguarda _left_, analogamente se il sistema è stato preparato in $$ \vert l \rangle $$, le probabilità in $$ \sigma_z $$ sono ancora pari a $$ \frac{1}{2} $$. Poiché $$ \vert l \rangle $$ e $$ \vert r \rangle $$ sono ortogonali

$$ \langle r \vert l \rangle = 0 $$

partiamo dall'espressione di $$ \vert r \rangle $$ per trovare $$ \vert l \rangle $$:

$$ \vert l \rangle = \frac{1}{\sqrt{2}} \vert u \rangle - \frac{1}{\sqrt{2}} \vert d \rangle $$

Verifichiamo l'ortogonalità con il prodotto interno tra i coefficienti:

$$ \begin{pmatrix} \frac{1}{\sqrt{2}} & -\frac{1}{\sqrt{2}} \end{pmatrix} \begin{pmatrix} \frac{1}{\sqrt{2}} \\ \frac{1}{\sqrt{2}} \end{pmatrix} = 0 $$

E, per finire, ripetiamo un simile ragionamento su _in_ e _out_ per ottenere i due stati:

$$ \vert i \rangle = \frac{1}{\sqrt{2}} \vert u \rangle + \frac{i}{\sqrt{2}} \vert d \rangle $$

$$ \vert o \rangle = \frac{1}{\sqrt{2}} \vert u \rangle - \frac{i}{\sqrt{2}} \vert d \rangle $$

Anche questi due vettori sono ortogonali tra di loro: le coppie che abbiamo individuato, in definitiva, rappresentanto __tre basi__ del sistema di singolo spin. Ricordiamocelo quando, per onorare la tradizione, sceglieremo sistematicamente la coppia _up_, _down_ come base, nei prossimi articoli. Alla prossima!
