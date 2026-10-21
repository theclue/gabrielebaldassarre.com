---
category: Home Assistant
title: "Batterie non molto smart: stimare la carica residua e riconoscere i cicli di ricarica"
excerpt: "I dispositivi alimentati con normali batterie con connessione bipolare non forniscono, in genere, ad Home Assistant un sensore con la percentuale di carica residua. Con un po' di algebra e un modo piuttosto creativo di usare gli Helper possiamo costruire un modello approssimato per stimare l'autonomia residua e i cicli di ricarica che funzioni anche quando l'utente si dimentica di segnalare al sistema che ha appena sostituito le batterie."
master: /assets/images/posts/batterie-home-assistant-ricarica-stimata.jpg
image_meta:
  role: illustration
  context: ambient
  caption: "Pile cilindriche usate viste dall'alto. Photo by Roberto Sorin on Unsplash"
image_credit:
  author: "Roberto Sorin"
  author_url: "https://unsplash.com/@roberto_sorin?utm_source=mcp_server&utm_medium=referral"
  source: "Unsplash"
  source_url: "https://unsplash.com/?utm_source=mcp_server&utm_medium=referral"
header:
  overlay_filter: 0.5
broadcast:
  channels: [linkedin,mastodon]
  sent: false
  linkedin:
    text: |-
      𝙐𝙣𝙖 𝙗𝙖𝙩𝙩𝙚𝙧𝙞𝙖 𝙘𝙝𝙚 𝙩𝙞 𝙙𝙞𝙘𝙚 𝙨𝙤𝙡𝙤 «𝙉𝙤𝙧𝙢𝙖𝙡» 𝙤 «𝙇𝙤𝙬» 𝙦𝙪𝙖𝙣𝙩𝙤 𝙩𝙞 𝙨𝙩𝙖 𝙙𝙞𝙘𝙚𝙣𝙙𝙤 𝙙𝙖𝙫𝙫𝙚𝙧𝙤?

      I dispositivi smart alimentati con batterie con connettore bipolare non sono in grado, in genere, di dichiarare il proprio stato ad Home Assistant con accuratezza, ma al massimo indicazioni generiche tipo "Low" e "Normal" in base alla tensione in uscita.

      Questo rende i dashboard di monitoraggio delle batterie non molto soddisfacenti e poco utili, per stimare il tempo residuo di carica.

      Per questo motivo, con un po' di algebra e un uso piuttosto creativo degli helper di #homeassistant ho costruito un modello di stima che tiene conto dei cicli di ricarica, delle capacità delle celle e il consumo presunto. Il risultato è un indicatore percentuale molto più simile a quelli ottenibili dai dispositivi dotati di batterie con il pin per la telemetria. 

      La ricarica la dichiaro nel più classico dei modi con un pulsante (che noia), ma se mi dimentico di farlo, l'automazione prova a riconoscerla da sola in base ai dati storici e al comportamento osservato in passato.
    hashtags: ["#domotica", "#HomeAssistant"]
  mastodon:
    text: |-
      Ho provato a stimare in Home Assistant quanto durano le batterie delle mie termovalvole Tado, che espongono, in modo decisamente poco smart, solo un sensore con indicazioni generiche tipo "Normal" o "Low". Ne è uscito un modello di simulazione dei cicli di ricarica che usa i dati storici e il comportamento per stimare l'autonomia residua della ricarica.
    hashtags: ["#HomeAssistant", "#domotica", "#Tado"]
intended_audience: practitioner
proficiency_level: intermediate
tags:
  - home-assistant
  - batterie
  - tado
  - template
  - automazioni
  - dashboard
difficulty_declared:
  conceptual: 2
  technical: 4
  mathematical: 1
---

Le mie tre termovalvole Tado, in Bagno, Cameretta e Soggiorno, segnalano già quando le batterie sono quasi scariche. Per quell'avviso bastano due stati: `Normal` e `Low`. Nella dashboard, però, volevo affiancare a questo dato un'indicazione di come stesse avanzando il ciclo delle batterie, senza aspettare ogni volta il passaggio a `Low`.

Il sensore non fornisce una percentuale nascosta da estrarre con il template giusto. Ho quindi affiancato ai sensori nativi una stima temporale dell'autonomia: parto da una durata configurabile e tengo traccia dell'ultima ricarica. Il numero che ne ricavo serve a orientare la manutenzione, non a misurare la carica delle celle.

Per far partire il ciclo ho previsto due strade. Posso confermare la ricarica con un pulsante nella vista di manutenzione; se non lo faccio, l'automazione cerca una sequenza di stati compatibile con esaurimento e successiva ricarica. La prima è una dichiarazione esplicita, la seconda rimane un'ipotesi. Le due informazioni finiscono nella stessa memoria, ma restano distinguibili.

Ho mantenuto gli ID degli indicatori già usati dalla dashboard e raccolto il calcolo in un'unica automazione. Tutto resta nel suo editor YAML: la variabile d'azione `updates` contiene il template e la macro locale che useremo per le tre stanze. Non occorrono file Jinja esterni o modifiche a `configuration.yaml`. L'automazione scrive soltanto gli helper: riscaldamento e protezioni delle finestre continuano a funzionare come prima. I blocchi della dashboard, invece, si aggiungono alla vostra vista senza sostituirla per intero.

<!-- TODO: prima della pubblicazione verificare il montaggio completo degli esempi su un'istanza di prova Home Assistant e aggiungere schermate prive di identificativi personali. -->

## Che cosa significa quel numero

Prima di conoscere la data di una ricarica, non ho ancora un punto da cui far partire la stima. Mantengo quindi soltanto una traduzione convenzionale dello stato nativo:

| Informazione disponibile, prima di conoscere una ricarica | Indicatore |
|---|---:|
| Batteria `Normal`, dispositivo online e canale sano | 100 |
| Batteria `Low`, dispositivo online e canale sano | 10 |
| Stato sconosciuto, indisponibile o incoerente | Indisponibile |

Ho usato 100 per `Normal` e 10 per `Low`. **Non sono percentuali misurate**: permettono di rappresentare l'avviso qualitativo negli indicatori esistenti, senza inventare una data iniziale. Il valore 10 ha anche una ragione pratica: è sotto la soglia strettamente inferiore a 15 usata dalla notifica. Scegliere 15 non avrebbe fatto scattare quell'avviso.

Dopo una ricarica registrata possiamo fare qualcosa in più. Indichiamo con $t_r$ il suo timestamp e con $D$ la durata empirica del ciclo, espressa in giorni. Definiamo:

$$
a(t)=\max\left(0,\frac{t-t_r}{86400}\right),
\qquad
p_{\mathrm{tempo}}(t)=100\max\left(0,1-\frac{a(t)}{D}\right).
$$

I timestamp sono in secondi; dividendone la differenza per 86400 ottengo i giorni trascorsi. Il rapporto $a/D$ confronta due durate nella stessa unità. È questo il senso della percentuale: quanto rimane del **budget temporale** assegnato al ciclo.

