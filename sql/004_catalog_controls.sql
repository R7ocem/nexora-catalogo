ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS tema_cor_secundaria TEXT DEFAULT '#14b8a6',
ADD COLUMN IF NOT EXISTS usar_gradiente BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS horario_funcionamento JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS opcoes_pedido JSONB NOT NULL DEFAULT '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb;

ALTER TABLE catalogo_produtos
ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS destaque_ordem INTEGER NOT NULL DEFAULT 0;
