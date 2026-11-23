# Backend de referência

O MVP GitHub Pages executa as EDOs em JavaScript e não exige servidor. main.py é uma API FastAPI de referência para experimentos locais e integração futura.

## Execução local
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

Documentação interativa em http://127.0.0.1:8000/docs.

## Endpoint
POST /api/v1/simulations recebe parâmetros e retorna série temporal determinística. Não está hospedado pelo GitHub Pages.

Para hospedagem futura, publicar o serviço Python separadamente, configurar CORS para a origem Pages, limitar requisições, registrar logs estruturados e fixar versão do modelo. Não armazenar dados identificáveis de pacientes no protótipo.
## Análises globais (v0.5.0)
- `POST /api/v1/sensitivity`: sensibilidade local OAT.
- `POST /api/v1/uncertainty`: LHS ou Monte Carlo (`method`: `lhs` ou `monte_carlo`).
- `POST /api/v1/mcmc`: Random-Walk Metropolis, exige observações `metric`, `value` e `sd`.

Exemplo de corpo para LHS/Monte Carlo:
```json
{
  "method": "lhs",
  "samples": 300,
  "seed": 2026,
  "parameters": {"duration_min": 20}
}
```

Exemplo de corpo para MCMC:
```json
{
  "method": "mcmc",
  "samples": 300,
  "burn_in": 500,
  "thin": 2,
  "observations": [
    {"metric": "portal_pressure_mmhg", "value": 10.0, "sd": 1.0}
  ],
  "parameters": {"duration_min": 20}
}
```

A integração numérica é refinada automaticamente até dt ≤ 0,0025 min durante análises globais para reduzir instabilidade numérica em combinações de complacência/resistência com escalas de tempo curtas. Os intervalos paramétricos são hipóteses exploratórias, não priors clínicos fundamentados. O MCMC usa cadeias independentes e fornece diagnósticos exploratórios; não use os resultados para inferência científica sem avaliação adicional.


## MCMC diagnostics (v0.5.0)

`POST /api/v1/mcmc` accepts `chains` (2–8; default 4), `samples`, `burn_in`, `thin`, `seed` and explicit Gaussian observations. The response includes per-chain samples and acceptance rates, split-R-hat, approximate ESS and lag-1 autocorrelation for each parameter. The convergence flag uses exploratory thresholds (R-hat < 1.05 and ESS ≥ 100); it is not proof of convergence, identifiability or model validity. Synthetic-data tests are internal consistency checks only.


## Additional methodological endpoints (v0.6.0)

All endpoints accept the `GlobalAnalysisRequest` payload, including `parameters`, `samples` and `seed`.

- `POST /api/v1/identifiability`: local scaled finite-difference sensitivity matrix, numerical rank and pairwise column cosines.
- `POST /api/v1/prior-sensitivity`: prior-predictive comparison under contracted, reference and expanded uniform bounds.
- `POST /api/v1/synthetic-recovery`: synthetic truth/noise experiment with prior importance-sampling ranks, normalized median errors and importance-sampling ESS.

The synthetic recovery route is a preliminary SBC-style diagnostic, not formal validated Simulation-Based Calibration. A low importance-sampling ESS indicates weight degeneracy. All three routes use the model itself and synthetic inputs; none constitutes physiological validation.
