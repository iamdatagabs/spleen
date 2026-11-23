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