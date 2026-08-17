// Enrich data/projects.json with the read-only reporting fields shown on the
// construction-project detail tabs (#/app/projects/:id):
//   gf            floor area (SIA 416) in m², used by the BKP-2 benchmark
//   bkp           planned cost by BKP main group; group 2 is the existing bkp2
//                 value and the groups always sum exactly to plannedTotalCost
//   meilensteine  milestone list; quoted German keys are the persisted schema
//   risiken       risk register; quoted German keys are the persisted schema
//
// Milestones and risks are hand-authored per project below: their wording is
// domain content (SIA-phase gates, Verpflichtungskredit, Denkmalpflege …), not
// something a formula produces. The numeric fields are computed so the demo
// stays arithmetically consistent when cost figures change.
//
//   node scripts/build-project-report-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, normalize } from 'node:path';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..')) + '/';
const FILE = ROOT + 'data/projects.json';
const projects = JSON.parse(readFileSync(FILE, 'utf8'));

// Rough planning benchmarks (BKP 2 per m² floor area) by sub-portfolio, CHF/m². Labs and
// listed parliament buildings are costlier than standard office space.
const BKP2_PER_M2 = {
  'Verwaltung': 3100, 'Bildung und Forschung': 3600, 'Parlament und Regierung': 3900,
  'Kultur und Denkmäler': 3400, 'Zoll': 3000, 'Wohnen': 2800,
};

// Share of non-building cost (plannedTotalCost − BKP 2) per remaining main
// group. Group 0 (land) stays absent because the Confederation already owns it.
const REMAINDER_SHARES = [['1', 0.16], ['3', 0.22], ['4', 0.16], ['9', 0.18]]; // '5' absorbs the rest

