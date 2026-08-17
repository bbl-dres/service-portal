# Planning-example imagery review

> Date: 2026-08-17
> Scope: `#/knowledge/workspace/inspiration`, the planning-example preview on
> `#/knowledge/workspace/multispace`, and the twelve project-local visualisations
> under `assets/images/workspace-examples/`
> Status: implemented and verified against the final imagery, data, runtime,
> interaction, and repository contracts

## Outcome

The four planning examples now combine truthful location context with a coherent
three-image interior concept. Each card and gallery starts with one existing,
real photograph of the building. The gallery then presents a generated `01`
hero that explains the whole workplace concept and two companion views that
isolate its most important module combinations. The resulting four-item sequence
keeps the real location distinct from the plausible interior proposal.

These files are deliberately **illustrative, AI-generated, and non-binding**.
They are not photographs of the completed spaces, measured reconstructions,
approved designs, or evidence of compliance with the Multispace handbook,
accessibility rules, fire-safety requirements, SECO guidance, or the security
requirements of an embassy or customs facility.

## Evidence reviewed

The prior planning-example galleries referenced sixteen building-media records.
One per example remains active as the card cover and first gallery item; the
other three leave the active gallery:

| Example | Retained context item | Other legacy references | Architectural evidence carried forward |
| --- | --- | --- | --- |
| WSE-001 · Bundeshaus West | `MED-001` | `MED-003`, `MED-004`, `MED-005` | Arched openings, high historic volumes, warm stone, restrained green and burgundy, and the relationship between protected fabric and contemporary insertions. |
| WSE-002 · Embassy Berlin | `MED-008` | `MED-009`, `MED-010`, `MED-011` | Pale mineral surfaces, dark window frames, grey floors, quiet geometry, garden glazing, and an understated diplomatic waiting-room character. |
| WSE-003 · Customs facility Brig-Glis | `MED-077` | `MED-078`, `MED-079`, `MED-080` | A long glazed hall, light counters, acoustic ceiling rafts, dark mullions, durable grey floors, and diffuse Alpine daylight. |
| WSE-004 · Embassy Canberra | `MED-058` | `MED-059`, `MED-060`, `MED-061` | Warm brick and concrete, timber-slat ceilings, cylindrical concrete columns, full-height glazing, and restrained mid-century colour and furniture cues. |

Those records are not photographs of the configured module combinations. Only
`MED-001` is marked `CC BY-SA 4.0`; the other fifteen are marked as non-free BBL
media-library material. Each retained context image therefore keeps its own
media attribution and rights state. The other twelve no longer appear as active
gallery items, although their identifiers remain recognised for legacy shared
links. The generated images take broad architectural cues from the reviewed
references without editing a source photograph or attempting an exact copy of
its composition or artwork, and they do not inherit those source licences.

All twelve final JPEGs were then inspected at full size. The review found:

- four visually distinct buildings with consistent shell, materials, furniture,
  light direction, and colour within each three-image set;
- the intended module mix is legible across each set rather than being forced
  into every frame;
- no recognisable people, flags, official marks, readable screens, wayfinding,
  documents, access-control details, or surveillance layouts;
- no visible watermark or external-brand treatment;
- crop-safe landscape compositions with the important subject inside the
  central card area; and
- no camera or GPS EXIF fields in the inspected files. The two exposed JPEG
  properties are the luminance and chrominance quantisation tables.

The inspection is a design and content review, not a dimensional or technical
validation of what the images depict.

## Visual narrative by example

| Set | `01` generated hero | `02` companion | `03` companion |
| --- | --- | --- | --- |
| Bundeshaus West · M1/M2/M3/M4/M7 | Open work area, acoustic focus places, a glazed meeting room, and a compact coffee point in a historic volume. | Focus places and the six-person formal room. | Formal room, coffee point, and the circulation relationship to the open work area. |
| Embassy Berlin · M1/M6/M10 | Two-position reception, quiet waiting lounge, lockers/garderobe, and garden glazing. | Lounge, entrance route, and the full storage wall. | Both staff positions with the lounge and garden beyond. |
| Brig-Glis · M2/M4/M6 | Three public counter positions, waiting seats, rear work area, and a glazed meeting room. | Six-person team/collaboration area beside the counter zone. | Waiting area and four-person meeting room with the counter positions still visible. |
| Embassy Canberra · M4/M6/M8 | Flexible workshop tables, blank presentation surfaces, formal room, and an informal booth. | A closer reverse view of two project islands, mobile boards, and a material cart. | The four-person informal niche with the formal room alongside it. |