Come durata di partenza ho scelto **55 giorni**, il riferimento empirico per queste valvole. Avevamo considerato anche lo storico, ma i vecchi indicatori numerici derivati dagli stati qualitativi producevano falsi salti di ricarica: una mediana calcolata su quei salti avrebbe descritto soprattutto il comportamento dei template. Ho preferito un parametro esplicito e modificabile a una calibrazione apparentemente più precisa, ma basata su cicli non affidabili. I 55 giorni non sono dunque una durata dichiarata dal produttore né una misura validata da trasferire ad altri dispositivi.

Con $D=55$ giorni, dopo 11 giorni il modello restituisce $100(1-11/55)=80$. È il risultato della retta che abbiamo scelto, non una verifica della durata fisica. Se nel frattempo arriva `Low`, l'avviso della valvola conta più del calendario e limito il valore a 10. Al contrario, quando il tempo stimato è finito ma il dispositivo è ancora online con dati validi, tengo un minimo di 1: per assegnare zero voglio un altro indizio, non soltanto una scadenza.

Il ciclo continua a invecchiare durante un'interruzione di osservazione; il numero, però, non viene mostrato quando manca telemetria affidabile. Temperatura, frequenza degli azionamenti, celle differenti e invecchiamento possono cambiare la durata reale senza che questa retta lo sappia. Modificare $D$ ricalcola la stima del ciclo corrente alla prossima valutazione del modello, normalmente entro cinque minuti: non modifica retroattivamente la data di ricarica.

## Due livelli di aggiornamento, con autorità diversa

La via più diretta è dire al sistema: «ho terminato la ricarica e reinserito le batterie». Per questo ho aggiunto un pulsante per stanza. La pressione registra data e ora correnti, azzera i candidati automatici e apre un nuovo ciclo. Lo lascio funzionare **anche se la valvola è ancora offline**: posso aver completato l'operazione prima che l'integrazione aggiorni i suoi dati. La dichiarazione di ricarica non deve trasformarsi in una finta dichiarazione di connettività.

Come secondo livello, senza bisogno di premere nulla, l'automazione cerca questa sequenza:

1. L'ultima batteria letta mentre il dispositivo era online era `Low`.
2. Il dispositivo risulta offline per **oltre 3600 secondi osservati**, con bridge connesso, API sana e almeno un'altra valvola online durante le valutazioni.
3. Registriamo un **esaurimento presunto** e mostriamo zero finché continuano a valere le condizioni diagnostiche del ramo offline. Se viene meno anche la salute del canale, l'indicatore torna indisponibile, pur conservando l'ipotesi in memoria.
4. Quando ritorna online con `Normal` e canale sano, apriamo un candidato di ricarica.
5. Dopo almeno **300 secondi di permanenza osservata** in quelle condizioni, confermiamo la ricarica presunta. Il timestamp salvato è quello della **prima osservazione qualificante di `Normal`**, non quello della valutazione conclusiva.

Non basta quindi `Low → Normal`, né una disconnessione qualsiasi. Se il dispositivo torna con `Low`, non apriamo un ciclo nuovo. Se la ricarica avviene prima di aver osservato `Low` e un esaurimento presunto, l'automatismo può non riconoscerla: il pulsante copre proprio questo caso.

| Evento | Candidati offline/Normal | Ultima ricarica e relativa fonte | Esaurimento presunto già confermato |
|---|---|---|---|
| Riavvio di HA o reload delle automazioni | Ricominciano dall'osservazione corrente | Conservati | Conservato |
| Gap fra valutazioni superiore a 900 s | Ricominciano dall'osservazione corrente | Conservati | Conservato |
| Bridge/API non sani o dati ambigui | Azzerati | Conservati | Conservato |
| Conferma esplicita | Azzerati | Nuovo timestamp, fonte `explicit` | Cancellato |
| Ritorno `Normal` qualificato per 300 s | Candidato concluso | Prima osservazione, fonte `presumed` | Cancellato |

Questi intervalli riguardano ciò che HA riesce a osservare. Non sto ascoltando continuamente la radio della valvola e, durante i cinque minuti di conferma, l'integrazione potrebbe riproporre lo stesso valore in cache. È il motivo per cui ho mantenuto la parola **presunta** anche quando la sequenza è completa.

### Il limite che le soglie non risolvono

La Cameretta ha mostrato bene perché questa distinzione serve. La valvola era tornata a funzionare e le temperature si aggiornavano, mentre il metadato di connessione la indicava ancora offline. Anche quel dato si è poi riallineato, senza un nuovo abbinamento. Nel frattempo, però, il vecchio flag non descriveva la disponibilità effettiva della valvola.

Nel codice di **Tado CE 4.5.0** esaminato durante il progetto, dati di zona e informazioni sui dispositivi seguono percorsi di aggiornamento distinti. Una temperatura recente non rende automaticamente recente anche il dato batteria o connessione. La cadenza dipende dalla configurazione e dalla quota API: se cambiate versione dell'integrazione, è uno dei comportamenti da ricontrollare.

Controllare bridge, API e altre valvole evita di attribuire alla batteria alcuni guasti del canale comune; non distingue, invece, un vero esaurimento da una lunga rimozione delle celle o da un problema locale di comunicazione. Mi serve quindi conservare la fonte `presumed` e poter registrare una ricarica esplicita quando conosco l'operazione effettuata. Correggere il flag nativo per far apparire online la valvola nasconderebbe proprio l'informazione che il modello deve trattare con cautela.

## 1. Preparare sorgenti e helper

Gli esempi usano Home Assistant con la sintassi dei trigger disponibile in **2026.10**, compreso `button.pressed` sugli helper `input_button`. Verificate gli **stati grezzi** in Strumenti → Stati: la traduzione visibile in dashboard non è necessariamente il valore da confrontare nel template.

Per il Bagno useremo queste sorgenti; per le altre stanze cambia il nome:

| Entità sorgente | Valore atteso |
|---|---|
| `sensor.bagno_batteria` | `Normal` oppure `Low` |
| Attributo `connection_state` di `sensor.bagno_batteria` | `online` oppure `offline` |
| `binary_sensor.bagno_tado_ce_connessione` | `on` significa connessa |
| `binary_sensor.internet_bridge_connessione` | `on` significa bridge connesso |
| `sensor.tado_ce_hub_stato_api` | `OK` significa canale API sano |

Adattate questi ID alle vostre entità reali. Nel codice, una lettura online è valida solo se il sensore di connessione è `on` **e** l'attributo batteria è `online`. Il ramo offline accetta connessione `off` e attributo `offline` o assente. Una discordanza non è un nuovo stato da inventare: sospende il riconoscimento. Per un'altra integrazione occorre prima individuare segnali equivalenti; non basta cambiare il nome del sensore batteria.

Non usate lo stato `off` di un'entità `climate` per dedurre che la batteria sia scarica: potrebbe significare soltanto riscaldamento disattivato. Se avete la stessa valvola esposta da più integrazioni, contatela una volta sola: un duplicato non è «un'altra valvola online».

