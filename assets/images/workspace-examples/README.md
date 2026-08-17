# Workspace example visualisations

This directory contains the generated interior concepts for the planning
examples shown under `#/knowledge/workspace/inspiration`. The portal places one
real building-context photograph before these concepts. The generated interiors
connect that context with the Multispace modules declared for an example, but
they are not photographs of the completed space, verified reconstructions,
approved plans, or evidence of regulatory compliance.

## Data contract

`data/workspace-examples.json` composes each four-item gallery from three fields:

- `contextMediaId` is a canonical `MED-*` identifier. It supplies the card image
  and first gallery item from `data/media.json`;
- `images` is the ordered generated subset. Every current example has three
  records, shown after the context photograph; and
- `referenceMediaIds` retains every former building-media identifier so old
  shared `MED-*` links still resolve. Only `contextMediaId` is displayed from
  this compatibility list.

The first `images` record is therefore the first generated interior and the
second item in the composed gallery, not the card cover.

Each image record contains exactly:

- `imageId`: a stable, globally unique identifier;
- `kind`: `generated-visualisation`;
- `src`: a same-origin JPEG below `assets/images/workspace-examples/`;
- `title`: the concise gallery title;
- `alt`: a useful German description of the visible scene;
- `caption`: visible context stating that the concept is illustrative and
  non-binding;
- `credit`: creator and year;
- `license`: the current publication status; and
- `provenance`: how the image was produced and what it does not represent.

Do not add the former `mediaIds` or `coverMediaId` fields. `contextMediaId` is
required, must belong to `referenceMediaIds`, and is the only media-registry
record included in the active gallery.

## File convention and budget

Files use the stable example slug and a two-digit sequence:

    <example-slug>-<two-digit-sequence>.jpg

All current files are 1440 × 810 pixel, 16:9 JPEGs. Keep each file at most
220 KiB and the complete set at most 2.5 MiB. Repository integrity tests check
the exact filename case, dimensions, format, safe data reference, individual and
total byte budgets, absence of embedded metadata, complete provenance, and the
context-photo relationship.

## Provenance and status

The context photographs are authentic views of the named buildings, not of the
prototype interior scenarios. Their creator, copyright, licence, source, and
access metadata remain authoritative in `data/media.json`; do not duplicate or
weaken those terms in the example fixture.

The twelve interior images were generated with OpenAI for the customer portal
prototype in 2026. Their records mark them for prototype use only; release must
be reviewed before external publication. Existing BBL media informed only broad
architectural and material cues. In particular, the visualisations do not
reconstruct circulation, access control, staff-only areas, or security systems
in diplomatic or customs properties.

| Example | Generated files | Context photo | Architectural cue |
| --- | --- | --- | --- |
| WSE-001 · Bundeshaus West | `bundeshaus-west-2og-stabsstelle-01.jpg` to `-03.jpg` | `MED-001` | `MED-003` |
| WSE-002 · Schweizerische Botschaft Berlin | `botschaft-berlin-empfang-01.jpg` to `-03.jpg` | `MED-008` | `MED-010` |
| WSE-003 · Zollanlage Brig-Glis | `zollanlage-brig-glis-empfang-01.jpg` to `-03.jpg` | `MED-077` | `MED-079` |
| WSE-004 · Schweizerische Botschaft Canberra | `botschaft-canberra-besprechung-01.jpg` to `-03.jpg` | `MED-058` | `MED-060` |

## Future additions

- Generate a coherent set rather than unrelated stock-like scenes: establish
  the first interior view, then retain its shell, materials, lighting, and
  furniture language in later views.
- Show only the modules and spatial functions declared by the example.
- Keep screens and boards blank and omit people, logos, flags, brands, readable
  documents, wayfinding, and security equipment.
- Use restrained, plausible public-sector interiors rather than showroom or
  luxury-office styling.
- Inspect every output before authoring its alt text; metadata must describe the
  delivered pixels, not merely the prompt.
- Strip EXIF, XMP, comments, thumbnails, and other embedded application metadata
  before committing an image.