## Design decision and UX integration

Each planning example owns its generated imagery and explicitly selects its real
context image. The durable target contract is:

- `contextMediaId` selects exactly one real media-registry record as the card
  cover and first gallery item;
- `images` is an ordered list of three complete, provenance-bearing generated
  records; `images[0]` is the generated hero and gallery item two, followed by
  the two companion views;
- `referenceMediaIds` retains all four old identifiers only to recognise legacy
  shared links; the three unselected records do not re-enter the active gallery;
- the composed gallery always contains four ordered items: `Standortfoto`, then
  the three `Visualisierung` items;
- a gallery URL scopes either media or generated-image identifier to its example
  so an item cannot open in another example's collection;
- a recognised scoped legacy `MED-*` link canonicalises to the retained context
  item rather than reopening a removed photograph or becoming a broken bookmark;
- the context item preserves its authored media attribution, media-detail link,
  and rights state; download availability remains licence-gated;
- generated visualisations have no media-library detail action and no download
  action; prototype publication rights are not inferred from a local file;
- card media remains decorative beside the card's descriptive link, while each
  gallery item has authored German alternative text and metadata appropriate to
  its source; and
- the visible metadata calls the asset a visualisation. It must not use
  documentary labels such as «Aufnahme» or «Fotograf:in» for generated work.

The required visible disclosure is equivalent to:

> Illustrative, AI-generated planning visualisation. Not a photograph of the
> completed space and not a binding design.

The example record describes a planning scenario tied to a real BBL building.
The disclosure applies to the visual interpretation of its module mix and
prevents the image from being mistaken for documentary evidence of that place.

## Privacy, security, and factual guardrails

The following constraints apply to this set and all later replacements:

1. Do not show identifiable people, names, badges, personal effects, documents,
   readable screens, or readable incidental print.
2. Do not invent or expose access-control positions, guard routes, cameras,
   inspection processes, secure-room relationships, or emergency procedures.
   This is especially important for WSE-002 and WSE-003.
3. Do not add flags, coats of arms, government logos, branded furniture, or
   other marks that could imply official approval.
4. Use real-building images only as architectural references. Do not reproduce
   an exact protected artwork, photographic composition, or operational layout.
5. Keep screens and writable surfaces blank. A layout may communicate a module
   function without fabricating project content.
6. Keep circulation plausible and include visible inclusive-use cues where the
   subject requires them, such as a lowered service-counter position. The image
   still does not certify accessibility.
7. Never infer exact room dimensions, furniture counts, or compliance from a
   generated perspective. Text records remain authoritative for the demo facts.
8. Keep the files repository-local. No runtime image host, tracking request,
   hotlink, or availability dependency is introduced.

## Finalised reproducible prompt set

This section records the final, reproducible design prompt set. It is not a
claim that the text below is a verbatim raw API request or hidden model payload.
Reference files are inputs for architecture, material, or module language—not
edit targets.

### Shared hero prompt

Prepend this block to each `01` brief:

```text
Use case: photorealistic-natural
Asset type: wide 16:9 generated planning-example gallery hero
Style/medium: photorealistic architectural editorial photography, not glossy architectural visualisation
Composition/framing: eye-level 24–28 mm lens, corrected verticals, believable room scale, central crop-safe composition
Lighting/mood: calm natural daytime, restrained contrast, realistic exposure and surface texture
Continuity: use the real interior only for broad architectural and material cues; use module images only for function and furniture language; do not reproduce their exact composition
Constraints: conceptual and non-binding; unoccupied; credible ergonomics and clear circulation; blank screens and writable surfaces; no text, logos, flags, official marks, brands, documents, people, security details, or watermark
Avoid: fisheye distortion, impossible furniture, an oversized room, glossy CGI, luxury-hospitality styling, excessive plants, and oversaturated federal red
```

