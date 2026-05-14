---
category: Home Assistant
title: "Il cielo in salotto, parte 3: Spazio Profondo e Bollettini"
excerpt: "La terza e ultima sezione della dashboard di astrometria: l'immagine astronomica del giorno NASA (APOD) con API key e secrets.yaml, la posizione in tempo reale della ISS con multiscrape, e i prossimi lanci spaziali. Come integrare tutto in Home Assistant con REST sensor, Generic Camera e multiscrape."
header:
  overlay_image: /assets/images/home-assistant-overlay.jpg
  overlay_filter: 0.5
---

{% assign part1_post = site.posts | where: "url", "/home-assistant/dashboard-astrometria-parte-1/" | first %}
{% assign part2_post = site.posts | where: "url", "/home-assistant/dashboard-astrometria-parte-2/" | first %}
{% if part1_post and part2_post %}
Nella [prima parte]({{ part1_post.url | relative_url }}) abbiamo costruito il modulo Terra-Luna, nella [seconda]({{ part2_post.url | relative_url }}) abbiamo monitorato il Sole. In questa terza e ultima parte ci spingiamo oltre: lo spazio profondo, la stazione spaziale e i razzi che la raggiungono.
{% elsif part1_post %}
Nella [prima parte]({{ part1_post.url | relative_url }}) abbiamo costruito il modulo Terra-Luna, nella seconda abbiamo monitorato il Sole. In questa terza e ultima parte ci spingiamo oltre: lo spazio profondo, la stazione spaziale e i razzi che la raggiungono.
{% elsif part2_post %}
Nella prima parte abbiamo costruito il modulo Terra-Luna, nella [seconda]({{ part2_post.url | relative_url }}) abbiamo monitorato il Sole. In questa terza e ultima parte ci spingiamo oltre: lo spazio profondo, la stazione spaziale e i razzi che la raggiungono.
{% else %}
Nella prima parte abbiamo costruito il modulo Terra-Luna, nella seconda abbiamo monitorato il Sole. In questa terza e ultima parte ci spingiamo oltre: lo spazio profondo, la stazione spaziale e i razzi che la raggiungono.
{% endif %}

---

## APOD: l'Immagine Astronomica del Giorno

### Perché

Il **APOD** (Astronomy Picture of the Day) è probabilmente il sito di divulgazione astronomica più visitato al mondo. Attivo dal 16 giugno 1995, pubblica ogni giorno un'immagine astronomica diversa — fotografie di galassie, nebulose, eclissi, aurore, pianeti — con una spiegazione scritta da un astrofisico professionista. È una finestra quotidiana sull'universo accessibile a tutti.

Avere l'APOD del giorno in dashboard, con immagine e didascalia, trasforma Home Assistant in qualcosa di più di un pannello domotico: diventa un'interfaccia verso il cosmo.

### L'API NASA

La NASA mette a disposizione un'API pubblica e documentata per l'APOD all'indirizzo `https://api.nasa.gov/planetary/apod`. Richiede una chiave API che si ottiene gratuitamente registrandosi su [api.nasa.gov](https://api.nasa.gov).

Esiste anche una chiave `DEMO_KEY` che funziona senza registrazione, ma è soggetta a limiti di utilizzo più stringenti (30 richieste/ora, 50/giorno). Per un'installazione casalinga che interroga l'API una volta al giorno, la `DEMO_KEY` è sufficiente, ma consiglio di richiedere una chiave personale: è gratis e si ottiene in pochi minuti.

### Proteggere la chiave: secrets.yaml

In Home Assistant, le chiavi API non vanno mai scritte direttamente nei file di configurazione, perché `configuration.yaml` e i file correlati possono finire accidentalmente in un repository git o in un backup condiviso. La soluzione è `secrets.yaml`:

```yaml
# secrets.yaml
nasa_api_key: "la_tua_chiave_api_qui"
```

e nella configurazione si usa il riferimento:

```yaml
resource: "https://api.nasa.gov/planetary/apod?api_key=!secret nasa_api_key"
```

`secrets.yaml` non va mai committato su git — aggiungilo al `.gitignore` se usi il controllo versione per la tua configurazione HA.

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

Il sensore REST che costruisce il sensore APOD:

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

