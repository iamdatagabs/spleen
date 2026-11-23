# Publicação no GitHub Pages

## Configuração atual

O repositório está publicado pelo fluxo nativo do GitHub Pages, usando a branch `main` e a pasta raiz (`/root`). O GitHub executa automaticamente o build do site após novos commits.

URL pública: https://iamdatagabs.github.io/spleen/

## Como atualizar

1. Faça commit das alterações na branch `main`.
2. Acesse a aba [Actions](https://github.com/iamdatagabs/spleen/actions).
3. Acompanhe a execução **pages build and deployment**.
4. Quando build e deploy estiverem concluídos com sucesso, atualize a página pública.

## Configuração do repositório

Em Settings → Pages, mantenha:
- Build and deployment → Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**

O workflow customizado de deploy por Actions foi removido porque conflitou com a configuração nativa por branch. O workflow `.github/workflows/tests.yml` permanece ativo para executar os testes matemáticos do backend.

## Diagnóstico

- **404:** confirme a branch `main`, pasta raiz e aguarde a propagação.
- **Build Jekyll com erro:** verifique os arquivos e a saída do workflow `pages build and deployment`.
- **API indisponível:** GitHub Pages hospeda somente os arquivos estáticos; a API FastAPI precisa de hospedagem separada. Consulte `backend/README.md`.

O site é um protótipo experimental e não deve ser utilizado para decisões clínicas.