const MILESTONES = {
  'PRJ-01': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2023', effektiv: 'Q1 2023' },
    { label: 'Vorprojekt genehmigt', geplant: 'Q4 2023', effektiv: 'Q4 2023' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q3 2024', effektiv: 'Q1 2025' },
    { label: 'Baubeginn Etappe 1', geplant: 'Q3 2025', effektiv: 'Q4 2025' },
    { label: 'Übergabe an Nutzer', geplant: 'Q4 2027', effektiv: null },
  ],
  'PRJ-02': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2025', effektiv: 'Q1 2025' },
    { label: 'Vorprojekt genehmigt', geplant: 'Q1 2026', effektiv: 'Q1 2026' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q4 2026', effektiv: null },
    { label: 'Baubeginn', geplant: 'Q2 2027', effektiv: null },
    { label: 'Übergabe an Nutzer', geplant: 'Q4 2027', effektiv: null },
  ],
  'PRJ-03': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2026', effektiv: 'Q1 2026' },
    { label: 'Vorstudien abgeschlossen', geplant: 'Q4 2026', effektiv: null },
    { label: 'Vorprojekt genehmigt', geplant: 'Q4 2027', effektiv: null },
    { label: 'Botschaft / Verpflichtungskredit', geplant: 'Q2 2029', effektiv: null },
    { label: 'Baubeginn', geplant: 'Q1 2030', effektiv: null },
    { label: 'Übergabe an Nutzer', geplant: 'Q4 2032', effektiv: null },
  ],
  'PRJ-04': [
    { label: 'Projektauftrag erteilt', geplant: 'Q2 2024', effektiv: 'Q2 2024' },
    { label: 'Vorprojekt genehmigt', geplant: 'Q1 2025', effektiv: 'Q1 2025' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q1 2026', effektiv: 'Q2 2026' },
    { label: 'Zuschlag Gesamtleistung', geplant: 'Q1 2027', effektiv: null },
    { label: 'Baubeginn', geplant: 'Q3 2027', effektiv: null },
    { label: 'Übergabe an Nutzer', geplant: 'Q4 2029', effektiv: null },
  ],
  'PRJ-05': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2018', effektiv: 'Q1 2018' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q1 2019', effektiv: 'Q1 2019' },
    { label: 'Baubeginn', geplant: 'Q3 2019', effektiv: 'Q3 2019' },
    { label: 'Bauabnahme', geplant: 'Q2 2021', effektiv: 'Q2 2021' },
    { label: 'Projektabschluss', geplant: 'Q4 2021', effektiv: 'Q4 2021' },
  ],
  'PRJ-06': [
    { label: 'Projektauftrag erteilt', geplant: 'Q2 2017', effektiv: 'Q2 2017' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q2 2018', effektiv: 'Q3 2018' },
    { label: 'Baubeginn', geplant: 'Q1 2019', effektiv: 'Q1 2019' },
    { label: 'Bauabnahme', geplant: 'Q4 2020', effektiv: 'Q1 2021' },
    { label: 'Projektabschluss', geplant: 'Q3 2021', effektiv: 'Q3 2021' },
  ],
  'PRJ-07': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2024', effektiv: 'Q1 2024' },
    { label: 'Vorprojekt genehmigt', geplant: 'Q4 2024', effektiv: null },
    { label: 'Bauprojekt genehmigt', geplant: 'Q3 2025', effektiv: null },
    { label: 'Baubeginn', geplant: 'Q2 2026', effektiv: null },
    { label: 'Übergabe an Nutzer', geplant: 'Q4 2028', effektiv: null },
  ],
  'PRJ-08': [
    { label: 'Projektauftrag erteilt', geplant: 'Q2 2025', effektiv: 'Q2 2025' },
    { label: 'Vorprojekt genehmigt', geplant: 'Q4 2025', effektiv: 'Q4 2025' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q3 2026', effektiv: null },
    { label: 'Montagebeginn PV-Anlage', geplant: 'Q4 2026', effektiv: null },
    { label: 'Inbetriebnahme', geplant: 'Q4 2026', effektiv: null },
  ],
  'PRJ-09': [
    { label: 'Projektauftrag erteilt', geplant: 'Q1 2016', effektiv: 'Q1 2016' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q4 2016', effektiv: 'Q4 2016' },
    { label: 'Baubeginn', geplant: 'Q2 2017', effektiv: 'Q2 2017' },
    { label: 'Bauabnahme', geplant: 'Q2 2018', effektiv: 'Q2 2018' },
    { label: 'Projektabschluss', geplant: 'Q4 2018', effektiv: 'Q4 2018' },
  ],
  'PRJ-10': [
    { label: 'Projektauftrag erteilt', geplant: 'Q2 2022', effektiv: 'Q2 2022' },
    { label: 'Bauprojekt genehmigt', geplant: 'Q1 2023', effektiv: 'Q1 2023' },
    { label: 'Baubeginn', geplant: 'Q4 2023', effektiv: 'Q4 2023' },
    { label: 'Bauabnahme', geplant: 'Q4 2025', effektiv: 'Q1 2026' },
    { label: 'Übergabe an Betrieb', geplant: 'Q2 2026', effektiv: null },
  ],
};

// The highest persisted risk rating must agree with the project's traffic light.
const RISKS = {
  'PRJ-01': [
    { id: 'R-01', thema: 'Schadstofffunde im Bestand (Asbest, PCB)', einstufung: 'mittel', massnahme: 'Laufende Beprobung; Rückstellung im Kostendach eingestellt.' },
    { id: 'R-02', thema: 'Denkmalpflegerische Auflagen an der Fassade', einstufung: 'mittel', massnahme: 'Bemusterung vorgezogen, enge Abstimmung mit der Denkmalpflege.' },
    { id: 'R-03', thema: 'Lieferfristen Haustechnik-Komponenten', einstufung: 'tief', massnahme: 'Frühzeitige Beschaffung, Alternativprodukte geprüft.' },
  ],
  'PRJ-02': [
    { id: 'R-01', thema: 'Bauarbeiten im bewohnten Bestand', einstufung: 'tief', massnahme: 'Etappierung je Hausteil, Information der Bewohnenden.' },
    { id: 'R-02', thema: 'Kostenentwicklung Gebäudehülle', einstufung: 'tief', massnahme: 'Kostendach mit Reserve; Baupreisindex wird beobachtet.' },
    { id: 'R-03', thema: 'Baubewilligungsverfahren Stadt Bern', einstufung: 'tief', massnahme: 'Vorabklärung mit der Bewilligungsbehörde erfolgt.' },
  ],
  'PRJ-03': [
    { id: 'R-01', thema: 'Verpflichtungskredit noch nicht bewilligt', einstufung: 'hoch', massnahme: 'Botschaftsplanung mit der EFV abgestimmt; Etappierung vorbereitet.' },
    { id: 'R-02', thema: 'Nutzeranforderungen Labore nicht konsolidiert', einstufung: 'hoch', massnahme: 'Bedarfsworkshops mit Agroscope bis Q4 2026.' },
    { id: 'R-03', thema: 'Baugrund und Altlasten am Standort', einstufung: 'mittel', massnahme: 'Baugrunduntersuchung im Auftrag der Vorstudien.' },
    { id: 'R-04', thema: 'Marktkapazitäten für Grossprojekte', einstufung: 'mittel', massnahme: 'Frühe Marktsondierung; Vergabe in Losen geprüft.' },
  ],
  'PRJ-04': [
    { id: 'R-01', thema: 'Einsprachen im Vergabeverfahren', einstufung: 'mittel', massnahme: 'Rechtsdienst einbezogen; Debriefings für Anbietende vorgesehen.' },
    { id: 'R-02', thema: 'Schnittstellen zur Etappe 1 im laufenden Betrieb', einstufung: 'mittel', massnahme: 'Koordinationsgremium Campus etabliert.' },
    { id: 'R-03', thema: 'Teuerung Baumeisterarbeiten', einstufung: 'tief', massnahme: 'Indexierte Verträge, Reserve im Verpflichtungskredit.' },
  ],
  'PRJ-05': [
    { id: 'R-01', thema: 'Befundlage der historischen Substanz', einstufung: 'tief', massnahme: 'Restauratorische Voruntersuchung durchgeführt; Projekt abgeschlossen.' },
    { id: 'R-02', thema: 'Terminfenster Parlamentsbetrieb', einstufung: 'tief', massnahme: 'Arbeiten in den Sessionspausen ausgeführt.' },
  ],
  'PRJ-06': [
    { id: 'R-01', thema: 'Grundwasser beim Aushub Tiefmagazin', einstufung: 'tief', massnahme: 'Abdichtungskonzept umgesetzt; Projekt abgeschlossen.' },
    { id: 'R-02', thema: 'Klimastabilität der Magazinräume', einstufung: 'tief', massnahme: 'Monitoring im Probebetrieb bestätigt.' },
  ],
  'PRJ-07': [
    { id: 'R-01', thema: 'Standortstrategie BAZG offen', einstufung: 'hoch', massnahme: 'Projekt sistiert; Entscheid GS-EFD wird abgewartet.' },
    { id: 'R-02', thema: 'Mehrkosten durch Projektunterbruch', einstufung: 'mittel', massnahme: 'Minimaler Erhaltungsunterhalt sichergestellt.' },
    { id: 'R-03', thema: 'Ressourcen bei Wiederaufnahme', einstufung: 'mittel', massnahme: 'Wiederanlaufplan dokumentiert.' },
  ],
  'PRJ-08': [
    { id: 'R-01', thema: 'Netzanschluss und Einspeisebewilligung', einstufung: 'tief', massnahme: 'Abklärung mit dem Netzbetreiber abgeschlossen.' },
    { id: 'R-02', thema: 'Lieferfristen PV-Module', einstufung: 'tief', massnahme: 'Rahmenvertrag mit Lieferwerk; Module disponiert.' },
  ],
  'PRJ-09': [
    { id: 'R-01', thema: 'Wetterfenster für Dacharbeiten', einstufung: 'tief', massnahme: 'Etappierung mit Notabdeckung; Projekt abgeschlossen.' },
    { id: 'R-02', thema: 'Auflagen der Lokalbehörden (NYC)', einstufung: 'tief', massnahme: 'Permits frühzeitig eingeholt.' },
  ],
  'PRJ-10': [
    { id: 'R-01', thema: 'Inbetriebnahme im laufenden Museumsbetrieb', einstufung: 'mittel', massnahme: 'Nacht- und Schliesstage genutzt; Probebetrieb verlängert.' },
    { id: 'R-02', thema: 'Raumklima der Sammlungsdepots', einstufung: 'mittel', massnahme: 'Feinjustierung mit Monitoring bis Q4 2026.' },
    { id: 'R-03', thema: 'Restleistungen der Unternehmer', einstufung: 'tief', massnahme: 'Garantierückbehalt; Mängelliste wird geführt.' },
  ],
};

for (const p of projects) {
  const total = Number(p.plannedTotalCost) || 0;
  const bkp2 = Number(p.bkp2) || 0;

  const kennwert = BKP2_PER_M2[p.subPortfolio] || 3200;
  p.gf = Math.round(bkp2 / kennwert / 50) * 50;

  // BKP split: distribute the non-building remainder over groups 1/3/4/9 with
  // fixed shares, rounded to CHF 10'000; group 5 absorbs the rounding rest so
  // the Hauptgruppen always sum exactly to plannedTotalCost.
  const remainder = total - bkp2;
  const bkp = { '2': bkp2 };
  let assigned = 0;
  for (const [group, share] of REMAINDER_SHARES) {
    bkp[group] = Math.round(remainder * share / 10000) * 10000;
    assigned += bkp[group];
  }
  bkp['5'] = remainder - assigned;
  p.bkp = Object.fromEntries(Object.entries(bkp).sort(([a], [b]) => Number(a) - Number(b)));

  p.meilensteine = MILESTONES[p.projectId] || [];
  p.risiken = RISKS[p.projectId] || [];

  // Data fix: phase 21 is «Vorstudien» in the SIA-112 reference list
  // (data/reference-data.json); the label said «Vorprojekt» (= phase 31).
  if (p.siaPhase === '21') p.siaPhaseLabel = 'Vorstudien';
}

writeFileSync(FILE, JSON.stringify(projects, null, 2) + '\n');
console.log(`${projects.length} Projekte aktualisiert → data/projects.json`);
for (const p of projects) {
  const sum = Object.values(p.bkp).reduce((s, v) => s + v, 0);
  if (sum !== p.plannedTotalCost) throw new Error(`${p.projectId}: BKP-Summe ${sum} ≠ ${p.plannedTotalCost}`);
}
