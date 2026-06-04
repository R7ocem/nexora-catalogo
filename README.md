# Nexora Catálogos

MVP de catálogo digital multiempresa da Nexora.

Rotas:

- `/cardapio/savore`: cardápio público para alimentação
- `/catalogo/slug-da-empresa`: catálogo público para outros segmentos
- `/admin`: painel simples

Antes de publicar, execute `sql/001_setup.sql` no Postgres.

Operacao:

- Antes de rodar SQL novo, faca backup do banco.
- Siga a rotina em `sql/README.md`.
- Depois de mergear um PR, rode o SQL necessario e faca deploy no EasyPanel.
- A raiz do sistema (`/`) abre o painel. Empresas de alimentação usam `/cardapio/slug-da-empresa`; outros segmentos usam `/catalogo/slug-da-empresa`.
