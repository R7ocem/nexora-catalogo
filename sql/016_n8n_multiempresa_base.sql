-- Base de configuracao por empresa para o vendedor n8n.
ALTER TABLE catalogo_empresas
  ADD COLUMN IF NOT EXISTS n8n_instance TEXT,
  ADD COLUMN IF NOT EXISTS n8n_greeting TEXT,
  ADD COLUMN IF NOT EXISTS n8n_menu JSONB NOT NULL DEFAULT '{"items":[{"number":1,"label":"Fazer pedido","action":"pedido","enabled":true},{"number":2,"label":"Ver catalogo","action":"catalogo","enabled":true},{"number":3,"label":"Falar com atendimento","action":"humano","enabled":true}]}'::jsonb,
  ADD COLUMN IF NOT EXISTS n8n_kitchen_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS n8n_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS n8n_pix_holder TEXT,
  ADD COLUMN IF NOT EXISTS n8n_next_order_number INTEGER NOT NULL DEFAULT 77,
  ADD COLUMN IF NOT EXISTS print_config JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE catalogo_empresas
SET n8n_instance = slug
WHERE n8n_instance IS NULL OR BTRIM(n8n_instance) = '';

UPDATE catalogo_empresas
SET n8n_next_order_number = 77
WHERE n8n_next_order_number IS NULL OR n8n_next_order_number < 77;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_empresas_n8n_instance
ON catalogo_empresas (n8n_instance)
WHERE n8n_instance IS NOT NULL AND BTRIM(n8n_instance) <> '';

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS numero_sequencial INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_empresa_numero_sequencial
ON pedidos (company, numero_sequencial)
WHERE company IS NOT NULL AND numero_sequencial IS NOT NULL;

CREATE TABLE IF NOT EXISTS solicitacoes_orcamento (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES catalogo_empresas(id) ON DELETE CASCADE,
  session_id TEXT,
  cliente TEXT,
  telefone TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_orcamento_empresa_status
ON solicitacoes_orcamento (empresa_id, status, criado_em DESC);
