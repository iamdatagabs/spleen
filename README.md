# SPLEEN
**Splanchnic Perfusion Simulation Environment**

SPLEEN is an experimental computational-physiology prototype for exploring how hemodynamic changes during digestive surgery may alter regional splanchnic blood-flow distribution.

## Live prototype
GitHub Pages is enabled and the initial deployment completed successfully. Open the prototype at:
`https://iamdatagabs.github.io/spleen/`

The latest commits may still be propagating while their Actions runs finish. [Deployment history](https://github.com/iamdatagabs/spleen/actions).

## Current model — v0.2.0
- Four regional arterial flow compartments (stomach, intestine, spleen and pancreas).
- Coupled portal pressure compartment with compliance and hepatic outflow resistance.
- Simplified feedback from portal pressure to regional target flow.
- Derived portal inflow, hepatic outflow, hepatic arterial flow and hepatic oxygen-delivery indicator.
- Browser simulation, time-series chart and CSV export.
- Python/FastAPI reference implementation.

## Quick start
Open `index.html` in a modern browser, or serve the repository locally:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Verification
Run the backend verification suite locally:

```bash
cd backend
pip install -r requirements.txt pytest
pytest -q
```

GitHub Actions runs these tests on pushes and pull requests. The current suite checks baseline equilibrium, portal balance, nonnegative flows under a stress scenario, and time-step refinement.

## Documentation
- [Mathematical model](docs/model.md)
- [Requirements](docs/requirements.md)
- [Deployment guide](docs/deployment.md)
- [Backend notes](backend/README.md)

## Model scope and safety
This is a **research/educational prototype**, not a patient-specific simulator, clinical decision-support system, or validated physiological model. Values and coefficients are illustrative and must not guide clinical care. The current implementation is a lumped-parameter coupled ODE model; it does not solve spatial oxygen-transport PDEs or 3D Navier–Stokes equations.

## Roadmap
1. Verify numerical convergence and implementation parity between JavaScript and Python.
2. Perform parameter sensitivity and uncertainty analysis.
3. Replace illustrative coefficients with traceable experimental/clinical data under appropriate approvals.
4. Add spatial oxygen transport PDE and numerical convergence tests.
5. Validate against independent data before any clinical translation.

## License
MIT (prototype code).
