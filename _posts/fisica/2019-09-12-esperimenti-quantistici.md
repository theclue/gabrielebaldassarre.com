---
category: Fisica
title: Esperimenti quantistici
excerpt: Un grande classico della meccanica quantistica è l'affermazione secondo cui una misurazione altera il sistema. In questo articolo cerchiamo di dare una spiegazione più rigorosa di questa concezione comune.
header:
  overlay_image: /assets/images/spazi-vettoriali-overlay.jpg
  teaser: /assets/images/spazi-vettoriali-teaser.jpg
  overlay_filter: 0.5
---

In un sistema fisico che coinvolge grandezze su scala quantistica, non importa quanto gentilmente venga effettuata una misurazione (durante un esperimento), essa inevitabilmente perturberà in qualche modo il sistema, lasciandolo in uno stato diverso da quello in cui era prima della misurazione. Questa è la prima grande differenza rispetto a un sistema classico.

Badate bene che questo non significa che la misura va necessariamente ad alterare la quantità che si sta misurando, cosa che renderebbe la misura stessa inutile e il sistema non osservabile, ma di sicuro _qualcosa_ viene alterato. Il suo stato interno, per la precisione, che impatterà molto probabilmente altre grandezze del sistema.

Vediamo bene cosa questo comporti nella pratica.

Esperimenti quantistici
-----------------------

Intanto diciamo che effettuare un esperimento quantistico significa misurare, con uno strumento opportuno, una particolare grandezza di un sistema su scala quantistica.

Abbiamo già detto che, quando si misura una grandezza quantistica, dobbiamo considerare l'apparato di misurazione come parte integrante del sistema, un qualcosa in grado di influenzarlo. Non ci interessa, per ora, come questo apparato sia fisicamente realizzato, quindi concettualizziamolo come una _black box_ dotata di una finestrella dalla quale è possibile leggere i risultati e di una sonda per misurare il valore della grandezza da osservare. Questo apparato, inoltre, ha un'orientazione nello spazio: un lato è chiaramente indicato come "Alto", come gli scatoloni dei mobili Ikea.

Riprendiamo l'esempio del sistema della moneta, che può assumere i due soli valori misurati "Testa" o "Croce" e supponiamo che sia una grandezza quantistica. Supponiamo di chiamarla __spin__ e indichiamola con la dicitura $$\sigma_z$$. Invece che "Testa" o "Croce", i risultati possibili per questa grandezza sono +1 e -1, corrispondenti rispettivamente agli stati _"up"_ e _"down"_.

In pratica, abbiamo la situazione seguente:

![Apparato di misurazione](/assets/images/apparato_spin_up.svg?style=centerme)

Notiamo che prima di aver eseguito la misurazione, la finestrella dell'apparato non mostra alcun valore misurato.

Supponiamo, ora, che lo spin sia stato preparato da qualcuno (o qualcosa) nello stato _up_. Non ci interessa sapere chi o cosa ha imposto questo stato al sistema, nella nostra concettualizzazione matematica. Ciò che importa è che lo spin sia nello stato _up_ senza alcuna possibilità di errore. Effettuiamo la misurazione: l'apparato restituirà il valore +1.

![Apparato di misurazione: up](/assets/images/apparato_spin_up_misura.svg?style=centerme)

Per essere sicuri, resettiamo l'apparato di misura e rieseguiamo le misure più volte, assicurandoci che tra una misura e l'altra non accada qualcosa nel sistema tale da alterare il valore di $$\sigma_z$$ (in fisica si dice che non accade _niente di interessante_ al sistema). Otterremo __sempre__ +1: il risultato dell'esperimento non varia.

E questa è già una prima, grande, scoperta: nei sistemi quantistici, i risultati degli esperimenti ripetuti sono confermati. La meccanica quantistica, insomma, è strana, ma non è _così_ strana.

