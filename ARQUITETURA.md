# Arquitetura do Projeto Nexora Catalogos

## Visao geral

O Nexora Catalogos e uma plataforma de catalogo digital multiempresa e multissegmento. O mesmo sistema atende alimentacao, festas, decoracao, beleza, moda, servicos e outros tipos de negocio.

A Nexora administra todas as empresas em um painel central. Cada empresa cliente tem seu proprio painel, identidade visual, produtos, campanhas, pedidos, relatorios e configuracoes.

O objetivo do sistema e entregar uma experiencia simples para o lojista e pratica para o cliente final:

- Cliente acessa o catalogo.
- Escolhe produtos ou servicos.
- Adiciona ao pedido.
- Envia pelo WhatsApp.
- Loja acompanha o pedido pelo painel ou pelo fluxo do n8n.

## Tecnologias principais

- Next.js: aplicacao web, rotas publicas, APIs e painel administrativo.
- React: telas interativas do catalogo e painel.
- PostgreSQL: banco principal.
- Docker: execucao dos servicos.
- EasyPanel: deploy e gerenciamento do app.
- Traefik: HTTPS e roteamento de dominios.
- GitHub: versionamento, branches e pull requests.
- n8n: automacoes de WhatsApp, vendedor, recuperacao de carrinho e alertas futuros.
- Evolution API: envio e recebimento de mensagens WhatsApp.

## Estrutura de pastas

```text
app/
  admin/                         Painel administrativo e acoes do painel
  api/inventory/                 Endpoints para estoque e n8n
  cardapio/[slug]/               Rota publica legada para alimentacao
  catalogo/[slug]/               Rota publica legada para outros segmentos
  [slug]/                        Rota publica curta principal
  globals.css                    Estilos gerais do painel e catalogo
  catalog-adjustments.css        Ajustes visuais especificos do catalogo

lib/
  auth.js                        Login, sessao, senha e usuario
  catalog.js                     Regras de segmento e rotas publicas
  db.js                          Conexao com PostgreSQL
  format.js                      Formatacoes reutilizaveis
  inventoryAuth.js               Protecao dos endpoints de estoque
  validation.js                  Validacoes de email, WhatsApp e CPF/CNPJ

sql/
  001_setup.sql                  Base inicial
  002_admin_users.sql            Usuarios administrativos
  003_instagram_url.sql          Instagram
  004_catalog_controls.sql       Destaques e opcoes do catalogo
  005_visual_background_controls.sql
  006_multiempresa_hardening.sql
  007_company_email.sql
  008_company_owner_data.sql
  009_product_variations.sql
  010_product_shipping_text.sql
  011_inventory.sql
  012_smart_inventory.sql
  013_orders_panel.sql
  014_catalog_welcome_notice.sql
  015_catalog_welcome_image.sql
```

## Rotas publicas

### Rota curta principal

```text
https://catalogo.usenexora.com.br/slug-da-empresa
```

Essa e a rota recomendada para novos clientes, porque funciona para qualquer segmento e nao prende a loja ao termo "cardapio".

### Rota de cardapio

```text
https://catalogo.usenexora.com.br/cardapio/savore
```

Mantida para alimentacao e compatibilidade com links antigos.

### Rota de catalogo

```text
https://catalogo.usenexora.com.br/catalogo/viva-festas
```

Mantida para outros segmentos e compatibilidade com links antigos.

### Painel

```text
https://catalogo.usenexora.com.br/admin
```

O painel muda conforme o usuario:

- `nexora_admin`: gerencia todas as empresas.
- `empresa_admin`: gerencia apenas a empresa vinculada.

## Banco de dados

As tabelas principais usam o prefixo `catalogo_`.

### `catalogo_empresas`

Guarda cada empresa cliente.

Principais grupos de dados:

