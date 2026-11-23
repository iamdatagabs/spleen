# Publicação no GitHub Pages

O repositório contém um workflow em .github/workflows/pages.yml que publica a raiz do projeto a cada push em main.

## Ativação inicial (necessária uma única vez)
1. Abra https://github.com/iamdatagabs/spleen/settings/pages
2. Em Build and deployment, selecione Source = GitHub Actions.
3. Salve a configuração, se solicitado.
4. Abra a aba Actions e acompanhe o workflow Deploy SPLEEN to GitHub Pages até ficar verde.

URL esperada: https://iamdatagabs.github.io/spleen/

O workflow não consegue substituir essa ativação inicial nas configurações do repositório. Após a ativação, os próximos commits serão publicados automaticamente.

## Diagnóstico
- Falha em configure-pages: confira se Pages foi habilitado e se Source está como GitHub Actions.
- Falha de permissão: confira Settings > Actions > General > Workflow permissions e as permissões Pages e ID token no workflow.
- Página 404 logo após sucesso: aguarde a propagação e confira se o deploy foi feito no repositório correto.

O site é estático e não executa backend Python. Para testar a API localmente, siga backend/README.md.