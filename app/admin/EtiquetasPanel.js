'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_LABEL_OPTIONS, LABEL_MODELS, getLabelModel, getModelCapacity } from '../../lib/labelModels';

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function numero(valor, fallback = 0) {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function texto(valor) {
  return String(valor || '').trim();
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(valor) {
  return texto(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function produtoCodigo(produto) {
  return texto(produto.codigo || produto.sku || produto.id);
}

function produtoUnidade(produto) {
  return texto(produto.unidade_medida || produto.unidade || produto.unit || 'un');
}

function produtoPrecoPromocional(produto) {
  return numero(produto.preco_promocional || produto.preco_promocao || produto.promotional_price || 0);
}

function produtoCodigoBarras(produto) {
  return texto(produto.codigo_barras || produto.codigo_barra || produto.ean || produto.barcode || '');
}

function repetirProdutos(selecionados, produtos) {
  const porId = new Map(produtos.map((produto) => [String(produto.id), produto]));
  const etiquetas = [];

  Object.entries(selecionados).forEach(([id, quantidade]) => {
    const produto = porId.get(String(id));
    const total = Math.max(0, numero(quantidade, 0));

    if (!produto || total <= 0) return;

    for (let index = 0; index < total; index += 1) {
      etiquetas.push(produto);
    }
  });

  return etiquetas;
}

function modeloStyle(modelo) {
  return {
    '--label-width': `${modelo.widthMm}mm`,
    '--label-height': `${modelo.heightMm}mm`
  };
}

function LabelCard({ produto, empresa, modelo, opcoes, preview = false }) {
  const precoPromocional = produtoPrecoPromocional(produto);
  const precoPrincipal = precoPromocional > 0 ? precoPromocional : numero(produto.preco, 0);
  const precoOriginal = precoPromocional > 0 ? numero(produto.preco, 0) : 0;
  const codigo = produtoCodigo(produto);
  const codigoBarras = produtoCodigoBarras(produto);
  const qrData = typeof window !== 'undefined'
    ? `${window.location.origin}/${empresa.slug || ''}?produto=${produto.id}`
    : `${empresa.slug || ''}:${produto.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=92x92&data=${encodeURIComponent(qrData)}`;
  const barcodeUrl = codigoBarras
    ? `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(codigoBarras)}&code=Code128&translate-esc=on`
    : '';

  return (
    <article
      className={[
        'label-preview-card',
        modelo.kind === 'promo' ? 'promo-label' : '',
        opcoes.showCutouts && modelo.hasCutouts ? 'with-cutouts' : '',
        preview ? 'is-preview' : ''
      ].filter(Boolean).join(' ')}
      style={modeloStyle(modelo)}
    >
      {opcoes.showCutouts && modelo.hasCutouts ? (
        <>
          <span className="label-cutout top" />
          <span className="label-cutout bottom" />
        </>
      ) : null}

      <div className="label-heading">
        {opcoes.showLogo && empresa.logo_url ? (
          <img src={empresa.logo_url} alt="" />
        ) : (
          <span>{texto(empresa.nome).slice(0, 1) || 'N'}</span>
        )}

        {opcoes.showCategory && produto.categoria_nome ? (
          <small>{produto.categoria_nome}</small>
        ) : null}
      </div>

      {modelo.kind === 'promo' ? <strong className="label-offer">OFERTA</strong> : null}

      <h3>{produto.nome || 'Produto'}</h3>

      <div className="label-price-box">
        {precoOriginal > 0 ? <del>{moeda(precoOriginal)}</del> : null}
        <strong>{moeda(precoPrincipal)}</strong>
        <span>{produtoUnidade(produto)}</span>
      </div>

      <div className="label-footer">
        {opcoes.showSku && codigo ? <small>Cod. {codigo}</small> : <small />}

        <div className="label-machine-fields">
          {opcoes.showBarcode && codigoBarras ? (
            <img className="label-barcode" src={barcodeUrl} alt={`Codigo de barras ${codigoBarras}`} />
          ) : null}

          {opcoes.showQrCode ? (
            <img className="label-qr" src={qrUrl} alt="QR Code do produto" />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function EtiquetasPanel({ empresa, categorias, produtos }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [modeloId, setModeloId] = useState(LABEL_MODELS[0].id);
  const [selecionados, setSelecionados] = useState({});
  const [opcoes, setOpcoes] = useState(DEFAULT_LABEL_OPTIONS);
  const modelo = getLabelModel(modeloId);
  const capacidade = getModelCapacity(modelo);

  const produtosFiltrados = useMemo(() => {
    const termo = normalizar(busca);

    return produtos.filter((produto) => {
      const categoriaOk = !categoria || String(produto.categoria_id || '') === String(categoria);
      const textoProduto = normalizar([
        produto.nome,
        produto.codigo,
        produto.categoria_nome,
        produto.apelidos
      ].filter(Boolean).join(' '));

      return categoriaOk && (!termo || textoProduto.includes(termo));
    });
  }, [busca, categoria, produtos]);

  const etiquetas = useMemo(
    () => repetirProdutos(selecionados, produtos),
    [selecionados, produtos]
  );

  const previewEtiquetas = etiquetas.slice(0, Math.min(6, capacidade || 6));
  const totalFolhas = Math.max(1, Math.ceil(etiquetas.length / Math.max(1, capacidade)));

  function alterarOpcao(nome) {
    setOpcoes((atual) => ({ ...atual, [nome]: !atual[nome] }));
  }

  function alternarProduto(produto, quantidadePadrao = 1) {
    setSelecionados((atual) => {
      const id = String(produto.id);
      const proximo = { ...atual };

      if (proximo[id]) {
        delete proximo[id];
      } else {
        proximo[id] = quantidadePadrao;
      }

      return proximo;
    });
  }

  function alterarQuantidade(produto, quantidade) {
    setSelecionados((atual) => {
      const id = String(produto.id);
      const total = Math.max(0, numero(quantidade, 0));
      const proximo = { ...atual };

      if (total <= 0) {
        delete proximo[id];
      } else {
        proximo[id] = total;
      }

      return proximo;
    });
  }

  function selecionarFiltrados() {
    setSelecionados((atual) => {
      const proximo = { ...atual };
      produtosFiltrados.forEach((produto) => {
        proximo[String(produto.id)] = proximo[String(produto.id)] || 1;
      });
      return proximo;
    });
  }

  function limparSelecao() {
    setSelecionados({});
  }

  function gerarHtmlImpressao() {
    const labelsHtml = etiquetas.map((produto) => {
      const precoPromocional = produtoPrecoPromocional(produto);
      const precoPrincipal = precoPromocional > 0 ? precoPromocional : numero(produto.preco, 0);
      const precoOriginal = precoPromocional > 0 ? numero(produto.preco, 0) : 0;
      const codigo = produtoCodigo(produto);
      const codigoBarras = produtoCodigoBarras(produto);
      const qrData = `${window.location.origin}/${empresa.slug || ''}?produto=${produto.id}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=92x92&data=${encodeURIComponent(qrData)}`;
      const barcodeUrl = codigoBarras
        ? `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(codigoBarras)}&code=Code128&translate-esc=on`
        : '';

      return `
        <article class="label ${modelo.kind === 'promo' ? 'promo' : ''} ${opcoes.showCutouts && modelo.hasCutouts ? 'with-cutouts' : ''}">
          ${opcoes.showCutouts && modelo.hasCutouts ? '<span class="cutout top"></span><span class="cutout bottom"></span>' : ''}
          <div class="heading">
            ${opcoes.showLogo && empresa.logo_url ? `<img src="${escapeHtml(empresa.logo_url)}" alt="">` : `<span>${escapeHtml(texto(empresa.nome).slice(0, 1) || 'N')}</span>`}
            ${opcoes.showCategory && produto.categoria_nome ? `<small>${escapeHtml(produto.categoria_nome)}</small>` : ''}
          </div>
          ${modelo.kind === 'promo' ? '<b class="offer">PROMOCAO</b>' : ''}
          <h2>${escapeHtml(produto.nome || 'Produto')}</h2>
          <div class="price">
            ${precoOriginal > 0 ? `<del>${moeda(precoOriginal)}</del>` : ''}
            <strong>${moeda(precoPrincipal)}</strong>
            <span>${escapeHtml(produtoUnidade(produto))}</span>
          </div>
          <footer>
            ${opcoes.showSku && codigo ? `<small>Cod. ${escapeHtml(codigo)}</small>` : '<small></small>'}
            <div>
              ${opcoes.showBarcode && codigoBarras ? `<img class="barcode" src="${escapeHtml(barcodeUrl)}" alt="">` : ''}
              ${opcoes.showQrCode ? `<img class="qr" src="${escapeHtml(qrUrl)}" alt="">` : ''}
            </div>
          </footer>
        </article>
      `;
    }).join('');

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Etiquetas ${escapeHtml(empresa.nome || '')}</title>
          <style>
            @page { size: A4 ${modelo.orientation}; margin: ${modelo.marginMm}mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #211f1c; }
            .sheet {
              display: grid;
              grid-template-columns: repeat(${modelo.columns}, ${modelo.widthMm}mm);
              grid-auto-rows: ${modelo.heightMm}mm;
              gap: ${modelo.gapMm}mm;
              align-content: start;
              justify-content: start;
            }
            .label {
              position: relative;
              width: ${modelo.widthMm}mm;
              height: ${modelo.heightMm}mm;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              border: 1px solid #15120f;
              border-radius: 3mm;
              padding: 4mm;
              background: #fffdf7;
              page-break-inside: avoid;
            }
            .label.with-cutouts::before,
            .label.with-cutouts::after {
              position: absolute;
              left: 50%;
              width: 16mm;
              height: 4mm;
              border: 1px solid #15120f;
              background: white;
              content: "";
              transform: translateX(-50%);
            }
            .label.with-cutouts::before { top: -2mm; border-radius: 0 0 4mm 4mm; }
            .label.with-cutouts::after { bottom: -2mm; border-radius: 4mm 4mm 0 0; }
            .heading { display: flex; align-items: center; justify-content: space-between; gap: 2mm; min-height: 10mm; }
            .heading img, .heading span { width: 9mm; height: 9mm; border-radius: 2mm; object-fit: contain; background: #111; color: white; display: grid; place-items: center; font-weight: 900; }
            .heading small { color: #0f766e; font-size: 8pt; font-weight: 800; text-align: right; line-height: 1.05; }
            .offer { align-self: flex-start; margin-top: 1mm; border-radius: 999px; padding: 1.5mm 3mm; background: #b42318; color: white; font-size: 9pt; letter-spacing: 0; }
            h2 {
              min-height: 16mm;
              margin: 2mm 0 1mm;
              font-size: clamp(10pt, 5mm, 18pt);
              line-height: 1.05;
              overflow: hidden;
              overflow-wrap: anywhere;
            }
            .price { margin-top: auto; display: grid; gap: 0.5mm; }
            .price del { color: #706a62; font-size: 9pt; }
            .price strong { color: #0b4f4a; font-size: clamp(21pt, 9mm, 38pt); line-height: 0.95; letter-spacing: 0; }
            .price span { color: #706a62; font-size: 8pt; font-weight: 800; text-transform: uppercase; }
            footer { display: flex; align-items: end; justify-content: space-between; gap: 2mm; margin-top: 2mm; min-height: 9mm; }
            footer small { font-size: 7pt; color: #706a62; }
            footer div { display: flex; align-items: end; gap: 1.5mm; }
            .barcode { width: 24mm; max-height: 9mm; object-fit: contain; }
            .qr { width: 10mm; height: 10mm; object-fit: contain; }
            @media print {
              .sheet { break-inside: auto; }
              .label { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">${labelsHtml}</main>
          <script>window.addEventListener('load', function () { window.print(); });</script>
        </body>
      </html>`;
  }

  function gerarEtiquetas() {
    if (etiquetas.length === 0) {
      window.alert('Selecione pelo menos um produto para gerar etiquetas.');
      return;
    }

    const semPreco = etiquetas.find((produto) => numero(produto.preco, 0) <= 0 && produtoPrecoPromocional(produto) <= 0);
    if (semPreco && !window.confirm('Existem produtos sem preco. Deseja gerar mesmo assim?')) {
      return;
    }

    const janela = window.open('', '_blank', 'width=980,height=720');
    if (!janela) {
      window.alert('O navegador bloqueou a janela de impressao. Libere pop-ups para este site.');
      return;
    }

    janela.document.open();
    janela.document.write(gerarHtmlImpressao());
    janela.document.close();
  }

  return (
    <div className="labels-tool">
      <div className="labels-toolbar">
        <label>
          Buscar produto
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Nome, codigo ou categoria"
          />
        </label>

        <label>
          Categoria
          <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
            <option value="">Todas</option>
            {categorias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modelo
          <select value={modeloId} onChange={(event) => setModeloId(event.target.value)}>
            {LABEL_MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="labels-summary-row">
        <span>{etiquetas.length} etiquetas selecionadas</span>
        <span>{capacidade} por folha A4</span>
        <span>{totalFolhas} folha(s)</span>
      </div>

      <div className="labels-options">
        {[
          ['showLogo', 'Logo'],
          ['showSku', 'Codigo'],
          ['showQrCode', 'QR Code'],
          ['showBarcode', 'Codigo de barras'],
          ['showCategory', 'Categoria'],
          ['showCutouts', 'Recortes']
        ].map(([id, label]) => (
          <label key={id} className="label-toggle">
            <input
              type="checkbox"
              checked={Boolean(opcoes[id])}
              onChange={() => alterarOpcao(id)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="labels-workspace">
        <section className="labels-picker">
          <div className="labels-action-row">
            <button className="secondary-button" type="button" onClick={selecionarFiltrados}>
              Selecionar lista
            </button>
            <button className="secondary-button" type="button" onClick={limparSelecao}>
              Limpar
            </button>
          </div>

          <div className="labels-product-list">
            {produtosFiltrados.length === 0 ? (
              <p className="muted">Nenhum produto encontrado.</p>
            ) : produtosFiltrados.map((produto) => {
              const quantidade = selecionados[String(produto.id)] || 0;

              return (
                <article key={produto.id} className={quantidade > 0 ? 'label-product selected' : 'label-product'}>
                  <button type="button" onClick={() => alternarProduto(produto)}>
                    <strong>{produto.nome}</strong>
                    <span>{produto.categoria_nome || 'Sem categoria'} | {moeda(produto.preco)}</span>
                  </button>

                  <label>
                    Qtd.
                    <input
                      type="number"
                      min="0"
                      value={quantidade}
                      onChange={(event) => alterarQuantidade(produto, event.target.value)}
                    />
                  </label>
                </article>
              );
            })}
          </div>
        </section>

        <section className="labels-preview-panel">
          <div className="labels-preview-header">
            <div>
              <h3>Previa</h3>
              <p>{modelo.name} - {modelo.widthMm} x {modelo.heightMm} mm</p>
            </div>

            <button className="primary-button" type="button" onClick={gerarEtiquetas}>
              Gerar etiquetas
            </button>
          </div>

          <div className="label-preview-grid">
            {previewEtiquetas.length === 0 ? (
              <div className="labels-empty-preview">
                Selecione produtos para montar a folha de etiquetas.
              </div>
            ) : previewEtiquetas.map((produto, index) => (
              <LabelCard
                key={`${produto.id}-${index}`}
                produto={produto}
                empresa={empresa}
                modelo={modelo}
                opcoes={opcoes}
                preview
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
