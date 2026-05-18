---
category: Home Assistant
title: "Il cielo in salotto, parte 2: Sol"
excerpt: "La seconda sezione della dashboard di astrometria: immagini live del Sole da SOHO e GOES-16, la previsione delle aurore boreali OVATION, e i dati del vento solare con grafici in tempo reale tramite ApexCharts. Tutto da fonti pubbliche NASA e NOAA, senza API key."
master: /assets/images/astrometria-dashboard-distorci-2.png
broadcast:
  channels: [linkedin, mastodon]
header:
  overlay_filter: 0.5
---

Nella {% post_link /home-assistant/dashboard-astrometria-parte-1/ "prima parte" %} abbiamo costruito il modulo Terra-Luna. Ora ci spostiamo verso il centro del sistema solare: il **Sole**.

Il Sole non è un oggetto statico. È una stella attiva, percorsa da correnti di plasma, squarciata periodicamente da eruzioni gigantesche, capace di lanciare nello spazio ondate di particelle che raggiungono la Terra in pochi giorni e interferiscono con le nostre reti elettriche, le comunicazioni radio e, nei casi più spettacolari, producono aurore boreali visibili anche alle latitudini italiane. Monitorare l'attività solare non è puro esercizio accademico: è _space weather_, e può avere conseguenze molto concrete per un astrofilo e un astrofotografo.

Questa sezione della dashboard raccoglie tutto questo in un unico colpo d'occhio.

{% cloudinary /assets/images/astrometria-dashboard.png alt="La dashboard di astrometria" caption="Intanto, vi ricordo, questo è quello che ci prefiggiamo di ottenere e oggi ci concentreremo sulla colonna centrale" %}

---

## NASA Eyes on the Solar System

Prima di entrare nei dati quantitativi, ho voluto includere un elemento puramente visivo e divulgativo: **NASA Eyes on the Solar System**, un simulatore 3D interattivo sviluppato dalla NASA che mostra la posizione in tempo reale di pianeti, lune, sonde e asteroidi nel sistema solare.

È uno strumento straordinario per visualizzare le distanze cosmiche in modo intuitivo: puoi seguire la traiettoria del Voyager 1, ora a più di 23 miliardi di chilometri dalla Terra, oppure vedere dove si trova in questo momento il James Webb Space Telescope. Tutto in scala e in tempo reale.

Si incorpora nella dashboard tramite una card `iframe` che punta all'applicazione web della NASA. Non è esattamente l'integrazione più elegante che si sia mai vista in Lovelace, ma funziona:

```yaml
type: iframe
url: "https://eyes.nasa.gov/apps/solar-system/#/home?featured=JUNO"
aspect_ratio: 75%
```

**Nota**: l'applicazione richiede WebGL e su dispositivi mobili può risultare pesante o non interattiva. È pensata principalmente per una visualizzazione su schermo desktop o su un tablet di buona potenza.

---

## Immagini live del Sole

Qui non usiamo API Rest o servizi complessi, ma ci limitiamo a visualizzare gli stream media messi a disposizione della NASA o dal NOAA, manipolati con CSS per conformarmi visivamente all'aspetto del dashboard.

### Riutilizzare il markup Lovelace: button_card_templates

Per le immagini live ho scelto un approccio basato sui **template globali di `custom:button-card`**. L'idea è definire una volta sola uno stile "tile con immagine di sfondo" e riutilizzarlo per tutte le sorgenti visive, così da definire il markup una sola volta, in perfetto stile [DRY](https://www.geeksforgeeks.org/software-engineering/dont-repeat-yourselfdry-in-software-development/). I template si definiscono nella configurazione globale del dashboard Lovelace e, nel momento in cui scrivo, devono per forza essere definite in Yaml:

```yaml
button_card_templates:
  live_tile_card:
    show_icon: false
    show_name: true
    show_label: false
    styles:
      card:
        - border-radius: 12px
        - overflow: hidden
        - height: 180px
    custom_fields:
      picture: true

  live_tile_with_picture:
    template: live_tile_card
    custom_fields:
      picture: |
        [[[
          return `<div style="
            width: 100%;
            height: 100%;
            background-image: url('${variables.picture}');
            background-size: cover;
            background-position: center;
          "></div>`;
        ]]]
    styles:
      custom_fields:
        picture:
          - position: absolute
          - top: 0
          - left: 0
          - width: 100%
          - height: 100%