Da **Impostazioni → Dispositivi e servizi → Helper**, create gli helper seguenti per ogni stanza, sostituendo `bagno` con `cameretta` e `soggiorno`. Controllate gli ID assegnati prima di creare l'automazione.

| Tipo | Entity ID per il Bagno | Impostazioni e valore di prima configurazione |
|---|---|---|
| Numero | `input_number.tado_bagno_ciclo_ricarica_stimato` | Min 1, max 730, passo 0,5, unità `d`; impostare 55 |
| Testo | `input_text.tado_bagno_memoria_batteria` | Min 0, max **255**; impostare una sola volta `{}` |
| Pulsante | `input_button.tado_bagno_conferma_ricarica_batterie` | Nessun valore iniziale da impostare |
| Numero | `input_number.tado_bagno_numero_batterie_aa` | Min 1, max 8, passo 1; impostare 2 |
| Numero | `input_number.tado_bagno_capacita_nominale_per_batteria_aa` | Min 100, max 5000, passo 1, unità `mAh`; impostare 2220 |

Il nome visualizzato dell'helper non garantisce da solo l'ID desiderato. Dopo averlo creato, apritene le impostazioni, controllate l'ID e adattatelo agli esempi prima di proseguire. Il modello richiede i primi tre helper; gli ultimi due descrivono le celle e servono alla label della dashboard, non al calcolo della percentuale.

Per impostare `{}` nel nuovo helper Testo potete usare il suo campo di testo nella UI, per esempio aggiungendolo temporaneamente a una card Entità. In alternativa, da **Strumenti → Azioni** selezionate `input_text.set_value`, scegliete il nuovo helper e inserite `{}` come valore. Fatelo **solo alla prima configurazione di un helper vuoto**: svuotare una memoria già in uso elimina anche la data di ricarica che contiene.

**Non configurate `initial`** per le memorie e i numeri persistenti. Impostare 55 o `{}` la prima volta non significa forzarli a ogni avvio. Gli helper ripristinano il valore salvato; rimangono comunque dati da includere nei backup, non un archivio immune da perdita del sistema di storage.

### Perché una memoria JSON

Per riconoscere la sequenza non basta leggere il sensore nell'istante corrente. Mi serve ricordare che l'ultima lettura valida era `Low`, quando è iniziato l'offline e se ho già registrato un esaurimento presunto. Le variabili dell'automazione, da sole, non possono farlo: vengono ricreate a ogni esecuzione.

Ho scelto un solo `input_text` per ogni valvola e ci salvo questi dati come testo JSON. È questa la «memoria»: un normale helper Testo, non un file da creare o un'integrazione da installare. Un record fittizio, dopo 11 giorni su 55 dall'inizio di un ciclo confermato esplicitamente, sarebbe:

```json
{"v":1,"l":"NORMAL","o":0,"d":false,"r":1700000000,"n":0,"t":1700950400,"s":"explicit","p":80}
```

Gli orari sono inventati per l'esempio, non valori da incollare nella vostra installazione. `r` è l'inizio del ciclo, `t` l'ultima valutazione: la loro differenza è 950400 secondi, cioè 11 giorni. `p=80` è il risultato del modello, mentre `l=NORMAL` è l'ultima indicazione qualitativa osservata online.

Per usarlo nel calcolo, leggo il testo con `states(...)` e lo trasformo in un dizionario con `from_json`. Alla fine faccio il percorso inverso: `to_json` produce la stringa che `input_text.set_value` salva nell'helper. I sensori della dashboard leggono quel risultato già pronto; la ricostruzione della sequenza rimane nell'automazione.

Il vantaggio è tenere insieme dati che devono cambiare insieme: per ogni valvola sostituisco il record con una sola azione, anziché aggiornare separatamente data, flag e percentuale. Le tre stanze vengono comunque scritte una dopo l'altra, non in una transazione unica. Ecco perché ho usato chiavi così corte: lo stato di un `input_text` deve rimanere entro 255 caratteri.

| Chiave | Significato |
|---|---|
| `v` | Versione del record |
| `l` | Ultima batteria valida online: `LOW`, `NORMAL` o stringa vuota |
| `o` | Inizio del candidato offline, oppure 0 |
| `d` | Esaurimento presunto confermato: `false`/`true` |
| `r` | Timestamp dell'ultima ricarica registrata, oppure 0 |
| `n` | Prima osservazione del candidato `Normal`, oppure 0 |
| `t` | Timestamp dell'ultima valutazione |
| `p` | Indicatore numerico oppure `null` |
| `s` | Fonte dell'ultima ricarica: `none`, `explicit`, `presumed` |

Qui «memoria dei cicli» significa conservare lo stato del ciclo corrente e l'ultima ricarica, **non un elenco illimitato di tutte le ricariche passate**. Il Recorder può registrare i cambiamenti delle entità secondo la propria retention, ma non lo usiamo come memoria operativa della macchina a stati.

Un `input_datetime` sarebbe adatto a conservare una data da sola. In questo caso la data è già nel record: un sensore timestamp la renderà leggibile senza duplicare la fonte di verità. All'inizio `r=0` significa «nessuna ricarica registrata», non una data da visualizzare come gennaio 1970.

Usare helper Numero, Data/ora, Booleano e Selezione separati sarebbe una scelta altrettanto possibile, e ogni campo sarebbe più immediato da ispezionare nella UI. Qui ho preferito il record unico per contenere il numero di entità e le scritture da coordinare. JSON è una scelta del progetto, non un requisito di Home Assistant. Durante l'uso lasciate aggiornare il record all'automazione: per registrare una ricarica c'è il pulsante.

## 2. Creare una variabile d'azione con un template locale

Ora che abbiamo dove conservare i dati, passiamo al calcolo che li aggiorna. L'ho tenuto dentro l'automazione: una sola macro, richiamata per ciascuna stanza, senza file esterni. Prima del blocco completo conviene vedere come si inserisce un template in una variabile d'azione, perché è lì che vivrà tutta la logica.

**`variables` è un'azione di Home Assistant**: assegna nomi a valori che possiamo usare nelle azioni successive della stessa esecuzione. Un valore può essere fisso, come 55, oppure calcolato con Jinja. Per isolare la sintassi, parto da questo frammento di sole azioni; serve a leggerne la struttura, non è una seconda automazione da installare:

{% raw %}
```yaml
actions:
  - variables:
      giorni: 55
      trascorsi: 11
      autonomia_stimata: >-
        {% macro percentuale(durata, eta) -%}
          {{ (100 * (1 - eta / durata)) | round(0) | int }}
        {%- endmacro %}
        {{ percentuale(giorni, trascorsi) | int }}
  - stop: "Fine dell'esempio: nessuna entità è stata modificata."
```
{% endraw %}

Qui YAML definisce la variabile `autonomia_stimata`; `>-` dice che il suo valore è un testo su più righe. Dentro quel testo, Jinja definisce la macro `percentuale` e la richiama con due argomenti. HA valuta il template e assegna alla variabile il risultato numerico **80**, non il codice della funzione. Le chiavi sono valutate nell'ordine in cui sono scritte: `giorni` e `trascorsi` devono precedere il calcolo che le legge.