Adesso, facciamo qualcosa di veramente inaspettato: ruotiamo di 180° l'apparato ed eseguiamo la misurazione. Il risultato che otteniamo è -1 e, come prima, tale misura è confermata rieseguendo gli esperimenti.

![Apparato di misurazione: up](/assets/images/apparato_spin_down.svg?style=centerme)

E questa è la seconda grande scoperta: c'è, nello stato delle grandezze quantistiche, un qualche tipo di concetto di __direzionalità__. E, quale strumento migliore abbiamo a disposizione per descrivere, in un modello, la direzionalità se non tramite i __vettori__?

Se, infatti, lo stato dello spin fosse rappresentato da un vettore con modulo unitario e che, nel caso specifico, punta verso l'alto (da cui, beh, _up_), non c'è nulla di imprevedibile nei risultati +1 e -1, in base a come è ruotato l'apparato. Newton è salvo.

Ma cosa succede se ruotiamo l'apparato di lato ed effettuiamo la misurazione? In base alla meccanica classica, dovremmo avere come risultato 0 (la componente sull'asse x del vettore _up_ è zero). E invece...

![Apparato di misurazione: x](/assets/images/apparato_spin_lato.svg?style=centerme)

Per quanto ci ostiniamo a misurare, il risultato sarà ancora una volta +1 oppure -1!

Non solo: è impossibile _prevedere_ se il risultato sarà +1 o -1. Entrambi i valori hanno uguale probabilità di presentarsi, ma una volta determinato, il valore misurato viene mantenuto nelle misurazioni successive. La proprietà di conferma delle misure non è andata perduta: l'aleatorietà si presenta solo alla _prima_ misurazione.

E se ruotiamo l'apparato di un angolo arbitrario? La meccanica classica ci dice che il risultato dovrebbe essere $$ \cos(\theta) $$, dove $$ \theta $$ è l'angolo formato dall'apparato con il vettore di spin, perché tale è la componente del vettore di spin lungo la direzione in cui è orientato l'apparato. Ma niente da fare...

![Apparato di misurazione: angolo arbitrario](/assets/images/apparato_spin_theta.svg?style=centerme)

Il risultato è ancora una volta +1 o -1, con la stessa irritante aleatorietà iniziale.

E tanto per complicare ancora di più le cose, se riportiamo l'apparato nella posizione iniziale e tentiamo di misurare $$ \sigma_z $$, il risultato è __ancora una volta__ +1 o -1, con uguale probabilità. Quindi, questo vuol dire che il sistema non si trova più nello stato _up_, perché se così fosse il risultato della misurazione non sarebbe aleatorio (e valere, nel nostro esempio, +1). In effetti, a voler essere precisi, la figura sopra è imprecisa: la "freccia" non è più rivolta verso l'alto.

Da questo esperimento possiamo trarre due importanti conclusioni:

* __Lo spin può assumere solo valori discreti__, ma solo per alcuni stati del sistema (es. _up_ o _down_), le misure sono determinabili in modo __non ambiguo__. In generale, riscontreremo sempre una certa aleatorietà nelle misurazioni, il che ci suggerisce che, in un sistema quantistico, _stati e misure non sono la stessa cosa_. In un sistema classico questo non avviene: se si conosce lo stato di un sistema, è possibile sempre misurare le sue grandezze in modo non ambiguo.
* __L'atto della misurazione ha perturbato il sistema.__ Nello specifico, la misura di $$ \sigma_x $$ ha distrutto qualunque informazione sulla misura di $$ \sigma_z $$ che avevamo raccolto in precedenza. Ne consegue che le due componenti spaziali dello spin non possono essere misurate contemporaneamente o, più in generale, di un sistema quantistico non è possibile conoscere _tutto_, a differenza di un sistema classico.

Questi due principi (quantizzazione e indeterminazione) rappresentano i pilastri della meccanica quantistica; adesso non ci resta che costruire un modello matematico per poterla applicare.

Prima, però, facciamo pace con la fisica classica.
