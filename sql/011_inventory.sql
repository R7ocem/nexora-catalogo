ALTER TABLE catalogo_produtos
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_when_out_of_stock BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

UPDATE catalogo_produtos
SET
  stock_quantity = GREATEST(COALESCE(stock_quantity, 0), 0),
  min_stock = GREATEST(COALESCE(min_stock, 0), 0),
  track_stock = COALESCE(track_stock, false),
  show_when_out_of_stock = COALESCE(show_when_out_of_stock, true),
  is_available = COALESCE(is_available, true);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES catalogo_produtos(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES catalogo_empresas(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste', 'cancelamento')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT,
  order_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_low_stock
ON catalogo_produtos (empresa_id, track_stock, stock_quantity, min_stock);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created_at
ON stock_movements (product_id, created_at DESC);
