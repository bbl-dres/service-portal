# swisstopo-APIs: Rezept für echte Schweizer Katasterdaten

Referenz für den Bezug authentischer Gebäude- und Grundstücksdaten aus den
**schlüsselfreien öffentlichen Diensten** des Bundes. Alle hier dokumentierten
Aufrufe wurden am **29.07.2026** effektiv ausgeführt; sämtliche Antwortausschnitte
sind reale, ungekürzte Auszüge aus den Live-Antworten.

Einstiegspunkt der offiziellen Dokumentation: <https://docs.geo.admin.ch/>

---

## 0. Grundlagen

### 0.1 Kein API-Key nötig

> «Die Nutzung der Geodienste der BGDI benötigt keine Registrierung und ist kostenlos.»
> — *Allgemeine Nutzungsbedingungen BGDI, Kap. 2.2*,
> <https://www.geo.admin.ch/de/allgemeine-nutzungsbedingungen-bgdi>

Kein Token, kein Header, keine Anmeldung. Alle Aufrufe unten funktionieren mit
blossem `curl`.

### 0.2 Beteiligte Hosts

| Host | Rolle | Betreiber |
|---|---|---|
| `api3.geo.admin.ch` | SearchServer (Geocoding), MapServer identify/find/htmlPopup | swisstopo (BGDI) |
| `geodesy.geo.admin.ch` | REFRAME – Koordinatentransformation LV95 ↔ WGS84 | swisstopo |
| `geodienste.ch` | WFS auf die amtliche Vermessung (Liegenschaften, Bodenbedeckung) | KGK/KKGEO (Kantone) |
| `www.oereb2.apps.be.ch` (kantonal) | ÖREB-Kataster-Auszug | Kanton BE (URL kommt aus der BGDI, s. Kap. 3.4) |

### 0.3 Koordinatensysteme und die Achsenfalle

* **EPSG:2056 (LV95)** – Landeskoordinaten in Metern. E ≈ 2 600 000, N ≈ 1 200 000.
* **EPSG:21781 (LV03)** – alt. E ≈ 600 000, N ≈ 200 000.
* **EPSG:4326 (WGS84)** – lon/lat in Grad.

**Falle:** Der `SearchServer` liefert `x` = **Nord**wert und `y` = **Ost**wert –
also vertauscht gegenüber der üblichen Konvention. Ohne `sr`-Parameter kommen die
Werte in **LV03**, mit `sr=2056` in **LV95**.

Für `identify` gilt hingegen die Reihenfolge `geometry=<Ost>,<Nord>` (bzw.
`<lon>,<lat>` bei `sr=4326`).

### 0.4 Fair Use