- Identificacao: nome, slug, segmento, tipo de oferta.
- Contato: WhatsApp, email, Instagram.
- Dados cadastrais: proprietario, CPF/CNPJ, endereco, cidade e estado.
- Visual: logo, banner, cores, gradiente, tema e fundo.
- Tela inicial: titulo, texto e imagem de aviso.
- Funcionamento: dias e horarios.
- Pedido: opcoes de retirada, entrega, Pix, dinheiro e cartao.
- Controle interno: bloqueio, ativo/inativo e dados de acesso.

### `catalogo_usuarios`

Guarda os acessos ao painel.

- Empresa vinculada.
- Nome do usuario.
- Email de acesso.
- Senha criptografada.
- Papel do usuario.
- Status ativo.

As senhas nao podem ser visualizadas. A Nexora pode redefinir uma senha temporaria.

### `catalogo_categorias`

Organiza os itens da vitrine.

- Empresa.
- Nome.
- Ordem.
- Status ativo.

### `catalogo_produtos`

Guarda produtos e servicos.

Principais campos:

- Empresa.
- Categoria.
- Codigo.
- Nome.
- Descricao com quebras de linha preservadas.
- Preco.
- Tipo de item.
- Tipo de preco.
- Foto.
- Variacoes.
- Frete/entrega no card.
- Destaque e posicao.
- Apelidos para o bot.
- Status ativo.
- Controle de estoque.
- Estoque inteligente.

### `pedidos` e `pedido_itens`

Guardam os pedidos recebidos pelo catalogo/n8n.

Principais campos:

- Empresa.
- Cliente.
- Telefone.
- Pedido.
- Numero do dia.
- Status.
- Status de preparo.
- Total.
- Retirada ou entrega.
- Endereco e localizacao.
- Forma de pagamento.
- Itens do pedido.
- Datas de preparo, pronto, saiu para entrega e finalizado.

### `stock_movements`

Guarda movimentacoes de estoque.

Tipos previstos:

- Entrada.
- Saida.
- Ajuste.
- Cancelamento.

Essa tabela prepara o sistema para relatorios e automacoes de estoque.

## Painel administrativo

O painel foi organizado em uma Central de Gestao com modulos.

### Modulos principais

- Pedidos da loja.
- Produtos e servicos.
- Relatorios.
- Novo produto.
- Categorias do catalogo.
- Campanhas e avisos.
- Dados da empresa.
- Seguranca da conta.
- Usuarios e acessos, quando for Nexora Admin.
- Nova empresa, quando for Nexora Admin.

### Topo do painel

Mostra:

- Logo da empresa.
- Nome da empresa.
- Status ativo.
- Botao Ver catalogo.
- Botao Sair.

### Rodape do painel

Mostra:

- Fale conosco via WhatsApp da Nexora.
- Criado por Nexora.

## Pedidos da loja

O painel de pedidos e uma evolucao visual do fluxo que antes dependia apenas de comandos no WhatsApp.

Ele usa a mesma logica de status:

- Novo.
- Em preparo.
- Pronto.
- Saiu.
- Finalizado.

Cada pedido aparece em card, com:

- Numero do pedido.
- Cliente.
- Telefone.
- Total.
- Recebimento.
- Pagamento.
- Itens.
- Endereco, quando for entrega.
- Botoes de Maps/Waze, quando houver localizacao.
- Botoes para avancar status.

### Fluxo de retirada

1. Novo.
2. Aceitar pedido.
3. Em preparo.
4. Pedido pronto.
5. Cliente retira.
6. Finalizar.

### Fluxo de entrega

1. Novo.
2. Aceitar pedido.
3. Em preparo.
4. Pedido pronto.
5. Saiu para entrega.
6. Finalizar.

### Reversao de status

O painel permite reverter os pontos mais criticos:

- De Pronto para Em preparo.
- De Saiu para Pronto.

## Relatorios

O modulo de Relatorios usa dados reais de pedidos salvos no banco.

Filtros disponiveis:

- Hoje.
- Ontem.
- Esta semana.
- Este mes.
- Ultimos 7 dias.
- Ultimos 30 dias.
- Periodo personalizado.

Indicadores:

