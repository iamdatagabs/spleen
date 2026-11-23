# Publicação no GitHub Pages

## Configuração atual

O repositório está configurado para publicação por **GitHub Actions**. O workflow `.github/workflows/pages.yml` envia a raiz do projeto ao GitHub Pages a cada push na branch `main`.

URL pública: https://iamdatagabs.github.io/spleen/

## Como atualizar

1. Faça commit das alterações na branch `main`.
2. Acesse a aba [Actions](https://github.com/iamdatagabs/spleen/actions).
3. Acompanhe o workflow **Deploy SPLEEN to GitHub Pages**.
4. Quando as etapas de build e deploy estiverem concluídas com sucesso, atualize a página pública.

## Configuração do repositório

Em Settings → Pages, mantenha:
- Build and deployment → Source: **GitHub Actions**

O workflow de testes `.github/workflows/tests.yml` também permanece ativo e executa verificações do modelo matemático em pushes e pull requests.

## Diagnóstico

- **Falha em configure-pages:** confirme que Pages está habilitado e que Source está como GitHub Actions.
- **Falha de permissão:** confira Settings → Actions → General e as permissões Pages e ID token do workflow.
- **Página 404 logo após sucesso:** aguarde a propagação e confira o URL de publicação na execução do deploy.
- **API indisponível:** GitHub Pages hospeda somente os arquivos estáticos; a API FastAPI precisa de hospedagem separada. Consulte `backend/README.md`.

O site é um protótipo experimental e não deve ser utilizado para decisões clínicas.
