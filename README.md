# SPLEEN
**Splanchnic Perfusion Simulation Environment**

SPLEEN is an experimental computational-physiology prototype for exploring how hemodynamic changes during digestive surgery may alter regional splanchnic blood-flow distribution.

## Live prototype
After enabling GitHub Pages with **GitHub Actions** as the build/deployment source, the application will be available at:
`https://iamdatagabs.github.io/spleen/`

The included workflow deploys the repository root.

## What is included
- Browser-based interactive compartmental ODE simulation.
- Four regional arterial beds: stomach, intestine, spleen and pancreas.
- Derived portal-flow and hepatic oxygen-delivery indicators.
- Scenario controls for mean arterial pressure, pneumoperitoneum, vasopressor support and blood loss.
- Time-series visualization and CSV export.
- Python/FastAPI reference backend.
- Mathematical model, requirements and limitations documentation.

## Publicação\nSiga [o guia de GitHub Pages](docs/deployment.md) para ativar a publicação inicial.\n\n## Quick start
Open `index.html` in a modern browser, or serve the repository locally:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Model scope and safety
This is a **research/educational prototype**, not a patient-specific simulator, clinical decision-support system, or validated physiological model. Values and coefficients are illustrative and must not guide clinical care. The first version uses a reduced-order lumped-parameter model; it does not solve 3D Navier–Stokes equations or spatial oxygen-transport PDEs.

See [the mathematical model](docs/model.md), [requirements](docs/requirements.md), and [backend notes](backend/README.md).

## Roadmap
1. Establish physiological plausibility and parameter provenance.
2. Calibrate against experimental/clinical datasets with appropriate approvals.
3. Add portal/hepatic coupling and organ-specific autoregulation.
4. Add spatial oxygen transport PDE and numerical convergence tests.
5. Validate against independent data before any clinical translation.

## License
MIT (prototype code).