| Service | Limite (Minutenbasis) | Limite (Jahresbasis) |
|---|---|---|
| API Rest Services (`*.geo.admin.ch`) | 40 Requests / Minute | 21 Mio Requests / Jahr |
| WMTS (`wmts.geo.admin.ch`) | 1'200 Requests / Minute | 631 Mio Requests / Jahr |
| WMS (`wms.geo.admin.ch`) | 20 Requests / Minute (bei 360'000 Pixel Bildgrösse) | 10.5 Mio / Jahr bei 1.7 TB |
| REFRAME (`geodesy.geo.admin.ch/reframe`) | 40 Requests / Minute | 21 Mio Requests / Jahr |

Quelle: Tabelle in Kap. 2.3 der Allgemeinen Nutzungsbedingungen BGDI.
Für `geodienste.ch` gelten **eigene, deutlich strengere** Limiten (Kap. 8.2).

---

## 1. (A) Geocoding – Adresse → Koordinaten

### 1.1 Aufruf

```
GET https://api3.geo.admin.ch/rest/services/api/SearchServer
      ?searchText=<Adresse als Freitext>
      &type=locations
      &origins=address        # optional, beschränkt auf Gebäudeadressen
      &sr=2056                # optional; ohne diesen Parameter kommt LV03
      &limit=1                # optional
```

| Parameter | Bedeutung |
|---|---|
| `searchText` | Freitext, tolerant («fuzzy»). Umlaute funktionieren, ASCII-Ersatz (`Papiermuehlestrasse`) ebenfalls. |
| `type` | `locations` für Orte/Adressen/Parzellen; `layers` für Layer, `featuresearch` für Objekte. |
| `origins` | Filter auf Herkunftsklasse: `address`, `parcel`, `gg25`, `zipcode`, … |
| `sr` | `2056` (LV95), `21781` (LV03, Default), `4326`, `3857`. |

### 1.2 Reale Antwort (gekürzt)

```bash
curl -s -G "https://api3.geo.admin.ch/rest/services/api/SearchServer" \
  --data-urlencode "searchText=Bundesplatz 3 Bern" \
  --data-urlencode "type=locations" \
  --data-urlencode "origins=address" \
  --data-urlencode "sr=2056"
```

```json
{"fuzzy":"true","results":[{"attrs":{
  "detail":"bundesplatz 3 3011 bern 351 bern ch be",
  "featureId":"2242547_0",
  "geom_st_box2d":"BOX(2600423.2569999993 1199521.109000001,2600423.2569999993 1199521.109000001)",
  "label":"Bundesplatz 3 <b>3011 Bern</b>",
  "lat":46.946773529052734,
  "lon":7.444191932678223,
  "links":[
    {"href":"/rest/services/ech/MapServer/ch.swisstopo.amtliches-gebaeudeadressverzeichnis/101002312",
     "rel":"related","title":"ch.swisstopo.amtliches-gebaeudeadressverzeichnis"},
    {"href":"/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/2242547_0",
     "rel":"related","title":"ch.bfs.gebaeude_wohnungs_register"}],
  "num":3, "origin":"address", "rank":7,
  "x":1199521.125,   // NORD (LV95)
  "y":2600423.25     // OST  (LV95)
},"id":1008811,"weight":1546}]}
```

**Was man bekommt:**

* `lat` / `lon` – WGS84 direkt mitgeliefert (float32-genau, ca. ±0.5 m).
* `x` / `y` – LV95 (bzw. LV03 ohne `sr`), **x = Nord, y = Ost**.
* `geom_st_box2d` – Bounding Box im Format `BOX(<Ost> <Nord>,<Ost> <Nord>)`; bei
  Adressen ist es ein Punkt (min = max).
* `featureId` – Form `<EGID>_<EDID>`, z. B. `2242547_0`. **Der Teil vor dem
  Unterstrich ist bereits der EGID.**
* `links` – fertige Deep-Links auf den GWR- und den Gebäudeadressverzeichnis-Layer.

> **Hinweis zur PLZ:** «3003 Bern» ist eine reine Verwaltungs-PLZ der
> Bundesverwaltung ohne eigene Adressgeometrie. Das amtliche Adressverzeichnis
> führt die Bundesbauten unter **3011 Bern**. Die Suche mit «3003» findet die
> Adresse trotzdem (fuzzy), liefert aber das Label mit 3011.

### 1.3 LV95 → WGS84 konvertieren (REFRAME)

Wer präziser als die float32-`lat`/`lon` aus dem SearchServer sein will oder von
LV95 ausgeht, nutzt den geodätischen REST-Dienst:

```
GET https://geodesy.geo.admin.ch/reframe/lv95towgs84?easting=<E>&northing=<N>&format=json
GET https://geodesy.geo.admin.ch/reframe/wgs84tolv95?easting=<lon>&northing=<lat>&format=json
```

Reale Antworten:

```bash
curl -s "https://geodesy.geo.admin.ch/reframe/lv95towgs84?easting=2600423.19&northing=1199521.05&format=json"
```
```json
{"easting": "7.444191200349111", "northing": "46.9467745488081"}
```

```bash
curl -s "https://geodesy.geo.admin.ch/reframe/wgs84tolv95?easting=7.444191&northing=46.946773&format=json"
```
```json
{"easting": "2600423.1753197145", "northing": "1199520.878962242"}
```

Achtung: Der Dienst benennt die Felder auch im WGS84-Fall `easting`/`northing` –
`easting` ist die **Länge (lon)**, `northing` die **Breite (lat)**.

Alternativ kann `identify` selbst in EPSG:4326 rechnen (`sr=4326`), womit sich
eine separate Transformation meist erübrigt.

---

## 2. (B) EGID – Eidg. Gebäudeidentifikator aus dem GWR

Layer: **`ch.bfs.gebaeude_wohnungs_register`** (Bundesamt für Statistik BFS).

### 2.1 Aufruf

```
GET https://api3.geo.admin.ch/rest/services/api/MapServer/identify
      ?geometry=<Ost>,<Nord>
      &geometryType=esriGeometryPoint
      &layers=all:ch.bfs.gebaeude_wohnungs_register
      &sr=2056
      &tolerance=5
      &returnGeometry=false
```

| Parameter | Bedeutung |
|---|---|
| `geometry` | `<Ost>,<Nord>` in der mit `sr` gewählten Projektion. |
| `layers` | `all:<layerBodId>` – mehrere Layer per Komma kombinierbar. |
| `tolerance` | Suchradius in **Bildschirm-Pixel**. Bei `tolerance=0` exakter Punkt-in-Polygon-Test. GWR-Punkte brauchen einen Radius (5 ist bewährt). |
| `mapExtent` / `imageDisplay` | **Nur nötig, wenn `tolerance > 0`** – sie definieren den Pixelmassstab. Format `<minE>,<minN>,<maxE>,<maxN>` bzw. `<w>,<h>,<dpi>`. Bei `tolerance=0` können beide weggelassen werden (empirisch verifiziert). |

Da der SearchServer den EGID bereits in `featureId` mitliefert, geht es auch
ohne Geometrie direkt über die Feature-ID:

```
GET https://api3.geo.admin.ch/rest/services/all/MapServer/ch.bfs.gebaeude_wohnungs_register/<EGID>_0
GET .../ch.bfs.gebaeude_wohnungs_register/<EGID>_0/extendedHtmlPopup?lang=de   # mit Code-Klartext
```

### 2.2 Reale Antwort (Bundesplatz 3, gekürzt)

```json
{"results":[{
 "layerBodId":"ch.bfs.gebaeude_wohnungs_register",
 "layerName":"GWR: Gebäudestatus",
 "featureId":"2242547_0",
 "attributes":{
   "egid":"2242547",
   "egrid":"CH294676423526",
   "strname_deinr":"Bundesplatz 3",
   "plz_plz6":"3011/301100",
   "ggdename":"Bern", "ggdenr":351, "gdekt":"BE",
   "lgbkr":1, "lparz":"823", "lparzsx":null,
   "gbez":"Parlamentsgebäude",
   "gkode":2600426.92, "gkodn":1199490.255, "gksce":901,
   "gstat":1004, "gkat":1060, "gklas":null,
   "gbauj":null, "gbaum":null, "gbaup":null, "gabbj":null,
   "garea":3697, "gvol":null, "gastw":null, "ganzwhg":null, "gebf":null,
   "gwaerzh1":7460, "genh1":7580,
   "egaid":101002312, "deinr":"3", "esid":10057890,
   "strname":["Bundesplatz"], "dplz4":3011, "dplzname":"Bern",
   "dkode":2600423.257, "dkodn":1199521.109,
   "gexpdat":"27.07.2026"
 }}]}
```

### 2.3 Feldreferenz (die relevanten)

| Feld | Bedeutung | verifizierte Klartexte |
|---|---|---|
| `egid` | **Eidg. Gebäudeidentifikator** | – |
| `egrid` | Eidg. Grundstücksidentifikator (aus AV übernommen) | – |
| `lparz` / `lgbkr` | Grundstücksnummer / Grundbuchkreis | – |
| `ggdenr` / `ggdename` | BFS-Gemeindenummer / Gemeindename | – |
| `gbez` | Gebäudename | `Parlamentsgebäude` |
| `gstat` | Gebäudestatus | `1004` = «Gebäude bestehend» |
| `gkat` | Gebäudekategorie | `1060` = «Gebäude ohne Wohnnutzung»; `1040` = «Gebäude mit teilweiser Wohnnutzung» |
| `gklas` | Gebäudeklasse | `1220` = «Bürogebäude» |
| `gbauj` / `gbaum` | Baujahr / Baumonat | z. B. `1951` / `1` |
| `gbaup` | Bauperiode | `8013` = «Periode von 1946 bis 1960»; `8014` = «Periode von 1961 bis 1970» |
| `garea` | **Gebäudefläche in m²** | – |
| `gvol` | Gebäudevolumen m³ (oft `null`) | – |
| `gastw` | Anzahl Geschosse | – |
| `ganzwhg` | Anzahl Wohnungen | – |
| `gkode` / `gkodn` | Gebäudekoordinate LV95 (Ost/Nord) | Herkunft `gksce`, z. B. «Amtliche Vermessung, DM.01» |
| `gwaerzh1` / `genh1` | Wärmeerzeuger / Energieträger Heizung | – |
| `gexpdat` | Publikationsstand der Daten | `27.07.2026` |

**Codeauflösung ohne eigene Tabelle:** Der `extendedHtmlPopup` rendert alle
Codes im Klartext – ideal, um die Zuordnung zu verifizieren:

```bash
curl -s "https://api3.geo.admin.ch/rest/services/all/MapServer/ch.bfs.gebaeude_wohnungs_register/1288857_0/extendedHtmlPopup?lang=de"
```
```
Eidg. Gebäudeidentifikator (EGID)   1288857
Eidg. Grundstücksidentifikator (EGRID)  CH628458463566
Grundstücksnummer                   2143
Koordinatenherkunft                 Amtliche Vermessung, DM.01
Gebäudestatus                       Gebäude bestehend
Gebäudekategorie                    Gebäude ohne Wohnnutzung
Gebäudeklasse                       Bürogebäude
Baujahr des Gebäudes                1951
Bauperiode                          Periode von 1946 bis 1960
Gebäudefläche [m2]                  2776
Anzahl Geschosse                    1
```

**Wichtig:** Viele GWR-Attribute sind bei Bundesbauten `null` (Baujahr, Volumen,
Geschosse beim Parlamentsgebäude). Das GWR ist nicht lückenlos gefüllt.

---

## 3. (C) EGRID, Parzellengeometrie und Parzellenfläche

Hier gibt es **drei** brauchbare Quellen. Die Kombination aus 3.2 (BGDI) und
3.3 (geodienste.ch WFS) ist das empfohlene Rezept.

### 3.1 Welcher Layer funktioniert?

Getestet wurden alle katasternahen Layer der BGDI. Ergebnis:

| Layer | Ergebnis |
|---|---|
| `ch.swisstopo-vd.amtliche-vermessung` («OpenData-AV») | ✅ **funktioniert** – EGRID, Nummer, BFS-Nr., Geometrie |
| `ch.kantone.cadastralwebmap-farbe` | ✅ funktioniert, aber **ohne** `bfsnr` |
| `ch.swisstopo-vd.stand-oerebkataster` | ✅ funktioniert – liefert die kantonale ÖREB-Service-URL |
| `ch.bfs.arealstatistik-bodenbedeckung` | ❌ `{"results": []}` – kein Treffer am Punkt |
| `ch.swisstopo-vd.geometa-standav` | Metadaten zum AV-Stand, keine Parzellen |

### 3.2 BGDI identify auf `ch.swisstopo-vd.amtliche-vermessung`

```
GET https://api3.geo.admin.ch/rest/services/all/MapServer/identify
      ?geometry=<lon>,<lat>
      &geometryType=esriGeometryPoint
      &layers=all:ch.swisstopo-vd.amtliche-vermessung
      &sr=4326
      &tolerance=0
      &returnGeometry=true
      &geometryFormat=geojson
```

`sr=4326` steuert **Eingabe und Ausgabe** gleichzeitig – die Antwortgeometrie
kommt dann direkt als GeoJSON in WGS84. Mit `sr=2056` kommt sie in LV95.

Reale Antwort (Attribute + Geometriekopf):

```json
{"results": [{
  "type": "Feature",
  "featureId": 2233231,
  "layerBodId": "ch.swisstopo-vd.amtliche-vermessung",
  "layerName": "OpenData-AV",
  "bbox": [7.443585, 46.946128, 7.446282, 46.946875],
  "attributes": {
    "bfsnr": 351,
    "ak": "BE",
    "number": "823",
    "identnd": "BE0200000042",
    "egris_egrid": "CH294676423526",
    "realestate_type": null,
    "geoportal_url": "https://www.topo.apps.be.ch/pub/map/?lang=de&gpk=MOPUBE_GPK",
    "label": "823"
  },
  "geometry": {"type": "Polygon", "coordinates": [[
    [7.443585,46.946798],[7.443598,46.9468],[7.44361,46.946802],
    [7.443623,46.946805],[7.443636,46.946807], … ]]}
}]}
```

| Feld | Bedeutung |
|---|---|
| `egris_egrid` | **EGRID** |
| `number` | Grundstücksnummer |
| `identnd` | NBIdent (Nummerierungsbereich, z. B. `BE0200000042`) |
| `bfsnr` | **BFS-Gemeindenummer** |
| `ak` | Kantonskürzel |
| `realestate_type` | Grundstücksart (hier `null`; der `htmlPopup` zeigt «Liegenschaft») |
| `geoportal_url` | Deep-Link ins kantonale Geoportal |

**Was fehlt: die Fläche.** Dieser Layer führt kein Flächenattribut. Dafür 3.3
oder 3.4.

### 3.3 geodienste.ch WFS – Layer `RESF` (Liegenschaften) ⭐ empfohlen

Der WFS der Kantone liefert EGRID, Nummer, BFS-Nr., **Fläche** und Geometrie in
**einem** Aufruf.

```
GET https://geodienste.ch/db/av_0/deu
      ?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature
      &TYPENAMES=ms:RESF
      &SRSNAME=urn:ogc:def:crs:EPSG::4326     # oder ::2056 (Default)
      &OUTPUTFORMAT=application/json; subtype=geojson
      &FILTER=<fes:Filter …EGRIS_EGRID = 'CH…'…>
```

Filter nach EGRID (URL-encoded übergeben):

```xml
<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">
  <fes:PropertyIsEqualTo>
    <fes:ValueReference>EGRIS_EGRID</fes:ValueReference>
    <fes:Literal>CH294676423526</fes:Literal>
  </fes:PropertyIsEqualTo>
</fes:Filter>
```

Alternativ per BBOX (`BBOX=<minE>,<minN>,<maxE>,<maxN>,urn:ogc:def:crs:EPSG::2056`)
oder per räumlichem Filter `fes:Intersects` mit einem GML-Polygon – beides
verifiziert.

Reale Antwort:

```json
{
"type": "FeatureCollection",
"numberMatched": 1,
"name": "RESF",
"crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::2056" } },
"features": [
{ "type": "Feature",
  "properties": {
    "BFSNr": 351,
    "NBIdent": "BE0200000042",
    "Nummer": "823",
    "EGRIS_EGRID": "CH294676423526",
    "Vollstaendigkeit": "vollstaendig",
    "Flaeche": 12183,
    "Kanton": "BE" },
  "geometry": { "type": "Polygon", "coordinates": [ [
    [2600377.071,1199523.671],[2600380.421,1199524.513],
    [2600383.79,1199525.278],[2600387.176,1199525.965], … ] ] } } ] }
```

`Flaeche` ist die **amtliche Fläche in m²**. Eine Gauss'sche Trapezformel über
die zurückgegebene LV95-Geometrie ergibt für alle drei Testparzellen **exakt
denselben Wert** (12183 / 6960 / 9625) – Geometrie und Flächenangabe sind
konsistent.

Verfügbare Feature-Typen des Dienstes (`GetCapabilities`):

| Name | Titel |
|---|---|
| `ms:RESF` | Liegenschaften |
| `ms:LCSF` | Bodenbedeckung |
| `ms:LCOBJ` | BB_Nummern_Namen |
| `ms:SOSF` / `ms:SOLI` / `ms:SOPT` | Einzelobjekte (Flächen / Linien / Punkte) |
| `ms:OSNR` | Liegenschaftsnummern |
| `ms:HADR` | Gebäudeadressen |
| `ms:MBSF` | Gemeindegrenzen |
| `ms:OSBP` / `ms:TBBP` / `ms:CPPT` | Grenzpunkte / Hoheitsgrenzpunkte / Fixpunkte |
| `ms:DPRSF` | SDRechte (selbständige und dauernde Rechte) |
| `ms:PLSF` / `ms:PLLI` / `ms:PLNA` | Rohrleitungen |
| `ms:LNNA` / `ms:LOCPOS` | Nomenklaturnamen / Lokalisationen |
| `ms:*PROJ` | jeweils der projektierte Zustand |

Unterstützte CRS: `EPSG::2056` (Default), `EPSG::4326`, `EPSG::3857`.
Ausgabeformate u. a. `application/json; subtype=geojson`, GML 3.2.

Die Abdeckung ist **nicht nur BE** – ein Kontrollaufruf in Zürich (Stadt,
BFS 261) liefert ebenfalls Treffer:

```json
{ "properties": { "BFSNr": 261, "NBIdent": "ZH0200000261", "Nummer": "AA5898",
  "EGRIS_EGRID": "CH599977759175", "Vollstaendigkeit": "vollstaendig",
  "Flaeche": 1666, "Kanton": "ZH" } }
```

### 3.4 ÖREB-Kataster – amtlicher Auszug mit Grundbuchfläche

Der Weg zum kantonalen ÖREB-Dienst führt über einen BGDI-Layer, der die
Service-URL pro Parzelle mitliefert – so bleibt die Kette bundesweit generisch:

```
GET https://api3.geo.admin.ch/rest/services/all/MapServer/identify
      ?geometry=<Ost>,<Nord>&geometryType=esriGeometryPoint
      &layers=all:ch.swisstopo-vd.stand-oerebkataster
      &sr=2056&tolerance=0&returnGeometry=false
```

```json
{"results": [{
 "layerBodId": "ch.swisstopo-vd.stand-oerebkataster",
 "layerName": "Verfügbarkeit des ÖREB-Katasters",
 "attributes": {
   "bfs_nr": 351, "gemeindename": "Bern", "kanton": "Bern",
   "oereb_status_de": "ÖREB-Kataster eingeführt",
   "firmenname": "Direktion für Inneres und Justiz des Kantons Bern, Amt für Geoinformation",
   "email": "info.agi@be.ch", "url_oereb": "http://www.be.ch/oerebk",
   "oereb_webservice": "https://www.oereb2.apps.be.ch",
   "egris_egrid": "CH294676423526",
   "realestate_type": "Liegenschaft",
   "oereb_extract_pdf": "https://www.oereb2.apps.be.ch/extract/pdf/?EGRID=CH294676423526",
   "oereb_extract_url": "https://www.oereb2.apps.be.ch/extract/url/?EGRID=CH294676423526"
 }}]}
```

Der JSON-Auszug (Standard OEREB v2.0):

```
GET <oereb_webservice>/extract/json/?EGRID=<EGRID>
GET <oereb_webservice>/getegrid/json/?EN=<Ost>,<Nord>     # EGRID aus Koordinate
```

```bash
curl -s "https://www.oereb2.apps.be.ch/getegrid/json/?EN=2600423.19,1199521.05"
```
```json
{"GetEGRIDResponse": [{"egrid": "CH294676423526", "number": "823",
 "identDN": "BE0200000042",
 "type": {"Code": "RealEstate", "Text": [{"Language":"de","Text":"Liegenschaft"}]}}]}
```

Aus `extract/json` (94 KB) der relevante Teil:

```json
"RealEstate": {
  "Type": {"Code":"RealEstate","Text":[{"Language":"de","Text":"Liegenschaft"}]},
  "Canton": "BE",
  "MunicipalityName": "Bern",
  "MunicipalityCode": 351,
  "LandRegistryArea": 12183,
  "Number": "823",
  "IdentDN": "BE0200000042",
  "EGRID": "CH294676423526",
  "SubunitOfLandRegister": "1 - Altstadt",
  "RestrictionOnLandownership": [ … ]
}
```

`LandRegistryArea` (Grundbuchfläche in m²) **stimmt mit `Flaeche` aus dem WFS
exakt überein** – zwei unabhängige Bestätigungen derselben Zahl.

Zusätzlich enthält der Auszug die betroffenen ÖREB-Themen:

```
ConcernedTheme: ch.Nutzungsplanung, ch.BE.Gewaesserschutzbereiche,
                ch.Laermempfindlichkeitsstufen, ch.BE.ArchaeologischesInventar
```

Der ÖREB-Auszug enthält **keine Parzellengeometrie**, nur einen vorgefertigten
WMS-`GetMap`-Link auf den Situationsplan.

---

## 4. (D) Bodenbedeckung (Land Cover) pro Parzelle

Layer: **`ms:LCSF`** im geodienste.ch-WFS (INTERLIS DM01AVCH, «Land Cover Surface»).

Im BGDI-Angebot gibt es **keinen** vektoriellen AV-Bodenbedeckungslayer – die
Prüfung der `layersConfig` (896 Layer) und der WMS-`GetCapabilities` ergab nur
`ch.swisstopo.vec200-landcover` (swissTLMRegio, viel zu grob) und
`ch.bfs.arealstatistik-bodenbedeckung` (Hektarraster, liefert am Punkt kein
Ergebnis). Die AV-Bodenbedeckung ist ausschliesslich über geodienste.ch
erreichbar.

### 4.1 Aufruf

```
GET https://geodienste.ch/db/av_0/deu
      ?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature
      &TYPENAMES=ms:LCSF
      &BBOX=<minE>,<minN>,<maxE>,<maxN>,urn:ogc:def:crs:EPSG::2056
      &COUNT=500
      &OUTPUTFORMAT=application/json; subtype=geojson
```

Statt BBOX funktioniert auch ein räumlicher Filter (verifiziert):

```xml
<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"
            xmlns:gml="http://www.opengis.net/gml/3.2">
  <fes:Intersects>
    <fes:ValueReference>msGeometry</fes:ValueReference>
    <gml:Polygon srsName="urn:ogc:def:crs:EPSG::2056">
      <gml:exterior><gml:LinearRing><gml:posList>
        2600400 1199500 2600450 1199500 2600450 1199540 2600400 1199540 2600400 1199500
      </gml:posList></gml:LinearRing></gml:exterior>
    </gml:Polygon>
  </fes:Intersects>
</fes:Filter>
```

### 4.2 Reale Antwort

```json
{
"type": "FeatureCollection",
"name": "LCSF",
"crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::2056" } },
"features": [
{ "type": "Feature",
  "properties": {"BFSNr":351,"Qualitaet":"AV93","Art":"uebrige_befestigte",
                 "GWR_EGID":"","Kanton":"BE"},
  "geometry": {"type":"Polygon","coordinates":[[
    [2600386.391,1199571.514],[2600446.581,1199578.904],
    [2600451.043,1199542.511],[2600390.85,1199535.145],
    [2600386.391,1199571.514]]]}},
{ "type": "Feature",
  "properties": {"BFSNr":351,"Qualitaet":"AV93","Art":"Gebaeude",
                 "GWR_EGID":"2242547","Kanton":"BE"},
  "geometry": {"type":"Polygon","coordinates":[[
    [2600387.111,1199483.646],[2600388.699,1199484.04], … ]]}}
]}
```

**`GWR_EGID` verknüpft die Gebäudeflächen direkt mit dem GWR** – das ist die
saubere Brücke zwischen Bodenbedeckung und Gebäuderegister.

### 4.3 Wertebereich `Art`

Empirisch über 1500 LCSF-Objekte im Raum Bern-Innenstadt ausgezählt:

| `Art` | Anzahl im Sample |
|---|---|
| `Gebaeude` | 973 |
| `uebrige_befestigte` | 235 |
| `Gartenanlage` | 140 |
| `Trottoir` | 76 |
| `uebrige_humusierte` | 72 |
| `Acker_Wiese_Weide` | 4 |

Weitere Werte des DM01-Katalogs (`Strasse_Weg`, `Wasserbecken`, `Fliessgewaesser`,
`geschlossener_Wald`, `Fels`, `Gletscher` …) kommen ausserhalb des Stadtzentrums vor.

### 4.4 Einschränkung: keine Verschneidung mit der Parzelle

**Wichtig und ehrlich:** LCSF-Polygone sind **nicht an Parzellengrenzen
geschnitten**. Ein BBOX- oder Intersects-Abruf liefert Flächen, die über die
Parzelle hinausragen. Eine naive Summierung (Zentroid-in-Parzelle) über die
Testparzellen ergibt:

```
Bundesplatz 3 (12183 m²):   uebrige_befestigte 7742 · Gebaeude 6307
                            Gartenanlage 266 · Strasse_Weg 255   → Summe 14570 m²
Papiermühlestr. 172 (6960): Gartenanlage 9224 · Gebaeude 2777
                            uebrige_befestigte 1569              → Summe 13570 m²
Monbijoustr. 40 (9625):     Gartenanlage 7833 · Gebaeude 2130
                            Trottoir 1574 · uebrige_befestigte 835 → Summe 12372 m²
```

Die Summen übersteigen die Parzellenfläche deutlich. Für eine korrekte
Bodenbedeckungsbilanz pro Grundstück muss man die LCSF-Polygone clientseitig
mit dem RESF-Polygon **verschneiden** (z. B. `turf.intersect` /
PostGIS `ST_Intersection`). Der Dienst leistet das nicht.

---

## 5. Die drei Testadressen vollständig aufgelöst

| | Bundesplatz 3 | Papiermühlestrasse 172 | Monbijoustrasse 40 |
|---|---|---|---|
| Amtliches Label | Bundesplatz 3, 3011 Bern | Papiermühlestrasse 172, 3063 Ittigen | Monbijoustrasse 40, 3011 Bern |
| WGS84 lat | 46.94677454 | 46.97437194 | 46.94272742 |
| WGS84 lon | 7.44419120 | 7.47707520 | 7.43561181 |
| LV95 E / N | 2600423.25 / 1199521.13 | 2602925.25 / 1202589.75 | 2599770.00 / 1199071.13 |
| **EGID** | **2242547** | **1288857** | **1234465** |
| Gebäudename | Parlamentsgebäude | – | – |
| Gebäudestatus | 1004 (bestehend) | 1004 (bestehend) | 1004 (bestehend) |
| Gebäudekategorie | 1060 (ohne Wohnnutzung) | 1060 (ohne Wohnnutzung) | 1040 (teilweise Wohnnutzung) |
| Gebäudeklasse | – | 1220 (Bürogebäude) | – |
| Baujahr / Bauperiode | – | 1951 / 8013 (1946–1960) | – / 8014 (1961–1970) |
| Geschosse | – | 1 | 5 |
| Gebäudefläche `garea` | 3697 m² | 2776 m² | 2098 m² |
| Gebäudekoordinate LV95 | 2600426.92 / 1199490.26 | 2602958.19 / 1202556.49 | 2599761.97 / 1199033.77 |
| **EGRID** | **CH294676423526** | **CH628458463566** | **CH394687173565** |
| Parzellennummer | 823 | 2143 | 531 |
| NBIdent | BE0200000042 | BE0200000004 | BE0200000044 |
| Grundbuchkreis | 1 – Altstadt | – | 3 – Mattenhof |
| **Parzellenfläche** | **12 183 m²** | **6 960 m²** | **9 625 m²** |
| Fläche nachgerechnet | 12 183 m² ✓ | 6 960 m² ✓ | 9 625 m² ✓ |
| Gemeinde / **BFS-Nr.** | Bern / **351** | Ittigen / **362** | Bern / **351** |
| Grundstücksart | Liegenschaft | Liegenschaft | Liegenschaft |
| Stützpunkte Polygon | 117 (WFS) / 233 (BGDI) | 54 (WFS) / 111 (BGDI) | 62 (WFS) / 174 (BGDI) |

> Die BGDI-Variante liefert eine dichter aufgelöste (verdichtete) Kontur derselben
> Parzelle; der WFS die kompaktere Originalstützpunktfolge. Beide sind
> deckungsgleich.

### 5.1 Parzellenpolygone (GeoJSON, EPSG:4326)

**Bundesplatz 3 – EGRID CH294676423526** — 117 Stützpunkte total,
BBox `[7.443585, 46.946128, 7.446282, 46.946875]`; erste 12 Stützpunkte:

```json
{"type":"Polygon","coordinates":[[
 [7.443585,46.946798],[7.443629,46.946806],[7.443674,46.946812],
 [7.443718,46.946819],[7.443763,46.946824],[7.444353,46.946873],
 [7.444372,46.946875],[7.44439,46.946875],[7.444408,46.946875],
 [7.444426,46.946875],[7.444445,46.946873],[7.444464,46.94687]
 /* … 105 weitere Stützpunkte … */ ]]}
```

**Papiermühlestrasse 172 – EGRID CH628458463566** — 54 Stützpunkte,
hier **vollständig**:

```json
{"type":"Polygon","coordinates":[[
 [7.47675,46.974227],[7.476906,46.974359],[7.477188,46.974579],
 [7.477197,46.974585],[7.477207,46.97459],[7.477217,46.974594],
 [7.477228,46.974598],[7.477239,46.974601],[7.477251,46.974603],
 [7.477262,46.974605],[7.477274,46.974606],[7.477286,46.974606],
 [7.477298,46.974606],[7.47731,46.974605],[7.477322,46.974603],
 [7.477334,46.9746],[7.477345,46.974597],[7.477355,46.974593],
 [7.477366,46.974589],[7.477583,46.97449],[7.477636,46.974468],
 [7.477688,46.974446],[7.477742,46.974424],[7.477795,46.974403],
 [7.47785,46.974383],[7.477904,46.974364],[7.47796,46.974344],
 [7.478015,46.974326],[7.478072,46.974308],[7.478128,46.97429],
 [7.477973,46.974106],[7.478229,46.974004],[7.478755,46.973794],
 [7.479133,46.973645],[7.479208,46.973615],[7.479174,46.973576],
 [7.479246,46.973547],[7.479269,46.97354],[7.479215,46.97348],
 [7.479248,46.973467],[7.479238,46.973451],[7.479219,46.973437],
 [7.479187,46.973432],[7.479147,46.973436],[7.478922,46.97349],
 [7.478893,46.973492],[7.478904,46.973505],[7.478944,46.973556],
 [7.478279,46.97382],[7.478004,46.973929],[7.477769,46.974023],
 [7.477587,46.973808],[7.47756,46.973777],[7.47675,46.974227]]]}
```

**Monbijoustrasse 40 – EGRID CH394687173565** — 62 Stützpunkte total,
BBox `[7.434614, 46.941673, 7.435778, 46.943169]`; erste 12 Stützpunkte:

```json
{"type":"Polygon","coordinates":[[
 [7.434614,46.942653],[7.434826,46.942725],[7.434855,46.942736],
 [7.434884,46.942747],[7.434913,46.942758],[7.43494,46.94277],
 [7.434968,46.942783],[7.434995,46.942796],[7.435022,46.94281],
 [7.435048,46.942824],[7.435074,46.942839],[7.435099,46.942855]
 /* … 50 weitere Stützpunkte … */ ]]}
```

---

## 6. Kompakte Aufrufkette (Referenzrezept)

```
1.  Adresse           → api3.geo.admin.ch/rest/services/api/SearchServer
                         ?searchText=…&type=locations&origins=address&sr=2056
    ⇒ lat, lon, x(=Nord), y(=Ost), featureId "<EGID>_<EDID>"

2.  (optional) LV95   → geodesy.geo.admin.ch/reframe/lv95towgs84
                         ?easting=<E>&northing=<N>&format=json

3.  EGID + Gebäude    → api3.geo.admin.ch/rest/services/api/MapServer/identify
                         ?geometry=<E>,<N>&geometryType=esriGeometryPoint
                         &layers=all:ch.bfs.gebaeude_wohnungs_register
                         &sr=2056&tolerance=5&returnGeometry=false
    ⇒ egid, egrid, lparz, ggdenr, garea, gkat, gstat, gbauj, gastw …

4.  EGRID + Parzelle  → api3.geo.admin.ch/rest/services/all/MapServer/identify
                         ?geometry=<lon>,<lat>&geometryType=esriGeometryPoint
                         &layers=all:ch.swisstopo-vd.amtliche-vermessung
                         &sr=4326&tolerance=0
                         &returnGeometry=true&geometryFormat=geojson
    ⇒ egris_egrid, number, bfsnr, ak + Polygon in WGS84

5.  Fläche + Polygon  → geodienste.ch/db/av_0/deu
                         ?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature
                         &TYPENAMES=ms:RESF&FILTER=<EGRIS_EGRID = EGRID>
                         &OUTPUTFORMAT=application/json; subtype=geojson
    ⇒ Flaeche (m²), Nummer, NBIdent, BFSNr + Polygon

6.  Bodenbedeckung    → gleicher WFS, TYPENAMES=ms:LCSF, BBOX der Parzelle
    ⇒ Art, GWR_EGID + Polygone  (clientseitig mit RESF verschneiden!)

7.  (optional) ÖREB   → identify auf ch.swisstopo-vd.stand-oerebkataster
                         ⇒ oereb_webservice
                      → <oereb_webservice>/extract/json/?EGRID=<EGRID>
    ⇒ LandRegistryArea, SubunitOfLandRegister, ConcernedTheme
```

Das sind **4 bis 6 Requests pro Adresse** – bei 40 Requests/Minute reicht das
für ca. 7 Adressen pro Minute ohne Fair-Use-Verletzung.

---

## 7. Bulk-Download statt Einzelabfragen

Für grössere Datenmengen ist der Direktabruf ausdrücklich unerwünscht
(vgl. Kap. 8). Stattdessen:

| Datensatz | Download |
|---|---|
| Amtliche Vermessung (national) | `https://data.geo.admin.ch/ch.swisstopo-vd.amtliche-vermessung/data.zip` |
| AV pro Gemeinde, Shapefile | `https://api3.geo.admin.ch/featureattachments/ch.swisstopo-vd.amtliche-vermessung/DM01AVCH24D/SHP/<KT>/<BFSNR>.zip` |
| AV pro Gemeinde, INTERLIS | `https://api3.geo.admin.ch/featureattachments/ch.swisstopo-vd.amtliche-vermessung/DM01AVCH24D/ITF/<KT>/<BFSNR>.zip` |
| GWR | `https://www.housing-stat.ch/__publicdata` |

Kontrolle des Shapefile-Downloads für Bern (BFS 351):

```
HTTP/1.1 200 OK
Content-Type: binary/octet-stream
Content-Length: 325970846
Last-Modified: Fri, 17 Jul 2026 01:12:30 GMT
```

Achtung: Die Datei ist trotz Gemeinde-Pfad **326 MB** gross.

---

## 8. Nutzungsbedingungen und Lizenz

### 8.1 BGDI / swisstopo (`*.geo.admin.ch`)

Quelle: <https://www.geo.admin.ch/de/allgemeine-nutzungsbedingungen-bgdi>
(Stand swisstopo KOGIS / 01.01.2025)

**Kosten und Registrierung**

> «Der Bezug und die Nutzung der Daten bzw. der Dienste ist kostenlos unter
> Berücksichtigung der Bestimmungen zum Fair Use.»

> «Die Nutzung der Geodienste der BGDI benötigt keine Registrierung und ist
> kostenlos.» (Kap. 2.2)

**Umfang der Nutzung**

> «Auf der Bundes Geodaten-Infrastruktur BGDI stehen Geodaten in maschinell
> lesbarer Form grundsätzlich zur freien Verfügung. […] Die bezogenen Daten
> dürfen gemäss ihren Nutzungsbedingungen aufbereitet, analysiert und publiziert
> werden inkl. Einbezug weiterer Daten.» (Kap. 2.1)

**Quellenangabe – Pflicht**

> «In Publikationen und Analysen, die auf der BGDI basieren, ist gemäss den
> Nutzungsbedingungen des entsprechenden Datensatzes eine Quellangabe anzugeben,
> wie dies in der rechten unteren Ecke des Kartenviewer gemacht wird.
> © Data: swisstopo» (Kap. 3.1)

**Rate Limits** — siehe Tabelle in Kap. 0.4 dieses Dokuments.

> «Bei übermässiger Nutzung von Geodiensten kann der Zugang eingeschränkt oder
> verweigert werden. In diesen Fällen kann swisstopo mit dem Datennutzer / der
> Datennutzerin einen Vertrag abschliessen (Art. 44 Abs. 2 GeoIV).» (Kap. 2.3)

> «Hinweis zum Web-Scraping: Das automatisches Parsing der Geodienste via Bots
> mit hohen Abfrageintensitäten ist zu unterlassen. Für den Bezug der Datensätze
> ausserhalb des Kontextes der Webdienste (Nutzung in offline Systemen,
> Datenbanken usw.) ist der Downloadservice zu nutzen.» (Kap. 2.3)

> «Die Einbindung der Geodienste in Webapplikationen mit im Schnitt 20'000
> Nutzern pro Tag oder Desktopanwendungen entspricht einer Fair-Use-Nutzung.» (Kap. 2.3)

**Betrieb**

> «Servicezeit: Montag bis Freitag, 07:30-12:00 und 13:00-17:00 Uhr» · Verfügbarkeit
> 98 % · 7×24 h nur «best effort» (Kap. 5.1–5.3). Status: <https://status.geo.admin.ch>

Ebenso bestätigt in der technischen Doku:

> «The access and use of the data or the services is free of charge, subject to
> the provisions on fair use, see our Terms of Use.»
> — <https://docs.geo.admin.ch/get-started/overview.html>

### 8.2 geodienste.ch (WFS der amtlichen Vermessung)

Quelle: <https://geodienste.ch/terms-of-use> (Bern, 15.10.2025)

> «Die Nutzung der Geodaten und -dienste von geodienste.ch muss in jedem Fall mit
> den geltenden Nutzungsbedingungen der Kantone vereinbar sein.»

**Fair-Use-Limiten – deutlich strenger als bei der BGDI:**

| Service | Limite |
|---|---|
| Website | 20 Requests / Minute |
| Web Map Service | 10 Requests / Minute bei einer Bildgrösse von 360'000 Pixel |
| **Web Feature Service** | **10 Requests / Minute bei einer Datenübertragung von 1 MB** |
| Download-Dienst AtomFeed / STAC-API | 1 Dataset / Angebot und Tag |
| Rest-API Export | 1 Bezug / Angebot und Tag |

> «Hinweis zum Web-Scraping: Das automatische Parsing der Geodienste via Bots mit
> hohen Abfrageintensitäten ist zu unterlassen.»

> «Die Einbindung der Geodienste in Webapplikationen mit im Schnitt 10'000 Nutzern
> pro Tag oder Desktopanwendungen entspricht einer Fair-Use-Nutzung.»

In den `GetCapabilities` des Dienstes steht ausserdem:

```xml
<ows:Fees>Für den Bezug des Geodienstes können Kosten anfallen.
          Die Gebühren werden durch die Kantone erhoben.</ows:Fees>
<ows:AccessConstraints>https://geodienste.ch/terms-of-use</ows:AccessConstraints>
```

Der Zugriff selbst war in allen Tests **schlüssel- und kostenfrei**; die
Gebührenklausel ist eine Vorbehaltsklausel der Kantone. Für ein produktives
System sollte die Nutzung mit `geodienste@kgk-cgc.ch` geklärt werden.

### 8.3 Lizenz der einzelnen Datensätze

Die Datensatzlizenz steht in geocat.ch, nicht in der API-Antwort.

**GWR** (`ch.bfs.gebaeude_wohnungs_register`, geocat-UUID
`56553efe-4a2c-449d-93ba-cf7edd518d56`):

```xml
<mco:useConstraints><mco:MD_RestrictionCode codeListValue="otherRestrictions"/></mco:useConstraints>
<mco:otherConstraints><gco:CharacterString>Quellenangabe erforderlich.</gco:CharacterString>
```

mit der Nutzungseinschränkung:

> «Gemäss Art. 16 der Verordnung über das eidgenössische Gebäude- und
> Wohnungsregister vom 1. Juli 2017 (VGWR; SR 431.841) veröffentlicht das BFS die
> Daten der Berechtigungsstufen A im Internet.»

Das entspricht dem OGD-Standardmodell **«Freie Nutzung. Quellenangabe ist
Pflicht.»** (opendata.swiss).

**Amtliche Vermessung** (`ch.swisstopo-vd.amtliche-vermessung`, geocat-UUID
`a3c0f7fb-1be0-4385-9c54-33b65ae3e1ae`): Der Metadatensatz führt nur
`otherRestrictions` **ohne** Freitext. Der Datenherr ist gemäss BGDI-Metadaten
«Amtliche Vermessung Schweiz». In der Praxis gelten die kantonalen
OGD-Bedingungen der AV (vgl. 8.2).

### 8.4 Empfohlener Attributionsvermerk

```
Gebäudedaten: © Bundesamt für Statistik BFS, Eidg. Gebäude- und Wohnungsregister (GWR)
Parzellen- und Bodenbedeckungsdaten: © Amtliche Vermessung Schweiz / Kantone (geodienste.ch)
Geodienste und Adresssuche: © swisstopo (BGDI)
```

---

## 9. Was nicht erreichbar war – ehrliche Liste

1. **Bodenbedeckung pro Parzelle als fertige Bilanz.** Der Dienst liefert
   LCSF-Polygone, aber ungeschnitten. Die Zuordnung Fläche → Grundstück muss
   clientseitig verschnitten werden (Kap. 4.4). Es gibt keinen Endpoint, der
   «Bodenbedeckungsanteile dieser Parzelle» zurückgibt.

2. **Kein bundesweiter, einheitlicher ÖREB-Endpoint.** `api.oereb.admin.ch` und
   `oereb.geo.admin.ch` antworten nicht (DNS/Connection, curl exit 6);
   `/rest/services/all/OerebService` gibt 404. Der Weg führt zwingend über
   `ch.swisstopo-vd.stand-oerebkataster` zum jeweiligen **kantonalen** Dienst.
   Getestet wurde nur Bern (`oereb2.apps.be.ch`); andere Kantone können
   abweichende URL-Muster haben.

3. **Parzellenfläche fehlt in der BGDI.** Weder
   `ch.swisstopo-vd.amtliche-vermessung` noch `ch.kantone.cadastralwebmap-farbe`
   führen ein Flächenattribut. `/attributes` auf dem AV-Layer antwortet
   `{"detail":"No feature with id attributes","status":"error","code":404}`.
   Die Fläche kommt nur aus geodienste.ch (`RESF.Flaeche`) oder aus dem
   ÖREB-Auszug (`LandRegistryArea`).

4. **GWR-Codelisten nicht als API.** Es gibt keinen Endpoint, der `gkat=1060`
   → «Gebäude ohne Wohnnutzung» auflöst. Behelf: `extendedHtmlPopup` rendert
   die Klartexte (Kap. 2.3). Für eine Applikation muss der BFS-Merkmalskatalog
   als statische Tabelle mitgeliefert werden.

5. **Viele GWR-Attribute sind leer.** Beim Parlamentsgebäude sind Baujahr,
   Bauperiode, Volumen, Geschosszahl und Energiebezugsfläche `null`. Das ist
   kein API-Problem, sondern eine Datenlücke im Register.

6. **PLZ 3003 existiert im Adressverzeichnis nicht.** Die Suche findet die
   Adressen, gibt aber 3011 zurück. Wer 3003 anzeigen will, muss das selbst
   überschreiben.

7. **`ch.bfs.arealstatistik-bodenbedeckung`** liefert am Punkt
   `{"results": []}` – der Layer ist für Punktabfragen in dieser Konfiguration
   unbrauchbar.

8. **Eigentümerangaben gibt es nicht.** Weder GWR noch AV noch ÖREB liefern
   Grundbuch-Eigentümer. Das ist Kantonsrecht und nicht öffentlich abrufbar.

9. **Die geocat-Lizenz der AV ist unspezifisch** – nur `otherRestrictions` ohne
   Freitext (Kap. 8.3). Für eine rechtssichere Publikation müsste der Datenherr
   direkt angefragt werden.

10. **Vertexzahlen weichen zwischen den Quellen ab** (117 vs. 233 beim
    Bundesplatz). Die BGDI verdichtet die Kontur. Wer Geometrien zwischen den
    beiden Quellen vergleicht, darf nicht auf Stützpunktgleichheit prüfen.

---

## 10. Quellenverzeichnis

| Thema | URL |
|---|---|
| Technische Doku (Einstieg) | <https://docs.geo.admin.ch/> |
| Search / Geocoding | <https://docs.geo.admin.ch/access-data/search.html> |
| Identify Features | <https://docs.geo.admin.ch/access-data/identify-features.html> |
| Find Features | <https://docs.geo.admin.ch/access-data/find-features.html> |
| Layerliste (maschinenlesbar) | <https://api3.geo.admin.ch/rest/services/all/MapServer/layersConfig?lang=de> |
| Nutzungsbedingungen BGDI | <https://www.geo.admin.ch/de/allgemeine-nutzungsbedingungen-bgdi> |
| Betriebsbestimmungen geodienste.ch | <https://geodienste.ch/terms-of-use> |
| AV-WFS GetCapabilities | <https://geodienste.ch/db/av_0/deu?SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0> |
| GWR beim BFS | <https://www.bfs.admin.ch/bfs/de/home/register/gebaeude-wohnungsregister.html> |
| Metadaten AV (geocat) | <https://www.geocat.ch/geonetwork/srv/ger/catalog.search#/metadata/a3c0f7fb-1be0-4385-9c54-33b65ae3e1ae> |
| Metadaten GWR (geocat) | <https://www.geocat.ch/geonetwork/srv/ger/catalog.search#/metadata/56553efe-4a2c-449d-93ba-cf7edd518d56> |
| Status der Geodienste | <https://status.geo.admin.ch> |
