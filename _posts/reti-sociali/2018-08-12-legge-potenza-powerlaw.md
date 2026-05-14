---
title: "Approfondimento matematico: la power law"
excerpt: La legge di potenza, o _power law_ è uno dei costrutti matematici che ricoprono massima
  importanza in Social Network Analysis. In questo articolo ci doteremo di tutti gli
  strumenti teorici e metodologici per applicarla allo studio delle reti
category: "Reti Sociali"
header:
  overlay_filter: 0.5
  overlay_image: /assets/images/powerlaw-overlay.jpg
  teaser: /assets/images/powerlaw-teaser.jpg
editor_options:
  chunk_output_type: inline
---

Le legge di potenza altri non è che una funzione matematica con un andamento esponenziale caratterizzato da un parametro che può essere sia negativo che positivo e che nella sua forma più generale si esprime come

$$ f(x) = ax^k $$

e di per sé non ha niente di speciale.

Diventa, però, interessante quando descrive una _distribuzione di probabilità_, ovvero la probabilità del verificarsi degli eventi misurati sull'ascissa. In questo frangente, si può osservare che tantissimi fenomeni fisici, dalla dimensione delle città a quella dei crateri da impatto, dalla magnitudine dei terremoti all'attenuazione acustiva, seguono qusto andamento.

Ma prima di addentrarci nello studio della legge di potenza, facciamo alcuni esempi chiarificatori di come si presentano, spesso, le grandezze in natura.

## Distribuzioni normali e...meno normali

Il modo più "naturale" in cui ci aspettiamo di misurare una grandezza è una distribuzione _centrale_, dove la maggior parte delle osservazioni si concentrano attorno a un valore tipico, il _valore medio_, e decadono molto velocemente in modo simmetrico ai due estremi. Molte distribuzioni, sia presenti in natura che costruite dall'uomo, hanno queste caratteristiche, che possono essere descritte, con un livello più o meno accettabile di approssimazione, con tutta una famiglia di modelli statistici, come la [distribuzione gaussiana](https://it.wikipedia.org/wiki/Distribuzione_normale), la [distribuzione binomiale](https://it.wikipedia.org/wiki/Distribuzione_binomiale) e la [quella di Poisson](https://it.wikipedia.org/wiki/Distribuzione_di_Poisson) che, dati una serie di parametri, è in grado di _spiegare_ e _descrivere_ la popolazione.

Non è detto, però, che le osservazioni si distribuiscano in modo simmetrico attorno ad un valore tipico. Alcune grandezze, infatti, si esprimono in popolazioni in cui si ha la maggioranza delle osservazioni su valori _bassi_ delle ascisse, ma presentano anche diverse osservazioni molto a destra, in una lunga _coda_ , con osservazioni che possono raggiungere valori della ascissa molto grandi, anche di diversi ordini di granzezza più grandi della media. Quello più sotto ne è un tipico esempio.