```

Ogni tile con immagine live diventa poi solo poche righe di configurazione, con la variabile `picture` che riceve l'URL dell'immagine. Vediamo subito gli esempi che popolano il nostro dashboard.

**Nota:** non tutti sanno che effettivamente è possibile accedere al file Yaml complessivo di un intero dashboard. Lo si fa dal menù modifica dashboard in alto a destra, da dove è raggiungibile l'editor di configurazione testuale. I templati vanno direttamente nel _root node_. 

### SOHO Lasco C3

**SOHO** (Solar and Heliospheric Observatory) è un satellite congiunto ESA-NASA in orbita attorno al punto di Lagrange L1 tra Terra e Sole, a circa 1,5 milioni di chilometri dalla Terra. Uno dei suoi strumenti più famosi è **LASCO C3**, un coronagrafo che oscura il disco solare (come un'eclissi artificiale) per rendere visibile la corona solare esterna. Le immagini vengono aggiornate ogni pochi minuti e rese disponibili pubblicamente dalla NASA.

Perché è utile? Il LASCO C3 è lo strumento primario per il rilevamento delle **CME** (Coronal Mass Ejection): espulsioni di miliardi di tonnellate di plasma che, quando sono dirette verso la Terra, possono causare tempeste geomagnetiche. Forse più utili per chi fa radioastronomia che astrofotografia, ma sono proprio belle da vedere in dashboard, questo è sicuro.

```yaml
type: custom:button-card
template:
  - live_tile_card
  - live_tile_with_picture
name: "SOHO Lasco C3"
color_type: icon
variables:
  picture: "https://sohowww.nascom.nasa.gov/data/realtime/c3/512/latest.jpg"
tap_action:
  action: none
```

### GOES-16 SUVI

**GOES-16** è il satellite meteorologico geostazionario americano. Oltre ai dati meteo, ospita a bordo il **SUVI** (Solar Ultraviolet Imager), che fotografa il Sole in ultravioletto a sei diverse lunghezze d'onda. La banda da 195 Å (Angstrom), che corrisponde a temperature coronali di circa 1,5 milioni di Kelvin, è quella standard per individuare le regioni attive, i filamenti e i brillamenti solari.

L'URL delle immagini più recenti è pubblico e aggiornato in tempo reale da NOAA:

```yaml
type: custom:button-card
template:
  - live_tile_card
  - live_tile_with_picture
name: "GOES-16 (SUVI)"
color_type: icon
variables:
  picture: "https://services.swpc.noaa.gov/images/animations/suvi/primary/195/latest.png"
tap_action:
  action: none
```

### Aurora OVATION

Il modello **OVATION** (Oval Variation, Assessment, Tracking, Intensity and Online Nowcasting) di NOAA è il sistema di nowcasting più usato per la previsione delle aurore boreali e australi. Produce ogni 30 minuti una mappa globale della probabilità di avvistamento aurorale basandosi sul vento solare misurato dai satelliti.

Per chi vive nell'Europa settentrionale, questa mappa è preziosissima: durante le tempeste geomagnetiche più intense (indice Kp ≥ 7), le aurore diventano visibili anche a latitudini sorprendentemente basse. Certo, la probabilità di osservare una aurora boreale, chessò, in Lombardia rimane piuttosto bassa (ma [meno bassa di quanto si credi](https://www.ilgiorno.it/cronaca/aurora-boreale-kdhk6hp7)) e proprio per questo avere questo indicatore in dashboard è importante per evitare di perdersi i momenti giusti.

```yaml
type: custom:button-card
template:
  - live_tile_card
  - live_tile_with_picture
name: "Aurora Boreale (OVATION)"
color_type: icon
variables:
  picture: "https://services.swpc.noaa.gov/images/animations/ovation-north/latest.jpg"
styles:
  custom_fields:
    picture:
      - background-size: "110% 110%"
tap_action:
  action: none
```

Il `background-size: 110% 110%` applica un leggero zoom che taglia il bordo bianco dell'immagine originale NOAA, migliorando la resa visiva nel tile.

Le tre tile vengono raggruppate in un `horizontal-stack`:

```yaml
type: horizontal-stack
cards:
  - # SOHO Lasco C3
  - # GOES-16 SUVI
  - # Aurora OVATION
