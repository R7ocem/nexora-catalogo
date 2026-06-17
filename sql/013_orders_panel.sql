CREATE TABLE IF NOT EXISTS pedidos (
  pedido_id TEXT PRIMARY KEY,
  numero_dia INTEGER,
  session_id TEXT,
  company TEXT,
  cliente TEXT,
  telefone TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  total NUMERIC NOT NULL DEFAULT 0,
  subtotal_produtos NUMERIC NOT NULL DEFAULT 0,
  desconto NUMERIC NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC NOT NULL DEFAULT 0,
  entrega_retirada TEXT,
  endereco TEXT,
  pagamento TEXT,
  tempo_preparo_minutos INTEGER NOT NULL DEFAULT 30,
  confirmado_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  latitude_entrega NUMERIC,
  longitude_entrega NUMERIC,
  enviado_cozinha BOOLEAN NOT NULL DEFAULT false,
  enviado_cozinha_em TIMESTAMP,
  erro_envio_cozinha TEXT,
  data_pedido DATE DEFAULT CURRENT_DATE,
  status_preparo TEXT,
  preparo_em TIMESTAMP,
  pronto_em TIMESTAMP,
  saiu_entrega_em TIMESTAMP,
  finalizado_em TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id SERIAL PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(pedido_id) ON DELETE CASCADE,
  produto TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_preparo TEXT,
ADD COLUMN IF NOT EXISTS preparo_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS pronto_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS saiu_entrega_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pedidos_company_status
ON pedidos (company, status, status_preparo, confirmado_em DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_data_numero
ON pedidos (data_pedido DESC, numero_dia);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido
ON pedido_itens (pedido_id);
