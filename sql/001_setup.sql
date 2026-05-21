CREATE TABLE IF NOT EXISTS food_empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
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
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

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
