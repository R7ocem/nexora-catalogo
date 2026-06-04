export function rotuloCatalogo(segmento) {
  return segmento === 'alimentacao' ? 'Cardápio digital' : 'Catálogo digital';
}

export function caminhoCatalogo(empresa) {
  const prefixo = empresa?.segmento === 'alimentacao' ? 'cardapio' : 'catalogo';

  return `/${prefixo}/${empresa?.slug || ''}`;
}

export function subtituloCatalogo(empresa) {
  const padrao = rotuloCatalogo(empresa?.segmento);
  const subtitulo = String(empresa?.subtitulo_publico || '').trim();
  const subtituloGenerico = ['catalogo', 'catalogo digital', 'cardapio', 'cardapio digital'].includes(
    subtitulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );

  return !subtitulo || subtituloGenerico ? padrao : subtitulo;
}
