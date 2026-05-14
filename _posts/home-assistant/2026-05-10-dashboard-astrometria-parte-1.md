---
category: Home Assistant
title: "Il cielo in salotto, parte 1: Sistema Terra-Luna"
excerpt: "Come costruire una dashboard di astrometria in Home Assistant per tenere d'occhio la Luna, il Sole e lo spazio profondo. Prima parte: l'architettura generale e il modulo Terra-Luna, con disco lunare in tempo reale via API NASA, template sensor per il formato data NASA e il sensore di fase lunare con icone e immagine dinamica."
header:
  overlay_image: /assets/images/dashboard-astrometria-header.png
  overlay_filter: 0.5
---

Ci sono progetti che iniziano con un'idea semplice e finiscono per diventare qualcosa di più grande. Questo è uno di quelli. Tutto è partito da una domanda banale: *posso sapere dalla mia dashboard di Home Assistant in che fase è la Luna stasera?* La risposta è ovviamente sì — ma una volta aperta quella porta, è difficile fermarsi.

Quello che descrivo in questa serie di articoli è una dashboard di **astrometria** — una parola un po' altisonante per dire: uno schermo dedicato a tutto quello che succede sopra la nostra testa, dai cicli lunari all'attività solare, dalle aurore boreali ai prossimi lanci spaziali. Non è un progetto per astronomi professionisti e il suo scopo è sicuramente divulgativo, in particolare per incuriosire i miei due bambini. Tuttavia, non è nemmenod el tutto inutile: astrofili, appassionati di astrofotografia, o semplicemente chi vuole sapere se stasera vale la pena alzare lo sguardo potrebbero trovarvi informazioni utili.

La dashboard è divisa in tre sezioni:

1. **Sistema Terra-Luna** — la Luna, il sole che tramonta (questa prima parte)
2. **Sol** — immagini live del Sole, aurora boreale, vento solare (parte 2)
3. **Spazio profondo e bollettini** — l'immagine del giorno NASA (APOD), posizione della ISS, prossimi lanci (parte 3)

{% figure caption:"Al termine di questa serie di articoli, l'aspetto del dashboard sarà - speriamo - più o meno questo" %}
![La dashboard di astrometria](/assets/images/astrometria-dashboard.png)
{% endfigure %}

## Cosa serve: le integrazioni HACS