### WSE-001 · Bundeshaus West · `01`

References, in role order:

1. `assets/images/buildings/1080-4840-AF_federal-palace-west_interior.jpg`
   — real-interior architecture and material reference;
2. `assets/images/buildings/1080-4840-AF_federal-palace-west_exterior.jpg`
   — window scale and proportion reference;
3. `assets/images/multispace-modules/team-arbeitsplatz-01.jpg`;
4. `assets/images/multispace-modules/fokus-arbeitsplatz-01.jpg`; and
5. `assets/images/multispace-modules/coffee-point-01.jpg`.

```text
Primary request: create a plausible conceptual visualisation of the second-floor staff zone at Bundeshaus West in Bern, integrating Multispace modules M1, M2, M3, M4, and M7. Show a representative portion of the 410 m² zone rather than claiming to show all 23 workplaces.
Scene/backdrop: a believable historic administrative interior with a high plaster ceiling, deep arched window reveals, restrained stone and cornice details, and daylight. Do not transplant the ceremonial entrance hall wholesale and do not reproduce its exact painted decoration.
Subject: make four compact desk clusters legible, with no more than four desks in a cluster and desks oriented perpendicular to daylight; place two freestanding acoustic focus carrels away from circulation; include a separated six-person team table with a blank AV display and blank magnetic whiteboard, a compact central coffee point, and only a glimpse of a closed formal meeting room in the background. Contemporary additions should look reversible and freestanding.
Color palette and materials: cream and warm sandstone, off-white plaster, light oak, warm-grey acoustic fabric and carpet, with very small muted forest-green and burgundy accents derived from the building.
Specific avoid items: exact decorative artwork, a ceremonial-hall office fantasy, fixed interventions that damage the historic fabric, and a crowded attempt to show every recorded workplace.
```

### WSE-002 · Embassy Berlin · `01`

References, in role order:

1. `assets/images/buildings/1080-5210-AA_swiss-embassy-berlin_interior.jpg`;
2. `assets/images/buildings/1080-5210-AA_swiss-embassy-berlin_facade-detail.jpg`;
3. `assets/images/multispace-modules/einzel-arbeitsplatz-01.jpg`;
4. `assets/images/multispace-modules/informelle-sitzungen-01.jpg`; and
5. `assets/images/multispace-modules/locker-garderoben-01.jpg`.

```text
Primary request: create a plausible conceptual visualisation of a calm 68 m² reception and waiting area at the Swiss Embassy Berlin, integrating M1, M6, and M10. It must not look like a documentary image of the completed room.
Scene/backdrop: a minimalist diplomatic interior in the modern wing, with pale mineral concrete or plaster, dark bronze-black window frames, a grey terrazzo or stone floor, large garden glazing, and restrained courtyard greenery.
Subject: show two adjacent staff work positions behind a low, restrained reception counter with one wheelchair-accessible lower section; add a quiet four-seat waiting lounge and low table beside the garden; place recessed light-oak and grey lockers plus coat storage close to the entrance. Staff screens face away and remain blank.
Color palette and materials: charcoal, warm grey, pale oak, mineral plaster, and one muted rust-red textile accent.
Specific avoid items: hotel-lobby glamour, an imposing security desk, Swiss marks, flags, signage, readable screens, badges, documents, surveillance equipment, and inferred access-control details.
```

### WSE-003 · Customs facility Brig-Glis · `01`

References, in role order:

1. `assets/images/buildings/1080-6210-AA_customs-facility-brig-glis_interior.jpg`;
2. `assets/images/buildings/1080-6210-AA_customs-facility-brig-glis_facade-detail.jpg`;
3. `assets/images/multispace-modules/team-arbeitsplatz-01.jpg`;
4. `assets/images/multispace-modules/formelle-sitzungen-01.jpg`; and
5. `assets/images/multispace-modules/informelle-sitzungen-01.jpg`.

