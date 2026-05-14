---
title: "Una rete sociale fatta di comunità"
excerpt: "L'esperimento dei sei gradi di separazione ci conferma che il mondo è sorprendentemente _piccolo_ e _ben connesso_. Recentemente, però, si è scoperto che le reti sociali umane presentano una caratteristica ancora più affascinate, fondamentale per la loro stessa sopravvivenza: l'innata propensione ad organizzarsi in community."
category: "Reti Sociali"
header:
  overlay_image: /assets/images/community-network-overlay.jpg
  teaser: /assets/images/community-network-teaser.jpg
  overlay_filter: 0.5
---

Nel corso di tutto il XX Secolo, i sociologi e gli studiosi di topologia e di reti ci hanno deliziato con modelli non solo sempre più credibili e realistici per descrivere una rete sociale, ma anche con sorprendenti similitudini e simmetrie con tante reti spontaneamente presenti in natura, in una sorta di elegante rappresentazione unificata della realtà.

Il caso più noto è certamente quello della [Teoria del mondo piccolo](https://it.wikipedia.org/wiki/Teoria_del_mondo_piccolo), quella dei sei gradi di separazione per intenderci, e della [Rete Small-World](https://en.wikipedia.org/wiki/Small-world_network) da essa descritta. Accompagnato da un [esperimento non proprio rigoroso](https://it.wikipedia.org/wiki/Sei_gradi_di_separazione), ma goloso dal punto di vista mediatico, qualche pellicola cinematografica e, in tempi più recenti, un po' di intrigo complottistico in salsa social, il modello è anche uno dei primi che si studia in Social Network Analysis. Ebbene, sotto opportune condizioni lo _Small-World_ si ritrova in tante reti, naturali e non, come quelle descritte dai neuroni del cervello, le reti di diffusione dell'energia elettrica, i commutatori telefoni, ecc., e questo ha contribuito non poco alla sua attrattiva per i non addetti ai lavori.

Sfortunatamente per gli hippie e per i fisici, però, il XXI Secolo si è aperto con una serie di studi che ci hanno mostrato una realtà un po' più complessa, che rompe, almeno per ora, la simmetria con neuroni, telefoni e relé e, forse, fa perdere un po' di fascino al tutto. Le reti sociali umane sono sì delle reti _Small-World_, ma hanno anche alcune caratteristiche uniche.

Ma prima di parlare di questo modello più evoluto, vediamo innanzitutto brevemente come si è chiuso il XX Secolo in casa dei sociologi.

{% figure caption:"Stanley Milgram, lo psicologo statunitense che, nell'ambito dell'arcinoto esperimento, nel 1967 spedì lettere in giro per tutti gli Stati Uniti e dimostrò che viviamo in un mondo piccolo. Non tutti sanno, però, che prima di lui l'esistenza dello _Small-World effect_ era stata speculata dallo scrittore ungherese [Frigyers Karinthy](http://www.eastjournal.net/archives/74471) mentre [Ithiel de Sola Pool](https://en.wikipedia.org/wiki/Ithiel_de_Sola_Pool) e Manfred Kochen colmarono, nel 1978 e con un rigoroso  modello matematico, le lacune dell'illustre, e discusso, predecessore (foto: [Psychology Unlocked](http://www.psychologyunlocked.com/stanley-milgram/))." %}
![Stanley Milgram](/assets/images/stanley-milgram.jpg)
{% endfigure %}

## Cosa si sapeva già: le tre caratteristiche di una rete sociale

Per lungo tempo, tre sono state, in linea di principio, le caratteristiche che sembravano mettere d'accordo tutte (o quasi) le reti sociali sui quali si avevano dati attendibili. Queste caratteristiche riscontrate nelle reti hanno consentito di costruire modelli via via più complessi e realistici e che descrivono in maniera sempre più accurata la complessità delle relazioni umane.

### Viviamo in un mondo piccolo

Questa caratteristica, dimostrata empiricamente con l'esperimento di Milgram, suggerisce che _la distanza media tra due nodi qualunque della rete è relativamente piccola._ Tradotto, questo significa che, scelti due nodi della rete, essi sono connessi attraverso un numero di nodi intermedi _molto piccolo_ se confrontato con la dimensione della rete stessa.

Più precisamente, il __diametro__ della rete è, sì, proporzionale al numero di nodi, ma cresce su scala solo logaritmica rispetto al numero di nodi \\( n \\). Questo comporta che al crescere del numero di nodi di una rete, il diametro cresce, ma più lentamente.

Qui è racchiusa l'essenza dei  _sei gradi di separazione_. E' una caratteristica che non è di esclusivo appannaggio delle reti sociali, ma è stata riscontrata anche in reti di informazioni, reti tecnologiche e persino reti biologiche. Oltre ai succitati sei gradi dell'esperimento di Milgram (scesi, sembrerebbe, a 4.7 dall'avvento di Facebook), diametri contenuti il propozione alle dimensioni della rete si hanno nel World Wide Web (stimato in circa 19), nelle connesisoni neuronali e in molte altre circostanze.