Prima di entrare nel merito, elenco le card custom installate via [HACS](https://hacs.xyz) che vengono usate in questa o nelle prossime parti:

- **`custom:lunar-phase-card`** — visualizza la fase lunare con grafico dell'arco celeste
- **`custom:button-card`** — card altamente configurabile, usata per le tile con immagine live (parti 2 e 3)
- **`custom:apexcharts-card`** — grafici per i dati del vento solare (parte 2)

Tutte le altre integrazioni (REST sensor, Generic Camera, multiscrape) sono native o disponibili tramite HACS come integrazione, non come card.

---

## La Luna

### Perché

La Luna è l'oggetto celeste più osservato e fotografato da sempre. Per un astrofilo o un appassionato di astrofotografia, la fase lunare è una variabile critica: la notte di luna piena è splendida da guardare a occhio nudo, ma rende quasi inutili le sessioni di deep sky a causa della luce diffusa. Sapere in anticipo la fase e l'orario del tramonto del sole (che definisce l'inizio della notte astronomica) permette di pianificare le sessioni di osservazione con precisione.

### L'integrazione `moon` nativa

Home Assistant include di serie un'integrazione chiamata semplicemente **Moon** che calcola localmente, senza dipendenze esterne, la fase lunare corrente. Si abilita da *Impostazioni → Dispositivi e servizi → Aggiungi integrazione* cercando "Moon", oppure aggiungendo una riga al `configuration.yaml`:

```yaml
moon:
```

Questo crea l'entità `sensor.moon` con stati come `new_moon`, `waxing_crescent`, `first_quarter`, `waxing_gibbous`, `full_moon`, `waning_gibbous`, `last_quarter`, `waning_crescent`. 

È la base dati, ma da sola non basta per visualizzare il disco lunare attuale, esteticamente molto più gradevole da mostrare in dashbard. Per quello, ci serve una fonte fotografica.

### Il disco lunare in tempo reale: API NASA SVS

La NASA mette a disposizione un'API pubblica e gratuita nel suo set di endpoint **SVS (Scientific Visualization Studio)** e che restituisce, per ogni ora, l'immagine esatta del disco lunare vista dalla Terra, completa di angolo di librazione, illuminazione e fase. L'endpoint è:

```
https://svs.gsfc.nasa.gov/api/dialamoon/{YYYY-MM-DDTHH:MM}
```

dove la data e l'ora vanno passate in formato ISO 8601. La risposta JSON contiene, tra le varie cose, proprio l'informazione che ci serve:

```json
{
  "image": {
    "url": "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005190/frames/730x730_1x1_30p/moon.XXXX.jpg"
  }
}
```

Quindi `value_json.image.url` è l'URL dell'immagine PNG del disco lunare per quell'istante.

Il problema è il formato della data: l'API si aspetta `2026-05-10T14:00`, ma i template Jinja2 di HA hanno `now()` che restituisce un oggetto datetime completo. Serve un passo intermedio.

### Il sensore template per la data

Creo un **template sensor** che formatta la data corrente nel formato esatto richiesto dall'API:

{% raw %}
```yaml
template:
  - sensor:
      - unique_id: datetime_universal_nasa
        name: "Data e Ora (formato REST NASA)"
        state: >
          {{ now().strftime('%Y-%m-%dT%H:%M') }}
        attributes:
          template: space
```
{% endraw %}

Questo crea `sensor.datetime_universal_nasa` che aggiorna il suo stato ogni minuto con il timestamp corrente nel formato giusto. L'attributo `template: space` è un'etichetta libera che uso per raggruppare logicamente i sensori legati al tema astronomico — non ha impatto funzionale, ma torna utile per filtrare le entità nella UI. Come spesso accade, la scelta se realizzare il sensore template da UI piuttosto che da Yaml è molto personale e del tutto equivalente.

### Il REST sensor per il disco lunare

Ora uso questo sensore come parte dell'URL nella `resource_template` del REST sensor. Questo, invece, ad oggi può essere solo configurato tramite Yaml:

{% raw %}
```yaml
rest:
  - platform: rest
    unique_id: nasa_moon_phase
    resource_template: >-
      https://svs.gsfc.nasa.gov/api/dialamoon/{{
        states('sensor.datetime_universal_nasa')
        if states('sensor.datetime_universal_nasa') not in ['unknown', 'unavailable']
        else now().strftime('%Y-%m-%dT%H:%M')
      }}
    name: Nasa Moon Phase Info
    value_template: "{{ value_json.image.url }}"
    json_attributes:
      - image
```
{% endraw %}

Due cose degne di nota:

- **Il fallback**: se il sensore della data non è ancora disponibile al boot, uso `now().strftime(...)` direttamente nella `resource_template`. Questo evita che il sensore vada in `unavailable` durante l'avvio di HA, sporcando il log di avvio.
- **`json_attributes: [image]`**: salvo l'intero oggetto `image` come attributo del sensore, non solo l'URL. Questo mi permette di accedere a tutti i campi restituiti dall'API in futuro senza modificare la configurazione.

Il sensore `sensor.nasa_moon_phase_info` avrà come `state` l'URL dell'immagine del disco lunare aggiornata all'ora corrente.

### Generic Camera: mostrare l'immagine

Un REST sensor restituisce testo (l'URL), non l'immagine stessa. Per mostrare l'immagine nella dashboard serve una **Generic Camera**.

L'integrazione **Generic Camera** (o *Still Image Camera*) di Home Assistant crea un'entità `camera.*` che scarica periodicamente un'immagine da un URL statico o dinamico e la espone come stream video o still image. La si aggiunge da *Impostazioni → Dispositivi e servizi → Generic Camera* e nel campo **Still Image URL** si inserisce un template Jinja2 molto semplice:

{% raw %}
```
{{ states('sensor.nasa_moon_phase_info') }}
```
{% endraw %}

oppure, equivalentemente:

{% raw %}
```
{{ state_attr('sensor.nasa_moon_phase_info', 'value') }}
```
{% endraw %}

Questo crea `camera.fasi_lunari_nasa` (il nome si può scegliere in fase di configurazione). La camera aggiorna l'immagine ogni volta che lo stato del sensore cambia — che avviene ogni ora, allineato con l'ora astronomica.

Nella dashboard, una card `picture-entity` che punta a questa camera mostra il disco lunare aggiornato:

```yaml
type: picture-entity
entity: sensor.fasi_lunari
camera_image: camera.fasi_lunari_nasa
camera_view: auto
show_name: true
show_state: true
```

Ho completato aggiungendo nell'heading della sezione un badge con `sensor.sun_next_dusk`: l'orario del prossimo crepuscolo astronomico. È una piccola aggiunta, ma molto pratica: guardando la dashboard so immediatamente a che ora inizia il buio utile per l'osservazione. Il sensore `sun.sun` espone automaticamente questi attributi tramite l'integrazione sole nativa di HA. Questo, per praticità, l'intero codice dell'intestazione di sezione

```yaml
type: heading
icon: mdi:earth
heading_style: title
heading: "Sistema Terra-Luna"
badges:
  - type: entity
    entity: sensor.sun_next_dusk
```

{% figure caption:"La foto della Luna può finalmente essere visualizzata in dashboard utilizzando una qualsiasi card che possa visualizzare un flusso di fotocamera." %}
![Il disco lunare](/assets/images/fasi-lunari.png)
{% endfigure %}

### La custom:lunar-phase-card

Il disco lunare è già un buon punto di partenza, ma la `custom:lunar-phase-card` aggiunge un livello di informazione in più: mostra l'arco celeste con la posizione della Luna, il grafico dell'altitudine nelle prossime ore, e i dati di fase, prossimo plenilunio, distanza dalla Terra e percentuale di illuminazione.

Si installa da HACS (Repository: *lunar-phase-card*). La configurazione per Milano:

```yaml
type: custom:lunar-phase-card
use_default: true
show_background: true
selected_language: it
default_card: horizon
moon_position: left
compact_view: false
12hr_format: false
number_decimals: 0
latitude: 45.4668
longitude: 9.1457
location:
  city: Milano
  country: Italia
graph_config:
  y_ticks: true
  x_ticks: true
  show_time: true
  show_current: true
  show_legend: false
  show_highest: true
  y_ticks_position: left
  y_ticks_step_size: 55
  time_step_size: 30
```

{% figure caption:"Card di sintesi della Luna" %}
![La Moon card](/assets/images/moon-card.png)
{% endfigure %}

`use_default: true` dice alla card di calcolare autonomamente la fase senza affidarsi a un sensore esterno — il che la rende indipendente dal REST sensor NASA e dal sensore `moon`. Questo è utile per avere ridondanza: anche se l'API NASA fosse irraggiungibile, la card continua a mostrare la fase calcolata internamente.

---

## Sensore fasi lunari con icona e immagine

Il sensore `sensor.moon_phase` dell'integrazione Moon restituisce valori interni in inglese (`new_moon`, `waxing_crescent`, ecc.). Per i **badge** e le **Mushroom card** — che mostrano nome, icona e immagine in modo visivamente curato — conviene costruire un template sensor dedicato che traduca questi valori in italiano, abbini l'icona MDI corretta e usi l'immagine NASA come `picture` dell'entità. Il risultato è un piccolo tocco di classe, esteticamente gradevole.

{% raw %}
```yaml
template:
  - sensor:
      - unique_id: moon_phase_anime
        name: "Fasi Lunari"
        state: >
          {% set phase = states('sensor.moon_phase') %}
          {% set moon_phases = {
              'new_moon': 'Luna nuova',
              'waxing_crescent': 'Primo crescente',
              'first_quarter': 'Primo quarto',
              'waxing_gibbous': 'Gibbosa crescente',
              'full_moon': 'Luna piena',
              'waning_gibbous': 'Gibbosa calante',
              'last_quarter': 'Ultimo quarto',
              'waning_crescent': 'Ultimo crescente'
            }
          %}
          {{ moon_phases[phase] if phase in moon_phases.keys() else 'Sconosciuto' }}
        picture: "{{ states('sensor.nasa_moon_phase_info') }}"
        icon: >
          {% set phase = states('sensor.moon_phase') %}
          {% set moon_icons = {
              'new_moon': 'mdi:moon-new',
              'waxing_crescent': 'mdi:moon-waning-crescent',
              'first_quarter': 'mdi:moon-first-quarter',
              'waxing_gibbous': 'mdi:moon-waxing-gibbous',
              'full_moon': 'mdi:moon-full',
              'waning_gibbous': 'mdi:moon-waning-gibbous',
              'last_quarter': 'mdi:moon-last-quarter',
              'waning_crescent': 'mdi:moon-waning-crescent'
            }
          %}
          {{ moon_icons[phase] if phase in moon_icons.keys() else 'mdi:moon-new' }}
```
{% endraw %}

{% figure caption:"Badge costruito a partire dal sensore. Notare l'immagine e le descrizioni in italiano" %}
![Badge fasi lunari](/assets/images/fasi-lunari-header.png)
{% endfigure %}

Alcune note:

- **`picture`**: l'attributo speciale `picture` di un template sensor sovrascrive l'icona con un'immagine. In questo caso punta allo stato di `sensor.nasa_moon_phase_info`, che come abbiamo visto contiene l'URL del disco lunare attuale. Mushroom card e chip card mostrano automaticamente questa immagine tonda al posto dell'icona — il risultato, come dicevo, è visivamente molto efficace.
- **`icon`**: mappa ogni fase sulla corrispondente icona `mdi:moon-*`. La libreria MDI include tutte le otto fasi. Quando `picture` è valorizzata la card usa quella, ma l'icona rimane disponibile come fallback o in contesti che non supportano `picture`.
- **Fallback `'Sconosciuto'` / `'mdi:moon-new'`**: il filtro `if phase in moon_phases.keys() else` protegge da stati transitori (`unknown`, `unavailable`) al boot o durante riavvii.
- **Relazione con gli altri sensori**: questo sensore è un *aggregatore* — non interroga API esterne, si limita a leggere `sensor.moon_phase` (nativo) e `sensor.nasa_moon_phase_info` (REST). Se l'API NASA fosse irraggiungibile, lo stato in italiano e l'icona continuerebbero a funzionare; mancherebbe solo l'immagine.

---

## Riepilogo

In questa prima parte abbiamo costruito il modulo **Sistema Terra-Luna**:

{% assign part2_post = site.posts | where: "url", "/home-assistant/dashboard-astrometria-parte-2/" | first %}
{% if part2_post %}
Nella [seconda parte]({{ part2_post.url | relative_url }}) ci sposteremo sul Sole: immagini live da SOHO e GOES-16, la previsione delle aurore boreali OVATION, e i dati dello spazio meteorologico con grafici BT/BZ in tempo reale.
{% else %}
Nella seconda parte ci sposteremo sul Sole: immagini live da SOHO e GOES-16, la previsione delle aurore boreali OVATION, e i dati dello spazio meteorologico con grafici BT/BZ in tempo reale.
{% endif %}