![Questi grafici mostrano le varie parole contenute nel Moby Dick di Herman Melville. In ascissa sono rappresentate le frequenze con cui una parola occorre nel testo. In ordinata, invece, il numero di parole che occorrono con una specifica frequenza. Sebbene la maggior parte delle parole abbiamo un numero di occorrenze molto basso, ce ne sono alcune che incorrono molto più frequentemente nel testo, causando la lunga coda a destra che, in un ripido decadimento, caratterizza la distribuzione, Il plot di destra mostra gli stessi dati ma su una scala logaritmica su entrambi gli assi, in modo da evidenziare meglio l'andamento esponenziale di tale decadimento. Il linguista George Kingsley Zipf ha potuto verificare, negli anni Trenta del Novecento, che la maggior parte della produzione letteraria occidentale segue questa distribuzione.](/assets/figures/mobydick-1.svg)

Il grafico in scala _log-log_, mostra chiaramente un andamento assimilabile a quello di una retta per buona parte del suo dominio. Non lo è, apparentemente, nella parte più a destra, dove, però, vige più che altro un elevato errore di campionamento (come dicevamo, sono pochissime le parole ad avere un numero di occorrenze così elevato).

Passiamo ora dalle frequenze alle probabilità e quindi al differenziale. Se definiamo come \\( p(x)dx \\) la frazione di parole con un numero di occorrenze compreso tra \\( x \\) e \\( x + dx \\) e ci troviamo in un andamento più o meno rettilineo come quello appena evidenziato, allora la funzione, su scala logaritmica, può essere descritta come

$$ \ln p(x) = -\alpha \ln x + c $$

con \\( \alpha \\) e \\( c \\) costanti. Elevando su \\( e \\) otteniamo la cosiddetta __legge di potenza__ (o power law).

$$ p(x) = Cx^{-\alpha} \tag{\ast} $$

con \\( C = e^c \\).

Una volta definito \\( \alpha \\), che è il parametro caratterizzante e che in genere (e soprattutto in ambito SNA) è compreso tra 2 e 3, e comunque non è mai minore di 1,  abbiamo tutto ciò che ci serve per descrivere la distribuzione. Il coefficiente \\( C \\), infatti, non è per nulla interessante ai fini pratici, dato che è semplicemente il termine che garantisce che la somma dell'area sottesa dalla curva sia 1, come obbligatorio che sia trovandoci di fronte a una funzione di probabilità.

In natura sono migliaia le grandezze che seguono la legge di potenza nel loro andamento probabilistico e spaziano dall'astronomia, alla linguistica (come abbiamo visto) fino, naturalmente, alle scienze sociali. Tuttavia, molto raramente una grandezza segue una power law sull'_interezza_ delle misure che assume. Più spesso, essa segue questo andamento _a tratti_, mentre in altre regioni il suo andamento segue leggi diverse.

D'altra parte, per ciò che concerne in nostri scopi, poter affermare che una rete sociale segua, per alcuni suoi attributi (come, ad esempio, il grado) la legge di potenza, ci consente di poter desumere moltissimo sulla sua natura. Non è quindi una affermazione da fare alla leggera!

Per questo motivo, ora che sappiamo quali sono le sue caratteristiche, resta da capire come studiarla.

## Individuare una distribuzione _power law_
Innanzitutto una premessa, che facciamo riprendendo l'esempio di prima: dire che __la r-esima parola più ricorrente in Moby Dick viene usata n volte__ è esattamente la stessa cosa di dire che __esistono r parole che occorrono con una frequenza pari almenoa n__ (per capirci, _r_ sta per _rank_).

Intanto, questo ci consente di pensare alla legge di potenza come a una funzione di __distribuzione cumulativa di probabilità__, e questo è utile a prescindere.

Ma, tornando all'interpretazione; il modo più semplice per individuare una power law è, in prima istanza, con un istogramma. Lo abbiamo involontariamente già visto con l'esempio precedente, in cui abbiamo rappresentato la popolazione in questa forma,  usando punti invece che barre per non affollare il grafico e riportando sulle ascisse gli intervalli \\( k, k+n \\) di occorrenze nel testo e sulle ordinate il conteggio delle parole contenute in tali intervalli. In particolare, l'andamento (quasi) lineare del grafico su assi logaritmici ci ha fatto pensare a una power law.

L'istogramma è stato costruito affinché l'ampiezza delle "barre" (o, più propriamente, _bin_ o meglio ancora _intervalli_) fosse costante; il grafico che ne è risultato è decisamente ben definito nella parte sinistra, dove si concentrano la maggior parte delle osservazioni, ma molto confuso sulla _coda_ di destra, dove ogni intervallo dell'istogramma ha pochi elementi e perciò le piccole fluttuazioni nel numero di componenti nel gruppo causa un grande scostamento sul grafico su scala logaritmica. Il problema è serio: andando a costruire su quel campione un modello di regressione per stimare il modulo di \\( \alpha \\), il rumore statistico sulla coda interverrà negativamente su di esso, introducendo una forte sottostima nel coefficiente.

Un modo più accurato consiste allora nel _variare la dimensione degli intervalli dell'isogramma con uno schema costante e normalizzare i risultati_, in modo da ottenere un conteggio _per unità di grandezza di x_. Questa operazione si chiama _non-linear binning_.

La logica più comune di binning è quella su base logaritmica, creando una sequenza di intervalli di dimensione esponenzialmente crescente ad es. \\( 2^0=1, 2^1=2, 2^2=4, 2^3=8,...\\)
In questo modo, gli intervalli a destra otterranno un maggior numero di campioni, abbattendo il rumore statistico. Applichiamo questa trasformazione ai dati di Moby Dick:

![Il _logarithmic binning_ incrementale consente di ridurre il rumore sulla parte destra della distribuzione e, essendo una sequenza esponenziale, presenterà degli intervalli equispaziati sull'asse delle ascisse, espresso su scala logaritmica.](/assets/figures/mobydick.log-1.svg)

Il grafico di destra, su scala logaritmica, è ancora una volta quello più interessante. Grazie al logarithmic binning, infatti, abbiamo linearizzato efficacemente anche la parte destra della distribuzione e ora è possibile applicare una regressione per stimare \\( \alpha \\). Tuttavia, noterete come i punti caratterizzanti ora siano molti di meno.

In effetti, per eliminare il rumore si è reso necessario creare degli intervalli molto ampi e questo ha comportato una notevole perdita di informazioni. Per spiegare meglio il concetto: una volta aggregate le misurazioni all'interno di un bin, le abbiamo perse come entità distinte. E tanto più ampi sono gli intervalli, tante più sono le osservazioni che abbiamo aggregato insieme, e sulle quali non è più possibile affermare nulla singolarmente.

In particolare, è sufficiente che \\( \alpha > 1 \\), cosa che avviene _sempre_, per far sì che un intervallo abbia meno campioni dell'intervallo immediatamente alla sua sinistra.

Fortunatamente esiste un modo ancora migliore per rappresentare (e studiare) una power law e consiste nel rappresentarla mediante la __distribuzione di probabilità cumulativa__ (cumulative distribution function, o __CDF__).

Se indichiamo con \\( P(x) \\) la probabilità che \\( x \\) abbia un valore non più semplicemente uguale ma __maggiore o uguale__ a \\( x \\)

$$ P(x) = \int_x^\infty p(x^\prime)dx^\prime $$

Poiché la \\( p(x) \\) è una power law di tipo

$$ p(x) = Cx^{-\alpha} $$

possiamo scrivere

$$ P(x) = C\int_x^\infty x^{\prime-\alpha}dx^\prime = \boxed{ \frac{C}{\alpha - 1}x^{-(\alpha - 1 )}} \tag{CDF} $$

La CDF \\( P(x) \\) di una power law (nel box rosso) è a sua volta, come si può vedere, una power law ma con esponente \\( \alpha - 1 \\); questo significa che una volta rappresentata su scala log-log presenterà ancora un andamento rettilineo, ma con una pendenza diversa.
Soprattutto,  essa è stata ottenuta _senza_ un binning, quindi senza perdita di informazioni e senza aver dovuto formulare alcuna ipotesi sull'ampiezza degli intervalli (ovvero, fare una scelta empirica). Ancora una volta, usiamo il dataset di Moby Dick per visualizzare la CDF:

![plot of chunk mobydick.cdf](/assets/figures/mobydick.cdf-1.svg)

La CDF del campione è, come si può vedere, molto "pulita" e segue con notevole precisione l'andamento di una power law avente $$ \alpha = 1.93 $$ (retta in rosso).

## Determinare i parametri della power law

Per quanto molto comune in natura, sono poche le grandezze che presentano un andamento che segue la legge di potenza nell'interezza dei valori della loro CDF; più spesso, si riscontrano distribuzioni che assimilano la legge di potenza sulla parte _destra_ del loro dominio (come nell'esempio sopra), mentre la parte sinistra segue un andamento diverso.

Per questo motivo, è prassi abbastanza comune individuare il valore \\( x_{min} \\) al di sopra del quale la distribuzione, si verifica, segue in modo soddisfacente la legge di potenza, mentre per i valori al di sotto è opportuno individuare un modello che esprima con minore incertezza l'andamento della CDF, perché la _power law_ non modella adeguatamente la distribuzione; spesso, per questi valori bassi, migliori risultati si hanno con modelli di tipo esponenziale, log-normali o di Poisson. Nell'esempio di Moby Dick, per dire, ha senso applicare il modello _power law_ di cui sopra solo per $$ x_{min} \ge 26 $$

La stima di \\( x_{min} \\) può essere fatta in modo visivo, dal grafico della CDF, oppure analiticamente, in modo da avere una stima statisticamente robusta e che, soprattutto, non richieda l'intervento diretto dell'osservatore per l'interpretazione.

L'idea alla base è piuttosto semplice: scegliamo un valore \\( \hat{x} \\) tale che renda le distribuzioni di probabilità e la migliore _power law_ applicabile (con un dato \\( \alpha \\)) il più simile possibile per valori sopra \\( \hat{x} \\). Se il valore di \\( \hat x_{min} \\) è superiore del valore vero di \\( x_{min} \\), questo implica scartare un maggior numero di osservazioni (sotto \\( x_{min} \\)) e, quindi, ottenere, una distribuzione di probabilità più scadente, per via delle fluttuazioni statistiche. D'altra parte, se il valore di \\( \hat{x} \\) è inferiore al valore vero di \\( x_{min} \\), le distribuzioni di probabilità divergeranno per la sostanziale differenza tra i dati e il modello stesso. Il valore migliore di \\( x_{min} \\) giace all'interno di questo intervallo.

La migliore misura per quantificare la distanza tra due distribuzioni di probabilità, per dati che palesemente non seguono la distribuzione nornale, è la statistica KS (o Kolmogorof-Smirnov), ovvero la massima distanza tra le CDF dei dati e il modello:

$$ D = \max_{x \ge x_{min}} \left\lvert S(x) - P(x) \right\rvert $$

con \\( S(x) \\) che rappresenta la CDF delle osservazioni per valori che siano almeno \\( x_{min} \\) e \\( P(x) \\) la CDF del modello _power law_ che rappresenta la miglior stima possibile. La stima \\( \hat{x} \\) di \\( x_{min} \\) è quella che minimizza \\( D \\).

Una volta individuato un soddisfacente \\( x_{min} \\), è possibile stimare un adeguato \\( \alpha \\). Per farlo, l'approccio migliore è utilizzare il [metodo della massima verosmiglianza](https://it.wikipedia.org/wiki/Metodo_della_massima_verosimiglianza) (MLE), posto che vi sia un adeguato numero di osservazioni con \\( x \ge x_{min} \\). LA MLE per il caso continuo è la seguente (quella per il caso discreto è molto più complessa e non verrà trattata in questa sede):

$$ \hat{\alpha} = 1 + n\left[\sum_{i=1}^n \ln\frac{x_i}{x_{min}}\right] \tag{MLE} $$

Dove \\( \hat{\alpha} \\) è il valore stimato per \\( \alpha \\), normalmente non noto, individuato da una popolazione di \\( n \\) osservazioni \\( x_i \\) con \\( i = 1, 2, \dots, n \\), tutti tale che \\( x_i \ge x_{min} \\).

Naturalmente, la robustezza di tali stimatori va anche essa valutata con un opportuno test per l'ipotesi, ma per essa vi chiedo di attendere il secondo articolo sull'argomento che ho in lavorazione, che riporterà degli esempi pratici in R e che toccherà anche questi temi ulteriori.

## Esempi noti in letteratura

Dai ricercatori, sono stati spesso studiati e citati dei campioni che esprimono un andamento della CDF come legge di potenza. Vediamo i più famosi:

* __Frequenza delle parole nei testi__ - lo abbiamo visto con Moby Dick, ma il linguista [George Kingsley Zipf](https://en.wikipedia.org/wiki/George_Kingsley_Zipf) ha potuto verificare come questo accada in tutta la letteratura occidentale. La trattazione è riportata in [un suo elegante lavoro](https://www.amazon.it/Human-Behavior-Principle-Least-Effort/dp/161427312X) del 1949.

* __Citazioni nelle pubblicazioni scientifiche__ - dimostrata da Derek J. de Solla Price in un [articolo su Science](http://garfield.library.upenn.edu/papers/pricenetworks1965.pdf) nel lontano 1965.

## Un esempio tutto nostro: i comuni italiani

Per completare la trattazione, volevo brevemente studiare un campione che molto spesso, in letteratura, è stato assimilato ad una _power law_: la popolazione degli insediamenti umani in una data nazione.



Così, per essere originale, ho ben pensato di studiare il dataset dei communi italiani, messo a disposizione dall'ISTAT a valle dell'ultimo censimento nazionale. Si tratta di un dataset di 7978 comuni italiani con una popolazione compresa tra 30 e 2873494 abitanti.

Il valore del più piccolo comune d'Italia,  (30, si tratta del comune di Moncenisio, in provincia di Torino) mi ha fatto subito sospettare che la parte sinistra della distribuzione avesse un comportamento singolare (difficile pensare che ci siano più comuni di 30 abitanti rispetto agli altri).

Prima, però, di stimare un \\( x_{min} \\) per la CDF, mi sono chiesto se la distribuzione, una volta applicato il binning logaritmico, non potesse assumere una forma canonica. Così, dopo aver segmentato la popolazione in 100 intervalli ho ottenuto questo plot della densità e della percentuale di osservazioni.

![plot of chunk italian.towns.plots](/assets/figures/italian.towns.plots-1.svg)

Ebbene, questo grafico mi ha subito dato la sensazione di un andamento che segue una [distribuzione log-normale](https://it.wikipedia.org/wiki/Distribuzione_lognormale), con una leggera distonia sulla "coda" destra che può essere imputabile a un andamento secondo la legge di potenza.

Il prossimo passo è stato, perciò, quello di individuare, attraverso il metodo di massima verosimiglianza spiegato sopra, due modelli, uno di tipo _power law_ e uno di tipo log-normale. L'ho fatto, naturalmente, sulla CDF e ho ottenuto il seguente:

![plot of chunk italian.towns.cdf](/assets/figures/italian.towns.cdf-1.svg)

Ebbene, come previsto il modello log-normale (in verde) riesce a descrivere il campione per gran parte del suo codominio (ha \\( x_{min_1} = 430\\), fino a \\( x_{min_2} = 99469\\), al di sopra del quale è la legge di potenza (in rosso) caratterizzata dal parametro \\( \alpha = 2.41 \\) a descrivere meglio la curva di distribuzione della CDF.

Poiché, per ciò che avevamo ipotizzato sui dati, lo studio della funzione non è interessante per valori inferiori di \\( x_{min_1} \\), il _fitting_ si può arrestare qui. Ciò che bisognerebbe fare per terminare il lavoro è, come dicevamo, un opportuno test per verificare la robustezza degli stimatori, ma oggettivamente, nel caso specifico l'ispezione visiva dei grafici fornisce già, con discreto margine di sicurezza, le garanzie necessarie.

## Per approfondire

* M. E. J. Newman, [Power laws, Pareto distributions and Zipf’s law](https://arxiv.org/pdf/cond-mat/0412004.pdf), 2006;
* Aaron Clauset, Cosma Rohilla Shalizi, M. E. J. Newman, [Power Laws Distributions in Empirical Data](https://arxiv.org/pdf/0706.1062.pdf), 2009
