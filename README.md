# SPLEEN
**Splanchnic Perfusion Simulation Environment**

SPLEEN is an experimental computational-physiology prototype for exploring how hemodynamic changes during digestive surgery may alter regional splanchnic blood-flow distribution.

## Live prototype
GitHub Pages is enabled and the initial deployment completed successfully. Open the prototype at:
`https://iamdatagabs.github.io/spleen/`

The latest commits may still be propagating while their Actions runs finish. [Deployment history](https://github.com/iamdatagabs/spleen/actions).

## Current model — v1.3.0 tissue oxygen reaction-diffusion
- Four regional arterial flow compartments (stomach, intestine, spleen and pancreas).
- Coupled portal pressure compartment with compliance and hepatic outflow resistance.
- Simplified feedback from portal pressure to regional target flow.
- Derived portal inflow, hepatic outflow, hepatic arterial flow and hepatic oxygen-delivery indicator.
- Browser simulation, time-series chart, CSV export, and an interactive global-uncertainty workspace.
- Interactive Three.js parametric 3D spleen surface with three transient territories. Territory intensity and pressure markers respond to simulated pressure; arterial/venous branch thickness and particle transit respond independently to regional inflow/outflow. These are visual encodings of reduced-order outputs, not spatial CFD or anatomical measurements.
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

The CI pipeline also runs Node.js tests for conservative territory-flow allocation and bounded 3D flow/pressure visual mappings.

Run the backend verification suite locally:

```bash
cd backend
pip install -r requirements.txt pytest
pytest -q
```

GitHub Actions runs these tests on pushes and pull requests. The current suite checks baseline equilibrium, portal balance, nonnegative flows under a stress scenario, and time-step refinement.

## Documentation
- [Apostila de fundamentação matemática e fisiologia (LaTeX)](docs/apostila_fundamentacao_matematica.tex)
- [Mathematical model](docs/model.md)
- [Requirements](docs/requirements.md)
- [Deployment guide](docs/deployment.md)
- [Backend notes](backend/README.md)

## Global analysis
The browser dashboard runs LHS, Monte Carlo and an exploratory Random-Walk Metropolis MCMC locally. MCMC requires explicit observations with `metric`, `value` and positive `sd`; the default example is a placeholder and must not be treated as patient data. The Python API exposes equivalent analysis endpoints. The MCMC implementation uses independent chains and reports exploratory convergence diagnostics; these do not establish physiological validity or parameter identifiability.

## Model scope and safety
This is a **research/educational prototype**, not a patient-specific simulator, clinical decision-support system, or validated physiological model. Values and coefficients are illustrative and must not guide clinical care. The current implementation is a lumped-parameter coupled ODE model. The 3D spleen is a procedural parametric surface and an exploratory reduced-order parallel-bed visualization, not a segmented anatomical mesh or spatial CFD model; it does not solve oxygen-transport PDEs or 3D Navier–Stokes equations.

## Roadmap
1. Expand simulation-based calibration, parameter recovery and identifiability analysis with synthetic data.
2. Test prior and observation-error sensitivity using justified distributions and likelihoods.
3. Verify numerical convergence and parity between browser and Python implementations.
4. Replace illustrative coefficients with traceable experimental/clinical data under appropriate approvals.
5. Add spatial oxygen-transport PDE and numerical convergence tests.
6. Validate against independent data before any clinical translation.

## License
MIT (prototype code).


## Mathematical specification and methodological investigations (v0.7.0)

- LaTeX formulation: [`docs/model.tex`](docs/model.tex), with a readable companion at [`docs/model.md`](docs/model.md).
- Local identifiability screening: `POST /api/v1/identifiability`.
- Prior-range robustness: `POST /api/v1/prior-sensitivity`.
- Synthetic parameter recovery / preliminary importance-sampling rank check: `POST /api/v1/synthetic-recovery`.

These analyses are computational diagnostics using the current simplified model. They do not establish physiological validity, clinical calibration, structural identifiability or formal SBC validity.


- Transient three-territory splenic Windkessel layer: regional pressure storage and venous outflow feed the portal compartment; illustrative resistance/compliance parameters only.

- Distributed arterial and venous pressure profiles for each splenic territory; intermediate branch pressures are interpolated for visualization and are not anatomically calibrated.


## Spatial oxygen delivery — v1.2.0
The 3D spleen view now reports regional convective oxygen delivery ($DO_2 = 10\,Q_a\,C_{aO_2}$) for its three reduced-order territories. Territory shading combines relative pressure and oxygen-delivery indices; the dashboard exposes mL O₂/min and percentage of a computational reference. Gaussian interpolation colors the parametric organ surface as a dimensionless visualization field, not as a tissue oxygenation or oxygen-diffusion solver. The model does not calculate oxygen extraction, consumption, hypoxia, or cellular availability. Outputs remain experimental and must not guide clinical decisions.


## Tissue oxygen reaction-diffusion — v1.3.0
A 3D tissue layer now solves a reduced-order reaction-diffusion equation for tissue oxygen partial pressure (pO₂), with distributed perfusion supply, effective diffusion, and saturable consumption. A finite-difference 3D grid is advanced with explicit Euler integration and a checked stability bound; the parametric spleen surface samples the resulting field. This is a phenomenological research prototype: it does not resolve individual vessels, hemoglobin dissociation, measured cellular metabolism, capillary extraction, or clinical hypoxia. Parameters are illustrative and outputs are not for clinical decision-making.


## Heterogeneidade microvascular — v1.4.0
A camada espacial de pO₂ incorpora índices regionais demonstrativos de densidade capilar e uma distância efetiva aos centros computacionais de troca. Esses campos modulam a oferta perfusional distribuída e são apresentados separadamente como índices/medidas geométricas do modelo. Os centros não são capilares segmentados, a distância não é uma medida histológica e os parâmetros não foram calibrados com dados anatômicos ou fisiológicos. A versão mantém a natureza fenomenológica e experimental do protótipo.
