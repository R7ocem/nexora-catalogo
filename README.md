# Nexora Catálogos

Sistema de catálogo digital multiempresa da Nexora.

O projeto permite cadastrar empresas de diferentes segmentos, configurar identidade visual, gerenciar produtos/serviços, destacar itens, controlar horários de funcionamento e receber pedidos pelo WhatsApp.

## Rotas principais

- `/admin`: painel administrativo
- `/cardapio/slug-da-empresa`: catálogo público para empresas de alimentação
- `/catalogo/slug-da-empresa`: catálogo público para outros segmentos

## Recursos principais

- Gestão de múltiplas empresas
- Cadastro de produtos, serviços e categorias
- Itens em destaque com controle de ordem
- Tema claro, escuro e cores personalizadas
- Logo, banner e identidade visual por empresa
- Status de aberto/fechado por horário de funcionamento
- Pedido com retirada/entrega e forma de pagamento
- Envio do pedido pelo WhatsApp
- Acessos por empresa com senha temporária
- Bloqueio, desbloqueio e exclusão de empresas
- Dados cadastrais da empresa no painel Nexora

## Operação

Antes de rodar qualquer SQL novo, faça backup do banco.

Depois de cada alteração:

1. Abrir ou revisar o Pull Request no GitHub.
2. Rodar o SQL necessário no servidor, quando houver.
3. Fazer merge do Pull Request.
4. Fazer deploy no EasyPanel.
5. Conferir o painel e pelo menos um catálogo público.

## Banco de dados

As tabelas principais usam o prefixo `catalogo_`.

Principais tabelas:

- `catalogo_empresas`
- `catalogo_usuarios`
- `catalogo_categorias`
- `catalogo_produtos`

Os scripts SQL ficam na pasta `sql/`.

## Deploy

O deploy é feito pelo EasyPanel usando o repositório:

- GitHub: `R7ocem/nexora-catalogo`
- Branch: `main`
- Caminho de build: `/`

Variável pública principal:

```env
NEXT_PUBLIC_BASE_URL=https://catalogo.usenexora.com.br