La macro esiste **solo durante il rendering di quel template**. Un'altra variabile o l'azione successiva non possono richiamare `percentuale` come se fosse una funzione globale: ricevono il risultato già calcolato. Analogamente, nell'automazione completa `advance` sarà una funzione locale al valore di `updates`, e le azioni successive useranno soltanto il dizionario `updates`.

| Elemento | Che cosa contiene | Sopravvive alla fine dell'esecuzione? |
|---|---|---|
| Variabili create con Jinja `set` | Valori intermedi del template | No |
| Macro locale | Codice richiamabile nello stesso template | No |
| Variabile d'azione `updates` | Risultato del calcolo, utilizzabile nelle azioni successive | No |
| Helper `input_text` | Testo JSON salvato tramite un'azione esplicita | Sì, mediante il ripristino dello stato |

Non basta quindi chiamare una variabile `memoria` per renderla persistente. La persistenza arriva **solo dal salvataggio nell'helper**. Nella prossima esecuzione l'automazione rileggerà l'helper e ricreerà da zero tutte le proprie variabili.

### Dove si inserisce nella UI

1. Aprite **Impostazioni → Automazioni e scene → Automazioni** e create una nuova automazione vuota, non basata su blueprint.
2. Dal menu dell'editor scegliete **Modifica in YAML**. Il nome o la posizione del menu possono variare leggermente con la versione del frontend.
3. Per la configurazione definitiva incollate **l'intero blocco della sezione seguente**, non il frammento di studio. Il blocco `- variables:` è già nella posizione corretta sotto `actions:`.
4. Adattate gli ID delle sorgenti e degli helper prima di salvare. Non avviate due automazioni che scrivono le stesse memorie: se state sostituendo una versione precedente, conservatene una copia e disattivatela prima di abilitare la nuova.

Tutto questo resta nell'editor dell'automazione: `updates` non diventa un'entità e non occorre aggiungerlo a `configuration.yaml`. L'azione Variabili si può inserire anche dall'editor visuale; per questo blocco uso YAML perché permette di seguire l'annidamento del template in un unico punto.

## 3. Un solo autore della memoria: l'automazione in coda

Per evitare che un aggiornamento automatico sovrascriva una conferma appena inserita, ho fatto passare entrambi dalla stessa automazione, in modalità **`queued`**. Il pulsante non scrive il JSON per conto proprio. Memoria e telemetria vengono lette nelle **azioni**, quando arriva il turno dell'esecuzione: un risultato calcolato prima dell'attesa in coda potrebbe essere già superato.

Qui c'è l'automazione completa: i trigger, il template locale `advance` e le tre azioni che salvano i risultati. Incollatela nell'editor YAML della singola automazione, senza aggiungere una chiave esterna `automation:`. Se l'editor ha già assegnato un `id`, mantenete quello: il valore sotto identifica la nostra versione, ma non entra nel calcolo.

{% raw %}
```yaml
id: tado_battery_model_v1
alias: Tado batterie - riconoscimento ricariche e stima
description: >-
  Scrive soltanto le memorie batteria. Conferme esplicite e inferenze
  sono serializzate; nessun comando alle termovalvole.
mode: queued
max: 20
triggers:
  - trigger: state
    entity_id:
      - sensor.bagno_batteria
      - sensor.cameretta_batteria
      - sensor.soggiorno_batteria
      - binary_sensor.bagno_tado_ce_connessione
      - binary_sensor.cameretta_tado_ce_connessione
      - binary_sensor.soggiorno_tado_ce_connessione
      - binary_sensor.internet_bridge_connessione
      - sensor.tado_ce_hub_stato_api
    to: null
  - trigger: time_pattern
    minutes: "/5"
  - trigger: homeassistant
    event: start
  - trigger: event
    event_type: automation_reloaded
  - trigger: button.pressed
    target:
      entity_id: input_button.tado_bagno_conferma_ricarica_batterie
    id: explicit_bagno
  - trigger: button.pressed
    target:
      entity_id: input_button.tado_cameretta_conferma_ricarica_batterie
    id: explicit_cameretta
  - trigger: button.pressed
    target:
      entity_id: input_button.tado_soggiorno_conferma_ricarica_batterie
    id: explicit_soggiorno
conditions: []
actions:
  - variables:
      updates: >-
        {% macro advance(old, sample) %}
        {% set m = old if old is mapping and old.get('v', 1) == 1 else {} %}
        {% set tick = sample.now | int %}
        {% set last = m.get('l', '') %}
        {% set off = m.get('o', 0) | int(0) %}
        {% set dead = m.get('d', false) | bool(false) %}
        {% set recharge = m.get('r', 0) | int(0) %}
        {% set normal_since = m.get('n', 0) | int(0) %}
        {% set checked = m.get('t', 0) | int(0) %}
        {% set battery = sample.battery | trim | upper %}
        {% set days = sample.days | float(0) %}
        {% set source = m.get('s', 'presumed' if recharge > 0 else 'none') %}
        {% set percent = none %}
        {% set observation_gap = sample.reset or checked <= 0 or tick < checked or tick - checked > 900 %}
        {% if observation_gap %}
          {% if not dead %}{% set off = 0 %}{% endif %}
          {% set normal_since = 0 %}
        {% endif %}
        {% set predicted = 100 %}
        {% if recharge > 0 and recharge <= tick and days > 0 %}
          {% set elapsed_days = [0, (tick - recharge) / 86400] | max %}
          {% set predicted = [1, [100, 100 * (1 - elapsed_days / days)] | min] | max %}
        {% endif %}
        {% if sample.manual | default(false) %}
          {% set recharge = tick %}
          {% set last = 'NORMAL' %}
          {% set off = 0 %}
          {% set dead = false %}
          {% set normal_since = 0 %}
          {% set source = 'explicit' %}
          {% set percent = 100 if sample.healthy and sample.connection == 'on' and sample.reported == 'online' and battery == 'NORMAL' else none %}
        {% elif sample.healthy and sample.connection == 'on' and sample.reported == 'online' and battery in ['NORMAL', 'LOW'] %}
          {% set off = 0 %}
          {% if battery == 'LOW' %}
            {% set last = 'LOW' %}
            {% set normal_since = 0 %}
            {% set percent = [10, predicted] | min %}
          {% else %}
            {% set last = 'NORMAL' %}
            {% if dead %}
              {% if normal_since <= 0 or normal_since > tick %}{% set normal_since = tick %}{% endif %}
              {% if tick - normal_since >= 300 %}
                {% set recharge = normal_since %}
                {% set source = 'presumed' %}
                {% set dead = false %}
                {% set normal_since = 0 %}
                {% set percent = 100 %}
              {% endif %}
            {% else %}
              {% set normal_since = 0 %}
              {% set percent = predicted %}
            {% endif %}
          {% endif %}
        {% elif sample.healthy and sample.connection == 'off' and sample.reported in ['offline', ''] and sample.other_online %}
          {% set normal_since = 0 %}
          {% if dead %}
            {% set percent = 0 %}
          {% elif last == 'LOW' %}
            {% if off <= 0 or off > tick %}{% set off = tick %}{% endif %}
            {% if tick - off > 3600 %}
              {% set dead = true %}
              {% set percent = 0 %}
            {% endif %}
          {% else %}
            {% set off = 0 %}
          {% endif %}
        {% else %}
          {% if not dead %}{% set off = 0 %}{% endif %}
          {% set normal_since = 0 %}
        {% endif %}
        {% if days <= 0 or recharge > tick %}{% set percent = none %}{% endif %}
        {{ dict(v=1, l=last, o=off, d=dead, r=recharge, n=normal_since, t=tick, s=source, p=(percent | round(0) | int) if percent is number else none) | to_json }}
        {% endmacro %}
        {% set ns = namespace(updates={}) %}
        {% set rooms = [
          dict(room='bagno', battery='sensor.bagno_batteria',
               connection='binary_sensor.bagno_tado_ce_connessione',
               memory='input_text.tado_bagno_memoria_batteria',
               cycle='input_number.tado_bagno_ciclo_ricarica_stimato'),
          dict(room='cameretta', battery='sensor.cameretta_batteria',
               connection='binary_sensor.cameretta_tado_ce_connessione',
               memory='input_text.tado_cameretta_memoria_batteria',
               cycle='input_number.tado_cameretta_ciclo_ricarica_stimato'),
          dict(room='soggiorno', battery='sensor.soggiorno_batteria',
               connection='binary_sensor.soggiorno_tado_ce_connessione',
               memory='input_text.tado_soggiorno_memoria_batteria',
               cycle='input_number.tado_soggiorno_ciclo_ricarica_stimato')
        ] %}
        {% set connections = [
          'binary_sensor.bagno_tado_ce_connessione',
          'binary_sensor.cameretta_tado_ce_connessione',
          'binary_sensor.soggiorno_tado_ce_connessione'
        ] %}
        {% set reset = trigger is defined and (
          trigger.platform | default('') == 'homeassistant' or (
            trigger.platform | default('') == 'event' and
            trigger.event.event_type | default('') == 'automation_reloaded')) %}
        {% for room in rooms %}
          {% set old = states(room.memory) | from_json({}) %}
          {% set peers = connections | reject('eq', room.connection) | list %}
          {% set other_online = expand(peers) | selectattr('state', 'eq', 'on') | list | length > 0 %}
          {% set sample = dict(
            now=as_timestamp(now()) | int,
            connection=states(room.connection),
            reported=state_attr(room.battery, 'connection_state') | default('', true) | lower,
            battery=states(room.battery),
            healthy=is_state('binary_sensor.internet_bridge_connessione', 'on') and
                    is_state('sensor.tado_ce_hub_stato_api', 'OK'),
            other_online=other_online,
            days=states(room.cycle) | float(0),
            reset=reset,
            manual=trigger is defined and trigger.id | default('') == ('explicit_' ~ room.room)
          ) %}
          {% set updated = advance(old, sample) | from_json({}) %}
          {% set ns.updates = dict(ns.updates, **{room.room: updated}) %}
        {% endfor %}
        {{ ns.updates }}
  - action: input_text.set_value
    target:
      entity_id: input_text.tado_bagno_memoria_batteria
    data:
      value: "{{ updates.bagno | to_json }}"
  - action: input_text.set_value
    target:
      entity_id: input_text.tado_cameretta_memoria_batteria
    data:
      value: "{{ updates.cameretta | to_json }}"
  - action: input_text.set_value
    target:
      entity_id: input_text.tado_soggiorno_memoria_batteria
    data:
      value: "{{ updates.soggiorno | to_json }}"
```
{% endraw %}

