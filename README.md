# BBL Kundenportal (Service Portal)

<p align="center">
  <img src="assets/images/social1.jpg" width="100%" alt="BBL Kundenportal, service portal prototype"/>
</p>

<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/status-prototype-orange.svg" alt="Status: Prototype"/>
  <a href="https://github.com/swiss/designsystem"><img src="https://img.shields.io/badge/CD%20Bund-aligned-D8232A.svg" alt="CD Bund aligned"/></a>
  <a href="https://bbl-dres.github.io/service-portal/"><img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live demo"/></a>
</p>

> [!CAUTION]
> **This is an unofficial prototype for demonstration purposes only.**
> The repository is intended to contain only fictional or publicly releasable data, and not every function is fully implemented. The current [technical review](docs/code-review.md) lists data and media whose publication or redistribution status still requires owner confirmation. The prototype is not intended for production use.

The BBL Kundenportal is a process-oriented prototype for the [Federal Office for Buildings and Logistics (BBL)](https://www.bbl.admin.ch). It brings services, cases, specialist applications, property information, documents, and data access together in one interface based on the Swiss Confederation design system.

## Demo

**Live demo:** https://bbl-dres.github.io/service-portal/

## Scope

- Service catalogue, guided forms, and case tracking
- Property inventory, building documentation, media, and project views
- Workspace planning, room booking, and the BBL intranet shop
- Application and data catalogues, dashboards, process documentation, and knowledge content

## Technical overview

- Static single-page application with hash routing
- Vanilla JavaScript ES modules, HTML, and CSS, with no build step or installed package-manager dependencies
- Static JSON and GeoJSON repository fixtures shared across the portal and its micro-apps
- UI patterns and tokens aligned with the official [`swiss/designsystem`](https://github.com/swiss/designsystem)
- Pinned MapLibre GL JS, Swagger UI, and bpmn-js runtime libraries loaded on demand from `unpkg.com`
- Map views and address search use external Swisstopo, CARTO, MapLibre demo-tile, and geo.admin.ch services and therefore require network access
- Dependency-free Node/CDP browser checks documented in [`scripts/README.md`](scripts/README.md)

## Run locally

Serve the repository over HTTP because ES modules and `fetch()` do not work reliably from `file://`:

```bash
node scripts/serve.mjs
```

Then open http://127.0.0.1:8848/.

## Documentation

Architecture, requirements, data models, design reviews, and implementation notes are collected in [`docs/`](docs/README.md).

## License

Licensed under the [MIT License](LICENSE).
