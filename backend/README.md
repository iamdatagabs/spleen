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
## Análises globais (v0.4.0)
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

A integração numérica é refinada automaticamente até dt ≤ 0,0025 min durante análises globais para reduzir instabilidade numérica em combinações de complacência/resistência com escalas de tempo curtas. Os intervalos paramétricos são hipóteses exploratórias, não priors clínicos fundamentados. O MCMC atual usa uma única cadeia e não fornece R-hat ou tamanho efetivo de amostra; não use os resultados para inferência científica sem diagnósticos adicionais.