```text
Primary request: create a plausible conceptual visualisation of the 96 m² public counter hall at the customs facility in Brig-Glis, integrating M2, M4, and M6 while making three public service positions, waiting, and a rear team workplace understandable.
Scene/backdrop: a long, bright, gently curving glazed hall with white acoustic ceiling rafts, a polished light-grey floor, slim dark mullions, and only a diffuse glimpse of the Alpine landscape.
Subject: show a slightly curved white and pale-oak service counter divided into three clear public bays, including one lower accessible surface; use discreet transparent privacy dividers; add a small durable waiting cluster, a rear six-person team table with acoustic separation, and a glimpse of a four-person glazed meeting room and small informal niche.
Color palette and materials: white, silver, charcoal, pale oak, light grey, and a restrained muted-red upholstery accent.
Specific avoid items: customs processes, signage or counter numbers, flags, documents, security equipment, cameras, access details, a clinical airport aesthetic, and blown-out windows.
```

### WSE-004 · Embassy Canberra · `01`

References, in role order:

1. `assets/images/buildings/1080-5620-AA_swiss-embassy-canberra_interior.jpg`;
2. `assets/images/buildings/1080-5620-AA_swiss-embassy-canberra_exterior.jpg`;
3. `assets/images/multispace-modules/formelle-sitzungen-01.jpg`;
4. `assets/images/multispace-modules/informelle-sitzungen-01.jpg`; and
5. `assets/images/multispace-modules/interaktive-sitzungen-01.jpg`.

```text
Primary request: create a plausible conceptual visualisation of a 120 m² meeting and creative zone at the Swiss Embassy Canberra, integrating M4, M6, and M8 with no permanent desks. It must not look like a photograph of a completed fit-out.
Scene/backdrop: a preserved warm-modernist interior with a timber-slat ceiling, white-painted brick, rough cylindrical concrete columns, warm brown brick and board-formed concrete, full-height glazing, and soft eucalyptus-garden daylight.
Subject: show a flexible creative area in the foreground with mobile light-oak tables, stackable ergonomic chairs, several mobile writable boards, and a large blank display; add an upholstered four-person meeting booth or niche and a glass-and-timber separated formal eight-seat meeting room in the background. The layout should look resettable after workshops.
Color palette and materials: light oak and walnut, off-white, warm grey, dusty rose, aubergine, and small ochre accents, with realistic fabric and concrete grain.
Specific avoid items: copied paintings, Aboriginal motifs, retro film-set styling, luxury hospitality, decorative clutter, official marks, and permanent desks.
```

### Shared companion-view continuity prompt

Apply this block to every `02` and `03` image. Reference the accepted `01`
visualisation first and the same real interior used for its hero second.

```text
Generate a companion view of exactly the same conceptual room and completed design—not a redesign. Image 1 is the accepted hero and the primary continuity reference. Image 2 is the real-interior architecture reference and remains secondary. Preserve the shell, apparent dimensions, window, door and column positions, ceiling, fixed joinery, furniture family, material and color palette, daylight direction, exposure, blank screens, and unoccupied state. Reveal the requested zone from a different eye-level 24–28 mm camera position with corrected verticals and a central crop-safe 16:9 composition. Do not add or remove program elements except where the new viewpoint reveals an element already belonging to the concept. Keep the result photorealistic, editorial, illustrative, and non-binding. No people, text, logos, flags, brands, documents, security or access-control details, or watermark.
```

### Companion-view deltas

