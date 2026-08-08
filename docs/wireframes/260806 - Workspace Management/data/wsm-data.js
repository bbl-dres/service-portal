// Generiert aus data/wsm-fixture.js + data/wsm-catalog.js — klassisches Skript
// (kein ES-Modul), damit es über <script src> im DC-Helmet geladen werden kann.
(function () {
// Fixture-Auszug aus bbl-dres/service-portal (data/floors.json, data/spaces.json,
// data/buildings.geojson) für Gebäude 1080/6650/AA — Verwaltungsgebäude Liebefeld.
// Modulzuordnungen und SUS-Messwerte sind PROTOTYP-ANNAHMEN (im Repo nicht vorhanden).

const building = {
  "bbl_id": "1080/6650/AA",
  "bez": "Verwaltungsgebäude Liebefeld (BAG / BLV)",
  "adr": "Schwarzenburgstrasse 157, 3097 Liebefeld",
  "ort": "Liebefeld",
  "plz": "3097",
  "nutzer": "Bundesamt für Gesundheit BAG; Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV",
  "bjahr": 2015,
  "hnf": 19136,
  "ngf": 25714,
  "gf": 29900,
  "kf": 4186,
  "astw": 7
};

const floors = [{"floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","key":"eg","label":"EG","level":0,"areaGross":850,"areaHnf":604,"rooms":26,"extent":[5900,1440]},{"floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","key":"1og","label":"1. OG","level":1,"areaGross":770,"areaHnf":523,"rooms":26,"extent":[5350,1440]},{"floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","key":"2og","label":"2. OG","level":2,"areaGross":850,"areaHnf":640,"rooms":28,"extent":[5900,1440]}];

const spaces = [{"spaceId":"1080-6650-AA-1og-01","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 01","useType":"korridor","useLabel":"Korridor","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":128.4,"capacity":0,"bookable":false,"occupierVe":null,"rect":[0,600,5350,240]},{"spaceId":"1080-6650-AA-1og-02","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 02","useType":"treppenhaus","useLabel":"Treppenhaus","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":25.2,"capacity":0,"bookable":false,"occupierVe":null,"rect":[4930,0,420,600]},{"spaceId":"1080-6650-AA-1og-03","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 03","useType":"wc","useLabel":"WC","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[4930,840,210,600]},{"spaceId":"1080-6650-AA-1og-04","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 04","useType":"technik","useLabel":"Technikraum","sia":"TF","siaLabel":"Technikfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5140,840,210,600]},{"spaceId":"1080-6650-AA-1og-05","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 05","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[0,0,450,600]},{"spaceId":"1080-6650-AA-1og-06","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 06","useType":"druckraum","useLabel":"Druckerraum","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":15,"capacity":0,"bookable":false,"occupierVe":"BAFU","rect":[450,0,250,600]},{"spaceId":"1080-6650-AA-1og-07","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 07","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[700,0,400,600]},{"spaceId":"1080-6650-AA-1og-08","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 08","useType":"teekueche","useLabel":"Teeküche","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":15,"capacity":0,"bookable":false,"occupierVe":"BLV","rect":[1100,0,250,600]},{"spaceId":"1080-6650-AA-1og-09","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 09","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1350,0,400,600]},{"spaceId":"1080-6650-AA-1og-10","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 10","useType":"lounge","useLabel":"Lounge","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":39,"capacity":10,"bookable":false,"occupierVe":"BLV","rect":[1750,0,650,600]},{"spaceId":"1080-6650-AA-1og-11","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 11","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[2400,0,400,600]},{"spaceId":"1080-6650-AA-1og-12","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 12","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[2800,0,400,600]},{"spaceId":"1080-6650-AA-1og-13","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 13","useType":"openspace","useLabel":"Open Space","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":45,"capacity":5,"bookable":false,"occupierVe":"BLV","rect":[3200,0,750,600]},{"spaceId":"1080-6650-AA-1og-14","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 14","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[3950,0,450,600]},{"spaceId":"1080-6650-AA-1og-15","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 15","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":31.8,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[4400,0,530,600]},{"spaceId":"1080-6650-AA-1og-16","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 16","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":39,"capacity":13,"bookable":true,"occupierVe":"BAFU","rect":[0,840,650,600]},{"spaceId":"1080-6650-AA-1og-17","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 17","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":36,"capacity":12,"bookable":true,"occupierVe":"BLV","rect":[650,840,600,600]},{"spaceId":"1080-6650-AA-1og-18","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 18","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1250,840,400,600]},{"spaceId":"1080-6650-AA-1og-19","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 19","useType":"lager","useLabel":"Lager","sia":"NNF","siaLabel":"Nebennutzfläche","group":"sonder","groupLabel":"Sonderräume","area":18,"capacity":0,"bookable":false,"occupierVe":"BLV","rect":[1650,840,300,600]},{"spaceId":"1080-6650-AA-1og-20","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 20","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1950,840,400,600]},{"spaceId":"1080-6650-AA-1og-21","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 21","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":33,"capacity":3,"bookable":false,"occupierVe":"BLV","rect":[2350,840,550,600]},{"spaceId":"1080-6650-AA-1og-22","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 22","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[2900,840,400,600]},{"spaceId":"1080-6650-AA-1og-23","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 23","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":21,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[3300,840,350,600]},{"spaceId":"1080-6650-AA-1og-24","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 24","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[3650,840,450,600]},{"spaceId":"1080-6650-AA-1og-25","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 25","useType":"archiv","useLabel":"Archiv","sia":"NNF","siaLabel":"Nebennutzfläche","group":"sonder","groupLabel":"Sonderräume","area":21,"capacity":0,"bookable":false,"occupierVe":"BLV","rect":[4100,840,350,600]},{"spaceId":"1080-6650-AA-1og-26","floorId":"1080-6650-AA-1og","buildingId":"1080/6650/AA","roomNumber":"1. OG 26","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":28.8,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[4450,840,480,600]},{"spaceId":"1080-6650-AA-eg-01","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 01","useType":"korridor","useLabel":"Korridor","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":141.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[0,600,5900,240]},{"spaceId":"1080-6650-AA-eg-02","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 02","useType":"treppenhaus","useLabel":"Treppenhaus","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":25.2,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5480,0,420,600]},{"spaceId":"1080-6650-AA-eg-03","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 03","useType":"wc","useLabel":"WC","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5480,840,210,600]},{"spaceId":"1080-6650-AA-eg-04","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 04","useType":"technik","useLabel":"Technikraum","sia":"TF","siaLabel":"Technikfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5690,840,210,600]},{"spaceId":"1080-6650-AA-eg-05","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 05","useType":"empfang","useLabel":"Empfang","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[0,0,450,600]},{"spaceId":"1080-6650-AA-eg-06","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 06","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":42,"capacity":14,"bookable":true,"occupierVe":"BLV","rect":[450,0,700,600]},{"spaceId":"1080-6650-AA-eg-07","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 07","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":42,"capacity":14,"bookable":true,"occupierVe":"BLV","rect":[1150,0,700,600]},{"spaceId":"1080-6650-AA-eg-08","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 08","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[1850,0,400,600]},{"spaceId":"1080-6650-AA-eg-09","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 09","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[2250,0,500,600]},{"spaceId":"1080-6650-AA-eg-10","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 10","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":36,"capacity":12,"bookable":true,"occupierVe":"BLV","rect":[2750,0,600,600]},{"spaceId":"1080-6650-AA-eg-11","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 11","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":21,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[3350,0,350,600]},{"spaceId":"1080-6650-AA-eg-12","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 12","useType":"lager","useLabel":"Lager","sia":"NNF","siaLabel":"Nebennutzfläche","group":"sonder","groupLabel":"Sonderräume","area":21,"capacity":0,"bookable":false,"occupierVe":"BAFU","rect":[3700,0,350,600]},{"spaceId":"1080-6650-AA-eg-13","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 13","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[4050,0,400,600]},{"spaceId":"1080-6650-AA-eg-14","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 14","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[4450,0,400,600]},{"spaceId":"1080-6650-AA-eg-15","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 15","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":37.8,"capacity":13,"bookable":true,"occupierVe":"BLV","rect":[4850,0,630,600]},{"spaceId":"1080-6650-AA-eg-16","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 16","useType":"fokusraum","useLabel":"Fokusraum","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":15,"capacity":1,"bookable":true,"occupierVe":"BLV","rect":[0,840,250,600]},{"spaceId":"1080-6650-AA-eg-17","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 17","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":51,"capacity":17,"bookable":true,"occupierVe":"BLV","rect":[250,840,850,600]},{"spaceId":"1080-6650-AA-eg-18","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 18","useType":"druckraum","useLabel":"Druckerraum","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":18,"capacity":0,"bookable":false,"occupierVe":"BLV","rect":[1100,840,300,600]},{"spaceId":"1080-6650-AA-eg-19","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 19","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1400,840,450,600]},{"spaceId":"1080-6650-AA-eg-20","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 20","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1850,840,450,600]},{"spaceId":"1080-6650-AA-eg-21","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 21","useType":"fokusraum","useLabel":"Fokusraum","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":21,"capacity":1,"bookable":true,"occupierVe":"BLV","rect":[2300,840,350,600]},{"spaceId":"1080-6650-AA-eg-22","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 22","useType":"teekueche","useLabel":"Teeküche","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":15,"capacity":0,"bookable":false,"occupierVe":"BLV","rect":[2650,840,250,600]},{"spaceId":"1080-6650-AA-eg-23","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 23","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[2900,840,500,600]},{"spaceId":"1080-6650-AA-eg-24","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 24","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":36,"capacity":12,"bookable":true,"occupierVe":"BAFU","rect":[3400,840,600,600]},{"spaceId":"1080-6650-AA-eg-25","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 25","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":33,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[4000,840,550,600]},{"spaceId":"1080-6650-AA-eg-26","floorId":"1080-6650-AA-eg","buildingId":"1080/6650/AA","roomNumber":"EG 26","useType":"openspace","useLabel":"Open Space","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":55.8,"capacity":6,"bookable":false,"occupierVe":"BLV","rect":[4550,840,930,600]},{"spaceId":"1080-6650-AA-2og-01","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 01","useType":"korridor","useLabel":"Korridor","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":141.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[0,600,5900,240]},{"spaceId":"1080-6650-AA-2og-02","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 02","useType":"treppenhaus","useLabel":"Treppenhaus","sia":"VF","siaLabel":"Verkehrsfläche","group":"infra","groupLabel":"Infrastruktur","area":25.2,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5480,0,420,600]},{"spaceId":"1080-6650-AA-2og-03","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 03","useType":"wc","useLabel":"WC","sia":"NNF","siaLabel":"Nebennutzfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5480,840,210,600]},{"spaceId":"1080-6650-AA-2og-04","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 04","useType":"technik","useLabel":"Technikraum","sia":"TF","siaLabel":"Technikfläche","group":"infra","groupLabel":"Infrastruktur","area":12.6,"capacity":0,"bookable":false,"occupierVe":null,"rect":[5690,840,210,600]},{"spaceId":"1080-6650-AA-2og-05","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 05","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BLV","rect":[0,0,500,600]},{"spaceId":"1080-6650-AA-2og-06","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 06","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BLV","rect":[500,0,500,600]},{"spaceId":"1080-6650-AA-2og-07","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 07","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[1000,0,450,600]},{"spaceId":"1080-6650-AA-2og-08","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 08","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1450,0,400,600]},{"spaceId":"1080-6650-AA-2og-09","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 09","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BLV","rect":[1850,0,500,600]},{"spaceId":"1080-6650-AA-2og-10","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 10","useType":"archiv","useLabel":"Archiv","sia":"NNF","siaLabel":"Nebennutzfläche","group":"sonder","groupLabel":"Sonderräume","area":18,"capacity":0,"bookable":false,"occupierVe":"BAFU","rect":[2350,0,300,600]},{"spaceId":"1080-6650-AA-2og-11","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 11","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[2650,0,450,600]},{"spaceId":"1080-6650-AA-2og-12","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 12","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[3100,0,400,600]},{"spaceId":"1080-6650-AA-2og-13","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 13","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[3500,0,400,600]},{"spaceId":"1080-6650-AA-2og-14","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 14","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[3900,0,500,600]},{"spaceId":"1080-6650-AA-2og-15","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 15","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":30,"capacity":3,"bookable":false,"occupierVe":"BLV","rect":[4400,0,500,600]},{"spaceId":"1080-6650-AA-2og-16","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 16","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":21,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[4900,0,350,600]},{"spaceId":"1080-6650-AA-2og-17","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 17","useType":"openspace","useLabel":"Open Space","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":13.8,"capacity":1,"bookable":false,"occupierVe":"BLV","rect":[5250,0,230,600]},{"spaceId":"1080-6650-AA-2og-18","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 18","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[0,840,400,600]},{"spaceId":"1080-6650-AA-2og-19","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 19","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":42,"capacity":14,"bookable":true,"occupierVe":"BAFU","rect":[400,840,700,600]},{"spaceId":"1080-6650-AA-2og-20","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 20","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[1100,840,450,600]},{"spaceId":"1080-6650-AA-2og-21","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 21","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[1550,840,400,600]},{"spaceId":"1080-6650-AA-2og-22","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 22","useType":"sitzung","useLabel":"Sitzungszimmer","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"zusammen","groupLabel":"Zusammenarbeit","area":48,"capacity":16,"bookable":true,"occupierVe":"BAFU","rect":[1950,840,800,600]},{"spaceId":"1080-6650-AA-2og-23","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 23","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":24,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[2750,840,400,600]},{"spaceId":"1080-6650-AA-2og-24","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 24","useType":"fokusraum","useLabel":"Fokusraum","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":15,"capacity":1,"bookable":true,"occupierVe":"BAFU","rect":[3150,840,250,600]},{"spaceId":"1080-6650-AA-2og-25","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 25","useType":"openspace","useLabel":"Open Space","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":45,"capacity":5,"bookable":false,"occupierVe":"BAFU","rect":[3400,840,750,600]},{"spaceId":"1080-6650-AA-2og-26","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 26","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":21,"capacity":2,"bookable":false,"occupierVe":"BLV","rect":[4150,840,350,600]},{"spaceId":"1080-6650-AA-2og-27","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 27","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":27,"capacity":2,"bookable":false,"occupierVe":"BAFU","rect":[4500,840,450,600]},{"spaceId":"1080-6650-AA-2og-28","floorId":"1080-6650-AA-2og","buildingId":"1080/6650/AA","roomNumber":"2. OG 28","useType":"buero","useLabel":"Büro","sia":"HNF","siaLabel":"Hauptnutzfläche","group":"arbeit","groupLabel":"Arbeitsplätze","area":31.8,"capacity":3,"bookable":false,"occupierVe":"BAFU","rect":[4950,840,530,600]}];

const placements = [{"spaceId":"1080-6650-AA-1og-05","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-05","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-07","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-07","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-08","floorId":"1080-6650-AA-1og","mod":7,"sub":"7.1","n":1,"status":"bestand","incomplete":"Artikelnummer unbekannt"},{"spaceId":"1080-6650-AA-1og-08","floorId":"1080-6650-AA-1og","mod":7,"sub":"7.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-08","floorId":"1080-6650-AA-1og","mod":11,"sub":"11.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-09","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-09","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-1og-10","floorId":"1080-6650-AA-1og","mod":6,"sub":"6.4","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-10","floorId":"1080-6650-AA-1og","mod":7,"sub":"7.6","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-10","floorId":"1080-6650-AA-1og","mod":11,"sub":"11.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-11","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-11","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-12","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-12","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-13","floorId":"1080-6650-AA-1og","mod":2,"sub":"2.1","n":1,"status":"entfaellt"},{"spaceId":"1080-6650-AA-1og-13","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-13","floorId":"1080-6650-AA-1og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-13","floorId":"1080-6650-AA-1og","mod":5,"sub":"5.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-14","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-14","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-15","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-15","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-1og-15","floorId":"1080-6650-AA-1og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-16","floorId":"1080-6650-AA-1og","mod":4,"sub":"4.1.2","n":1,"status":"bestand","incomplete":"Modulrepräsentant fehlt im Plan"},{"spaceId":"1080-6650-AA-1og-17","floorId":"1080-6650-AA-1og","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-18","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"entfaellt"},{"spaceId":"1080-6650-AA-1og-18","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-20","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-20","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-1og-21","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-21","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-21","floorId":"1080-6650-AA-1og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-22","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-22","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-23","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"neu"},{"spaceId":"1080-6650-AA-1og-23","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-24","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-24","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-26","floorId":"1080-6650-AA-1og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-1og-26","floorId":"1080-6650-AA-1og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-06","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-07","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-08","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-08","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-09","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-09","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"entfaellt"},{"spaceId":"1080-6650-AA-eg-09","floorId":"1080-6650-AA-eg","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-10","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-11","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"neu"},{"spaceId":"1080-6650-AA-eg-11","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-13","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"neu"},{"spaceId":"1080-6650-AA-eg-13","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-14","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-14","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-15","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-16","floorId":"1080-6650-AA-eg","mod":3,"sub":"3.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-17","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-19","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-19","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-20","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-20","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-21","floorId":"1080-6650-AA-eg","mod":3,"sub":"3.2","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-eg-22","floorId":"1080-6650-AA-eg","mod":7,"sub":"7.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-22","floorId":"1080-6650-AA-eg","mod":7,"sub":"7.2","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-eg-22","floorId":"1080-6650-AA-eg","mod":11,"sub":"11.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-23","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-23","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-23","floorId":"1080-6650-AA-eg","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-24","floorId":"1080-6650-AA-eg","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-25","floorId":"1080-6650-AA-eg","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-25","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-eg-25","floorId":"1080-6650-AA-eg","mod":10,"sub":"10.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-eg-26","floorId":"1080-6650-AA-eg","mod":2,"sub":"2.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-26","floorId":"1080-6650-AA-eg","mod":9,"sub":"9.1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-26","floorId":"1080-6650-AA-eg","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-eg-26","floorId":"1080-6650-AA-eg","mod":5,"sub":"5.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-05","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-05","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-05","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-06","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-06","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-06","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-07","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-07","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-08","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-08","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-09","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-09","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-09","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-11","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-11","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-12","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-12","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-13","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"neu"},{"spaceId":"1080-6650-AA-2og-13","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-14","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-14","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-14","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-15","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-15","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-15","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-16","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-16","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-17","floorId":"1080-6650-AA-2og","mod":2,"sub":"2.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-17","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":2,"status":"entfaellt"},{"spaceId":"1080-6650-AA-2og-17","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-17","floorId":"1080-6650-AA-2og","mod":5,"sub":"5.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-18","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-18","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-19","floorId":"1080-6650-AA-2og","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-20","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-20","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-21","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-21","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"entfaellt"},{"spaceId":"1080-6650-AA-2og-22","floorId":"1080-6650-AA-2og","mod":4,"sub":"4.1.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-23","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"neu"},{"spaceId":"1080-6650-AA-2og-23","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-24","floorId":"1080-6650-AA-2og","mod":3,"sub":"3.2","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-25","floorId":"1080-6650-AA-2og","mod":2,"sub":"2.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-25","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-25","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-25","floorId":"1080-6650-AA-2og","mod":5,"sub":"5.2","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-26","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-26","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-27","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":2,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-27","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"neu"},{"spaceId":"1080-6650-AA-2og-28","floorId":"1080-6650-AA-2og","mod":1,"sub":"1","n":3,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-28","floorId":"1080-6650-AA-2og","mod":9,"sub":"9.1","n":1,"status":"bestand"},{"spaceId":"1080-6650-AA-2og-28","floorId":"1080-6650-AA-2og","mod":10,"sub":"10.1","n":1,"status":"bestand"}];

const sus = {"1080-6650-AA-1og-05":{"belegt":0,"kalt":2,"leer":0},"1080-6650-AA-1og-07":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-09":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-10":{"belegt":5,"kalt":1,"leer":4},"1080-6650-AA-1og-11":{"belegt":1,"kalt":1,"leer":0},"1080-6650-AA-1og-12":{"belegt":0,"kalt":1,"leer":1},"1080-6650-AA-1og-13":{"belegt":3,"kalt":0,"leer":2},"1080-6650-AA-1og-14":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-15":{"belegt":2,"kalt":0,"leer":1},"1080-6650-AA-1og-16":{"belegt":9,"kalt":0,"leer":4},"1080-6650-AA-1og-17":{"belegt":5,"kalt":4,"leer":3},"1080-6650-AA-1og-18":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-20":{"belegt":0,"kalt":1,"leer":1},"1080-6650-AA-1og-21":{"belegt":0,"kalt":1,"leer":2},"1080-6650-AA-1og-22":{"belegt":0,"kalt":0,"leer":2},"1080-6650-AA-1og-23":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-24":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-1og-26":{"belegt":1,"kalt":1,"leer":0},"1080-6650-AA-eg-05":{"belegt":0,"kalt":1,"leer":1},"1080-6650-AA-eg-06":{"belegt":8,"kalt":4,"leer":2},"1080-6650-AA-eg-07":{"belegt":8,"kalt":3,"leer":3},"1080-6650-AA-eg-08":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-eg-09":{"belegt":3,"kalt":0,"leer":0},"1080-6650-AA-eg-10":{"belegt":7,"kalt":2,"leer":3},"1080-6650-AA-eg-11":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-eg-13":{"belegt":1,"kalt":1,"leer":0},"1080-6650-AA-eg-14":{"belegt":0,"kalt":1,"leer":1},"1080-6650-AA-eg-15":{"belegt":7,"kalt":3,"leer":3},"1080-6650-AA-eg-16":{"belegt":1,"kalt":0,"leer":0},"1080-6650-AA-eg-17":{"belegt":8,"kalt":3,"leer":6},"1080-6650-AA-eg-19":{"belegt":0,"kalt":1,"leer":1},"1080-6650-AA-eg-20":{"belegt":1,"kalt":1,"leer":0},"1080-6650-AA-eg-21":{"belegt":1,"kalt":0,"leer":0},"1080-6650-AA-eg-23":{"belegt":0,"kalt":1,"leer":2},"1080-6650-AA-eg-24":{"belegt":5,"kalt":5,"leer":2},"1080-6650-AA-eg-25":{"belegt":2,"kalt":1,"leer":0},"1080-6650-AA-eg-26":{"belegt":0,"kalt":3,"leer":3},"1080-6650-AA-2og-05":{"belegt":1,"kalt":0,"leer":2},"1080-6650-AA-2og-06":{"belegt":2,"kalt":0,"leer":1},"1080-6650-AA-2og-07":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-08":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-09":{"belegt":1,"kalt":1,"leer":1},"1080-6650-AA-2og-11":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-12":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-13":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-14":{"belegt":2,"kalt":0,"leer":1},"1080-6650-AA-2og-15":{"belegt":1,"kalt":0,"leer":2},"1080-6650-AA-2og-16":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-17":{"belegt":1,"kalt":0,"leer":0},"1080-6650-AA-2og-18":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-19":{"belegt":6,"kalt":4,"leer":4},"1080-6650-AA-2og-20":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-21":{"belegt":2,"kalt":0,"leer":0},"1080-6650-AA-2og-22":{"belegt":8,"kalt":3,"leer":5},"1080-6650-AA-2og-23":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-24":{"belegt":1,"kalt":0,"leer":0},"1080-6650-AA-2og-25":{"belegt":0,"kalt":2,"leer":3},"1080-6650-AA-2og-26":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-27":{"belegt":1,"kalt":0,"leer":1},"1080-6650-AA-2og-28":{"belegt":3,"kalt":0,"leer":0}};

// Multispace-Modulkatalog — Werte aus docs/workspace-management-requirements.md, Kapitel 5
// (Modulübersicht des Multispace Handbuchs, Stand 6.1.2025). Wo die Detailseite des
// Handbuchs von der Übersicht abweicht, steht die Abweichung als `abweichung` dabei —
// sie wird nicht stillschweigend geglättet.

const modules = [
  {
    nr: 1, name: 'Einzel Arbeitsplatz', richtmass: 3.0, subs: [
      { sub: '1', name: 'Einzel Arbeitsplatz', qm: 3.0, pers: 1 },
    ],
    charakteristik: 'Der persönliche oder unpersönliche Arbeitsplatz für konzentriertes Arbeiten am Bildschirm. Grundeinheit jeder Multispace-Fläche.',
    richtlinien: [
      'Einzelarbeitsplätze immer entlang der Fassade und rechtwinklig zum Tageslicht.',
      'Gruppen von höchstens vier Tischen.',
      'Drehwinkel gegenüber der Fassade höchstens 10°.',
    ],
    elemente: ['Steh-Sitz-Tisch 160×80', 'Bürodrehstuhl', 'Rollcontainer', 'Tischleuchte', 'Monitorhalterung'],
  },
  {
    nr: 2, name: 'Team Arbeitsplatz', richtmass: null, subs: [
      { sub: '2.1', name: 'Team Arbeitsplatz 6 Personen', qm: 25, pers: 6 },
      { sub: '2.2', name: 'Team Arbeitsplatz 8 Personen', qm: 35, pers: 8 },
    ],
    charakteristik: 'Zusammenhängende Tischgruppe für ein Team, mit gemeinsamer Ablage und akustischer Abschirmung.',
    richtlinien: [
      'Gruppen von höchstens vier Tischen bilden; grössere Teams über mehrere Gruppen verteilen.',
      'Akustikschirme zwischen gegenüberliegenden Plätzen.',
      'SECO-Vorgaben zu Abständen und Verkehrsflächen einhalten.',
    ],
    elemente: ['Steh-Sitz-Tische', 'Bürodrehstühle', 'Rollcontainer je Platz', 'Akustikschirm', 'Team-Ablage'],
  },
  {
    nr: 3, name: 'Fokus Arbeitsplatz', richtmass: 3.0, subs: [
      { sub: '3.1', name: 'Fokus 2-/3-/¾-seitig umschlossen', qm: 3.0, pers: 1 },
      { sub: '3.2', name: 'Einzelkoje', qm: 3.0, pers: 1 },
    ],
    charakteristik: 'Rückzug für konzentriertes Arbeiten ohne Raumbuchung. Nicht persönlich zugewiesen.',
    richtlinien: [
      'Gleichmässig auf der Fläche verteilen.',
      'Nicht in Fluchtwegen platzieren.',
    ],
    elemente: ['Fokusarbeitsplatz mit Umschliessung', 'Stuhl', 'Ablage', 'Beleuchtung'],
  },
  {
    nr: 4, name: 'Formelle Sitzungen', richtmass: null, subs: [
      { sub: '4.1.1', name: 'Sitzung sitzend 4 Personen', qm: 16, pers: 4 },
      { sub: '4.1.2', name: 'Sitzung sitzend 8 Personen', qm: 25, pers: 8 },
      { sub: '4.2.1', name: 'Sitzung stehend 4 Personen', qm: 16, pers: 4 },
      { sub: '4.2.2', name: 'Sitzung stehend 6 Personen', qm: 20, pers: 6 },
      { sub: '4.5', name: 'Besprechungsbox 4er', qm: 9, pers: 4 },
      { sub: '4.6', name: 'Besprechungsbox 2er', qm: 4.5, pers: 2 },
    ],
    charakteristik: 'Geschlossene oder halboffene Besprechung mit Bildschirm und Konferenztechnik, buchbar.',
    richtlinien: [
      'Boxen gleichmässig auf der Fläche verteilen, nicht in Fluchtwegen.',
      'Sichtverbindung zum Korridor vermeiden, wo vertraulich gesprochen wird.',
    ],
    elemente: ['Konferenztisch', 'Konferenzstühle', 'Bildschirm 65"', 'Konferenzkamera', 'Whiteboard'],
  },
  {
    nr: 5, name: 'Telefon- / Videokonferenzbox', richtmass: null, subs: [
      { sub: '5.1', name: 'VK-Box 1er', qm: 4.5, pers: 1, abweichung: 'Detailseite Handbuch: 6.0 m²' },
      { sub: '5.2', name: 'Telefonbox 1er', qm: 2.0, pers: 1 },
    ],
    charakteristik: 'Schallgedämmte Einzelkabine für Telefonate und Videokonferenzen.',
    richtlinien: [
      'Gleichmässig verteilen, nicht in Fluchtwegen.',
      'Nahe an Arbeitsplatzzonen, aber akustisch von ihnen getrennt.',
    ],
    elemente: ['Schallkabine', 'Stehpult oder Hocker', 'Bildschirm (nur 5.1)', 'Lüftung', 'Beleuchtung'],
  },
  {
    nr: 6, name: 'Informelle Sitzungen', richtmass: null, subs: [
      { sub: '6.1.1', name: 'Stehbesprechung rechteckig', qm: 4, pers: 4 },
      { sub: '6.1.2', name: 'Stehbesprechung rund', qm: 4, pers: 4 },
      { sub: '6.2', name: 'Besprechungskoje', qm: 9, pers: 4 },
      { sub: '6.3', name: 'Sofa Kabine', qm: 12, pers: 4 },
      { sub: '6.4', name: 'Sofa Lounge', qm: 20, pers: 6 },
      { sub: '6.5', name: 'Sessel Lounge', qm: 27, pers: 8 },
    ],
    charakteristik: 'Kurze, ungeplante Abstimmung ohne Buchung — der Gegenpol zum Sitzungszimmer.',
    richtlinien: [
      'In der Nähe von Korridorkreuzungen und Coffee Points platzieren.',
      'Nicht direkt hinter Arbeitsplätzen.',
    ],
    elemente: ['Stehtisch oder Sofa', 'Hocker / Sessel', 'Ablagefläche', 'Teppich'],
  },
  {
    nr: 7, name: 'Coffee Point', richtmass: null, subs: [
      { sub: '7.1', name: 'Tresen', qm: 3, pers: 4 },
      { sub: '7.2', name: 'Esstisch', qm: 9, pers: 6 },
      { sub: '7.3', name: 'Sitzbank', qm: 6, pers: 4 },
      { sub: '7.4', name: 'Bistro', qm: 6, pers: 4 },
      { sub: '7.5', name: 'Sofa Kabine', qm: 9, pers: 4 },
      { sub: '7.6', name: 'Lounge', qm: 9, pers: 6 },
    ],
    charakteristik: 'Sozialer Mittelpunkt der Fläche. Verpflegung, informeller Austausch, Pause.',
    richtlinien: [
      'Coffee Point möglichst im Zentrum der Fläche.',
      'Locker nahe Eingang und Coffee Point.',
    ],
    elemente: ['Küchenzeile', 'Kaffeemaschine', 'Tresen / Esstisch', 'Barhocker', 'Entsorgungsstation'],
  },
  {
    nr: 8, name: 'Interaktive Sitzungen', richtmass: null, subs: [
      { sub: '8.1', name: 'Auditorium', qm: 65, pers: 40 },
      { sub: '8.2', name: 'Kreativraum', qm: 30, pers: 12 },
      { sub: '8.3', name: 'Werkstatt', qm: 30, pers: 12 },
    ],
    charakteristik: 'Grossgruppen, Workshops und Präsentationen. Bestuhlung beweglich.',
    richtlinien: [
      'Auditorium nur einmal pro Gebäude.',
      'Nahe am Empfang, damit Externe die Fläche nicht queren müssen.',
    ],
    elemente: ['Stapelstühle', 'Klapptische', 'Präsentationstechnik', 'Whiteboardwand', 'Materialwagen'],
  },
  {
    nr: 9, name: 'Team Ablage', richtmass: null, subs: [
      { sub: '9.1', name: 'Ablage offen', qm: null, pers: null },
      { sub: '9.2', name: 'Ablage geschlossen', qm: null, pers: null },
      { sub: '9.3', name: 'Ablage geschlossen, abschliessbar', qm: null, pers: null },
    ],
    charakteristik: 'Gemeinsame Ablage eines Teams. Kein persönlicher Stauraum.',
    richtlinien: [
      'Ablage immer vom Korridor zugänglich, nie hinter dem Arbeitsplatz.',
    ],
    elemente: ['Regal / Schrankelement', 'Beschriftungsschiene', 'Ordner-Set'],
  },
  {
    nr: 10, name: 'Locker, Garderoben', richtmass: null, subs: [
      { sub: '10.1', name: 'Locker', qm: null, pers: null },
      { sub: '10.2', name: 'Garderobe', qm: null, pers: null },
      { sub: '10.3', name: 'Organizer', qm: null, pers: null },
    ],
    charakteristik: 'Persönlicher Stauraum am unpersönlichen Arbeitsplatz — Voraussetzung für Desk-Sharing.',
    richtlinien: [
      'Locker nahe Eingang und Coffee Point.',
    ],
    elemente: ['Lockerschrank', 'Garderobenelement', 'Schirmständer', 'Organizer-Box'],
  },
  {
    nr: 11, name: 'Service Funktionen', richtmass: null, subs: [
      { sub: '11.1', name: 'Entsorgungsstation', qm: null, pers: null },
    ],
    charakteristik: 'Entsorgung und Wertstofftrennung auf der Fläche.',
    richtlinien: [
      'Je Coffee Point mindestens eine Station.',
    ],
    elemente: ['Wertstoffbehälter 4-fach', 'Beschriftung', 'Bodenschutz'],
  },
];

// Einzelmöbelstücke je Sub-Modul — Stufe 2 der Auswertung (WSM-D4).
// Artikelnummern sind FIKTIV, im Muster der BBL-Materialnummer. Preise: keine
// (Handbuch: «Die Preise sind vertraulich zu behandeln»; Kapitel Kostenkennwerte leer).
const artikel = {
  '1':     [['Steh-Sitz-Tisch 160×80','MAT-10-4021',1],['Bürodrehstuhl','MAT-10-4102',1],['Rollcontainer','MAT-10-4210',1],['Tischleuchte','MAT-10-4330',1]],
  '2.1':   [['Steh-Sitz-Tisch 160×80','MAT-10-4021',6],['Bürodrehstuhl','MAT-10-4102',6],['Rollcontainer','MAT-10-4210',6],['Akustikschirm 160','MAT-10-4415',3]],
  '2.2':   [['Steh-Sitz-Tisch 160×80','MAT-10-4021',8],['Bürodrehstuhl','MAT-10-4102',8],['Rollcontainer','MAT-10-4210',8],['Akustikschirm 160','MAT-10-4415',4]],
  '3.2':   [['Fokuskoje 1er','MAT-30-2110',1],['Polsterstuhl','MAT-30-2140',1]],
  '4.1.1': [['Konferenztisch 200×100','MAT-40-1120',1],['Konferenzstuhl','MAT-40-1210',4],['Bildschirm 65"','MAT-40-1810',1]],
  '4.1.2': [['Konferenztisch 320×120','MAT-40-1140',1],['Konferenzstuhl','MAT-40-1210',8],['Bildschirm 75"','MAT-40-1820',1],['Whiteboard mobil','MAT-40-1910',1]],
  '4.5':   [['Besprechungsbox 4er','MAT-40-5040',1],['Polsterbank','MAT-40-5110',2],['Bildschirm 43"','MAT-40-1805',1]],
  '5.2':   [['Telefonbox 1er','MAT-50-2010',1],['Stehpult-Einlage','MAT-50-2050',1]],
  '6.4':   [['Sofa 3-Sitzer','MAT-60-4010',2],['Beistelltisch','MAT-60-4120',2],['Teppich 300×200','MAT-60-4310',1]],
  '7.1':   [['Küchentresen','MAT-70-1010',1],['Barhocker','MAT-70-1110',4]],
  '7.2':   [['Esstisch 200×90','MAT-70-2010',1],['Stuhl gepolstert','MAT-70-2110',6]],
  '7.6':   [['Loungesessel','MAT-70-6010',4],['Couchtisch','MAT-70-6120',1]],
  '9.1':   [['Regal offen 5 OH','MAT-90-1010',1],['Beschriftungsschiene','MAT-90-1210',1]],
  '10.1':  [['Lockerschrank 12 Fächer','MAT-A0-1010',1]],
  '11.1':  [['Wertstoffstation 4-fach','MAT-B0-1010',1]],
};

const subIndex = (() => {
  const m = new Map();
  for (const mod of modules) for (const s of mod.subs) m.set(s.sub, { ...s, mod });
  return m;
})();

const buildings = [
 {
  "id": "1080/4840/AF",
  "bez": "Bundeshaus West",
  "ort": "Bern",
  "plz": "3011",
  "str": "Bundesgasse 1, 3011 Bern",
  "land": "CH",
  "reg": "BE",
  "lat": 46.946346,
  "lon": 7.442977,
  "port": "Verwaltungsgebäude",
  "art": "Verwaltung",
  "bjahr": 1857,
  "nutzer": "EDA, Bundeskanzlei, EJPD, Parlamentsdienste",
  "hnf": 9800,
  "ngf": 13100,
  "gf": 15860,
  "astw": 6,
  "stat": "Aktiv",
  "floors": 1,
  "rooms": 14,
  "ap": 23,
  "img": "assets/images/buildings/1080-4840-AF_federal-palace-west_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-4840-AF_federal-palace-west_exterior.jpg"
  ]
 },
 {
  "id": "1080/4100/AC",
  "bez": "Campus BAZG (Ausbildungszentrum Liestal)",
  "ort": "Liestal",
  "plz": "4410",
  "str": "Kasinostrasse 4, 4410 Liestal",
  "land": "CH",
  "reg": "BL",
  "lat": 47.479862,
  "lon": 7.744051,
  "port": "Ausbildung",
  "art": "Ausbildung",
  "bjahr": 1981,
  "nutzer": "Bundesamt für Zoll und Grenzsicherheit BAZG",
  "hnf": 5600,
  "ngf": 7400,
  "gf": 2480,
  "astw": 3,
  "stat": "Aktiv",
  "floors": 2,
  "rooms": 57,
  "ap": 205,
  "img": "assets/images/buildings/1080-4100-AC_campus-bazg-training-centre-liestal_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-4100-AC_campus-bazg-training-centre-liestal_exterior.jpg"
  ]
 },
 {
  "id": "1080/6100/AA",
  "bez": "Landesmuseum Zürich",
  "ort": "Zürich",
  "plz": "8001",
  "str": "Museumstrasse 2, 8001 Zürich",
  "land": "CH",
  "reg": "ZH",
  "lat": 47.379024505615234,
  "lon": 8.540567398071289,
  "port": "Kultur",
  "art": "Kultur",
  "bjahr": 1898,
  "nutzer": "Schweizerisches Nationalmuseum SNM",
  "hnf": 7552,
  "ngf": 10148,
  "gf": 11800,
  "astw": 4,
  "stat": "Aktiv",
  "floors": 2,
  "rooms": 84,
  "ap": 229,
  "img": "assets/images/buildings/1080-6100-AA_swiss-national-museum-zurich_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-6100-AA_swiss-national-museum-zurich_exterior.jpg"
  ]
 },
 {
  "id": "1080/6430/AA",
  "bez": "Schweizerische Nationalbibliothek, Tiefmagazin West",
  "ort": "Bern",
  "plz": "3005",
  "str": "Hallwylstrasse 15, 3005 Bern",
  "land": "CH",
  "reg": "BE",
  "lat": 46.94121551513672,
  "lon": 7.449760913848877,
  "port": "Lager / Logistik",
  "art": "Bildung",
  "bjahr": 1931,
  "nutzer": "Schweizerische Nationalbibliothek NB",
  "hnf": 6082,
  "ngf": 8173,
  "gf": 9503,
  "astw": 4,
  "stat": "Aktiv",
  "floors": 2,
  "rooms": 69,
  "ap": 271,
  "img": "assets/images/buildings/1080-6430-AA_swiss-national-library-underground-storage_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-6430-AA_swiss-national-library-underground-storage_exterior.jpg"
  ]
 },
 {
  "id": "1080/6540/AA",
  "bez": "Verwaltungsgebäude Eichenweg 5, Areal Meielen Nord",
  "ort": "Zollikofen",
  "plz": "3052",
  "str": "Eichenweg 5, 3052 Zollikofen",
  "land": "CH",
  "reg": "BE",
  "lat": 46.99821472167969,
  "lon": 7.462268829345703,
  "port": "Verwaltungsgebäude",
  "art": "Verwaltung",
  "bjahr": 2023,
  "nutzer": "Eidgenössisches Departement für auswärtige Angelegenheiten EDA",
  "hnf": 21504,
  "ngf": 28896,
  "gf": 33600,
  "astw": 9,
  "stat": "Aktiv",
  "floors": 0,
  "rooms": 0,
  "ap": 0,
  "img": "assets/images/buildings/1080-6540-AA_eichenweg-5-administrative-building_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-6540-AA_eichenweg-5-administrative-building_exterior.jpg"
  ]
 },
 {
  "id": "1080/6650/AA",
  "bez": "Verwaltungsgebäude Liebefeld (BAG / BLV)",
  "ort": "Liebefeld",
  "plz": "3097",
  "str": "Schwarzenburgstrasse 157, 3097 Liebefeld",
  "land": "CH",
  "reg": "BE",
  "lat": 46.929893493652344,
  "lon": 7.42135763168335,
  "port": "Verwaltungsgebäude",
  "art": "Verwaltung",
  "bjahr": 2015,
  "nutzer": "Bundesamt für Gesundheit BAG; Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV",
  "hnf": 19136,
  "ngf": 25714,
  "gf": 29900,
  "astw": 7,
  "stat": "Aktiv",
  "floors": 3,
  "rooms": 80,
  "ap": 262,
  "img": "assets/images/buildings/1080-6650-AA_liebefeld-administrative-building-bag-blv_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-6650-AA_liebefeld-administrative-building-bag-blv_exterior.jpg"
  ]
 },
 {
  "id": "1080/4850/AG",
  "bez": "Verwaltungszentrum Guisanplatz",
  "ort": "Bern",
  "plz": "3014",
  "str": "Guisanplatz 1, 3014 Bern",
  "land": "CH",
  "reg": "BE",
  "lat": 46.959785,
  "lon": 7.463306,
  "port": "Verwaltungsgebäude",
  "art": "Verwaltung",
  "bjahr": 2019,
  "nutzer": "armasuisse, Bundesanwaltschaft, fedpol, BABS",
  "hnf": 2200,
  "ngf": 3000,
  "gf": 30000,
  "astw": 6,
  "stat": "Abgang",
  "floors": 2,
  "rooms": 45,
  "ap": 88,
  "img": "assets/images/buildings/1080-4850-AG_guisanplatz-administrative-centre_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-4850-AG_guisanplatz-administrative-centre_exterior.jpg",
   "assets/images/buildings/1080-4850-AG_guisanplatz-administrative-centre_interior.jpg",
   "assets/images/buildings/1080-4850-AG_guisanplatz-administrative-centre_surroundings.jpg"
  ]
 },
 {
  "id": "1080/6210/AA",
  "bez": "Zollanlage Brig-Glis",
  "ort": "Glis",
  "plz": "3902",
  "str": "Bielstrasse 1, 3902 Glis",
  "land": "CH",
  "reg": "VS",
  "lat": 46.3072624206543,
  "lon": 7.964066505432129,
  "port": "Zoll",
  "art": "Zoll",
  "bjahr": 2017,
  "nutzer": "Bundesamt für Zoll und Grenzsicherheit BAZG",
  "hnf": 1834,
  "ngf": 2464,
  "gf": 2865,
  "astw": 3,
  "stat": "Aktiv",
  "floors": 1,
  "rooms": 19,
  "ap": 27,
  "img": "assets/images/buildings/1080-6210-AA_customs-facility-brig-glis_exterior.jpg",
  "imgs": [
   "assets/images/buildings/1080-6210-AA_customs-facility-brig-glis_exterior.jpg",
   "assets/images/buildings/1080-6210-AA_customs-facility-brig-glis_interior.jpg"
  ]
 }
];
window.WSM = { buildings, building, floors, spaces, placements, sus, modules, artikel, subIndex };
})();
