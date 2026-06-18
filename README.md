# Nexora Catalogos

Sistema de catalogo digital multiempresa da Nexora.

O projeto permite cadastrar empresas de diferentes segmentos, configurar identidade visual, gerenciar produtos/servicos, destacar itens, controlar horarios de funcionamento e receber pedidos pelo WhatsApp.

## Rotas principais

- `/admin`: painel administrativo
- `/slug-da-empresa`: link publico principal para qualquer segmento
- `/cardapio/slug-da-empresa`: link antigo de cardapio para empresas de alimentacao
- `/catalogo/slug-da-empresa`: link antigo de catalogo para outros segmentos

## Recursos principais

- Gestao de multiplas empresas
- Cadastro de produtos, servicos e categorias
- Itens em destaque com controle de ordem
- Tema claro, escuro e cores personalizadas
- Logo, banner e identidade visual por empresa
- Status de aberto/fechado por horario de funcionamento
- Pedido com retirada/entrega e forma de pagamento
- Envio do pedido pelo WhatsApp
- Acessos por empresa com senha temporaria
- Bloqueio, desbloqueio e exclusao de empresas
- Dados cadastrais da empresa no painel Nexora

## Operacao

Antes de rodar qualquer SQL novo, faca backup do banco.

Depois de cada alteracao:

1. Abrir ou revisar o Pull Request no GitHub.
2. Rodar o SQL necessario no servidor, quando houver.
3. Fazer merge do Pull Request.
4. Fazer deploy no EasyPanel.
5. Conferir o painel e pelo menos um catalogo publico.

## Banco de dados

As tabelas principais usam o prefixo `catalogo_`.

Principais tabelas:

- `catalogo_empresas`
- `catalogo_usuarios`
- `catalogo_categorias`
- `catalogo_produtos`

Os scripts SQL ficam na pasta `sql/`.

## Deploy

O deploy e feito pelo EasyPanel usando o repositorio:

- GitHub: `R7ocem/nexora-catalogo`
- Branch: `main`
- Caminho de build: `/`

Variavel publica principal:

```env
NEXT_PUBLIC_BASE_URL=https://catalogo.usenexora.com.br
```
