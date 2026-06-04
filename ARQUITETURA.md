# Arquitetura do Projeto Nexora Catalogos

## Visao geral

O Nexora Catalogos e um sistema de catalogo digital multiempresa. Ele permite que a Nexora gerencie varias empresas clientes em um unico painel, com catalogos publicos separados por segmento, identidade visual, produtos, servicos, pedidos via WhatsApp e controles administrativos.

O sistema atende empresas de alimentacao e tambem outros segmentos, como festas, decoracao, moda, beleza, servicos e outros.

## Tecnologias principais

- Next.js: aplicacao web, rotas publicas e painel administrativo.
- React: componentes e telas do painel/catalogo.
- PostgreSQL: banco de dados principal.
- EasyPanel: deploy e gerenciamento do servico.
- Traefik: roteamento dos dominios e HTTPS.
- Docker: execucao dos servicos no servidor.
- GitHub: versionamento e pull requests.

## Estrutura principal

```text
app/
  admin/                 Painel administrativo
  cardapio/[slug]/       Catalogo publico para alimentacao
  catalogo/[slug]/       Catalogo publico para outros segmentos

lib/
  auth.js                Sessao, senha, autenticacao e usuario logado
  catalog.js             Regras de rotas e rotulos de catalogo/cardapio
  db.js                  Conexao com PostgreSQL
  format.js              Formatacao de valores
  validation.js          Validacoes de email, WhatsApp e CPF/CNPJ

sql/
  *.sql                  Scripts de criacao e evolucao do banco
```

## Rotas publicas

### `/cardapio/[slug]`

Usada para empresas de alimentacao.

Exemplo:

```text
https://catalogo.usenexora.com.br/cardapio/savore
```

Mostra o catalogo da empresa com:

- Banner
- Logo
- Nome da empresa
- Instagram
- Status aberto/fechado
- Destaques
- Categorias
- Produtos
- Carrinho/pedido
- Opcoes de recebimento e pagamento
- Envio pelo WhatsApp

### `/catalogo/[slug]`

Usada para empresas de outros segmentos.

Exemplo:

```text
https://catalogo.usenexora.com.br/catalogo/viva-festas
```

Funciona como catalogo digital, com os mesmos recursos principais, mas usando a nomenclatura adequada para segmentos que nao sao alimentacao.

### `/admin`

Painel administrativo da Nexora e das empresas.

O acesso depende do usuario logado:

- `nexora_admin`: administra todas as empresas.
- `empresa_admin`: administra apenas a propria empresa.

## Banco de dados

As tabelas principais usam o prefixo `catalogo_`.

### `catalogo_empresas`

Guarda as empresas clientes.

Principais campos:

- Nome da empresa
- Slug/link publico
- WhatsApp
- Email da empresa
- Proprietario
- CPF/CNPJ
- Endereco
- Cidade
- Estado
- Segmento
- Tipo de oferta
- Titulo e subtitulo publicos
- Instagram
- Logo e banner
- Cores e tema
- Fundo do catalogo
- Horarios de funcionamento
- Opcoes de pedido
- Status ativo/bloqueado

### `catalogo_usuarios`

Guarda os acessos ao painel.

Principais campos:

- Empresa vinculada
- Nome
- Email
- Senha criptografada
- Papel do usuario
- Status ativo

As senhas nao ficam visiveis. Quando necessario, o admin Nexora define uma senha temporaria.

### `catalogo_categorias`

Organiza os produtos/servicos por categoria.

Principais campos:

- Empresa
- Nome da categoria
- Ordem
- Status ativo

### `catalogo_produtos`

Guarda produtos e servicos do catalogo.

Principais campos:

- Empresa
- Categoria
- Codigo
- Nome
- Descricao
- Preco
- Tipo do item
- Tipo de preco
- Imagem
- Destaque
- Ordem do destaque
- Apelidos/aliases
- Status ativo

## Funcionalidades do painel Nexora

### Gestao de empresas

O admin Nexora pode:

- Criar nova empresa
- Escolher empresa existente
- Alterar dados da empresa
- Preencher dados cadastrais
- Definir segmento
- Definir tipo de oferta
- Configurar nome publico e subtitulo
- Adicionar Instagram
- Bloquear empresa
- Desbloquear empresa
- Excluir empresa bloqueada

### Dados cadastrais da empresa

Campos disponiveis para controle interno:

- Proprietario
- CPF/CNPJ
- Endereco
- Cidade
- Estado

Esses dados ajudam a Nexora a controlar clientes ja cadastrados e empresas antigas.

### Acessos da empresa

O admin Nexora pode:

- Criar acesso para uma empresa sem usuario
- Alterar nome do usuario
- Alterar email de acesso
- Definir nova senha temporaria

As senhas antigas nao podem ser visualizadas, apenas redefinidas.

### Identidade visual

Cada empresa pode configurar:

- Logo
- Banner
- Zoom de logo/banner
- Cor principal
- Cor secundaria
- Gradiente
- Fundo claro, escuro ou personalizado