### Come leggere il blocco `updates`

Il template fa quattro cose, nell'ordine:

1. Definisce `advance(old, sample)`. La macro riceve il precedente record di una stanza e un campione delle sorgenti; restituisce il nuovo record come testo JSON. Non scrive helper e non invia comandi.
2. Definisce `rooms`, cioè la corrispondenza fra stanza e ID delle entità. È il punto da adattare se i vostri ID sono diversi.
3. Per ogni stanza legge l'helper, prepara `sample`, richiama `advance` e converte il risultato con `from_json`. `namespace` consente di accumulare i risultati attraverso le iterazioni del ciclo Jinja.
4. Restituisce il dizionario completo, con le chiavi `bagno`, `cameretta` e `soggiorno`. HA lo assegna alla variabile d'azione `updates`.

È nelle tre azioni successive che il risultato smette di essere soltanto una variabile temporanea: ogni azione prende una stanza da `updates`, la serializza con `to_json` e la salva nel suo `input_text`. Negli helper non va incollato il codice della macro. A questo punto possiamo costruire i sensori che leggono quei record.

Le memorie non sono tra i trigger: altrimenti ogni scrittura innescherebbe un'altra valutazione. `to: null` nel trigger di stato esclude i cambiamenti dei soli attributi; il tick ogni cinque minuti rilegge anche l'attributo `connection_state` e fa avanzare i candidati senza nuove transizioni. Non vengono eseguite richieste di refresh cloud a ogni tick: si usano gli stati disponibili in HA.

Dopo startup, reload o un gap superiore a 900 secondi, il tempo precedente non vale per i candidati non confermati. La stessa valutazione può aprirne uno nuovo con timestamp corrente. Il flag di esaurimento già confermato e l'ultima ricarica restano invece memorizzati.

Ci sono due casi in cui non esponiamo un numero pur avendo una memoria valida: un ritorno `Normal` ancora in attesa dei 300 secondi, e una conferma esplicita con telemetria non coerente con `Normal` online. La data può essere salvata comunque; l'indicatore non deve anticipare una conferma o contraddire le sorgenti.

La versione realizzata usa `from_json({})` come ripiego e accetta il record versione 1. **Non è una migrazione né una riparazione dei dati:** se il testo è corrotto o la versione non è riconosciuta, il calcolo riparte da un record vuoto e non può recuperare la vecchia data. In caso di errore fermate l'automazione e controllate il backup, invece di azzerare l'helper per tentativi.

Le azioni sono brevi e non contengono attese di un'ora. Una coda finita può comunque saturarsi: controllate eventuali avvisi di `max_exceeded`, senza silenziarli. La serializzazione impedisce sovrascritture concorrenti all'interno di questo flusso, ma **non è una coda durevole delle pressioni** attraverso uno spegnimento improvviso. Dopo una conferma controllate che la data sia comparsa.

## 4. Esporre percentuale e ultima ricarica

Per la dashboard mi servono due letture del record: la percentuale e la data dell'ultima ricarica. Le espongo con due sensori per stanza, creati dalla UI in **Helper → Template → Sensore**. Per il Bagno uso questi ID:

- `sensor.termovalvola_bagno` per l'indicatore numerico;
- `sensor.tado_bagno_ultima_ricarica_presunta` per il timestamp.

