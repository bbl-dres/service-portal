// Multispace-Modulkatalog — Werte aus docs/workspace-management-requirements.md, Kapitel 5
// (Modulübersicht des Multispace Handbuchs, Stand 6.1.2025). Wo die Detailseite des
// Handbuchs von der Übersicht abweicht, steht die Abweichung als `abweichung` dabei —
// sie wird nicht stillschweigend geglättet.

export const modules = [
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
export const artikel = {
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

export const subIndex = (() => {
  const m = new Map();
  for (const mod of modules) for (const s of mod.subs) m.set(s.sub, { ...s, mod });
  return m;
})();
