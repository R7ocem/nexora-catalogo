ALTER TABLE food_empresas
ADD COLUMN IF NOT EXISTS segmento TEXT NOT NULL DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS email_empresa TEXT,
ADD COLUMN IF NOT EXISTS proprietario_nome TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS tipo_oferta TEXT NOT NULL DEFAULT 'produtos',
ADD COLUMN IF NOT EXISTS titulo_publico TEXT,
ADD COLUMN IF NOT EXISTS subtitulo_publico TEXT,
ADD COLUMN IF NOT EXISTS descricao_publica TEXT,
ADD COLUMN IF NOT EXISTS tema_cor TEXT NOT NULL DEFAULT '#0f766e',
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bloqueado_motivo TEXT,
ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMP;

ALTER TABLE food_produtos
ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'produto',
ADD COLUMN IF NOT EXISTS tipo_preco TEXT NOT NULL DEFAULT 'fixo',
ADD COLUMN IF NOT EXISTS apelidos TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_food_empresas_slug
ON food_empresas (slug);

CREATE INDEX IF NOT EXISTS idx_food_categorias_empresa_ordem
ON food_categorias (empresa_id, ordem);

CREATE INDEX IF NOT EXISTS idx_food_produtos_empresa_ativo_categoria
ON food_produtos (empresa_id, ativo, categoria_id);

CREATE INDEX IF NOT EXISTS idx_food_produtos_empresa_destaque
ON food_produtos (empresa_id, destaque, destaque_ordem);
