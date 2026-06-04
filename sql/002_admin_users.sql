CREATE TABLE IF NOT EXISTS catalogo_usuarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES catalogo_empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('nexora_admin', 'empresa_admin')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_usuarios_empresa_id
ON catalogo_usuarios (empresa_id);

INSERT INTO catalogo_usuarios (empresa_id, nome, email, senha_hash, papel, ativo)
VALUES (
  NULL,
  'Nexora Admin',
  'r7ocem@gmail.com',
  'pbkdf2_sha256$120000$80874ebcc10e139d1cb61d8c387345f1$77cac779e26c32a15fe6dd45a3ae8aed3bf622031a6d39abf2049505b43fd47b',
  'nexora_admin',
  true
)
ON CONFLICT (email)
DO UPDATE SET
  nome = EXCLUDED.nome,
  senha_hash = EXCLUDED.senha_hash,
  papel = EXCLUDED.papel,
  ativo = EXCLUDED.ativo,
  atualizado_em = NOW();

WITH empresa AS (
  SELECT id FROM catalogo_empresas WHERE slug = 'savore'
)
INSERT INTO catalogo_usuarios (empresa_id, nome, email, senha_hash, papel, ativo)
SELECT
  e.id,
  'Savore Admin',
  'savore@usenexora.com.br',
  'pbkdf2_sha256$120000$6a1db5d8666134d2826393626c68bd41$c0b32f45495082bc6d91e43260ada23e2f861a7ff58f7fcf1b832e055666c342',
  'empresa_admin',
  true
FROM empresa e
ON CONFLICT (email)
DO NOTHING;
