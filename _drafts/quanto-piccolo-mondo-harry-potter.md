---
title: "Quanto grande è il mondo di Harry Potter?"
excerpt: "E' possibile applicare la Social Network Analysis alle opere di fantasia? In questo esercizio di analisi che coinvolge il famoso mago dalla cicatrice a saetta cerchiamo di dare una risposta alla domanda: qualcosa di interessante ne verrà sicuramente fuori."
header:
  overlay_image: /assets/images/harry-potter-philosophers-overlay.png
  overlay_filter: 0.5 # same as adding an opacity of 0.5 to a black background
graph_kcores: "graphs/harrypotter-kcores.html"
graph_houses: "graphs/harrypotter-houses.html"
---

Venti anni fa, nel 1998, usciva in Italia _"Harry Potter e la Pietra Filosofale"_, il primo della serie di romanzi partoriti dalla penna di [J. K. Rowling](https://www.jkrowling.com/) che sarà destinata a cambiare per sempre sia la narrativa _young adults_ che il genere fantasy tout cour. Ammetto di aver scoperto relativamente tardi i volumi; e questo, credo, mi ha permesso di apprezzarli maggiormente e cogliere delle interessanti sfumature.

Affascinato dal mondo incredibilmente immersivo creato dalla Rowling, dalle vicende e dalle relazioni tra i personaggi, mi sono subito chiesto se i personaggi individuassero reti credibili, dal punto di vista sociale, e le loro caratteristiche.

Ebbene, molte tecniche di Social Network Analysis possono essere applicate anche allo opere di letteratura, purché adeguatamente "premasticate"; i risultati sono, come vedremo subito, stimolanti e, talvolta, inaspettati.

Il testo  utilizzato per l'analisi è la versione ePub in lingua inglese, acquistata dal [sito ufficiale](https://www.pottermore.com/).

## Una prima occhiata a "La pietra Filosofale"

Il primo volume della serie ha più che altro lo scopo di introdurre i personaggi e delinearne i ruoli (l'eroe, il supporto, l'antagonista, [eccetera](https://it.wikipedia.org/wiki/Narratologia)); introduce i personaggi che gravitano attorno alla Scuola di Magia e di Stregoneria di Hogwarts, ma non ne approfondisce le relazioni. Questo non è un problema: ciò che ci interessa, in effetti, non è l'importanza narrativa degli attori, ma le loro _conversazioni_; solo se i personaggi sono stati coinvolti almeno in una conversazione, infatti, questi potranno dire di avere una reciproca relazione sociale.

{% cloudinary /assets/images/harry-potter-philosophers-timeline.png alt="Timeline delle conversazioni dei 15 personaggi principali in Harry Potter e la Pietra Filosofale" caption="Top 15 Personaggi e loro linee di dialogo, in ordine decrescente. Harry è molto presente sin da subito e rivaleggia con Hermione, che arriverà più tardi con la sua proverbiale logorrea." %}

Dalla lettura delle sequenze dei dialoghi, vediamo immediatamente che il libro si concentra attorno alle vicende del protagonista, Harry; egli è, infatti, presente in quasi tutte le conversazioni. La rete, c'è da aspettarsi, avrà spiccate caratteristiche di una ego-network, forse sarà addirittura una rete (quasi) a stella. Non c'è da stupirsi: tutta la storia si svolge attorno a Harry e tutte le reti sociali espresse hanno nel giovane mago se non il destinatario naturale, almeno uno spettatore privilegiato.

La mia ipotesi di lavoro è stata quella di considerare tutti i personaggi individuati in una conversazione come facenti parte di una _clique_, ovvero un sottogruppo di individui completamente connesso, senza distinguere tra chi parla e chi ascolta. Questo implica che la rete che verrà individuata sarà non direzionata.

Ho, inoltre, considerato solo gli individui fisicamente presenti nelle "scene", perché su di essi si basano le relazioni interpersonali tra i personaggi. Personaggi citati, anche più volte, ma mai presenti fisicamente non sono quindi rappresentati. L'esempio più evidente sono i genitori di Harry.

Ho, infine, considerato una rete _statica_, riservandomi in futuro il divertimento di studiare la dinamica di crescita della rete (magari su tutti e sette i libri della serie).

## La rete

Ma bando alle ciance e vediamo, nel concreto, la rete nella sua rappresentazione migliore:

{% include {{ page.graph_houses }} %}

Chiaramente Harry è al centro della rete e forma una _clique_ molto stretta con, come prevedibile, Ron ed Hermione - gli altri due principali protagonisti del romanzo. Anche Hagrid, l'adulto più vicino a Harry all'inizio della saga, gode di una posizione che sembra essere molto privilegiata. Al contrario, personaggi molto importanti nella trama, come Albus Silente, non sono coinvolti in molte conversazioni con Harry e, quindi, assumono una posizione più defilata.

I colori dei nodi individuano i gruppi di affiliazione, ma anche community dai confini ben definiti - segno che la rete è particolarmente clusterizzabile, nonostante l'elevata densità di collegamenti.

Ma possiamo dire qualcosa di più sui ruoli, adesso?

{% cloudinary /assets/images/albus-dumbledore.jpg alt="Albus Silente nel primo film della saga" caption="Albus Silente, Dumbledore nel testo originale, è molto importante nella storia, ma non è poi così influente, stando alla sua posizione nella rete." %}

## Ron Weasley, l'eterno secondo...

Sia come sia, quello che salta immediatamente all'occhio nella rete è la sua grande __coesione__: un solo componente, tutti i personaggi raggiungibili a distanza uno o due - sempre attraverso Harry - e un elevata densità di _clique_. Ma quali sono i sottogruppi realmente influenti e chi è il vero comprimario di Harry nel romanzo?

Innanzitutto va detto che per quanto Harry sia il fulcro della rete, egli non è un punto di articolazione, ovvero non è un nodo la cui rimozione, da solo, va a provocare la rottura della rete in due (o più) sottoreti.
Se trascuriamo Madam Hooch e la Prof.ssa McGonagall (che lo sono, ma a favore di personaggi che sono all'estrema periferia della rete), per disgregare la rete, oltre a Harry è necessario rimuovere almeno uno tra Ron ed Hagrid; ben sei componenti, se a essere rimosso è Hagrid.

In una rete tanto fitta, sembra difficile individuare dei cluster definiti e dei personaggi ben rappresentativi per ognuno. Verrebbe da dire che la ego-rete con Harry al centro, che non ci dimentichiamo è pur sempre il _ragazzo-che-è-sopravvissuto_, dia poco spazio a comprimari e a una eventuale figura di coesione. Figura che, per la verità, la trama vorrebbe in Ron Weasley, il miglior amico del protagonista, nonché suo eterno e talvolta frustrato secondo.

Ma è davvero così?

Data la natura puramente speculativa dell'esplorazione e la natura artificiosamente bilanciata della rete, per dare una risposta a questa domanda mi limiterò a studiare i __k-core__, la cui definizione li descrive come i _sottogruppi massimali aventi almeno k connessioni con altri elementi del medesimo gruppo_. Questo, intanto, ci consente di stimare quantitativamente il grado di coesione _locale_ della rete. Vediamola graficamente e anche in forma tabellare, più sotto.

{% include {{ page.graph_kcores }} %}

|k   | Individui|
|:---|---------:|
|1   |         3|
|2   |         5|
|3   |         1|
|4   |         7|
|5   |         4|
|7   |         2|
|8   |        15|

Harry, Ron, Hermione e altri personaggi, quasi tutti della casa di Grifondoro, appartengono al grosso nucleo con _k=8_, il più imponente della rete. Un _core_ così massiccio è raro, nelle reti reali, ma non così esotico nella fiction di genere (in cui le relazioni sono semplificate e "velocizzate" per essere più vicine al protagonista di quanto non lo sarebbero mai in realtà).
Ma qui è il ruolo di __Hagrid__ che mi interessa: egli è, infatti, nel core _k=8_, ma non è nello stesso gruppo (Grifondoro) degli altri componenti del nucleo. E' un importante punto di articolazione della rete, come abbiamo già visto, e di primo acchitto sembra anche assumere una posizione piuttosto importante. Vale la pena di studiarne la centralità (Top 5 personaggi):

|name              | degree.std| betweeness.proximal| closeness.std|
|:-----------------|----------:|-------------------:|-------------:|
|Harry Potter      |         34|          260.658333|     0.9473684|
|Rubeus Hagrid     |         25|           91.130952|     0.7500000|
|Ron Weasley       |         22|           43.625000|     0.7058824|
|Hermione Granger  |         19|           35.783333|     0.6666667|
|Draco Malfoy      |         13|           12.826190|     0.6000000|
|Quirinus Quirrell |         12|            9.741667|     0.5901639|

Tralasciando gli ultimi due personaggi (due antagonisti) e Harry, che naturalmente ha un ruolo di assoluto primato, notiamo che le misure di centralità danno un quadro un po' diverso da quello che il romanzo ci descrive. Hagrid, in effetti, "vince" su Ron di stretta misura su almeno due misurazioni - che sono quelle più influenzate dal ruolo, predominante, dell'ingombrante vicino "egoico" Harry - ma risulta di gran lunga privilegiato nella __Proximal Betweeness Centrality__, misura di centralità che favorisce il ruolo dei nodi di intermediazione diretta nelle relazioni prossime.

E' Hagrid, in definitiva, la vera "spalla" di Harry - in termini di relazioni sociali - ed è sempre lui il personaggio la cui dipartita provocherebbe il più elevato contraccolpo sociale: ha un ruolo fortemente centrale, abilita l'accesso a diverse risorse periferiche della rete, fa parte del nucleo di massima coesione k=8, ma non fa parte di Grifondoro e pertanto è, da essi, meno propenso a esserne influenzato.

Niente male per un guardacaccia, no?

{% cloudinary /assets/images/ron-weasley.jpg alt="Ron Weasley, come compare nel primo film" caption="Povero Ron...nella trama del romanzo è l'eterno secondo. Mentre nella topologia della rete è addirittura terzo!" %}

Se siete interessati a come ho costruito la rete a partire da un ebook, vi invito a dare una occhiata al [codice sorgente](https://github.com/theclue/tableau-showcase/tree/master/data-raw/harry.potter.sna), ampiamente commentato, disponibile su Github. Codice che sarà, io spero, comunque oggetto di un futuro articolo.