### Horario de funcionamento

O painel permite configurar dias e horarios de funcionamento.

No catalogo publico aparece:

- Aberto
- Fechado

O status e calculado com base no horario configurado.

### Opcoes de pedido

O painel permite ativar/desativar:

- Retirada
- Entrega
- Pix
- Dinheiro
- Cartao

Essas opcoes aparecem no carrinho antes do cliente enviar o pedido.

### Produtos e servicos

O painel permite:

- Cadastrar produto/servico
- Editar produto/servico
- Alterar categoria
- Definir preco
- Definir imagem
- Definir tipo de item
- Definir tipo de preco
- Ativar/desativar
- Excluir

### Destaques

O sistema permite marcar itens como destaque.

Os destaques aparecem no topo do catalogo, com controle de ordem:

- Automatico
- Primeiro
- Segundo
- Terceiro
- Quarto
- Quinto
- Sexto

## Funcionalidades do catalogo publico

O catalogo publico mostra:

- Banner da empresa
- Logo
- Nome publico
- Subtitulo
- Botao do Instagram
- Status aberto/fechado
- Lista de destaques
- Categorias
- Produtos/servicos
- Botao adicionar
- Carrinho/pedido moderno
- Total aproximado
- Quantidade de itens
- Remocao de itens
- Forma de recebimento
- Forma de pagamento
- Envio para WhatsApp

## Fluxo de pedido

1. Cliente acessa o catalogo publico.
2. Escolhe produtos/servicos.
3. Clica em adicionar.
4. Abre o carrinho em Ver pedido.
5. Confere itens, quantidades e total.
6. Escolhe retirada ou entrega.
7. Escolhe forma de pagamento.
8. Clica em Enviar pelo WhatsApp.
9. O sistema monta a mensagem e abre o WhatsApp da empresa.

## Fluxo de criacao de empresa

1. Admin Nexora entra no painel.
2. Preenche Criar nova empresa:
   - Nome da empresa
   - Link do catalogo
   - Nome do proprietario
   - CPF/CNPJ
   - Endereco
   - Cidade
   - Estado
   - WhatsApp
   - Email de acesso
   - Senha temporaria
3. Sistema valida email, WhatsApp, CPF/CNPJ e link.
4. Empresa e acesso sao criados.
5. Admin configura produtos, categorias, cores, banner, logo e horarios.

## Fluxo de deploy

O deploy atual e feito pelo EasyPanel.

Sequencia recomendada:

1. Fazer backup do banco antes de SQL novo.
2. Rodar SQL necessario no servidor.
3. Fazer merge do Pull Request no GitHub.
4. Implantar no EasyPanel.
5. Conferir se o deploy ficou verde.
6. Testar painel e catalogo publico.

## Dominios e infraestrutura

Dominio principal atual:

```text
https://catalogo.usenexora.com.br
```

Servico no EasyPanel:

```text
nexora-catalogo
```

Repositorio GitHub:

```text
R7ocem/nexora-catalogo
```

Projeto EasyPanel:

```text
nexora01
```

Servicos relacionados no servidor:

- `nexora-catalogo`
- `nexora-db`
- `nexora-redis`
- `nexora-n8n`
- `metabase`
- `evolution`
- `traefik`

## Script de recuperacao do Traefik

Existe um script no servidor:

```bash
/root/fix-traefik-nexora.sh
```

Ele garante rotas internas do Traefik para:

- `catalogo.usenexora.com.br`
- `n8n.usenexora.com.br`
- `metabase.usenexora.com.br`

Quando houver Bad Gateway apos deploy ou instabilidade do Traefik, ele pode ser executado manualmente:

```bash
/root/fix-traefik-nexora.sh
```

Retorno esperado:

```text
catalogo.usenexora.com.br -> 200
n8n.usenexora.com.br -> 200
metabase.usenexora.com.br -> 200
```

## Seguranca

Recursos ja existentes:

- Login administrativo
- Senhas criptografadas
- Sessao por cookie seguro
- Protecao basica contra origem nao confiavel em formularios administrativos
- Limite de tentativas de login
- Validacao de email
- Validacao de WhatsApp
- Validacao de CPF/CNPJ
- Separacao de permissao entre admin Nexora e empresa

## Pontos importantes de manutencao

- Sempre fazer backup antes de rodar SQL.
- Nunca rodar SQL antigo sem conferir se ele ja foi aplicado.
- Depois de cada deploy, testar `/admin` e pelo menos um catalogo publico.
- Se o EasyPanel der Bad Gateway, executar o script do Traefik.
- Ao criar empresa nova, conferir o link publico e o acesso da empresa.
- Ao bloquear empresa, conferir se painel e catalogo ficam indisponiveis para o cliente.

## Estado atual do projeto

O projeto esta organizado como Nexora Catalogos e preparado para multiempresa e multissegmento.

O nome Food foi removido da identidade do projeto, do servico e das tabelas internas, mantendo rotas especiais de alimentacao em `/cardapio/[slug]` apenas por regra de negocio.