- Total vendido.
- Quantidade de pedidos.
- Ticket medio.
- Valor medio por item.
- Produtos mais vendidos.
- Produtos com menor saida.
- Receita por produto.
- Pedidos por status.
- Pedidos por retirada/entrega.
- Pedidos por forma de pagamento.
- Horarios com mais pedidos.

Se nao houver pedidos no periodo, o painel mostra aviso claro.

## Produtos e servicos

O lojista pode:

- Cadastrar produto ou servico.
- Editar foto.
- Editar nome, codigo, categoria, preco e descricao.
- Informar variacoes.
- Informar texto de frete/entrega.
- Marcar como destaque.
- Definir posicao do destaque.
- Ativar ou desativar.
- Excluir.

### Apelidos para o bot

O campo existe para ajudar o vendedor do n8n a reconhecer produtos por nomes alternativos.

Direcao futura:

- Reduzir preenchimento manual.
- Usar o nome do produto como base automaticamente.
- Fazer o vendedor buscar produtos direto do catalogo.

## Variacoes de produtos

As variacoes permitem vender um unico item com opcoes, sem cadastrar produtos repetidos.

Exemplo:

```text
Cor: Vermelho, Azul, Dourado
Tamanho: 06, 09, 12, 16, 26
```

No catalogo publico, o cliente escolhe as opcoes dentro da tela de detalhes do produto.

## Estoque inteligente

O estoque foi preparado para ir alem de um minimo manual.

Campos principais:

- Controlar estoque.
- Quantidade em estoque.
- Estoque minimo manual.
- Dias para reposicao.
- Dias de seguranca.
- Calcular minimo inteligente.
- Mostrar produto quando esgotado.

### Calculo inicial

O sistema usa media dos ultimos 14 dias.

Formula:

```text
estoque minimo recomendado =
media diaria de vendas x (dias de reposicao + dias de seguranca)
```

### Status de estoque

- Normal: acima do minimo recomendado.
- Atencao: abaixo ou igual ao minimo recomendado.
- Critico: abaixo ou igual a 50% do minimo recomendado.
- Esgotado: 0 unidades.

O status aparece no painel e no catalogo.

### Endpoints para n8n

```text
GET /api/inventory/low-stock
GET /api/inventory/alerts
POST /api/inventory/adjust
```

Esses endpoints sao protegidos por token:

```env
INVENTORY_CRON_TOKEN=
```

Uso futuro:

- n8n consulta produtos em atencao, criticos ou esgotados.
- n8n envia alerta no WhatsApp da loja.
- Loja atualiza estoque pelo painel.

## Catalogo publico

O catalogo mostra:

- Tela inicial animada.
- Banner.
- Logo centralizada em bloco arredondado.
- Nome da empresa.
- Instagram.
- Status aberto/fechado.
- Destaques.
- Categorias.
- Cards de produtos/servicos.
- Frete/entrega no card, quando informado.
- Variacoes.
- Quantidade no detalhe do item.
- Carrinho moderno.
- Pedido pelo WhatsApp.
- Botao de ajuda via WhatsApp.
- Criado por Nexora.

### Tela inicial

Quando o cliente entra, aparece um aviso inicial.

Se a loja nao configurar nada, aparece uma instrucao padrao:

```text
Escolha seus produtos, adicione ao carrinho e envie seu pedido pelo WhatsApp em poucos segundos.
```

Se a loja preencher titulo, texto ou imagem, a tela vira uma area de promocao/campanha.

## Campanhas e avisos

O modulo permite personalizar a tela inicial do catalogo:

- Titulo do aviso.
- Texto do aviso.
- Imagem do aviso.

Se a imagem do aviso ficar vazia, o catalogo usa o banner principal.

## Fluxo de pedido pelo catalogo

1. Cliente entra no catalogo.
2. Ve a tela inicial e clica para continuar.
3. Escolhe um item.
4. Abre detalhes do item.
5. Escolhe variacoes, quando houver.
6. Escolhe quantidade.
7. Adiciona ao carrinho.
8. Abre Ver pedido.
9. Confere total, itens e quantidades.
10. Escolhe retirada ou entrega.
11. Escolhe forma de pagamento.
12. Envia pelo WhatsApp.