| Output | Image 1 continuity reference | Image 2 architecture reference | Delta appended to the shared companion prompt |
| --- | --- | --- | --- |
| `bundeshaus-west-2og-stabsstelle-02.jpg` | `bundeshaus-west-2og-stabsstelle-01.jpg` | `1080-4840-AF_federal-palace-west_interior.jpg` | Move closer to the quiet zone. Put the two freestanding acoustic focus carrels in the foreground and the six-person glass-enclosed formal room beside them; retain historic arches and show only a restrained glimpse of open desks beyond. |
| `bundeshaus-west-2og-stabsstelle-03.jpg` | `bundeshaus-west-2og-stabsstelle-01.jpg` | `1080-4840-AF_federal-palace-west_interior.jpg` | Look along the circulation axis. Show the formal room on one side and the compact coffee/service joinery on the other, with the open work and focus zones receding under the same historic shell. Keep the route unobstructed. |
| `botschaft-berlin-empfang-02.jpg` | `botschaft-berlin-empfang-01.jpg` | `1080-5210-AA_swiss-embassy-berlin_interior.jpg` | Reverse toward the entrance and emphasise the four-seat waiting lounge plus the complete locker/garderobe wall. Let the reception counter recede near the garden door and preserve the same quiet material palette. |
| `botschaft-berlin-empfang-03.jpg` | `botschaft-berlin-empfang-01.jpg` | `1080-5210-AA_swiss-embassy-berlin_interior.jpg` | Move behind and slightly beside the counter. Clearly show both staff work positions with blank screens; keep the waiting lounge and garden glazing beyond and the locker wall along the side. Do not invent operational equipment. |
| `zollanlage-brig-glis-empfang-02.jpg` | `zollanlage-brig-glis-empfang-01.jpg` | `1080-6210-AA_customs-facility-brig-glis_interior.jpg` | View from the public-counter edge toward the rear collaboration zone. Make the six-person team table, blank display, and blank whiteboard primary; retain the translucent counter separation and a restrained glimpse of the formal room. |
| `zollanlage-brig-glis-empfang-03.jpg` | `zollanlage-brig-glis-empfang-01.jpg` | `1080-6210-AA_customs-facility-brig-glis_interior.jpg` | Reverse to the waiting side. Place the durable red waiting seats in the foreground, the four-person glazed meeting room centrally, and the three counter positions to the side; retain mountain daylight without exposing an operational layout. |
| `botschaft-canberra-besprechung-02.jpg` | `botschaft-canberra-besprechung-01.jpg` | `1080-5620-AA_swiss-embassy-canberra_interior.jpg` | Use a genuinely different, closer reverse angle from beside the windows. Show two compact project islands for about twelve people, three blank mobile boards, a low material cart, and an oblique blank display. Preserve the timber ceiling, white brick, concrete columns, warm palette, and furniture family, but exclude the glass formal room and informal booth from this frame. Use `interaktive-sitzungen-01.jpg` only as a functional reference for mobile workshop furniture. |
| `botschaft-canberra-besprechung-03.jpg` | `botschaft-canberra-besprechung-01.jpg` | `1080-5620-AA_swiss-embassy-canberra_interior.jpg` | Move close to the informal four-person niche with burgundy upholstery and a round table. Keep the glass formal room visible alongside it and only a distant glimpse of the creative zone. Preserve the curved white-brick enclosure, timber ceiling, and concrete columns. |

## Asset specification and provenance

All twelve files are project-local baseline JPEGs, 1440 × 810 pixels, 16:9,
and use stable example slugs plus a two-digit sequence. The set totals 2,111,579
bytes (2.014 MiB); individual files range from 136,129 to 218,551 bytes.

