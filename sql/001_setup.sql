CREATE TABLE IF NOT EXISTS catalogo_empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  email_empresa TEXT,
  proprietario_nome TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  instagram_url TEXT,
  segmento TEXT NOT NULL DEFAULT 'outros',
  tipo_oferta TEXT NOT NULL DEFAULT 'produtos',
  titulo_publico TEXT,
  subtitulo_publico TEXT,
  descricao_publica TEXT,
  tema_cor TEXT NOT NULL DEFAULT '#0f766e',
  tema_cor_secundaria TEXT DEFAULT '#14b8a6',
  usar_gradiente BOOLEAN NOT NULL DEFAULT true,
  catalogo_fundo_tipo TEXT NOT NULL DEFAULT 'claro',
  catalogo_fundo_cor TEXT NOT NULL DEFAULT '#f7f4ef',
  logo_posicao TEXT NOT NULL DEFAULT '50% 50%',
  logo_zoom NUMERIC NOT NULL DEFAULT 1,
  banner_posicao TEXT NOT NULL DEFAULT '50% 50%',
  banner_zoom NUMERIC NOT NULL DEFAULT 1,
  horario_funcionamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  opcoes_pedido JSONB NOT NULL DEFAULT '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb,
  logo_url TEXT,
  banner_url TEXT,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  bloqueado_motivo TEXT,
  bloqueado_em TIMESTAMP,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_categorias (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES catalogo_empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_produtos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES catalogo_empresas(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES catalogo_categorias(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC NOT NULL DEFAULT 0,
  tipo_item TEXT NOT NULL DEFAULT 'produto',
  tipo_preco TEXT NOT NULL DEFAULT 'fixo',
  imagem_url TEXT,
  destaque BOOLEAN NOT NULL DEFAULT false,
  destaque_ordem INTEGER NOT NULL DEFAULT 0,
  apelidos TEXT NOT NULL DEFAULT '',
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS email_empresa TEXT;

ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS proprietario_nome TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE catalogo_empresas
ADD COLUMN IF NOT EXISTS segmento TEXT NOT NULL DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS tipo_oferta TEXT NOT NULL DEFAULT 'produtos',
ADD COLUMN IF NOT EXISTS titulo_publico TEXT,
ADD COLUMN IF NOT EXISTS subtitulo_publico TEXT,
ADD COLUMN IF NOT EXISTS descricao_publica TEXT,
ADD COLUMN IF NOT EXISTS tema_cor TEXT NOT NULL DEFAULT '#0f766e',
ADD COLUMN IF NOT EXISTS tema_cor_secundaria TEXT DEFAULT '#14b8a6',
ADD COLUMN IF NOT EXISTS usar_gradiente BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS catalogo_fundo_tipo TEXT NOT NULL DEFAULT 'claro',
ADD COLUMN IF NOT EXISTS catalogo_fundo_cor TEXT NOT NULL DEFAULT '#f7f4ef',
ADD COLUMN IF NOT EXISTS logo_posicao TEXT NOT NULL DEFAULT '50% 50%',
ADD COLUMN IF NOT EXISTS logo_zoom NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS banner_posicao TEXT NOT NULL DEFAULT '50% 50%',
ADD COLUMN IF NOT EXISTS banner_zoom NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS horario_funcionamento JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS opcoes_pedido JSONB NOT NULL DEFAULT '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bloqueado_motivo TEXT,
ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMP;

ALTER TABLE catalogo_produtos
ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'produto',
ADD COLUMN IF NOT EXISTS tipo_preco TEXT NOT NULL DEFAULT 'fixo',
ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS destaque_ordem INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS apelidos TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_catalogo_empresas_slug
ON catalogo_empresas (slug);

CREATE INDEX IF NOT EXISTS idx_catalogo_categorias_empresa_ordem
ON catalogo_categorias (empresa_id, ordem);

CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_empresa_ativo_categoria
ON catalogo_produtos (empresa_id, ativo, categoria_id);

CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_empresa_destaque
ON catalogo_produtos (empresa_id, destaque, destaque_ordem);

INSERT INTO catalogo_empresas (nome, slug, whatsapp, ativo)
VALUES ('Savore Gourmet', 'savore', '556199327471', true)
ON CONFLICT (slug)
DO UPDATE SET
  nome = EXCLUDED.nome,
  whatsapp = EXCLUDED.whatsapp,
  ativo = EXCLUDED.ativo,
  atualizado_em = NOW();

WITH empresa AS (
  SELECT id FROM catalogo_empresas WHERE slug = 'savore'
)
INSERT INTO catalogo_categorias (empresa_id, nome, ordem, ativo)
SELECT e.id, c.nome, c.ordem, true
FROM empresa e
CROSS JOIN (
  VALUES
    ('Salgados', 1),
    ('Bebidas', 2),
    ('Sobremesas', 3)
) AS c(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_categorias fc
  WHERE fc.empresa_id = e.id AND fc.nome = c.nome
);