Ho mantenuto il secondo ID per compatibilità, anche se ormai quella data può arrivare da una conferma esplicita. Come nome visualizzato uso quindi **«Bagno: ultima ricarica registrata»**, mostrando a parte la fonte. Se partite da zero potete scegliere un ID meno ambiguo.

Se avete già sensori con questi ID, **non create doppioni sperando di sostituirli**: HA assegnerebbe un suffisso numerico. Nel sistema realizzato sono stati aggiornati i template degli indicatori esistenti, conservandone gli ID. Prima di intervenire sui vostri, salvate i template originali e controllate chi li usa, specialmente notifiche e dashboard.

La disponibilità segue una distinzione utile: una stima numerica deve essere recente e appoggiarsi a sorgenti sane; una data già registrata, invece, non perde significato perché la valvola si disconnette. I due sensori avranno quindi controlli diversi.

### Indicatore numerico

Impostate unità `%`, icona `mdi:battery-clock` e un nome che contenga **«autonomia stimata»**. La classe dispositivo `battery` è utile per le rappresentazioni standard, purché sia chiaro il significato del valore. Non serve dichiarare statistiche a lungo termine per far funzionare la memoria.

Nel campo **Stato**:

{% raw %}
```jinja
{% set m = states('input_text.tado_bagno_memoria_batteria') | from_json({}) %}
{{ m.get('p') if m is mapping else none }}
```
{% endraw %}

In **Opzioni aggiuntive → Disponibilità**:

{% raw %}
```jinja
{% set m = states('input_text.tado_bagno_memoria_batteria') | from_json({}) %}
{{ m is mapping and m.get('p') is number
   and 0 <= as_timestamp(now()) - (m.get('t', 0) | float(0)) <= 900
   and is_state('binary_sensor.internet_bridge_connessione', 'on')
   and is_state('sensor.tado_ce_hub_stato_api', 'OK')
   and states('binary_sensor.bagno_tado_ce_connessione') in ['on', 'off'] }}
```
{% endraw %}

Questa è la disponibilità usata dall'indicatore realizzato: richiede un risultato numerico recente, bridge/API sani e uno stato di connessione riconosciuto. Il controllo sull'età evita che una percentuale rimanga apparentemente aggiornata se l'automazione si ferma. È il tempo trascorso dall'ultima **valutazione del modello**, non la freschezza certificata del campione cloud. La disponibilità si aggiorna anche con il tempo grazie a `now()`; la coerenza con l'attributo batteria viene verificata nel calcolo di `p`.

### Timestamp dell'ultima ricarica

Impostate classe dispositivo **Timestamp**, nessuna unità e nome visualizzato **«Bagno: ultima ricarica registrata»**. Nel campo **Stato**:

{% raw %}
```jinja
{% set m = states('input_text.tado_bagno_memoria_batteria') | from_json({}) %}
{% set stamp = m.get('r', 0) | float(0) if m is mapping else 0 %}
{{ as_datetime(stamp).isoformat() if stamp > 0 else none }}
```
{% endraw %}

Nel campo **Disponibilità**:

{% raw %}
```jinja
{% set m = states('input_text.tado_bagno_memoria_batteria') | from_json({}) %}
{{ m is mapping and is_number(m.get('r'))
   and 0 < (m.get('r', 0) | float(0)) <= as_timestamp(now()) }}
```
{% endraw %}

Qui **non** richiediamo che la valvola sia online o il modello appena eseguito. La data è un'informazione storica: una disconnessione successiva non la rende falsa. Controlliamo invece che sia un timestamp numerico positivo e non nel futuro. Prima della prima ricarica registrata il sensore resta indisponibile.

Ripetete i quattro campi per Cameretta e Soggiorno, cambiando `bagno` negli ID. Gli helper Template creati dalla UI ricevono la propria identità dalla configurazione: non aggiungete un `unique_id` nei campi del flusso.

## 5. La dashboard: conferma, data e fonte

Cominciamo dalla parte che uso per dichiarare una ricarica. Bastano i pulsanti nativi di HA: le custom card serviranno soltanto per la resa delle barre e delle pill. Aggiungete questa **nuova card** alla vista di manutenzione, lasciando al loro posto le altre:

```yaml
type: grid
columns: 3
square: false
cards:
  - type: button
    entity: input_button.tado_bagno_conferma_ricarica_batterie
    name: Bagno
    icon: mdi:battery-sync
    tap_action:
      action: perform-action
      perform_action: input_button.press
      target:
        entity_id: input_button.tado_bagno_conferma_ricarica_batterie
      confirmation:
        text: Batterie ricaricate e reinserite in Bagno? Registro adesso.
  - type: button
    entity: input_button.tado_cameretta_conferma_ricarica_batterie
    name: Cameretta
    icon: mdi:battery-sync
    tap_action:
      action: perform-action
      perform_action: input_button.press
      target:
        entity_id: input_button.tado_cameretta_conferma_ricarica_batterie
      confirmation:
        text: Batterie ricaricate e reinserite in Cameretta? Registro adesso.
  - type: button
    entity: input_button.tado_soggiorno_conferma_ricarica_batterie
    name: Soggiorno
    icon: mdi:battery-sync
    tap_action:
      action: perform-action
      perform_action: input_button.press
      target:
        entity_id: input_button.tado_soggiorno_conferma_ricarica_batterie
      confirmation:
        text: Batterie ricaricate e reinserite in Soggiorno? Registro adesso.
```

Accanto ai pulsanti aggiungete una card Entità con i tre sensori timestamp:

```yaml
type: entities
title: Ultime ricariche registrate
show_header_toggle: false
entities:
  - entity: sensor.tado_bagno_ultima_ricarica_presunta
    name: Bagno
  - entity: sensor.tado_cameretta_ultima_ricarica_presunta
    name: Cameretta
  - entity: sensor.tado_soggiorno_ultima_ricarica_presunta
    name: Soggiorno
```

La conferma protegge dai tocchi involontari: il pulsante non accende un caricabatterie e non verifica la carica delle celle. Premetelo **dopo** l'operazione, non quando iniziate a caricarle. Non occorre un interruttore aggiuntivo per il modello: conferme e riconoscimento implicito convivono nella stessa automazione.

Per rendere esplicita la provenienza della data, una card Markdown nativa può leggere la stessa memoria:

{% raw %}
```yaml
type: markdown
content: >-
  {% for stanza in ['bagno', 'cameretta', 'soggiorno'] %}
    {% set m = states('input_text.tado_' ~ stanza ~ '_memoria_batteria') | from_json({}) %}
    {% set fonte = m.get('s', 'none') if m is mapping else 'none' %}
    {% set r = m.get('r', 0) | int(0) if m is mapping else 0 %}
    {% set descrizione = {'explicit': 'conferma esplicita',
                         'presumed': 'riconoscimento presunto'} %}
    **{{ stanza | capitalize }}**:
    {{ (r | timestamp_custom('%d/%m/%Y %H:%M', true)) if r > 0 else 'nessuna data registrata' }}
    — {{ descrizione.get(fonte, 'nessuna fonte') }}

  {% endfor %}
```
{% endraw %}