### Gli amici dei miei amici sono miei amici

Così come il DNA è costruito da una sequenza di quattro basi elementari (adenina, guanina,...) così anche le reti sociali hanno le loro "basi". Queste basi sono le differenti combinazioni di collegamenti possibili tra __tre__ nodi della rete, scelti casualmente.

Il motivo per cui l'elemento più atomico di organizzazione delle comunità sociali sia il triangolo è ancora oggetto di studi e non vi ci addentreremo in questa sete. Fatto sta, che, come una catena di DNA è descritta da una lunga sequenza di basi, una rete sociale può essere descritta da una lunga _sequenza di triangoli_. Questi triangoli prendono il nome di _triadi_ o, più spesso, di __clique__ (in italiano orribilmente traducibile con 'cricca'). E queste _clique_ non sono, tipicamente, oggetti statici; le relazioni evolvono nel tempo e la struttura della rete con esso. Con essa, quindi, cambiano le clique.

{% figure caption:"Una serie di clique, o triadi. In effetti, diverse possono essere le configurazioni con cui si presenta una triade aperta o chiusa. Tra questi esempi, l'unica caratterizzata da una certa instabilità è quella di sinistra che non a caso prende il nome di _triade proibita (forbidden triad)_: la probabilità che evolva, presto o tardi, in una delle due configurazioni più a destra è molto alta." %}
![Triadi in equilibrio e proibite](/assets/images/triadi.svg)
{% endfigure %}

Il motivo per cui avviene questa "risoluzione" della clique ha cause fisiche: minimizzazione dell'energia. Troppo dispendiosa di energie, infatti, è la situazione del nodo _A_, costretto a mantenere due canali segregati con _C_ e _B_ in una situazione di perenne stress sociale. Molto più facile risolverla facendo sì che i due nodi non connessi tra di loro entrino in contatto oppure interrompendo la relazione con uno dei due vicini (_C_, in questo caso).

