# Paginierung und Trefferzahl — CD-Abgleich (August 2026)

**Geteiltes Dokument.** Identische Kopie in
`service-portal/docs/pagination-alignment.md` und
`tenant-portal/docs/pagination-alignment.md`. Referenz ist der Code von
[`swiss/designsystem`](https://github.com/swiss/designsystem) — gelesen wurden
`css/components/pagination.postcss`,
`app/components/ch/components/Pagination.vue`, `PaginationItem.vue`,
`app/pages/searchResults.vue` und `SearchResultsFilters.vue`.

---

## 1. Was das Design System tatsächlich baut

### 1.1 Die Paginierung — und was NICHT darin steht

`Pagination.vue:2-24`:

```html
<div class="pagination" :class="!field ? 'pagination--extended' : ''">
  <input v-if="field" class="pagination__input" …>          <!-- Seitenfeld -->
  <div v-if="field" class="pagination__text">{{ totalPages }}</div>
  <ul class="pagination_items">
    <li><PaginationItem …></li>                              <!-- zurück / vor -->
  </ul>
</div>
```

Drei Kinder: **Feld, Seitentext, Steuerliste.** `PaginationItem.vue` ist ein
`<button class="btn btn--outline btn--icon-only">` mit `aria-label`.

**Es gibt kein Zählelement.** Weder im Markup noch in
`pagination.postcss:5-31`, das nur `.pagination`, `input`,
`.pagination__text`, `ul`, `.pagination--extended` und `.pagination--right`
kennt.

### 1.2 Wo die Trefferzahl steht

`searchResults.vue:83-87` — **über** den Resultaten, neben der Sortierung:

```html
<div class="search-results__header">
  <div><strong>127</strong>Suchergebnisse</div>
  <div class="search-results__sort">…</div>
</div>
```

`search.postcss:208-218` gibt dieser Zeile `flex … justify-between`, `text--sm`
und eine untere Trennlinie. Das ist exakt die Rolle, die beide Prototypen
`.catbar` nennen.

**Die Arbeitsteilung ist also eindeutig:**

| | Was es sagt | Wo |
| --- | --- | --- |
| `.catbar__count` | die **Trefferzahl** | über den Resultaten, neben Sortierung und Filter |
| `.pagination__input` + `.pagination__text` | die **Seite** | unter den Resultaten |
| `.pagination` `ul` | zurück / vor | unter den Resultaten |

---

## 2. Befund

Gemessen auf zwölf paginierenden Routen beider Prototypen (Playwright, 1440 px).

### 2.1 Dieselbe Zahl zweimal

| Route | Leiste | Paginierung |
| --- | --- | --- |
| Mieterportal · Vorgänge | «11 Vorgänge» | «1–11 von 11 Vorgängen» |
| Mieterportal · Dokumente einer Liegenschaft | «11 Dokumente» | «1–10 von 11 Dokumenten» |
| Service-Portal · Meine Vorgänge | «6 von 6 Vorgängen» | «1–6 von 6 Vorgängen» |

### 2.2 Die Seitenangabe ebenfalls zweimal

Acht Leisten des Service-Portals hängten die Seitenposition an die Trefferzahl:

> «20 von 20 Datensätze **· Seite 1 von 2**» — während direkt unter der Liste
> `.pagination__text` «von 2 Seiten» sagte.

### 2.3 Zwei Bauteile, zwei Anatomien

| | Mieterportal | Service-Portal | CD |
| --- | --- | --- | --- |
| Reihenfolge | Zähler · zurück · Feld · Seitentext · vor | Feld · Seitentext · `ul`(zurück, vor) | **Feld · Seitentext · `ul`** |
| Steuerelemente in einer `<ul>` | nein | ja | **ja** |
| Zählelement | `.pagination__count` | (in dieser Welle ergänzt) | **keines** |

### 2.4 Zwei Zählsätze

«20 **von 20** Datensätze» sagt dieselbe Zahl zweimal, wenn nichts gefiltert
ist. Das Mieterportal formulierte in diesem Fall bereits «11 Vorgänge».

---

## 3. Entscheid

### P1 · Die Trefferzahl steht **einmal**, in der Leiste

`.pagination__count` entfällt in beiden Prototypen. Zwei Oberflächen des
Mieterportals (Liegenschaften, Dokumente) trugen ihre Zahl ausschliesslich im
Fuss — sie bekommen sie in der Leiste, damit nichts verloren geht.

### P2 · Die Seitenangabe steht **einmal**, in der Paginierung

Der Zusatz «· Seite X von Y» verschwindet aus allen acht Leisten des
Service-Portals. `.pagination__text` sagt es bereits.

### P3 · CD-Anatomie und CD-Reihenfolge

Das Mieterportal übernimmt `Pagination.vue`s Aufbau: Feld, Seitentext, dann
zurück/vor in einer `<ul class="pagination__items">`.

### P4 · Ein Zählsatz für beide Prototypen

```
kein Bestand   →  «Keine Vorgänge»
ungefiltert    →  «<strong>11</strong> Vorgänge»
gefiltert      →  «<strong>3</strong> von 11 Vorgängen»      (Dativ)
leere Auswahl  →  «Keine Vorgänge für diese Auswahl»
```

Die Zahl ist ausgezeichnet, wie im CD (`<strong>127</strong>Suchergebnisse`).
Ungefiltert steht der blosse Bestand — «6 von 6» nennt dieselbe Zahl zweimal.
Gefiltert steht, was die Auswahl übrig liess; das ist die Frage, die man nach
einem Klick auf einen Filter hat.

Implementiert als **eine Funktion je Repositorium**:
`C.countText(unit, total, shown)` (Service-Portal,
`js/ui/components/catalogue.js`) und `countText({ total, shown, one, many,
dative })` (Mieterportal, `js/pagination.js`). Vierzehn Aufrufstellen bauten
den Satz vorher selbst zusammen.

### P5 · Die Paginierung bleibt immer sichtbar

Unverändert gültig aus der vorangehenden Welle: der Fuss verschwindet nicht,
wenn eine Seite genügt. «Seite 1 von 1» ist eine Auskunft, und ein
Steuerelement, das erst ab elf Zeilen erscheint, lässt dieselbe Oberfläche für
verschiedene Datenbestände verschieden aussehen.

---

## 4. Umgesetzt

| | Service-Portal | Mieterportal |
| --- | --- | --- |
| P1 `.pagination__count` entfernt (Markup + CSS) | umgesetzt | umgesetzt |
| P1 Zahl in die Leiste nachgezogen | — (überall vorhanden) | Liegenschaften, Dokumente |
| P2 «· Seite X von Y» aus der Leiste entfernt | 8 Stellen | — (nie vorhanden) |
| P3 CD-Anatomie der Paginierung | bereits vorhanden | umgesetzt |
| P4 gemeinsamer Zählsatz | 9 Aufrufstellen | 5 Aufrufstellen |
| CSS auf CD zurückgeführt | `.pagination` wieder `items-stretch`, ohne `width:100%` | `.pagination__count` gelöscht |

### Angepasste Prüfungen

Sieben Prüfungen hielten die alte Formulierung oder den alten Fuss fest:

- `service-portal`: `test-tenancies`, `test-media-library`, `test-workspace`
  (Zählsatz ohne «N von N»), `test-portfolio` (Seitenangabe jetzt aus
  `.pagination__text` statt aus der Leiste).
- `tenant-portal`: `check-detail-tables` — «der Fuss benennt das Fenster» wird
  zu «der Fuss benennt die Seite», und dass die Vorwärtstaste das Fenster
  bewegt, wird jetzt am Seitenfeld **und** an der ersten Zeile geprüft statt am
  Bereichssatz.

Diese Prüfungen haben ihren Zweck behalten; nur die Eigenschaft, an der sie ihn
messen, ist umgezogen — genau wie die Anzeige.