### Le pill delle batterie, senza valori statici

Le mie righe batteria usavano già un template `bar_row` di `custom:button-card`, con la label pensata per descrivere il tipo di batteria. La label era ancora nella configurazione, ma `show_label: false` la nascondeva: aggiornarne il testo non sarebbe bastato a mostrarla.

Ho riattivato la label, ripristinato lo stile a pill e collegato il contenuto agli helper di numero e capacità delle celle. Sul vostro dashboard controllate chi altro usa il template: la modifica condivisa rende visibili anche le label delle altre righe. Per limitarla alle Tado potete usare un override sulle sole righe interessate o un template dedicato.

Questo esempio completo usa un nuovo nome, **`tado_bar_row`**, per non sovrascrivere il vostro. Richiede {% xlink "https://github.com/custom-cards/button-card" "custom:button-card" %}; sintassi e dipendenze reattive sono riferite alla **7.0.1**. La card è una dipendenza solo della visualizzazione, non della memoria o delle conferme. Con le card native conservate le stesse informazioni, ma non questa impaginazione a pill.

Nell'editor della configurazione grezza della dashboard, aggiungete il template alla mappa `button_card_templates` già esistente. Non sostituite le altre definizioni.

{% raw %}
```yaml
button_card_templates:
  tado_bar_row:
    variables:
      stanza: bagno
    show_icon: false
    show_state: false
    show_label: true
    tap_action:
      action: more-info
    label: >-
      [[[
        const room = variables.stanza;
        const count = Number(states[`input_number.tado_${room}_numero_batterie_aa`]?.state);
        const capacity = Number(states[`input_number.tado_${room}_capacita_nominale_per_batteria_aa`]?.state);
        const countValid = Number.isInteger(count) && count > 0;
        const capacityValid = Number.isFinite(capacity) && capacity > 0;
        const type = countValid ? `${count}×AA` : 'AA (numero n/d)';
        return capacityValid ? `${type} · ${Math.round(capacity)} mAh/cella`
                             : `${type} · capacità n/d`;
      ]]]
    custom_fields:
      percent: >-
        [[[
          const p = Number(entity?.state);
          return Number.isFinite(p) && p >= 0 && p <= 100
            ? `${p}% stimato` : 'n/d';
        ]]]
      track: ""
      bar: ""
    styles:
      card:
        - padding: 12px
      grid:
        - grid-template-areas: '"n percent" "l l" "track track"'
        - grid-template-columns: minmax(0, 1fr) max-content
        - grid-template-rows: auto auto 6px
        - gap: 8px
      name:
        - justify-self: start
      label:
        - justify-self: start
        - border-radius: 999px
        - padding: 2px 8px
        - border: 1px solid var(--divider-color)
        - background-color: var(--ha-chip-background-color, var(--secondary-background-color))
        - font-size: 12px
        - white-space: normal
        - max-width: 100%
        - box-sizing: border-box
      custom_fields:
        percent:
          - justify-self: end
          - font-size: 12px
        track:
          - grid-area: track
          - height: 6px
          - width: 100%
          - border-radius: 3px
          - background-color: var(--divider-color)
        bar:
          - grid-area: track
          - justify-self: start
          - z-index: 1
          - height: 6px
          - border-radius: 3px
          - background-color: var(--primary-color)
          - width: >-
              [[[
                const p = Number(entity?.state);
                return Number.isFinite(p) && p >= 0 && p <= 100 ? `${p}%` : '0%';
              ]]]
```
{% endraw %}

Poi aggiungete una card che riusi il template:

```yaml
type: vertical-stack
cards:
  - type: custom:button-card
    template: tado_bar_row
    entity: sensor.termovalvola_bagno
    name: Bagno
    variables:
      stanza: bagno
  - type: custom:button-card
    template: tado_bar_row
    entity: sensor.termovalvola_cameretta
    name: Cameretta
    variables:
      stanza: cameretta
  - type: custom:button-card
    template: tado_bar_row
    entity: sensor.termovalvola_soggiorno
    name: Soggiorno
    variables:
      stanza: soggiorno
```

La pill mostrerà **`2×AA · 2220 mAh/cella`** e seguirà le modifiche degli helper. Se mancano i metadati, indicherà numero o capacità non disponibili. Se manca la percentuale, apparirà `n/d`: una barra vuota non va interpretata da sola come zero.

{% cloudinary /assets/images/batterie-home-assistant-ricarica-stimata-1.png alt="Card Termovalvole con tre righe batteria per Soggiorno, Cameretta e Bagno: percentuale a destra, barra sotto e pill con 2×AA · 2220 mAh/cella" caption="Le tre righe del template: percentuale, barra e pill con numero, formato e capacità nominale per cella." role="screenshot" context="result" %}

Il formato `AA` è qui una caratteristica dichiarata dei dispositivi, mentre numero e capacità vengono dagli helper. **2220 mAh è il valore nominale di ciascuna cella**. Il modello non somma le due capacità e non ricava energia, tensione o chimica. Questi metadati descrivono le batterie montate; non entrano nella formula dei 55 giorni e non la validano.

## 6. Verificare le transizioni senza scaricare una batteria

La macro legge l'orologio da `sample.now`, quindi possiamo provarla con tempi simulati. Essendo locale, **non si può importare dal nome dell'automazione** nell'editor Template. Per eseguire la prova:

1. Aprite **Strumenti → Template**.
2. Dal blocco YAML completo copiate soltanto la definizione di `advance`, dalla riga di apertura `macro advance` alla chiusura `endmacro`, comprese le rispettive delimitazioni Jinja. Non copiate `updates:`, il ciclo sulle stanze o le azioni `input_text.set_value`.
3. Rimuovete l'indentazione YAML iniziale, lasciando il contenuto Jinja, e incollate subito sotto il blocco di test seguente.
4. Il risultato deve mostrare `OK` per ciascun caso. Per verificare poi il template completo, usate separatamente il contenuto di `updates` nell'editor: senza `trigger`, non viene simulata una pressione del pulsante.

Queste prove eseguono soltanto calcoli: non premono pulsanti, non scrivono helper e non inviano comandi al riscaldamento. L'epoca numerica di partenza è un dato fittizio del test, non una data iniziale da copiare nelle memorie reali.

