# SPLEEN
**Splanchnic Perfusion Simulation Environment**

SPLEEN is an experimental computational-physiology prototype for exploring how hemodynamic changes during digestive surgery may alter regional splanchnic blood-flow distribution.

## Live prototype
GitHub Pages is enabled and the initial deployment completed successfully. Open the prototype at:
`https://iamdatagabs.github.io/spleen/`

The latest commits may still be propagating while their Actions runs finish. [Deployment history](https://github.com/iamdatagabs/spleen/actions).

## Current model — v0.6.0
- Four regional arterial flow compartments (stomach, intestine, spleen and pancreas).
- Coupled portal pressure compartment with compliance and hepatic outflow resistance.
- Simplified feedback from portal pressure to regional target flow.
- Derived portal inflow, hepatic outflow, hepatic arterial flow and hepatic oxygen-delivery indicator.
- Browser simulation, time-series chart, CSV export, and an interactive global-uncertainty workspace.
- Browser-side LHS, Monte Carlo and exploratory four-chain MCMC with split-R-hat, approximate ESS and lag-1 autocorrelation diagnostics, with P05/P50/P95 summaries and CSV export.
- Python API endpoints: `POST /api/v1/sensitivity`, `POST /api/v1/uncertainty` (LHS/Monte Carlo) and `POST /api/v1/mcmc` (requires observations).
- Python/FastAPI reference implementation with configurable structural parameters and a local OAT sensitivity endpoint (`POST /api/v1/sensitivity`).

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

## Global analysis
The browser dashboard runs LHS, Monte Carlo and an exploratory Random-Walk Metropolis MCMC locally. MCMC requires explicit observations with `metric`, `value` and positive `sd`; the default example is a placeholder and must not be treated as patient data. The Python API exposes equivalent analysis endpoints. The MCMC implementation uses independent chains and reports exploratory convergence diagnostics; these do not establish physiological validity or parameter identifiability.

## Model scope and safety
This is a **research/educational prototype**, not a patient-specific simulator, clinical decision-support system, or validated physiological model. Values and coefficients are illustrative and must not guide clinical care. The current implementation is a lumped-parameter coupled ODE model; it does not solve spatial oxygen-transport PDEs or 3D Navier–Stokes equations.

## Roadmap
1. Expand simulation-based calibration, parameter recovery and identifiability analysis with synthetic data.
2. Test prior and observation-error sensitivity using justified distributions and likelihoods.
3. Verify numerical convergence and parity between browser and Python implementations.
4. Replace illustrative coefficients with traceable experimental/clinical data under appropriate approvals.
5. Add spatial oxygen-transport PDE and numerical convergence tests.
6. Validate against independent data before any clinical translation.

## License
MIT (prototype code).


## Mathematical specification and methodological investigations (v0.6.0)

- LaTeX formulation: [`docs/model.tex`](docs/model.tex), with a readable companion at [`docs/model.md`](docs/model.md).
- Local identifiability screening: `POST /api/v1/identifiability`.
- Prior-range robustness: `POST /api/v1/prior-sensitivity`.
- Synthetic parameter recovery / preliminary importance-sampling rank check: `POST /api/v1/synthetic-recovery`.

These analyses are computational diagnostics using the current simplified model. They do not establish physiological validity, clinical calibration, structural identifiability or formal SBC validity.
