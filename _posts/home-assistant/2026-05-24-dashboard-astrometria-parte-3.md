---
category: Home Assistant
title: "Il cielo in salotto, parte 3: Lo spazio profondo"
excerpt: "La terza e ultima sezione della dashboard di astrometria: l'immagine astronomica del giorno NASA (APOD) con API key e secrets.yaml, la posizione in tempo reale della ISS con multiscrape, e i prossimi lanci spaziali. Come integrare tutto in Home Assistant con REST sensor, Generic Camera e multiscrape."
master: /assets/images/astrometria-dashboard-3.png
image_meta:
  role: screenshot
  context: reference
  caption: "Dashboard di astrometria completa — Spazio profondo"
header:
  transform: keystone
  intensity: medium
  logo: false
  overlay_filter: 0.5
series:
  id: "dashboard-astrometria"
  title: "Il cielo in salotto"
  part: 3
  total_parts: 3
broadcast:
  channels: [linkedin, mastodon]
  sent: false
  linkedin_image:
    logo: true
    color: white
    caption: "Astronomia in Home Assistant - Pt. 3: Completiamo il dashboard"
    transform: keystone
    intensity: medium
  mastodon_image:
    logo: home-assistant.png
    color: white
    caption: "Space dashboard for HA - Part 3: Final touches"
    transform: keystone
    intensity: low
intended_audience: practitioner
proficiency_level: intermediate
difficulty_declared:
  conceptual: 2
  technical: 4
  mathematical: 0
difficulty_computed:
  semantic:
    concept_count: 7
    concept_density: 0.33
    jargon_ratio: 6.8
    definition_coverage: 0.43
    external_knowledge_demand: 5
    prerequisite_depth: 1.9
    math_density: 0.0
    code_density: 4.2
    blocking_prerequisite_count: 2
knowledge_prerequisites:
  - concept: "home-assistant"
    label: "Home Assistant"
    url: "https://www.home-assistant.io/"
    importance: "required"
    depth: 2
  - concept: "yaml"
    label: "YAML"
    url: "https://yaml.org/"
    importance: "required"
    depth: 1
  - concept: "rest-apis"
    label: "REST API"
    url: "https://en.wikipedia.org/wiki/Representational_state_transfer"
    sameAs: "https://www.wikidata.org/wiki/Q749568"
    importance: "recommended"
    depth: 1
  - concept: "jinja2-templates"
    label: "Template Jinja2"
    url: "https://www.home-assistant.io/docs/configuration/templating/"
    importance: "recommended"
    depth: 2
  - concept: "multiscrape"
    label: "Multiscrape"
    url: "https://github.com/danieldotnl/ha-multiscrape"
    importance: "recommended"
    depth: 2
  - concept: "nasa-apod"
    label: "NASA APOD"
    url: "https://apod.nasa.gov/apod/"
    importance: "helpful"
    depth: 1
  - concept: "iss"
    label: "International Space Station"
    url: "https://en.wikipedia.org/wiki/International_Space_Station"
    sameAs: "https://www.wikidata.org/wiki/Q25271"
    importance: "helpful"
    depth: 1
  - concept: "norad-id"
    label: "NORAD ID (Satellite Catalog Number)"
    url: "https://en.wikipedia.org/wiki/Satellite_Catalog_Number"
    importance: "helpful"
    depth: 2
  - concept: "secrets-management"
    label: "Gestione delle secrets"
    url: "https://www.home-assistant.io/docs/configuration/secrets/"
    importance: "recommended"
    depth: 1
---

Nella {% post_link /home-assistant/dashboard-astrometria-parte-1/ "prima parte" role="prerequisite" context="provides-context" target="internal" %} abbiamo costruito il modulo Terra-Luna, nella {% post_link /home-assistant/dashboard-astrometria-parte-2/ "seconda" role="prerequisite" context="provides-context" target="internal" %} abbiamo monitorato il Sole. In questa terza e ultima parte ci spingiamo oltre: lo spazio profondo, la stazione spaziale e i razzi che la raggiungono. Dopo le misurazioni e i grafici dell'ultima volta, su questa colonna inseriremo _card_ con uno scopo più sognante e divulgativo.

---

## APOD: Astronomical Picture of the Day

L'{% xlink "https://apod.nasa.gov/apod/" "Astronomical Picture of the Day" role="definition" context="provides-context" target="external-authoritative" %} è probabilmente il sito di divulgazione astronomica più longevo e più visitato del web. Attivo dal 16 giugno 1995, e mai realmente cambiato da allora, pubblica ogni giorno un'immagine astronomica diversa — fotografie di galassie, nebulose, eclissi, aurore, pianeti — con una spiegazione scritta da un astrofisico professionista. È una finestra quotidiana sull'universo accessibile a tutti.