{% raw %}
```jinja
{% set T = 1700000000 %}
{% set base = dict(now=T, connection='on', reported='online',
                   battery='Normal', healthy=true, other_online=true,
                   days=55, reset=false, manual=false) %}
{% set normale = advance({}, base) | from_json %}
Normal senza data: {{ 'OK' if normale.p == 100 and normale.r == 0 else 'ERRORE' }}

{% set low = advance({}, dict(base, battery='Low')) | from_json %}
{% set offline = dict(base, connection='off', reported='offline', battery='Low') %}
{% set breve = advance(low, dict(offline, now=T+300)) | from_json %}
{% set ritorno = advance(breve, dict(base, now=T+600)) | from_json %}
Offline breve: {{ 'OK' if ritorno.r == 0 and ritorno.d == 0 else 'ERRORE' }}

{% set rete = advance(breve, dict(offline, now=T+600, healthy=false)) | from_json %}
Guasto canale: {{ 'OK' if rete.o == 0 and rete.p is none else 'ERRORE' }}

{% set gap = advance(breve, dict(offline, now=T+1301)) | from_json %}
Gap oltre 900 s: {{ 'OK' if gap.o == T+1301 and gap.d == 0 else 'ERRORE' }}

{% set ns = namespace(m=breve) %}
{% for i in range(2, 14) %}
  {% set ns.m = advance(ns.m, dict(offline, now=T+i*300)) | from_json %}
{% endfor %}
Esattamente 3600 s offline: {{ 'OK' if ns.m.d == 0 else 'ERRORE' }}
{% set scarica = advance(ns.m, dict(offline, now=T+3901)) | from_json %}
Oltre 3600 s: {{ 'OK' if scarica.d == 1 and scarica.p == 0 else 'ERRORE' }}

{% set primo = advance(scarica, dict(base, now=T+4000)) | from_json %}
{% set attesa = advance(primo, dict(base, now=T+4299)) | from_json %}
Prima di 300 s: {{ 'OK' if attesa.r == 0 and attesa.p is none else 'ERRORE' }}
{% set carica = advance(attesa, dict(base, now=T+4300)) | from_json %}
Ricarica presunta: {{ 'OK' if carica.r == T+4000 and carica.s == 'presumed' else 'ERRORE' }}

{% set riavvio = advance(carica, dict(base, now=T+4400, healthy=false, reset=true)) | from_json %}
Data dopo riavvio: {{ 'OK' if riavvio.r == carica.r and riavvio.p is none else 'ERRORE' }}
{% set manuale = advance(scarica, dict(offline, now=T+4500, healthy=false, manual=true)) | from_json %}
Conferma offline: {{ 'OK' if manuale.r == T+4500 and manuale.s == 'explicit' and manuale.d == 0 and manuale.p is none else 'ERRORE' }}
```
{% endraw %}

Questi casi verificano le regole di transizione e alcuni confini temporali. Provate anche un riavvio durante il candidato `Normal`: `n` deve ripartire dall'osservazione corrente senza cancellare `r`. Senza un'altra valvola online, l'offline non deve accumulare tempo utile alla prima dichiarazione di esaurimento. Una discordanza tra connessione `on` e attributo batteria `offline` deve produrre `p=null`, non una percentuale.

Ho verificato questi dieci casi anche nel **renderer Jinja nativo di Home Assistant**, usando gli stessi dati fittizi e senza scrivere helper, oltre ai controlli locali su codice e formattazione. È un modo per provare le transizioni senza attendere un ciclo delle batterie. Per trigger, coda e ripristino dopo un riavvio serve invece provare l'automazione completa: la configurazione riportata viene dall'istanza in uso, mentre il montaggio da zero su un'istanza di prova resta da verificare.

Per la parte numerica, una conferma seguita da 11 giorni simulati deve produrre 80 con `Normal` e al massimo 10 con `Low`; dopo 55 giorni, se ancora online con dati validi, deve produrre 1. Il test deve avanzare la stima dalla data salvata, non «consumare» una quota a ogni tick: perdere un tick non allunga la vita stimata.

Far passare questi test dice che il codice segue le regole scelte, non che una batteria durerà davvero 55 giorni. Per questa configurazione non abbiamo una serie validata di cicli fisici completi da cui ricavare errori o intervalli di confidenza sull'autonomia.

### Controlli di montaggio sull'istanza di prova

Prima di usare gli indicatori nelle notifiche:

1. Controllate che l'automazione sia attiva e che il primo tick scriva un record versione 1, senza creare una data di ricarica.
2. Dopo una vera ricarica completata, usate la conferma della stanza corretta e verificate timestamp e fonte `explicit`. Una pressione ripetuta registra un nuovo orario: non è un comando di sola lettura.
3. Verificate il ripristino delle memorie dopo un riavvio controllato e il riavvio dei soli candidati. La persistenza non si dimostra eseguendo soltanto la macro.
4. Controllate la traccia di un tick, l'assenza di errori di template e la lunghezza del JSON, sempre inferiore a 256 caratteri.
5. Verificate su desktop e telefono che `n/d`, fonte della data e dicitura «stimato» siano leggibili. Cambiare temporaneamente i metadati della batteria sull'istanza di prova deve aggiornare la pill senza ricaricare il modello.

Non serve provocare disconnessioni delle valvole reali, resettare abbinamenti o cambiare le protezioni delle finestre per controllare queste transizioni. Se volete interrompere l'esperimento, disattivate l'automazione; se avete sostituito sensori preesistenti, ripristinate i loro template salvati. Non cancellate le memorie finché volete conservarne le date.

## Che cosa mi restituisce la dashboard

Ho così affiancato all'avviso `Low` tre informazioni che prima non avevo insieme: quanto è avanzato il ciclo stimato, quando è stata registrata l'ultima ricarica e se quella data viene da una mia conferma o dal riconoscimento automatico. Il pulsante permette di dichiarare un'operazione nota; l'automazione prova a riconoscerla quando non intervengo. Se le sorgenti non bastano a sostenere un numero, la dashboard può anche mostrare `n/d`.

Per questo ho lasciato i 55 giorni in un helper modificabile. Potrò correggerli con osservazioni adatte, tenendo separate ricariche anticipate, guasti e cicli arrivati a esaurimento. Nel frattempo la stima ha uno scopo più limitato, ma concreto: organizzare la manutenzione senza scambiare due stati qualitativi per una misura continua.

## Riferimenti per adattare gli esempi

- {% xlink "https://www.home-assistant.io/integrations/input_text/" "Input text: limite dello stato e ripristino" %}.
- {% xlink "https://www.home-assistant.io/integrations/input_number/" "Input number: valori configurabili e ripristino" %}.
- {% xlink "https://www.home-assistant.io/integrations/input_button/" "Input button e trigger di pressione" %}.
- {% xlink "https://www.home-assistant.io/docs/automation/modes/" "Modalità di esecuzione delle automazioni" %}.
- {% xlink "https://www.home-assistant.io/docs/scripts/#variables" "Variabili nelle sequenze di azioni di Home Assistant" %}.
- {% xlink "https://www.home-assistant.io/docs/configuration/templating/" "Sintassi dei template Jinja in Home Assistant" %}.
- {% xlink "https://github.com/hiall-fyi/tado_ce/tree/v4.5.0" "Sorgenti Tado CE 4.5.0, versione esaminata" %}.
- {% xlink "https://github.com/custom-cards/button-card/tree/v7.0.1" "Documentazione e sorgenti button-card 7.0.1" %}.

<!-- TODO: generare e revisionare l'immagine master; aggiungere eventuali schermate solo dopo averle anonimizzate. Annotare i link con il flusso editoriale separato, dopo la revisione della bozza. -->
