CREATE TABLE IF NOT EXISTS food_empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  instagram_url TEXT,
  tema_cor_secundaria TEXT DEFAULT '#14b8a6',
  usar_gradiente BOOLEAN NOT NULL DEFAULT true,
  catalogo_fundo_tipo TEXT NOT NULL DEFAULT 'claro',
  catalogo_fundo_cor TEXT NOT NULL DEFAULT '#f7f4ef',
  logo_posicao TEXT NOT NULL DEFAULT 'center',
  banner_posicao TEXT NOT NULL DEFAULT 'center',
  horario_funcionamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  opcoes_pedido JSONB NOT NULL DEFAULT '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb,
  logo_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_categorias (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES food_empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_produtos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES food_empresas(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES food_categorias(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC NOT NULL DEFAULT 0,
  imagem_url TEXT,
  destaque BOOLEAN NOT NULL DEFAULT false,
  destaque_ordem INTEGER NOT NULL DEFAULT 0,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

ALTER TABLE food_empresas
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE food_empresas
ADD COLUMN IF NOT EXISTS tema_cor_secundaria TEXT DEFAULT '#14b8a6',
ADD COLUMN IF NOT EXISTS usar_gradiente BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS catalogo_fundo_tipo TEXT NOT NULL DEFAULT 'claro',
ADD COLUMN IF NOT EXISTS catalogo_fundo_cor TEXT NOT NULL DEFAULT '#f7f4ef',
ADD COLUMN IF NOT EXISTS logo_posicao TEXT NOT NULL DEFAULT 'center',
ADD COLUMN IF NOT EXISTS banner_posicao TEXT NOT NULL DEFAULT 'center',
ADD COLUMN IF NOT EXISTS horario_funcionamento JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS opcoes_pedido JSONB NOT NULL DEFAULT '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb;

ALTER TABLE food_produtos
ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS destaque_ordem INTEGER NOT NULL DEFAULT 0;

INSERT INTO food_empresas (nome, slug, whatsapp, ativo)
VALUES ('Savore Gourmet', 'savore', '556199327471', true)
ON CONFLICT (slug)
DO UPDATE SET
  nome = EXCLUDED.nome,
  whatsapp = EXCLUDED.whatsapp,
  ativo = EXCLUDED.ativo,
  atualizado_em = NOW();

WITH empresa AS (
  SELECT id FROM food_empresas WHERE slug = 'savore'
)
INSERT INTO food_categorias (empresa_id, nome, ordem, ativo)
SELECT e.id, c.nome, c.ordem, true
FROM empresa e
CROSS JOIN (
  VALUES
    ('Salgados', 1),
    ('Bebidas', 2),
    ('Sobremesas', 3)
) AS c(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM food_categorias fc
  WHERE fc.empresa_id = e.id AND fc.nome = c.nome
);
