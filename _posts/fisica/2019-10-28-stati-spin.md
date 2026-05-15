---
category: Fisica
title: Stati di Spin
excerpt: "È giunto il momento di verificare se il modello matematico che abbiamo derivato per descrivere gli stati quantistici funziona. Mettiamolo alla prova con il sistema quantistico più semplice di tutti: uno spin"
master: /assets/images/stati-spin.png
broadcast:
  channels: [linkedin, mastodon]
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
-------------------------

Prendiamo un sistema fisico _spin singolo_: come già assodato, esso può assumere solo due valori in corrispondenza di una misura orientata lungo l'asse $$ z $$ (non è sempre vero per qualunque direzione, ma per ora accontentatevi), i valori sono _spin up_ e _spin down_.

Alternativamente, possiamo definire che lo spin si trova in uno **stato generale**, composto da una sovrapposizione dei due stati di base (up e down), quindi generalizziamo:

$$ \vert A \rangle = \alpha_u \vert u \rangle + \alpha_d \vert d \rangle $$

Non spaventatevi! È una notazione compatta per esprimere un concetto semplice: lo stato di spin è formato da una componente up e una componente down, ognuna pesata per un coefficiente, detto **coefficiente di combinazione lineare**.

Il simbolo $$ \vert A \rangle $$ è un vettore di stato generico che chiamiamo _ket A_. I simboli $$ \vert u \rangle $$ e $$ \vert d \rangle $$ sono i vettori di stato relativi allo spin up e allo spin down.

Non è questa la sede per spiegare la notazione bra-ket, ma sappiate che è uno strumento elegante e compatto per scrivere le equazioni della meccanica quantistica.

Tornando al nostro stato generale, i coefficienti $$ \alpha_u $$ e $$ \alpha_d $$ sono numeri complessi che esprimono il "peso" di ciascuna componente. Il modulo quadro di questi coefficienti esprime la probabilità di trovare lo spin, durante una misura, in uno piuttosto che nell'altro stato.

Esprimiamo questa probabilità scrivendo la matrice densità dei coefficienti. Riscriviamo lo stato generale in forma vettoriale:

$$ \mathbf{A} = \begin{bmatrix} \alpha_u \\ \alpha_d \end{bmatrix} $$

Naturalmente, $$ \vert \alpha_u \vert^2 $$ è la probabilità di osservare il sistema nello stato _up_ e $$ \vert \alpha_d \vert^2 $$ è la probabilità di osservarlo nello stato _down_.

Poiché la somma delle probabilità deve essere 1, abbiamo:

$$ \vert \alpha_u \vert^2 + \vert \alpha_d \vert^2 = 1 $$

La misura dello spin
-------------------

Cosa succede quando misuriamo lo spin? La risposta è in linea con i postulati della meccanica quantistica: prima della misura, il sistema si trova in uno stato di sovrapposizione. L'atto della misura "prepara" il sistema, collassandolo in uno dei due autostati.

Per calcolare la probabilità che il sistema collassi su _up_ o _down_ in una direzione arbitraria, non basta conoscere i coefficienti lungo _z_ ma bisogna proiettare lo stato sul vettore relativo alla direzione di misura.

Questo non significa saperlo _a priori_: anche se conosciamo lo stato iniziale, non possiamo prevedere esattamente il risultato della singola misura, ma possiamo prevedere la distribuzione statistica dei risultati di tante misure.

Se lo spin è preparato nello stato up e misuriamo lungo lo stesso asse _z_, otterremo sempre up. Se invece misuriamo lungo un asse diverso, la probabilità sarà data, in sintesi, dall'angolo fra la direzione dello stato e la direzione della misura — proprio come in un coseno direttore.

Preparare uno stato di spin
--------------------------

Finora abbiamo parlato di misurare spin. Ma come si prepara uno spin in uno stato specifico?

Uno dei metodi più comuni è usare un magnete di Stern-Gerlach, che, accoppiandosi magneticamente con lo spin, lo indirizza su un percorso selettivo in base al suo valore.

Nell'esperimento di Stern-Gerlach, un fascio di particelle con spin viene fatto passare attraverso un campo magnetico non uniforme. A seconda del valore dello spin, le particelle vengono deflesse verso l'alto o verso il basso, separando così i due stati di spin e _preparando_ il sistema in uno di essi.

Bloccando uno dei due fasci, possiamo ottenere un fascio di particelle con spin preparato nello stato desiderato. Questo è un modo per "inizializzare" lo spin in uno stato noto.
