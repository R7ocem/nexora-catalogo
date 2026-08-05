ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS client_order_key TEXT;

ALTER TABLE pedido_itens
ADD COLUMN IF NOT EXISTS product_id INTEGER,
ADD COLUMN IF NOT EXISTS nome_produto TEXT,
ADD COLUMN IF NOT EXISTS variant_id TEXT,
ADD COLUMN IF NOT EXISTS variant_title TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS variacoes_escolhidas JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_company_client_order_key
ON pedidos (company, client_order_key)
WHERE company IS NOT NULL
  AND client_order_key IS NOT NULL
  AND BTRIM(client_order_key) <> '';

CREATE INDEX IF NOT EXISTS idx_pedido_itens_product_variant
ON pedido_itens (product_id, variant_id);