Lo `state` del sensore è il titolo della foto — leggibile come badge o nel `show_state` della card. Gli attributi contengono tutto il resto. Il `scan_interval: 3600` aggiorna ogni ora (l'APOD cambia una volta al giorno alle 00:00 UTC, ma è meglio aggiornare più spesso per non perdere il cambio).

**Nota importante**: quando `media_type` è `video` (accade circa 2-3 volte al mese, quando l'APOD del giorno è un video YouTube), l'URL punta a un embed video e non a un'immagine. La Generic Camera non può mostrare un video. Se vuoi gestire questo caso, puoi aggiungere un template sensor che restituisce un'immagine placeholder quando `media_type != 'image'`.

### Generic Camera per l'immagine

Esattamente come per il disco lunare, uso una **Generic Camera** per mostrare l'immagine:

In *Impostazioni → Dispositivi e servizi → Generic Camera*, nel campo **Still Image URL**:

```
{{ state_attr('sensor.nasa_apod', 'url') }}
```

Questo crea `camera.apod_nasa_gov` (il nome lo scegli tu in fase di configurazione). La camera si aggiorna automaticamente ogni volta che il sensore REST scarica un nuovo URL.

### La card nella dashboard

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

Il `tap_action` punta all'entità della **camera**, non al sensore. Questo è il dettaglio chiave: se si lascia il comportamento predefinito (more-info del sensore), il tap apre il pannello del sensore con i valori degli attributi — utile, ma non spettacolare. Puntando la `tap_action` alla camera, il tap apre il modale della camera con l'immagine a tutta larghezza, che è quello che vogliamo.

### La spiegazione in Markdown

Sotto l'immagine aggiungo una card Markdown che mostra la spiegazione dell'APOD, recuperata dall'attributo del sensore:

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

Il template Jinja2 `{{ state_attr(...) }}` funziona direttamente nel campo `content` delle card Markdown. `card_mod` (un'altra card HACS) permette di sovrascrivere lo stile CSS per un'interlinea più leggibile sul testo lungo.

---

## La ISS in tempo reale

### Perché

La Stazione Spaziale Internazionale orbita la Terra ogni 90 minuti a circa 400 km di quota e 27.600 km/h. È visibile a occhio nudo nelle ore crepuscolari come un punto luminoso che attraversa il cielo in 3-4 minuti, più brillante di qualunque stella. Per chi vuole fotografarla o semplicemente vederla passare, sapere la sua posizione attuale e la sua quota è il primo passo per pianificare un avvistamento.

### La fonte dati: wheretheiss.at

L'API [Where the ISS At?](https://wheretheiss.at) è pubblica, gratuita e non richiede autenticazione. Il satellite 25544 è il NORAD ID della ISS:

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

Con **multiscrape** posso creare più sensori da una singola chiamata API, evitando di fare più richieste allo stesso endpoint:

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

Alcune note:

- **`scan_interval: 60`**: La ISS si sposta di circa 460 km al minuto. Aggiornare ogni 60 secondi è un buon compromesso tra precisione e carico sull'API (che non ha rate limit documentati, ma va rispettata).
- **`| default('')`**: Il filtro Jinja2 `default('')` evita che il sensore vada in `unavailable` se un campo della risposta JSON mancasse per qualsiasi motivo — risposta incompleta, API momentaneamente sovraccarica, ecc. Senza questo filtro, un valore `null` causerebbe un errore di template.
- **Sensore principale con attributi**: Il sensore `iss` ha come `state` il valore statico `"OK"` (un segnaposto) e porta tutti i dati come attributi. Questo è utile quando si vuole visualizzare più dati della stessa risorsa in un'unica entità — per esempio in un `entity` card che mostra latitudine, longitudine e quota in un colpo solo.
- **Sensori separati per velocità e quota**: Avere `iss_velocity` e `iss_altitude` come entità indipendenti permette di mostrarli come `tile` card, con icona e unità di misura, o di usarli in grafici e automatizzazioni.

---

## Prossimi lanci spaziali

### Perché

I lanci spaziali sono diventati eventi frequenti: SpaceX, Rocket Lab, ULA e altre aziende lanciano decine di missioni all'anno. Molte sono visibili a occhio nudo se si abita nella giusta latitudine e nel momento giusto — e anche chi non può vederli dal vivo può seguirli in streaming. Sapere cosa sta per partire, quando e verso quale destinazione aggiunge un livello di contesto all'osservazione del cielo notturno.

### La fonte dati: RocketLaunch.Live

**[RocketLaunch.Live](https://rocketlaunch.live)** offre un'API JSON gratuita per i prossimi lanci. L'endpoint per i due lanci più imminenti:

```
https://fdo.rocketlaunch.live/json/launches/next/2
```

La struttura è un oggetto con un campo `result` che contiene un array di lanci. Per ogni lancio sono disponibili dozzine di campi: provider, veicolo, rampa di lancio, destinazione, missioni, finestra di lancio, link, tag.

### Configurazione multiscrape

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

Alcuni dettagli che meritano spiegazione:

**`scan_interval: 43200`** — 12 ore. I lanci spaziali non cambiano finestra con frequenza così alta e l'API gratuita ha limitazioni di utilizzo. Aggiornare due volte al giorno è più che sufficiente.

**`| map(attribute='name') | join(', ')`** — I campi `missions` e `tags` sono array di oggetti. Il filtro `map` estrae un campo da ciascun oggetto, e `join` li concatena in una stringa leggibile. Senza questo passaggio si avrebbe la rappresentazione grezza dell'array Python.

**Il `regex_replace` per il link** — Il campo `quicktext` di RocketLaunch.Live non contiene solo l'URL ma del testo in prosa del tipo: *"Follow SpaceX on Twitter for info: https://t.co/..."*. La prima `regex_replace` usa un lookahead (`.*(?=http)`) per eliminare tutto quello che precede il protocollo `http`. La seconda elimina la parte finale ` for info...` che talvolta segue l'URL. Il risultato è l'URL pulito, usabile come link nella card.

---

## Riepilogo della serie

In tre articoli abbiamo costruito una dashboard di astrometria completa in Home Assistant, usando esclusivamente fonti pubbliche e gratuite:

| Modulo | Componente | Fonte |
|---|---|---|
| **Terra-Luna** | Integrazione Moon | Calcolo locale HA |
| | Disco lunare | NASA SVS API |
| | Carta lunare | custom:lunar-phase-card |
| | Diario ISS | event.space_station |
| **Sol** | Simulatore 3D | NASA Eyes on Solar System |
| | SOHO Lasco C3 | NASA SOHO |
| | GOES-16 SUVI | NOAA |
| | Aurora OVATION | NOAA SWPC |
| | Radio Flux, Vento Solare, Kp | NOAA SWPC |
| | Grafici BT/BZ | NOAA SWPC DSCOVR |
| **Spazio Profondo** | APOD immagine + didascalia | NASA API |
| | ISS posizione | wheretheiss.at |
| | Prossimi lanci | RocketLaunch.Live |

Il bello di questo tipo di progetto è che può crescere indefinitamente: ogni API pubblica che restituisce dati astronomici può diventare un nuovo sensore, ogni sensore può diventare una card, ogni card può diventare un'automazione. Il cielo, letteralmente, è il limite.