They were generated with OpenAI for the service-portal prototype in 2026, then
selected and stored as the final project assets. The publication status is
prototype use only; external publication requires an explicit rights, privacy,
security, content, and accessibility review. The generated files do not inherit
or broaden the licences of their architectural reference photographs.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `botschaft-berlin-empfang-01.jpg` | 181,643 | `6d4c8521bb518127f71c13f50c96f3c9b03ef3d388bd17c5c17aea4b2e31c9a6` |
| `botschaft-berlin-empfang-02.jpg` | 136,129 | `8790b8ad3720da7af5ad2984152fafe17532e43f391f1dd90998604b11b7fc69` |
| `botschaft-berlin-empfang-03.jpg` | 160,122 | `4255bdc8f2455655838aa1389b1fb123f4423369528ecda005b13a61930b7042` |
| `botschaft-canberra-besprechung-01.jpg` | 211,447 | `01de7381f1128356773a6acc4b9387e99f4c2cfcd43009960035d9f1d7503dfa` |
| `botschaft-canberra-besprechung-02.jpg` | 218,551 | `c76b335bf474c1c5b4eb93e23c73e0f5ead0025eff89f3d94fc99937fd9e843e` |
| `botschaft-canberra-besprechung-03.jpg` | 177,721 | `eded1a4534e35e33bc73d2f26a177af9edefeda317936de72dd8a792f215dd26` |
| `bundeshaus-west-2og-stabsstelle-01.jpg` | 184,507 | `4d4ffb3e46e9b2b1d383e5465f907a91352294345c52296a1057cb5ff5baaa8a` |
| `bundeshaus-west-2og-stabsstelle-02.jpg` | 174,834 | `eb0f78560565623853a5dd559ea7dea846206c902711d6bc38770b6e019ed9e6` |
| `bundeshaus-west-2og-stabsstelle-03.jpg` | 157,499 | `76a5a70607d8a4ef5c402484e55fed68d3849c081acfe6e103e1dce56f5bba85` |
| `zollanlage-brig-glis-empfang-01.jpg` | 178,156 | `b19cd02184484f8d8bc785b636b231cd6ce0a5b4d4313a17e6c17ac0d3ebc601` |
| `zollanlage-brig-glis-empfang-02.jpg` | 160,825 | `4a2dd42e7b9da4600433fcfedc435ea79dd145d68cd5d0771a259c13ddeea8ec` |
| `zollanlage-brig-glis-empfang-03.jpg` | 170,145 | `9dc59711e6cef5b5e2049783f49d2237d937bce7901ef5e28d829dfac1c0283a` |

## Acceptance evidence

| Acceptance item | Evidence | Status |
| --- | --- | --- |
| Human visual review | All twelve final files inspected for set continuity, module legibility, crop safety, people, readable content, official marks, and security-sensitive details. | Complete · 2026-08-17 |
| Image integrity | `node scripts/test-data-integrity.mjs`: exact case, twelve 1440 × 810 JPEGs, 2,111,579-byte set, budgets, no orphans, and no embedded metadata. | Complete · 2026-08-17 |
| Data contract | `test-data-integrity` and `test-data-resilience`: one valid `contextMediaId`, three ordered complete generated records, retained aliases, and fail-closed malformed inputs. | Complete · 2026-08-17 |
| Page interaction | `node scripts/test-workspace-knowledge.mjs`: four decoded context covers; pointer and keyboard launch; exact four-item order; arrows, query, Escape, focus restoration, and 320/768/1440 containment. | Complete · 2026-08-17 |
| Disclosure and actions | `test-workspace-knowledge`: context attribution, media link, and licence-gated download; generated alt, status, credit, licence, provenance, visualisation share label, and no file/media action. | Complete · 2026-08-17 |
| Compatibility | `test-workspace-knowledge` and `test-routes`: old valid slugs and scoped `MED-*` aliases canonicalise to the retained context item; invalid values remain isolated. | Complete · 2026-08-17 |
| Route data needs | `node scripts/test-route-needs.mjs`: handbook and inspiration request `media.json` and `workspace-examples.json` once; module detail retains its narrower needs. | Complete · 2026-08-17 |
| Repository gates | Syntax, English-source, HTML/API contracts, data integrity/resilience, focused browser suites, documentation consistency, and `git diff --check`. | Complete · 2026-08-17 |

## Replacement guidance

The real context photo locates the example but must never be described as the
pictured interior. The generated set is appropriate for a demo because it
explains the purpose of planning examples. Replace it when commissioned
photography or an approved project visualisation exists for the exact fitted
zone. A replacement must keep the same explicit provenance and rights fields;
documentary photography must be identified as photography, while a render or
generated image must continue to say that it is illustrative. Do not remove the
distinction merely because a later visualisation is more realistic.