```

{% cloudinary /assets/images/astrometria-dashboard-immagini-sole-noaa.png alt="Live Sun, NOAA" caption="Immagini della superficie del Sole e indicatori NOAA Space Weather" %}

---

## NOAA Space Weather: i KPI dello spazio meteorologico

Le immagini raccontano la situazione qualitativa. Per avere numeri precisi, ho aggiunto tre sensori chiave del **NOAA Space Weather Prediction Center**, mostrati come semplici tile.

### Radio Flux F10.7

Il **flusso radio a 10,7 cm** (F10.7) è l'indice più longevo e affidabile del ciclo di attività solare: viene misurato ogni giorno alle 17:00 UTC dall'Osservatorio di Penticton (Canada) dal 1947. Valori tipici vanno da ~70 (minimo solare) a ~300+ (massimo solare). Siamo (maggio 2026) attualmente nel **Ciclo Solare 25**, in fase di massimo, quindi i valori sono elevati.

### Velocità del Vento Solare

Il vento solare è un flusso continuo di particelle cariche che il Sole emette in tutte le direzioni. La velocità tipica è 400-600 km/s, ma durante le CME può raggiungere i 3.000 km/s. Un aumento improvviso di velocità è spesso il primo segnale di un'onda d'urto in arrivo.

### Indice Kp

L'**indice Kp** misura le perturbazioni del campo magnetico terrestre su scala globale da 0 (calma assoluta) a 9 (tempesta geomagnetica estrema). È l'indice di riferimento per le previsioni aurorali:

| Kp | Visibilità aurora |
|---|---|
| ≤ 3 | Solo circolo polare |
| 5 | Scandinavia meridionale |
| 7 | Germania, Francia settentrionale |
| 9 | Mediterraneo |

### Configurazione multiscrape

I dati vengono recuperati tramite l'integrazione [Multiscrape](https://github.com/danieldotnl/ha-multiscrape) (disponibile anche su HACS), che permette di interrogare una API REST (o in generale qualsiasi cosa), in questo caso l'API NOAA, e mappare ogni campo su un sensore separato in un'unica operazione. Al momento in cui scrivo, il setup va necessariamente fatto in Yaml:

```yaml
multiscrape:
  - name: "NOAA Space Weather"
    resource: "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"
    sensor:
      - unique_id: noaa_space_weather_noon_10_7cm_radio_flux
        name: "NOAA Space Weather - Noon 10.7cm Radio Flux"
        value_template: {{ value_json[-1]["f10.7"] | jsonify }}
        unit_of_measurement: "sfu"

      - unique_id: noaa_space_weather_solar_wind_speed
        name: "NOAA Space Weather Solar Wind Speed"
        value_template: "{{ value_json[-1]['solar-wind'] }}"
        unit_of_measurement: "km/s"
```

Per l'indice Kp, NOAA espone un endpoint dedicato:

```yaml
  - name: "NOAA Kp Index"
    resource: "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
    sensor:
      - unique_id: noaa_kp_index_current
        name: "NOAA Kp Index Current"
        value_template: "{{ value_json[-1].kp_index }}"
        icon: mdi:sine-wave
```

Le tre tile nella dashboard:

```yaml
type: horizontal-stack
cards:
  - type: tile
    entity: sensor.noaa_space_weather_noon_10_7cm_radio_flux
    name: "Radio Flux F10.7"
  - type: tile
    entity: sensor.noaa_space_weather_solar_wind_speed
    name: "Vento Solare"
  - type: tile
    entity: sensor.noaa_kp_index_current
    name: "Indice Kp"
    icon: mdi:sine-wave
    color: purple
```

---

## Grafici del vento solare: BT e BZ

Il vento solare ha due parametri magnetici che determinano se una tempesta geomagnetica sarà intensa o meno:

- **BT** (Intensità totale del campo magnetico interplanetario) — quanto è forte il campo, in nanoTesla
- **BZ** (Componente Sud del campo) — la componente più critica: quando BZ è fortemente negativo (campo rivolto verso Sud), la magnetosfera terrestre si apre e le particelle solari entrano, causando aurore e tempeste geomagnetiche

Monitorare l'andamento di BZ nelle ultime ore è fondamentale: un BZ negativo prolungato è il segnale che una tempesta è in corso o imminente.

NOAA SWPC pubblica queste misure (aggiornate ogni minuto dal satellite DSCOVR al punto L1) in formato JSON, tanto per cambiare:

```
https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json
```

Per grafici molto densi che possono richiedere la visualizzazioni di più serie di dati, in genere preferisco ApexCharts, che ha una [fantastica card](https://github.com/RomRider/apexcharts-card) per Lovelace:

La linea orizzontale a y=0 è il riferimento visivo chiave: quando BZ scende sotto quella linea e ci rimane, è il momento di controllare le previsioni aurorali.

```yaml
type: custom:apexcharts-card
graph_span: 6h
header:
  show: true
  title: "Vento Solare — BT / BZ"
series:
  - entity: sensor.noaa_solar_wind_bt
    name: BT
    color: orange
    stroke_width: 2
  - entity: sensor.noaa_solar_wind_bz
    name: BZ
    color: "#5b9ec9"
    stroke_width: 2
    show:
      in_chart: true
yaxis:
  - id: main
    min: -30
    max: 30
    apex_config:
      tickAmount: 6
apex_config:
  chart:
    type: line
  annotations:
    yaxis:
      - y: 0
        borderColor: "#666"
        strokeDashArray: 4
```

{% cloudinary /assets/images/astrometria-dashboard-vento-solare.png alt="Grafici del vento solare" caption="ApexChart è estremamente flessibile e consente di ottenere layout e combinazioni molto complesse, anche se, ammetto, raramente mi trovo a rappresentare grafici diversi da istogrammi, scatterplot o spezzate...che ci volete fare, sono un tradizionalista!" %}

---


Nella {% post_link /home-assistant/dashboard-astrometria-parte-3/ "terza parte" %} chiudiamo il cerchio con lo spazio profondo: l'immagine astronomica del giorno della NASA (APOD), la posizione in tempo reale della ISS e il bollettino prossimi lanci spaziali.
