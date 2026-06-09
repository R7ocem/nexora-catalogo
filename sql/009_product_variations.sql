ALTER TABLE catalogo_produtos
ADD COLUMN IF NOT EXISTS variacoes JSONB NOT NULL DEFAULT '[]'::jsonb;