## Integracao com n8n

O n8n atualmente cuida de:

- Vendedor WhatsApp.
- Conversa inicial.
- Pedido digitado pelo cliente.
- Pedido vindo do catalogo.
- Envio do pedido para a cozinha/loja.
- Atualizacao de status por comando.
- Recuperacao de carrinho abandonado.

### Comandos atuais da loja

O fluxo foi simplificado para evitar o uso de `#`.

Exemplo com pedido `05`:

- `05`: aceitar pedido.
- `P05`: pedido pronto.
- `S05`: saiu para entrega.
- `F05`: finalizar pedido.

### Pontos planejados para o n8n

- Tornar o vendedor 100% multiempresa.
- Fazer o vendedor consultar produtos/servicos direto do catalogo.
- Se o cliente errar produto, enviar link do catalogo.
- Recuperacao de carrinho multiempresa.
- Trocar IP fixo da Evolution por nome interno/variavel.
- Ajustar numero sequencial dos pedidos para comecar em 77.
- Integrar alertas de estoque inteligente.

## Seguranca

Recursos atuais:

- Login administrativo.
- Senhas criptografadas.
- Sessao por cookie.
- Separacao entre Nexora Admin e empresa.
- Validacao de email.
- Validacao de WhatsApp.
- Validacao de CPF/CNPJ.
- Validacao de slug/link publico.
- Protecao basica contra origem nao confiavel em formularios administrativos.
- Limite de tentativas de login.
- Endpoints de estoque protegidos por token.

## Infraestrutura

Dominio principal:

```text
https://catalogo.usenexora.com.br
```

Repositorio:

```text
R7ocem/nexora-catalogo
```

Projeto EasyPanel:

```text
nexora01
```

Servico EasyPanel:

```text
nexora-catalogo
```

Servicos relacionados:

- `nexora-catalogo`
- `nexora-db`
- `nexora-redis`
- `nexora-n8n`
- `metabase`
- `evolution`
- `traefik`

## Traefik e Bad Gateway

Existe um script de correcao no servidor:

```bash
/root/fix-traefik-nexora.sh
```

Ele confere/corrige rotas para:

- `catalogo.usenexora.com.br`
- `n8n.usenexora.com.br`
- `metabase.usenexora.com.br`

Retorno esperado:

```text
catalogo.usenexora.com.br -> 200
n8n.usenexora.com.br -> 200
metabase.usenexora.com.br -> 200
```

## Operacao recomendada

Antes de qualquer SQL:

1. Fazer backup do banco.
2. Conferir se o SQL ja foi aplicado.
3. Rodar somente o SQL necessario.

Depois de alterar codigo:

1. Abrir ou atualizar Pull Request.
2. Conferir se nao ha conflito.
3. Fazer merge.
4. Fazer deploy no EasyPanel.
5. Testar `/admin`.
6. Testar pelo menos um catalogo publico.
7. Se houver Bad Gateway, rodar o script do Traefik.

## Estado atual

O projeto esta preparado como plataforma multiempresa e multissegmento.

O antigo conceito de Food foi removido da identidade do sistema. O foco atual e Nexora Catalogos, com suporte para cardapio em empresas de alimentacao e catalogo para os demais segmentos.

As principais bases ja existentes sao:

- Catalogo publico responsivo.
- Painel administrativo modular.
- Pedidos em cards.
- Relatorios por periodo.
- Estoque inteligente.
- Tela promocional inicial.
- Variacoes de produtos.
- Integracao com WhatsApp/n8n em evolucao.

## Proximas evolucoes importantes

- Finalizar vendedor n8n multiempresa.
- Integrar vendedor aos produtos reais do catalogo.
- Melhorar recuperacao de carrinho por empresa.
- Criar painel interno mais avancado de pedidos, se necessario.
- Enviar alertas de estoque inteligente via WhatsApp.
- Evoluir relatorios para comparativos e campanhas.
- Criar historico mais completo de vendas e atendimento.
