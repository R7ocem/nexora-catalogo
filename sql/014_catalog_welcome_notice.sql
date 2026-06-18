ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS aviso_titulo TEXT,
ADD COLUMN IF NOT EXISTS aviso_texto TEXT;