La "forza" che eventualmente spinge verso la prima delle due evoluzioni appena descritte è la  __transitività__ ed è una caratteristica osservabile in molte reti sociali e anche in alcune reti di informazioni (come gli scambi di email in un'azienda). Detto anche __clustering__, perché spinge la rete a organizzarsi in _grappoli_ strettamente connessi, è modellizabile con degli opportuni coefficienti che, in linea di principio, hanno lo scopo di misurare la _densità e la tipologia di clique_ in una rete.

### Follow the leader

Pensare alle reti come oggetti statici è un errore: le reti sociali si aggiornano di continuo introducendo nuovi nodi e nuovi collegamenti vengono a crearsi, mentre altri vengono recisi; solo che, talvolta, l'evoluzione è lenta e le variazioni impercettibili al punto che la rete stessa ci sembra un oggetto statico e immutabile.

Ebbene, quando una rete sociale è in espansione, si può osservare che i nuovi nodi entranti tenderanno a estrudere collegamenti verso i nodi della rete che ne presentano già molti altri, come se la popolarità di un nodo _attirasse_ a sé i nuovi arrivati. Questo comportamento, chiamato __attaccamento preferenziale__ crea delle strutture di rete in cui pochi nodi molto influenti, gli __hub__, o se vogliamo i _leader_, detengono un numero di collegamenti attivi molto superiore alla media degli altri nodi della rete. Le reti sociali presentano questa caratteristica, ma non tutte e comunque non tutte le reti (per es. il fenomeno è molto più raro nelle reti di informazione, come Internet).

Capire se ci troviamo di fronte a una rete di questo tipo, che per inciso prende il nome di __scale-free__,  non è difficile: basta studiare la distribuzione del grado di tutti i nodi della rete. In una rete non _scale-free_ non abbiamo motivo di sospettare la presenza di _hub_ privilegiati perché la probabilità di un nodo di avere \\( k \\) connessioni è identica per tutti i nodi della rete e vale \\( p(k) \\). E, in effetti, la degree centrality di distribuisce secondo una distribuzione simmetrica (la binomiale, nella fattispecie) attorno alla degree centrality media \\( k_{avg} \\).

Una rete _scale-free_ munita, come detto, di _hubs_ presenterà, invece, una distribuzione con una coda molto lunga sulla destra, dove ci sono nodi con una degree centrality di molto superiore alla media. Più precisamente, la degree centrality segue la [legge di potenza]({% post_url reti-sociali/2018-08-12-legge-potenza-powerlaw %}), o __power law__.

{% figure caption:"La distribuzione del numero dei collegamenti dei nodi per una rete non _scale-free_ (a sinistra) con una _scale-free_ (a destra). Sull'asse delle ascisse il numero di connessioni \\( k \\) di un nodo, sulle ordinate la percentuale di nodi tra tutti quelli della rete ad avere esattamente \\( k \\) connessioni. In una rete non _scale-free_ si ha il tipico andamento a campana di una binomiale (o di una Poisson o anche di una normale, a seconda delle approssimazioni applicate al modello) con la maggior parte dei nodi avente un numero di nodi vicino alla media e scarsa probabilità di avere degli _hub_ o dei nodi fortemente disconessi. Una rete _scale-free_, invece, ha l'andamento tipico di una power law, con la maggior parte dei nodi ad avere poche connessioni e pochi nodi ad avere un numero di connessioni \\( k \\) molto maggiori della media \\( k_{avg} \\)." %}
![Bell-shape & Power Law](/assets/images/powerlaw.gif)
{% endfigure %}

Solo una puntualizzazione sul nome: queste reti si chiamano __scale-free__ perché la pendenza della retta caratteristica del modello di regressione costruito sulla distribuzione della centralità è _invariante alla scala_,  cioè non varia al variare del numero dei nodi. Solo, tuttavia, questa grandezza presenta questa caratteristica, mentre tipicamente le altre grandezze caratteristiche (strutturali, come la centralitò, o attributi legati ai nodi) sono genericamente _non invarianti_.


## L'importanza delle community locali

Innanzitutto una precisazione: non è che solo nel XXI secolo i ricercatori si siano accorti che gli esseri umani tendono a individuare delle community più o meno con le altre regioni della rete. Questa è una scoperta ben più antica, con cui sociologi, antropologi e, in tempi ancor più remoti, persino filosofi si sono confrontati. Quello che, però, mancava era un'adeguata rappresentazione mediante un modello che potesse essere utilizzato in Social Network Analysis.

Un primo modello che descrive la creazione di community in una rete è stato un modello puramente _gerarchico_, che pensa alle community un po' come alle organizzazioni militari, cioè in raggruppamenti aggregati che crescono progressivamente di dimensione (es. plotoni che formano compagnie che a loro volta formano battaglioni, reggimenti, ecc.). Presto, però, si è scoperto che questo modello era troppo schematico per rappresentare correttamente la realtà delle relazioni tra gli individui.

Il buon senso ci suggerisce che le community locali si creano attorno agli individui che hanno qualcosa in comune, per es. l'età, la razza, la religione, la passione per i film di fantascienza. L'__affinità__ tra questi individui è alta e, quindi, è più alta la probabilità che tra di loro si instauri un legame.

In gergo, questo comportamento è chiamato __mixing__ e una rete che favorisce la coesione tra nodi affini è una rete soggetta ad _assortative mixing_ (o anche __omofilia__). Al contrario, una rete che favorisce le relazioni tra individui _non affini_ viene detta una rete soggetta a _disassortative mixing_.

{% figure caption:"Una stessa rete può essere sia assortativa che disassortativa, in base all'attributo scelto per esprimere la relazione. Una rete di adolescenti, ad esempio, è probabile che sia assortativa attorno a un attributo come l'età, ma sarà quasi certamente disassortativa su un attributo come il sesso se i legami esprimono relazioni sentimentali (la probabilità di un legame tra due nodi è più alta se essi non sono dello stesso sesso)." %}
![Il tempo delle mele](/assets/images/la-boum.jpg)
{% endfigure %}

Esiste, però, una particolare relazione di (dis)assortatività e cioè quella legata al numero di connessioni dei nodi (la _degree centrality_ o _grado_) che possiamo riassumere in una semplice domanda: i nodi con un elevato numero connessioni tenderanno a collegarsi ad altri nodi con molte connessioni o preferiranno nodi con un basso numero di connessioni?

{% figure caption:"Reti assortative e disassortative in riferimento al numero di connessioni (grado). In una rete assortativa (a sinistra) abbiamo una elevata densità di nodi con tante connessioni al centro, in un grande componente molto connesso, e una periferia di nodi con poche connessioni. In una rete disassortativa (a destra) invece avremo una distribuzione più uniforme tra centro e periferia e nodi con basso numero di connessioni adiacenti a nodi più popolari." %}
![Assortative & Disassortative Network](/assets/images/assortative-disassortative.png)
{% endfigure %}

Ebbene, molte reti sociali e per la verità _tutte_ quelle che sembrano organizzarsi in community, a prescindere dalle loro dimensioni, sono assortative sul grado. Tipici esempi sono la rete individuata dalle collaborazioni scientifiche (tenendo conto che nella maggior parte dei casi i _paper_ scientifici sono scritti a più mani da diversi studiosi e ricercatori) e la rete dei membri dei consigli di amministrazione delle aziende.

Al contrario, reti tipicamente disassortative sul numero di gradi sono quelle biologiche, come le reti individuate tra le proteine di una cellula.

La risposta alla domanda, comunque, è affermativa: i nodi con alta degree tenderanno a connettersi ai vicini più prossimi con alta degree, di fatto contribuendo al loro prestigio (e facilitandone le comunicazioni). Sembra poco, ma è la definizione di comunità per come la percepiscono gli esseri umani: comportamento _assortativo_ verso i membri della propria community, e quindi tante connessioni e _cluster_ molto stretti di individui con un fitto reticolo di connessioni che li tengono insieme, e comportamento _disassortativo_ verso i membri delle altre community, raggiunti da sporadici connessioni che fungono da "ponte" tra le diverse community costituenti la rete.

Non solo: se la rete è abbastanza fitta (e si può determinare anche numericamente quanto), questo fenomeno causa l'emergere di una community in genere di gran lunga più grande delle altre e di cui fanno parte la maggior parte dei nodi della rete: il cosiddetto __giant component__. Lo studieremo nel dettaglio in futuro.

Oltre a fornirci il modello matematico con cui analizzare una _rete fatta di comunità_ questa scoperta è fenomenale: ci fa capire come siano gli sporadici legami tra community diverse a essere essenziali per veicolare un messaggio, diffondere una notizia, capire in quanto tempo si diffonderà un virus ecc. nella totalità della rete. I (molti) legami presenti tra gli individui di una stessa community contribuiranno certamente alla _velocità_ con cui il messaggio si distribuisce all'interno della community stessa, ma sono inutili affinché il segnale travalichi i confini della community locale per "infettare" la rete nella sua interezza.

E' quello che si intende _forza dei legami deboli_, e merita che se ne parli in un articolo dedicato.