Avere l'APOD del giorno in dashboard, con immagine e didascalia, trasforma Home Assistant in qualcosa di più di un pannello domotico: diventa un'interfaccia verso il cosmo.

### L'API NASA

La NASA mette a disposizione un'API pubblica e documentata per l'APOD all'indirizzo `https://api.nasa.gov/planetary/apod`. Richiede una chiave API che si ottiene gratuitamente registrandosi su {% xlink "https://api.nasa.gov" "api.nasa.gov" role="tool" context="enables-step" target="external-authoritative" %}.

Esiste anche una chiave `DEMO_KEY` che funziona senza registrazione, ma è soggetta a limiti di utilizzo più stringenti (30 richieste/ora, 50/giorno). Per un'installazione casalinga che interroga l'API una volta al giorno, la `DEMO_KEY` è sufficiente, ma consiglio di richiedere una chiave personale: è gratis e si ottiene in pochi minuti.

### Proteggere la chiave: secrets.yaml

Approfito di questo semplice caso per spendere due parole su un argomento essenziale per chi sviluppa in Home Assistant, ovvero le cosiddette **secrets**. Analogamente a quelle di una moltitudine di altri sistemi software, e Home Assistant {% xlink "https://www.home-assistant.io/docs/configuration/secrets/" "non fa eccezione" role="deepening" context="extends-topic" target="external-authoritative" %}, sono piccole porzioni di dato, tipicamente stringa, che vanno interpretati dal sistema software come _confidenziali_. In alcuni software sono gestiti da _sidecar_ di cifratura o di protezione particolari, mentre in altre circostanze, come Home Assistant, appunto, sono semplicemente gestite con maggiore cautela. Le chiavi API sono un tipico esempio di dati tipici da gestire con le secrets:  non vanno mai scritte direttamente nei file di configurazione, perché `configuration.yaml` e i file correlati possono finire accidentalmente in un repository git o in un backup condiviso o in file di log. Ma, d'altro canto, nemmeno sono chiavi _così_ importanti da richiedere {% xlink "https://gist.github.com/sondalex/70d279d6fd21af6814e119b8e83392e0" "keyring"%}, {% xlink "https://oneuptime.com/blog/post/2026-02-23-how-to-use-terraform-with-vault-for-secret-management/view" "Vault" %} e altre soluzioni sofisticate. La soluzione di compromesso è semplicemente quella di riportarla nel file `secrets.yaml`:

```yaml
# secrets.yaml
nasa_api_key: "la_tua_chiave_api_qui"
```

e nella configurazione si usa il riferimento con questa sintassi specifica:

```yaml
resource: "https://api.nasa.gov/planetary/apod?api_key=!secret nasa_api_key"
```

Chiaramente `secrets.yaml` non va mai committato su git — aggiungilo al `.gitignore` se usi il controllo versione per la tua configurazione HA. Ci tengo, però, a precisare che la protezione delle secrets in Home Assistant, non va molto oltre quanto appena spiegato. Non è pensato, ripeto che non si sa mai, per dati _veramente, veramente_ confidenziali e preziosi. 

### Il REST sensor

La risposta dell'API APOD ha questa struttura:

```json
{
  "date": "2026-05-10",
  "title": "Nome della foto",
  "url": "https://apod.nasa.gov/apod/image/...",
  "explanation": "Testo della spiegazione...",
  "media_type": "image",
  "hdurl": "https://apod.nasa.gov/apod/image/...hd.jpg"
}
```

Non ha senso scomodare un `multiscape` per un parsing così semplice, piuttosto stavolta costruiamo  un semplice sensore REST per la risposta APOD:

{% raw %}
```yaml
rest:
  - resource: "https://api.nasa.gov/planetary/apod?api_key=!secret nasa_api_key"
    scan_interval: 3600
    sensor:
      - unique_id: nasa_apod
        name: "NASA APOD"
        value_template: "{{ value_json.title }}"
        json_attributes:
          - url
          - explanation
          - date
          - media_type
          - hdurl
```
{% endraw %}

