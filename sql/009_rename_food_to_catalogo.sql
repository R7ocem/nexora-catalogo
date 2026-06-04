ALTER TABLE IF EXISTS food_usuarios RENAME TO catalogo_usuarios;
ALTER TABLE IF EXISTS food_produtos RENAME TO catalogo_produtos;
ALTER TABLE IF EXISTS food_categorias RENAME TO catalogo_categorias;
ALTER TABLE IF EXISTS food_empresas RENAME TO catalogo_empresas;

ALTER INDEX IF EXISTS idx_food_usuarios_empresa_id RENAME TO idx_catalogo_usuarios_empresa_id;
ALTER INDEX IF EXISTS idx_food_empresas_slug RENAME TO idx_catalogo_empresas_slug;
ALTER INDEX IF EXISTS idx_food_categorias_empresa_ordem RENAME TO idx_catalogo_categorias_empresa_ordem;
ALTER INDEX IF EXISTS idx_food_produtos_empresa_ativo_categoria RENAME TO idx_catalogo_produtos_empresa_ativo_categoria;
ALTER INDEX IF EXISTS idx_food_produtos_empresa_destaque RENAME TO idx_catalogo_produtos_empresa_destaque;
