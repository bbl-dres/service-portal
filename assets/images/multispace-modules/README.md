# Multispace module illustrations

This directory contains the illustrative images used by the Multispace handbook
catalogue and its module detail pages. They are prototype assets, not photographs
of real BBL workplaces and not authoritative planning examples.

## Data contract

`data/multispace-modules.json` owns the ordered `images` array for each module.
The first item is the card and detail hero. Later items may be presented as a
gallery in their stored order. An empty array produces a compact text-first card
or detail view without making a media request. If a requested file fails, its
media wrapper may retain the module swatch as a visual fallback.

Each image record contains:

- `src`: a same-origin path below `assets/images/multispace-modules/`;
- `alt`: a concise German description of the visible scene;
- `caption`: visible context stating that the image is illustrative and non-binding;
- `credit`: the image creator and year;
- `license`: the current publication status; and
- `provenance`: how the asset was produced and what it does not represent.

Do not add the former scalar `image` property. A module may have `images: []`,
but every populated entry must contain the complete metadata above.

## File convention and budget

Files use the stable module slug rather than the handbook number, because a later
edition may renumber modules:

    <module-slug>-<two-digit-sequence>.jpg

The current images are 1440 × 810 pixel, 16:9 JPEG files. Keep each file at most
220 KiB and the complete module set at most 2 MiB. Repository integrity tests check
the exact filename case, dimensions, format, size, data reference, and provenance.

## Provenance and status

All eleven current illustrations were generated with OpenAI for the customer
portal prototype in 2026. Their data records mark them for prototype use only;
their release must be reviewed before external publication. They must not be
described as photographs, implemented workplaces, approved designs, or evidence
that a layout meets handbook, accessibility, fire-safety, or SECO requirements.

| Module | File | Production |
| --- | --- | --- |
| Einzel Arbeitsplatz | `einzel-arbeitsplatz-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Team Arbeitsplatz | `team-arbeitsplatz-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Fokus Arbeitsplatz | `fokus-arbeitsplatz-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Formelle Sitzungen | `formelle-sitzungen-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Telefon- / Videokonferenzbox | `telefon-videokonferenzbox-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Informelle Sitzungen | `informelle-sitzungen-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Coffee Point | `coffee-point-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Interaktive Sitzungen | `interaktive-sitzungen-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Team Ablage | `team-ablage-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Locker, Garderoben | `locker-garderoben-01.jpg` | OpenAI-generated prototype illustration, 2026 |
| Service Funktionen | `service-funktionen-01.jpg` | OpenAI-generated prototype illustration, 2026 |

## Prompt constraints for future additions

Keep future images consistent with this set:

- show the spatial function and characteristic furniture of exactly one module;
- use a neutral, contemporary Swiss federal-workplace visual language;
- use a wide 16:9 composition suitable for both a card crop and a detail hero;
- show no recognisable people, real locations, logos, brands, signs, or readable text;
- avoid decorative features that imply a requirement absent from the handbook; and
- never imply that the generated layout is dimensionally accurate or approved.

Real photographs of completed spaces belong in
`assets/images/workspace-examples/` and retain their own creator, licence, source,
and location context.
