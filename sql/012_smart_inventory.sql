ALTER TABLE catalogo_produtos
ADD COLUMN IF NOT EXISTS replenishment_days INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS safety_days INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS auto_calculate_min_stock BOOLEAN NOT NULL DEFAULT true;

UPDATE catalogo_produtos
SET
  replenishment_days = GREATEST(COALESCE(replenishment_days, 7), 1),
  safety_days = GREATEST(COALESCE(safety_days, 3), 0),
  auto_calculate_min_stock = COALESCE(auto_calculate_min_stock, true);

CREATE INDEX IF NOT EXISTS idx_stock_movements_sales_14_days
ON stock_movements (product_id, type, created_at DESC);