Lo `state` del sensore è il titolo della foto — leggibile come badge o nel `show_state` della card. Gli attributi contengono tutto il resto. Il `scan_interval: 3600` aggiorna ogni ora (l'APOD cambia una volta al giorno alle 00:00 UTC, ma è meglio aggiornare più spesso per non perdere il cambio).


### Generic Camera per l'immagine

Esattamente come per il disco lunare, uso una {% xlink "https://www.home-assistant.io/integrations/generic/" "Generic Camera" role="tool" context="enables-step" target="external-authoritative" %} per mostrare l'immagine:

In *Impostazioni → Dispositivi e servizi → Generic Camera*, nel campo **Still Image URL**:

```
{% raw %}{{ state_attr('sensor.nasa_apod', 'url') }}{% endraw %}
```

Questo crea `camera.apod_nasa_gov` (il nome, ovviamente, è libero). La camera si aggiorna automaticamente ogni volta che il sensore REST scarica un nuovo URL.

{% cloudinary /assets/images/home-assistant-generic-camera.png alt="Pannello di configurazione di Generic Camera" caption="Configuriamo la fotocamera generica come tipo a immagine fissa, passando il template del sensore con l'URL diretto della foto" loading="lazy" role="screenshot", context="result" %}

### La card nella dashboard

Da qui in poi è tutta discesa. Una semplice `picture-entity`

{% raw %}
```yaml
type: picture-entity
entity: sensor.nasa_apod
camera_image: camera.apod_nasa_gov
camera_view: live
show_name: true
show_state: true
tap_action:
  action: more-info
  entity: camera.apod_nasa_gov
```
{% endraw %}

![alt text](image.png)

{% cloudinary /assets/images/home-assistant-apod.png alt="Astronomical picture of the day" caption="La scheda finita, con l'immagine e la descrizione subito sotto" loading="lazy" role="screenshot", context="result" %}

Il `tap_action` punta all'entità della **camera**, non al sensore. Questo è il dettaglio chiave: se si lascia il comportamento predefinito (more-info del sensore), il tap apre il pannello del sensore con i valori degli attributi — utile, ma non spettacolare. Puntando la `tap_action` alla camera, il tap apre il modale della camera con l'immagine a tutta larghezza, che è quello che vogliamo.

**Nota importante**: quando `media_type` è `video` (accade circa 2-3 volte al mese, quando l'APOD del giorno è un video YouTube), l'URL punta a un embed video e non a un'immagine. La Generic Camera non può mostrare un video e quando ciò accade la card rimane vuota. Se vuoi gestire questo caso, puoi aggiungere un template sensor che restituisce un'immagine placeholder quando `media_type != 'image'`.

Come dite? Quando questo accade recuperare il video da YouTube, encodarlo con ffmpeg e renderlo disponibile tramite {% xlink "https://jellyfin.org/" "il media server" role="citation" context="supports-claim" target="internal" %} direttamente connesso a HA? Si, in effetti è una bella idea! _Inutilmente_ complicata...e per questo divertente! Ci penserò!

### La spiegazione in Markdown

Torniamo alla realizzazione del bloggo APOD. Sotto l'immagine aggiungo una card Markdown che mostra la spiegazione dell'APOD, recuperata dall'attributo del sensore:

{% raw %}
```yaml
type: markdown
content: "{{ state_attr('sensor.nasa_apod', 'explanation') }}"
card_mod:
  style: |
    ha-markdown {
      font-size: var(--body-font-size);
      line-height: 1.6;
    }
```
{% endraw %}

Il template Jinja2 `{% raw %}{{ state_attr(...) }}{% endraw %}` funziona direttamente nel campo `content` delle card Markdown. {% xlink "https://github.com/thomasloven/lovelace-card-mod" "card_mod" role="tool" context="enables-step" target="external-authoritative" %}, che se siete qui su questo blog quasi certamente avete, permette di sovrascrivere lo stile CSS per un'interlinea più leggibile sul testo lungo o per altri adattamenti stilistici che la sorgente NASA non ha (l'ho già detto che il sito è...longevo?).

---

## La ISS in tempo reale

La Stazione Spaziale Internazionale orbita la Terra ogni 90 minuti a circa 400 km di quota e 27.600 km/h. È visibile a occhio nudo nelle ore crepuscolari come un punto luminoso che attraversa il cielo in 3-4 minuti, più brillante di qualunque stella. Per chi vuole fotografarla o semplicemente vederla passare, sapere la sua posizione attuale e la sua quota è il primo passo per pianificare un avvistamento. Ma, più poeticamente, averla in dashboard non è che un fulgido modo per ricordarci cosa l'umanità è in grado di fare se ci si mette di buzzo buono.

### La fonte dati: wheretheiss.at

L'API {% xlink "https://wheretheiss.at" "Where the ISS At?" role="tool" context="enables-step" target="external-authoritative" %} è pubblica, gratuita e non richiede autenticazione. Viene interrogato passando a parametro il {% xlink "https://en.wikipedia.org/wiki/Satellite_Catalog_Number" "NORAD ID" role="definition" context="provides-context" target="external-authoritative" %} per i corpi in orbita. Il satellite 25544 è il NORAD ID della ISS:

```
https://api.wheretheiss.at/v1/satellites/25544
```

La risposta:

```json
{
  "latitude": 45.12,
  "longitude": 9.34,
  "altitude": 418.5,
  "velocity": 27580.4,
  "visibility": "daylight"
}
```

### Configurazione multiscrape

Come non detto, qui, invece, ho di nuovo usato **multiscrape**. Il punto è che avevo bisogno di creare più sensori da un singolo endpoint, ma volevo farlo evitando di fare più richieste allo stesso endpoint:

{% raw %}
```yaml
multiscrape:
  - name: "International Space Station"
    resource: "https://api.wheretheiss.at/v1/satellites/25544"
    scan_interval: 60
    sensor:
      - unique_id: iss
        name: "International Space Station"
        value_template: "OK"
        attributes:
          - name: latitude
            value_template: "{{ value_json.latitude | default('') }}"
          - name: longitude
            value_template: "{{ value_json.longitude | default('') }}"
          - name: altitude
            value_template: "{{ value_json.altitude | default('') }}"
          - name: velocity
            value_template: "{{ value_json.velocity | default('') }}"
          - name: visibility
            value_template: "{{ value_json.visibility | default('') }}"

      - unique_id: iss_velocity
        name: "International Space Station - Velocity"
        value_template: "{{ value_json.velocity }}"
        unit_of_measurement: "km/h"

      - unique_id: iss_altitude
        name: "International Space Station - Altitude"
        value_template: "{{ value_json.altitude }}"
        unit_of_measurement: "km"
```
{% endraw %}

{% cloudinary /assets/images/home-assistant-iis.png alt="Badge IIS, con velocità e altitudine" caption="Ho deciso di creare due piccole pills, o badge, nella parte superiore del dashboard con le informazioni di velocità istantanea e altitudine della Stazione Spaziale Internazionale. Non credevo dovessero occupare più spazio di così" loading="lazy" role="screenshot", context="result" %}

Alcune note:

- **`scan_interval: 60`**: La ISS si sposta di circa 460 km al minuto. Aggiornare ogni 60 secondi è un buon compromesso tra precisione e carico sull'API (che non ha rate limit documentati, ma va rispettata).
- **Sensore principale con attributi**: Il sensore `iss` ha come `state` il valore statico `"OK"` (un segnaposto) e porta tutti i dati come attributi. Questo è utile quando si vuole visualizzare più dati della stessa risorsa in un'unica entità — per esempio in un `entity` card che mostra latitudine, longitudine e quota in un colpo solo.
- **Sensori separati per velocità e quota**: Avere `iss_velocity` e `iss_altitude` come entità indipendenti permette di mostrarli come `tile` card, con icona e unità di misura, o di usarli in grafici e automatizzazioni (_qualche idea a riguardo, a proposito?_).

---

## Prossimi lanci spaziali

I lanci spaziali sono diventati eventi frequenti: SpaceX, Rocket Lab, ULA e altre aziende lanciano decine di missioni all'anno. Molte sono visibili a occhio nudo se si abita nella giusta latitudine e nel momento giusto (spoiler: no, noi in Italia no) — e anche chi non può vederli dal vivo può seguirli in streaming. Sapere cosa sta per partire, quando e verso quale destinazione aggiunge un livello di contesto all'osservazione del cielo notturno.

### La fonte dati: RocketLaunch.Live

{% xlink "https://rocketlaunch.live" "RocketLaunch.Live" role="tool" context="enables-step" target="external-authoritative" %} offre un'API JSON gratuita per i prossimi lanci. Non voglio esagerare in dashboard, quindi recupero solo i due lanci più imminenti:

```
https://fdo.rocketlaunch.live/json/launches/next/2
```

La struttura è un oggetto con un campo `result` che contiene un array di lanci. Per ogni lancio sono disponibili dozzine di campi: provider, veicolo, rampa di lancio, destinazione, missioni, finestra di lancio, link, tag. La risposta non è facilmente scomponibile: ho dovuto elencare tutti i campi. Due volte. Multiscape, stavolta, è stato praticamente indispensabile:

{% raw %}
```yaml
multiscrape:
  - name: "Rocket Launch - Next 2"
    resource: "https://fdo.rocketlaunch.live/json/launches/next/2"
    scan_interval: 43200
    sensor:
      - unique_id: rocketlaunch_live_next_1
        name: "Rocket Launch - Next 1"
        value_template: "{{ value_json.result[0].name }}"
        attributes:
          - name: Provider
            value_template: "{{ value_json.result[0].provider.name }}"
          - name: Vehicle
            value_template: "{{ value_json.result[0].vehicle.name }}"
          - name: Pad
            value_template: "{{ value_json.result[0].pad.name }}"
          - name: Pad Location
            value_template: "{{ value_json.result[0].pad.location.name }}"
          - name: Pad Location Country
            value_template: >-
              {{ value_json.result[0].pad.location.statename }}
              {{ value_json.result[0].pad.location.country }}
          - name: Missions
            value_template: >-
              {{ value_json.result[0].missions
                 | map(attribute='name') | join(', ') }}
          - name: Launch Description
            value_template: "{{ value_json.result[0].launch_description }}"
          - name: Date
            value_template: "{{ value_json.result[0].date_str }}"
          - name: Date Exact
            value_template: "{{ value_json.result[0].win_open }}"
          - name: Tags
            value_template: >-
              {{ value_json.result[0].tags
                 | map(attribute='text') | join(' / ') }}
          - name: Link
            value_template: >-
              {{ value_json.result[0].quicktext
                 | regex_replace(find='.*(?=http)', replace='')
                 | regex_replace(find=' for info.*', replace='') }}

      - unique_id: rocketlaunch_live_next_2
        name: "Rocket Launch - Next 2"
        value_template: "{{ value_json.result[1].name }}"
        attributes:
          - name: Provider
            value_template: "{{ value_json.result[1].provider.name }}"
          - name: Vehicle
            value_template: "{{ value_json.result[1].vehicle.name }}"
          - name: Pad
            value_template: "{{ value_json.result[1].pad.name }}"
          - name: Pad Location
            value_template: "{{ value_json.result[1].pad.location.name }}"
          - name: Pad Location Country
            value_template: >-
              {{ value_json.result[1].pad.location.statename }}
              {{ value_json.result[1].pad.location.country }}
          - name: Missions
            value_template: >-
              {{ value_json.result[1].missions
                 | map(attribute='name') | join(', ') }}
          - name: Launch Description
            value_template: "{{ value_json.result[1].launch_description }}"
          - name: Date
            value_template: "{{ value_json.result[1].date_str }}"
          - name: Date Exact
            value_template: "{{ value_json.result[1].win_open }}"
          - name: Tags
            value_template: >-
              {{ value_json.result[1].tags
                 | map(attribute='text') | join(' / ') }}
          - name: Link
            value_template: >-
              {{ value_json.result[1].quicktext
                 | regex_replace(find='.*(?=http)', replace='')
                 | regex_replace(find=' for info.*', replace='') }}
```
{% endraw %}

{% cloudinary /assets/images/home-assistant-lanci.png alt="I prossimi due lanci spaziali" caption="Il box con il bollettino dei lanci è semplice, ma efficace" loading="lazy" role="screenshot", context="result" %}

Alcuni dettagli che meritano spiegazione:

**`scan_interval: 43200`** — 12 ore. I lanci spaziali non cambiano finestra con frequenza così alta e l'API gratuita ha limitazioni di utilizzo. Aggiornare due volte al giorno è più che sufficiente.

**`| map(attribute='name') | join(', ')`** — I campi `missions` e `tags` sono array di oggetti. Il filtro `map` estrae un campo da ciascun oggetto, e `join` li concatena in una stringa leggibile.

**Il `regex_replace` per il link** — Il campo `quicktext` di RocketLaunch.Live non contiene solo l'URL ma del testo in prosa del tipo: *"Follow SpaceX on Twitter for info: https://t.co/..."*. La prima `regex_replace` usa un lookahead (`.*(?=http)`) per eliminare tutto quello che precede il protocollo `http`. La seconda elimina la parte finale ` for info...` che talvolta segue l'URL. Il risultato è l'URL pulito, usabile come link nella card.

{% cloudinary /assets/images/astrometria-dashboard.png alt="La dashboard di astrometria" caption="Ed eccoci al termine del nostro viaggio, con il dashboard che dovrebbe risultare più o meno così." %}

---

## Riepilogo della serie

In tre articoli abbiamo costruito una dashboard di astrometria completa in Home Assistant, usando esclusivamente fonti pubbliche e gratuite. Il bello di questo tipo di progetto è che può crescere indefinitamente: ogni API pubblica che restituisce dati astronomici può diventare un nuovo sensore, ogni sensore può diventare una card, ogni card può diventare un'automazione. {% xlink "https://www.youtube.com/watch?v=mt3MVP3FizQ" "E il cielo come limite!" role="citation" %}


