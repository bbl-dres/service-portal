// Aus dem Portal-Ast von data/processes.json grobe BPMN-Dateien bauen.
//
// Die Ablaeufe des Portals sind als Schrittketten erfasst — Status, Bezeichnung,
// Rolle, Art. Das ist genug fuer ein lesbares Diagramm: Startereignis, je Schritt
// eine Aufgabe in der Bahn ihrer Rolle, Endereignis, und die Kette dazwischen.
//
// GROB heisst grob: keine Gateways, keine Schleifen, keine Ausnahmen. Was hier
// entsteht, ist die Hauptstrasse — und genau die soll ein Leser sehen, um zu
// sagen «hier fehlt ein Schritt» oder «diese Rolle ist falsch». Verzweigungen
// kaeme man nur mit erfundenen Daten hinein, und erfundene Daten in einer
// Prozessdokumentation sind schlimmer als fehlende.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = 'c:/Users/david/Documents/GitHub/service-portal/';
const OUT = ROOT + 'assets/bpmn/';
// Seit 2026-08-15 stehen die Ablaeufe in processes.json, unterschieden durch
// ihren Ast. `defId` heisst dort `processId`.
const defs = JSON.parse(readFileSync(ROOT + 'data/processes.json', 'utf8'))
  .filter((r) => r.branch === 'portal' && Array.isArray(r.steps) && r.steps.length)
  .map((r) => ({ ...r, defId: r.processId }));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Kennungen muessen XML-NCName sein: Buchstabe oder _ am Anfang, danach nur
// Buchstaben, Ziffern, - und _.
const id = (s) => 'x' + String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '_').replace(/_+$/g, '');

// Art des Schritts → BPMN-Aufgabentyp. «auto» und «system» laufen ohne Zutun
// eines Menschen, das ist eine Service-Aufgabe; «user» ist eine Benutzeraufgabe.
const TASK_TAG = { user: 'userTask', auto: 'serviceTask', system: 'serviceTask' };

const W = 150, H = 80, GAP = 60, LANE_H = 140, LANE_X = 180, LEFT = 240;

function buildOne(def) {
  const steps = def.steps || [];
  const roles = [...new Set(steps.map((s) => s.role).filter(Boolean))];
  if (!roles.length) roles.push('Portal');
  const laneOf = (role) => Math.max(0, roles.indexOf(role || roles[0]));

  // Knoten der Reihe nach: Start, Schritte, Ende.
  const nodes = [
    { nid: id(def.defId + '_start'), tag: 'startEvent', name: 'Antrag ausgeloest', lane: 0, w: 36, h: 36 },
    ...steps.map((s, i) => ({
      nid: id(`${def.defId}_s${i + 1}_${s.status || s.label}`),
      tag: TASK_TAG[s.kind] || 'task',
      name: s.label || s.status || `Schritt ${i + 1}`,
      lane: laneOf(s.role), w: W, h: H,
    })),
    { nid: id(def.defId + '_end'), tag: 'endEvent', name: 'Abgeschlossen', lane: laneOf((steps[steps.length - 1] || {}).role), w: 36, h: 36 },
  ];
  nodes.forEach((n, i) => {
    const cx = LEFT + i * (W + GAP);
    n.x = cx + (W - n.w) / 2;
    n.y = 60 + n.lane * LANE_H + (H - n.h) / 2;
  });

  const flows = nodes.slice(0, -1).map((n, i) => ({
    fid: id(`${def.defId}_f${i + 1}`), from: n, to: nodes[i + 1],
  }));

  const procId = id('proc_' + def.defId);
  const width = LEFT + nodes.length * (W + GAP) + 80;

  const laneXml = roles.map((role, i) => {
    const mine = nodes.filter((n) => n.lane === i);
    return `      <bpmn:lane id="${id(def.defId + '_lane_' + role)}" name="${esc(role)}">\n`
      + mine.map((n) => `        <bpmn:flowNodeRef>${n.nid}</bpmn:flowNodeRef>`).join('\n')
      + '\n      </bpmn:lane>';
  }).join('\n');

  const nodeXml = nodes.map((n) => {
    const inc = flows.filter((f) => f.to === n).map((f) => `        <bpmn:incoming>${f.fid}</bpmn:incoming>`);
    const out = flows.filter((f) => f.from === n).map((f) => `        <bpmn:outgoing>${f.fid}</bpmn:outgoing>`);
    const kids = [...inc, ...out].join('\n');
    return `      <bpmn:${n.tag} id="${n.nid}" name="${esc(n.name)}">\n${kids}\n      </bpmn:${n.tag}>`;
  }).join('\n');

  const flowXml = flows.map((f) =>
    `      <bpmn:sequenceFlow id="${f.fid}" sourceRef="${f.from.nid}" targetRef="${f.to.nid}"/>`).join('\n');

  const shapeXml = nodes.map((n) =>
    `        <bpmndi:BPMNShape id="${n.nid}_di" bpmnElement="${n.nid}">\n`
    + `          <dc:Bounds x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${n.w}" height="${n.h}"/>\n`
    + '        </bpmndi:BPMNShape>').join('\n');

  const laneShapeXml = roles.map((role, i) =>
    `        <bpmndi:BPMNShape id="${id(def.defId + '_lane_' + role)}_di" bpmnElement="${id(def.defId + '_lane_' + role)}" isHorizontal="true">\n`
    + `          <dc:Bounds x="${LANE_X}" y="${40 + i * LANE_H}" width="${width - LANE_X}" height="${LANE_H}"/>\n`
    + '        </bpmndi:BPMNShape>').join('\n');

  const edgeXml = flows.map((f) =>
    `        <bpmndi:BPMNEdge id="${f.fid}_di" bpmnElement="${f.fid}">\n`
    + `          <di:waypoint x="${Math.round(f.from.x + f.from.w)}" y="${Math.round(f.from.y + f.from.h / 2)}"/>\n`
    + `          <di:waypoint x="${Math.round(f.to.x)}" y="${Math.round(f.to.y + f.to.h / 2)}"/>\n`
    + '        </bpmndi:BPMNEdge>').join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
    id="${id('definitions_' + def.defId)}"
    targetNamespace="http://kundenportal.local/bpmn">
  <bpmn:process id="${procId}" name="${esc(def.name)}" isExecutable="false">
    <bpmn:laneSet id="${id(def.defId + '_laneset')}">
${laneXml}
    </bpmn:laneSet>
${nodeXml}
${flowXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="${id(def.defId + '_diagram')}">
    <bpmndi:BPMNPlane id="${id(def.defId + '_plane')}" bpmnElement="${procId}">
${laneShapeXml}
${shapeXml}
${edgeXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

mkdirSync(OUT, { recursive: true });
for (const def of defs) {
  const name = `portal-${def.defId}.bpmn`;
  writeFileSync(OUT + name, buildOne(def), 'utf8');
  console.log(name.padEnd(34) + `${(def.steps || []).length} Schritte · `
    + `${new Set((def.steps || []).map((s) => s.role)).size} Rollen`);
}
console.log(`\n${defs.length} Dateien in assets/bpmn/`);
