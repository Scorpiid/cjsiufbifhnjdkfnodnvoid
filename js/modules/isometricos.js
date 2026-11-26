/**
 * SGIEE – Módulo: Isométricos y Documentación Técnica
 * Manages technical drawings, isometrics, datasheets linked to equipment.
 * Stores metadata + base64 thumbnails (or external links).
 * Provides an interactive SVG isometric viewer with CML pin overlay.
 */
const ModIsometricos = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let selectedEquipoId = null;
  let activeDocId      = null;
  let searchTerm       = '';

  /* ── Render ─────────────────────────────────────────────── */
  function render(equipoId = null) {
    if (equipoId) selectedEquipoId = equipoId;

    const el = document.getElementById('mod-isometricos');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Isométricos y Documentación Técnica</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="iso-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="iso-newBtn">＋ Nuevo Documento</button>
        </div>
      </div>

      <!-- Equipo selector -->
      <div class="card mb-2">
        <div class="card-body" style="padding:12px 20px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;font-weight:600">Equipo:</label>
            <select class="form-control" id="iso-eqSel" style="max-width:420px">
              <option value="">— Todos los equipos —</option>
              ${DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
                .map(e=>`<option value="${e.id}" ${selectedEquipoId===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
                .join('')}
            </select>
            <div class="search-input" style="min-width:180px">
              <input type="text" id="iso-search" placeholder="Buscar doc…">
            </div>
          </div>
        </div>
      </div>

      <!-- Main layout -->
      <div class="grid-2" id="iso-mainGrid" style="align-items:start">
        <!-- Doc list -->
        <div id="iso-listArea"></div>

        <!-- Viewer panel -->
        <div id="iso-viewerArea">
          <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:32px">
            <div class="empty-icon">📐</div>
            <h3>Seleccione un documento</h3>
            <p>Haga clic en un isométrico para visualizarlo e interactuar con los CMLs</p>
          </div>
        </div>
      </div>`;

    _bindEvents(el);
    _renderDocList();
  }

  /* ── Document List ──────────────────────────────────────── */
  function _renderDocList() {
    let docs = selectedEquipoId
      ? DB.query('isometricos', d => d.equipo_id === selectedEquipoId)
      : DB.getAll('isometricos');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      docs = docs.filter(d =>
        [d.titulo, d.numero, d.tipo, d.revision, d.descripcion]
          .some(v => (v||'').toLowerCase().includes(q))
      );
    }

    docs.sort((a,b) => (a.tipo||'').localeCompare(b.tipo||'') || (a.numero||'').localeCompare(b.numero||''));

    const area = document.getElementById('iso-listArea');
    if (!area) return;

    if (docs.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>Sin documentos</h3>
        <p>Agregue isométricos, planos o fichas técnicas para este equipo.</p>
        <button class="btn btn-primary btn-sm mt-2" id="iso-newBtn2">＋ Nuevo Documento</button>
      </div>`;
      area.querySelector('#iso-newBtn2')?.addEventListener('click', () => openDocForm(null));
      return;
    }

    const cards = docs.map(doc => {
      const eq = DB.getById('equipos', doc.equipo_id);
      const isActive = doc.id === activeDocId;
      const typeIcon = { 'Isométrico':'📐','Plano Mecánico':'📏','Datasheet':'📄',
        'P&ID':'⚙','Procedimiento':'📋','Informe':'📊' }[doc.tipo] || '📁';

      return `
        <div class="iso-card ${isActive?'selected':''}" data-doc="${doc.id}"
          style="background:var(--c-surface);border:1px solid ${isActive?'var(--c-primary)':'var(--c-border)'};
          border-radius:var(--r-lg);padding:14px 16px;margin-bottom:10px;cursor:pointer;
          transition:border-color .15s,box-shadow .15s;
          ${isActive?'box-shadow:0 0 0 3px rgba(26,111,196,.15)':''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:1.6rem;flex-shrink:0">${typeIcon}</span>
              <div>
                <div style="font-weight:700;font-size:.95rem">${Utils.escHtml(doc.titulo)}</div>
                <div class="text-xs text-muted">
                  ${Utils.escHtml(doc.numero||'')}
                  ${doc.revision ? `· Rev.${Utils.escHtml(doc.revision)}` : ''}
                  · ${Utils.fmtDate(doc.fecha)}
                </div>
                ${eq ? `<div class="text-xs text-muted">${eq.tag}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <span class="badge badge-muted">${Utils.escHtml(doc.tipo||'—')}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
            ${doc.url_externa
              ? `<a href="${Utils.escHtml(doc.url_externa)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Abrir</a>`
              : `<button class="btn btn-ghost btn-sm" data-doc-action="view" data-doc="${doc.id}">👁 Ver</button>`}
            <button class="btn btn-ghost btn-sm" data-doc-action="edit" data-doc="${doc.id}">✏️</button>
            <button class="btn btn-ghost btn-sm" data-doc-action="del"  data-doc="${doc.id}"
              style="color:var(--c-danger)">🗑</button>
          </div>
        </div>`;
    }).join('');

    area.innerHTML = cards;

    // Bind card clicks
    area.querySelectorAll('.iso-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button, a')) return;
        activeDocId = card.dataset.doc;
        _renderDocList();
        _openViewer(activeDocId);
      });
    });
    area.querySelectorAll('[data-doc-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { docAction, doc } = btn.dataset;
        if (docAction === 'view') _openViewer(doc);
        if (docAction === 'edit') openDocForm(doc);
        if (docAction === 'del')  deleteDoc(doc);
      });
    });
  }

  /* ── SVG Isometric Viewer with CML Pins ─────────────────── */
  function _openViewer(docId) {
    const doc = DB.getById('isometricos', docId);
    if (!doc) return;
    const eq   = doc.equipo_id ? DB.getById('equipos', doc.equipo_id) : null;
    const cmls = doc.equipo_id ? DB.query('cmls', c => c.equipo_id === doc.equipo_id) : [];

    const viewArea = document.getElementById('iso-viewerArea');
    if (!viewArea) return;

    // Build CML pins data
    const pins = (doc.cml_pins || []).map(pin => {
      const cml = cmls.find(c => c.id === pin.cml_id);
      const cr  = cml ? DB.calcCorrosionRate(cml.id) : null;
      const lm  = cml ? DB.lastMedicion(cml.id) : null;
      const color = !cr ? '#8a9ab0' : cr <= 0.1 ? '#22a06b' : cr <= 0.5 ? '#e8a020' : '#d93025';
      return { ...pin, cml, cr, lm, color };
    });

    viewArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 style="font-size:.95rem">${Utils.escHtml(doc.titulo)}</h3>
            <div class="text-xs text-muted">
              ${Utils.escHtml(doc.numero||'')} · Rev.${Utils.escHtml(doc.revision||'—')} · ${Utils.fmtDate(doc.fecha)}
              ${eq ? `· ${eq.tag}` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            ${cmls.length > 0 ? `<button class="btn btn-secondary btn-sm" id="iso-addPinBtn">📍 Añadir Pin CML</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('iso-viewerArea').innerHTML='<div class=empty-state><div class=empty-icon>📐</div><h3>Panel cerrado</h3></div>'" title="Cerrar">✕</button>
          </div>
        </div>
        <div class="card-body">

          <!-- Drawing area -->
          <div id="iso-svgWrap" style="position:relative;border:1px solid var(--c-border);
            border-radius:var(--r-md);overflow:hidden;background:#fafbfc;min-height:360px">
            ${_buildDrawing(doc, pins)}
            ${_buildPinOverlay(pins)}
          </div>

          <!-- Pin legend -->
          ${pins.length > 0 ? `
          <div class="mt-2">
            <div class="text-xs text-muted mb-1" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px">
              CML Monitoreados en este documento
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${pins.map(p => {
                if (!p.cml) return '';
                return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;
                  background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md)">
                  <span style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
                  <div>
                    <div class="text-sm font-bold">${Utils.escHtml(p.cml.nombre)}</div>
                    <div class="text-xs text-muted">${p.lm ? p.lm.espesor_mm + ' mm' : '—'} · ${p.cr !== null ? p.cr.toFixed(3)+' mm/a' : '—'}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}

          <!-- Metadata -->
          <div class="form-section mt-2">
            <div class="form-section-title">Detalles del Documento</div>
            <div class="form-row cols-3">
              ${_dCell('Tipo',          doc.tipo)}
              ${_dCell('N° Documento',  doc.numero)}
              ${_dCell('Revisión',      doc.revision)}
              ${_dCell('Fecha',         Utils.fmtDate(doc.fecha))}
              ${_dCell('Autor / Emisor',doc.autor)}
              ${_dCell('Estado',        doc.estado_doc)}
            </div>
            ${doc.descripcion ? `<div class="mt-1 text-sm text-muted">${Utils.escHtml(doc.descripcion)}</div>` : ''}
            ${doc.url_externa ? `<div class="mt-1"><a href="${Utils.escHtml(doc.url_externa)}" target="_blank"
              class="btn btn-secondary btn-sm">🔗 Abrir documento externo</a></div>` : ''}
          </div>
        </div>
      </div>`;

    // Add pin button
    document.getElementById('iso-addPinBtn')?.addEventListener('click', () => openAddPinModal(docId, cmls, doc.cml_pins||[]));

    // Pin hover tooltips
    viewArea.querySelectorAll('.cml-pin').forEach(pin => {
      pin.addEventListener('click', () => {
        const pinData = pins.find(p => p.cml_id === pin.dataset.cml);
        if (!pinData?.cml) return;
        Utils.toast(
          pinData.cml.nombre,
          `${pinData.cml.descripcion || ''} · ${pinData.lm ? pinData.lm.espesor_mm+' mm' : 'Sin medición'} · CR: ${pinData.cr!==null?pinData.cr.toFixed(3)+' mm/a':'—'}`,
          'info',
          4000
        );
      });
    });
  }

  function _dCell(label, val) {
    return `<div>
      <div class="text-xs text-muted">${label}</div>
      <div class="text-sm font-bold">${Utils.escHtml(String(val||'—'))}</div>
    </div>`;
  }

  /* ── SVG Drawing ────────────────────────────────────────── */
  function _buildDrawing(doc, pins) {
    // If stored SVG use it, else render default schematic per equipment type
    if (doc.svg_data) {
      return `<div style="width:100%;overflow:auto">${doc.svg_data}</div>`;
    }

    const eq = doc.equipo_id ? DB.getById('equipos', doc.equipo_id) : null;
    const tipo = eq?.tipo || '';

    // Generic schematic per equipment category
    const W = 500, H = 280;
    let shapes = '';

    if (tipo === 'Vasija a Presión' || tipo === 'Intercambiador') {
      shapes = `
        <!-- Vessel body -->
        <rect x="100" y="80" width="300" height="120" rx="10" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Left head ellipse -->
        <ellipse cx="100" cy="140" rx="20" ry="60" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Right head ellipse -->
        <ellipse cx="400" cy="140" rx="20" ry="60" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Nozzle top -->
        <rect x="225" y="55" width="50" height="30" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <!-- Nozzle bottom -->
        <rect x="225" y="195" width="50" height="30" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <!-- Saddle supports -->
        <rect x="150" y="200" width="40" height="40" fill="#c0c8d8" stroke="#8a9ab0" stroke-width="1"/>
        <rect x="310" y="200" width="40" height="40" fill="#c0c8d8" stroke="#8a9ab0" stroke-width="1"/>
        <!-- Label -->
        <text x="${W/2}" y="${H-15}" text-anchor="middle" font-size="12" fill="#5a6a80"
          font-family="Segoe UI,sans-serif">${Utils.escHtml(eq?.tag||'Vasija')} – ${Utils.escHtml(eq?.nombre||'')}</text>`;
    } else if (tipo === 'Tubería a Presión') {
      shapes = `
        <!-- Pipe straight -->
        <rect x="40" y="120" width="420" height="40" fill="#e8f4ff" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Elbow -->
        <path d="M 40 120 Q 40 90 70 90 L 150 90" fill="none" stroke="#1a6fc4" stroke-width="20"
          stroke-linecap="round"/>
        <!-- Flanges -->
        <rect x="38" y="115" width="6" height="50" fill="#8a9ab0"/>
        <rect x="456" y="115" width="6" height="50" fill="#8a9ab0"/>
        <rect x="148" y="82" width="6" height="20" fill="#8a9ab0"/>
        <!-- Flow arrow -->
        <line x1="200" y1="140" x2="320" y2="140" stroke="#1a6fc4" stroke-width="2" marker-end="url(#arrow)"/>
        <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#1a6fc4"/>
        </marker></defs>
        <text x="${W/2}" y="${H-15}" text-anchor="middle" font-size="12" fill="#5a6a80"
          font-family="Segoe UI,sans-serif">${Utils.escHtml(eq?.tag||'Tubería')} – ${Utils.escHtml(eq?.nombre||'')}</text>`;
    } else if (tipo === 'Tanque Atmosférico') {
      shapes = `
        <!-- Tank shell -->
        <rect x="130" y="40" width="240" height="200" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Roof (cone approx) -->
        <polygon points="130,40 250,10 370,40" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="2"/>
        <!-- Bottom -->
        <ellipse cx="250" cy="240" rx="120" ry="12" fill="#c8d8f0" stroke="#1a6fc4" stroke-width="1.5"/>
        <!-- Liquid level (75%) -->
        <rect x="131" y="90" width="238" height="149" fill="rgba(26,111,196,.08)"/>
        <line x1="131" y1="90" x2="369" y2="90" stroke="#1a6fc4" stroke-width="1" stroke-dasharray="6,3"/>
        <text x="375" y="94" font-size="10" fill="#1a6fc4" font-family="sans-serif">N.L.</text>
        <!-- Nozzle -->
        <rect x="90" y="180" width="40" height="20" fill="#d0e4fa" stroke="#1a6fc4" stroke-width="1.5"/>
        <text x="${W/2}" y="${H-5}" text-anchor="middle" font-size="12" fill="#5a6a80"
          font-family="Segoe UI,sans-serif">${Utils.escHtml(eq?.tag||'Tanque')}</text>`;
    } else {
      // Generic placeholder
      shapes = `
        <rect x="150" y="80" width="200" height="120" rx="8" fill="#e8f0fe" stroke="#1a6fc4" stroke-width="2"/>
        <text x="${W/2}" y="145" text-anchor="middle" font-size="14" fill="#1a6fc4"
          font-family="Segoe UI,sans-serif">${Utils.escHtml(eq?.tipo||'Equipo')}</text>
        <text x="${W/2}" y="${H-20}" text-anchor="middle" font-size="12" fill="#5a6a80"
          font-family="Segoe UI,sans-serif">${Utils.escHtml(eq?.tag||'')} – ${Utils.escHtml(eq?.nombre||doc.titulo||'')}</text>`;
    }

    return `<svg width="${W}" height="${H}" style="max-width:100%;display:block;margin:0 auto"
      viewBox="0 0 ${W} ${H}">${shapes}</svg>`;
  }

  /* ── Pin overlay ────────────────────────────────────────── */
  function _buildPinOverlay(pins) {
    if (pins.length === 0) return '';
    return pins.map(p => `
      <div class="cml-pin" data-cml="${p.cml_id}"
        style="position:absolute;left:${p.x||50}%;top:${p.y||50}%;
        transform:translate(-50%,-50%);
        width:22px;height:22px;border-radius:50%;
        background:${p.color};border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:.65rem;font-weight:700;color:#fff;
        transition:transform .15s"
        title="${Utils.escHtml(p.cml?.nombre||p.cml_id)}"
        onmouseover="this.style.transform='translate(-50%,-50%) scale(1.3)'"
        onmouseout="this.style.transform='translate(-50%,-50%) scale(1)'">
        📍
      </div>`).join('');
  }

  /* ── Add Pin Modal ──────────────────────────────────────── */
  function openAddPinModal(docId, cmls, existingPins) {
    const cmlOpts = cmls
      .map(c => `<option value="${c.id}">${Utils.escHtml(c.nombre)} – ${Utils.escHtml(c.descripcion||'')}</option>`)
      .join('');

    Utils.openModal('📍 Agregar Pin de CML al Isométrico',
      `<form id="pin-form">
        <div class="alert alert-info mb-2">
          <span class="alert-icon">ℹ️</span>
          <div>Ingrese la posición aproximada del CML en el plano (% desde esquina superior-izquierda).</div>
        </div>
        <div class="form-group">
          <label>CML a posicionar<span class="required">*</span></label>
          <select class="form-control" id="pin_cml">${cmlOpts}</select>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Posición X (%)<span class="required">*</span></label>
            <input type="number" class="form-control" id="pin_x" value="50" min="0" max="100" step="1">
            <div class="form-hint">0% = izquierda, 100% = derecha</div>
          </div>
          <div class="form-group">
            <label>Posición Y (%)<span class="required">*</span></label>
            <input type="number" class="form-control" id="pin_y" value="50" min="0" max="100" step="1">
            <div class="form-hint">0% = arriba, 100% = abajo</div>
          </div>
        </div>
      </form>`,
      {
        size: 'modal-sm',
        footerHtml: `
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" id="pin-saveBtn">📍 Agregar Pin</button>`
      }
    );

    setTimeout(() => {
      document.getElementById('pin-saveBtn')?.addEventListener('click', () => {
        const cmlId = document.getElementById('pin_cml')?.value;
        const x = parseFloat(document.getElementById('pin_x')?.value);
        const y = parseFloat(document.getElementById('pin_y')?.value);
        if (!cmlId || isNaN(x) || isNaN(y)) {
          Utils.toast('Requerido','Seleccione CML e ingrese posición.','error'); return;
        }
        const newPins = [...existingPins.filter(p => p.cml_id !== cmlId), { cml_id: cmlId, x, y }];
        DB.update('isometricos', docId, { cml_pins: newPins });
        Utils.toast('Pin agregado','CML posicionado en el isométrico.','success');
        Utils.closeModal();
        activeDocId = docId;
        _renderDocList();
        _openViewer(docId);
      });
    }, 50);
  }

  /* ── Document Form ──────────────────────────────────────── */
  function openDocForm(docId) {
    const doc   = docId ? DB.getById('isometricos', docId) : null;
    const title = doc ? `✏️ Editar – ${doc.titulo}` : '＋ Nuevo Documento';

    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e => `<option value="${e.id}" ${(doc?.equipo_id===e.id||selectedEquipoId===e.id)?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');
    const v = (f,d='') => Utils.escHtml(doc ? (doc[f]??d) : d);
    const sel = (f,val) => doc?.[f]===val ? 'selected' : '';

    const body = `
      <form id="iso-form">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Equipo asociado<span class="required">*</span></label>
            <select class="form-control" id="df_eq">${eqOpts}</select>
          </div>
          <div class="form-group">
            <label>Tipo de documento<span class="required">*</span></label>
            <select class="form-control" id="df_tipo">
              ${['Isométrico','Plano Mecánico','Datasheet','P&ID','Procedimiento','Informe','Otro']
                .map(t=>`<option ${sel('tipo',t)}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Título del documento<span class="required">*</span></label>
          <input class="form-control" id="df_titulo" value="${v('titulo')}"
            placeholder="p.ej. Isométrico Línea de Proceso P-201A">
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label>N° Documento</label>
            <input class="form-control" id="df_num" value="${v('numero')}" placeholder="p.ej. ISO-P201A-001">
          </div>
          <div class="form-group">
            <label>Revisión</label>
            <input class="form-control" id="df_rev" value="${v('revision')}" placeholder="A, B, 0, 1…">
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" class="form-control" id="df_fecha" value="${v('fecha', Utils.today())}">
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Autor / Empresa emisora</label>
            <input class="form-control" id="df_autor" value="${v('autor')}">
          </div>
          <div class="form-group">
            <label>Estado del documento</label>
            <select class="form-control" id="df_estdoc">
              ${['Vigente','Obsoleto','En revisión','Borrador'].map(s=>`<option ${sel('estado_doc',s)}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>URL / Ruta externa <span class="text-muted text-xs">(enlace a DMS, SharePoint, etc.)</span></label>
          <input class="form-control" id="df_url" type="url" value="${v('url_externa')}"
            placeholder="https://…">
          <div class="form-hint">Si se ingresa URL, el botón "Abrir" usará este enlace.</div>
        </div>
        <div class="form-group">
          <label>Descripción / Notas</label>
          <textarea class="form-control" id="df_desc" rows="2">${v('descripcion')}</textarea>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-lg',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="iso-saveDocBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('iso-saveDocBtn')?.addEventListener('click', () => {
        const titulo = document.getElementById('df_titulo')?.value?.trim();
        const eq_id  = document.getElementById('df_eq')?.value;
        if (!titulo || !eq_id) {
          Utils.toast('Requerido','Complete equipo y título.','error'); return;
        }
        const data = {
          equipo_id:  eq_id,
          tipo:       document.getElementById('df_tipo')?.value,
          titulo,
          numero:     document.getElementById('df_num')?.value?.trim()||'',
          revision:   document.getElementById('df_rev')?.value?.trim()||'',
          fecha:      document.getElementById('df_fecha')?.value||Utils.today(),
          autor:      document.getElementById('df_autor')?.value?.trim()||'',
          estado_doc: document.getElementById('df_estdoc')?.value||'Vigente',
          url_externa: document.getElementById('df_url')?.value?.trim()||'',
          descripcion: document.getElementById('df_desc')?.value?.trim()||'',
          cml_pins:   doc?.cml_pins || [],
        };
        if (docId) {
          DB.update('isometricos', docId, data);
          Utils.toast('Actualizado','Documento actualizado.','success');
        } else {
          DB.insert('isometricos', data);
          Utils.toast('Creado','Documento registrado.','success');
        }
        Utils.closeModal();
        selectedEquipoId = data.equipo_id;
        render();
      });
    }, 50);
  }

  /* ── Delete ─────────────────────────────────────────────── */
  function deleteDoc(docId) {
    const doc = DB.getById('isometricos', docId);
    if (!doc) return;
    Utils.confirm(`¿Eliminar documento "${doc.titulo}"?`, () => {
      DB.remove('isometricos', docId);
      if (activeDocId === docId) {
        activeDocId = null;
        const v = document.getElementById('iso-viewerArea');
        if (v) v.innerHTML = '<div class="empty-state"><div class="empty-icon">📐</div><h3>Documento eliminado</h3></div>';
      }
      Utils.toast('Eliminado','Documento eliminado.','warning');
      _renderDocList();
    });
  }

  /* ── Event binding ──────────────────────────────────────── */
  function _bindEvents(el) {
    el.querySelector('#iso-newBtn').addEventListener('click', () => openDocForm(null));
    el.querySelector('#iso-eqSel').addEventListener('change', e => {
      selectedEquipoId = e.target.value || null;
      activeDocId = null;
      _renderDocList();
    });
    const deb = Utils.debounce(() => _renderDocList());
    el.querySelector('#iso-search').addEventListener('input', e => {
      searchTerm = e.target.value; deb();
    });
    el.querySelector('#iso-exportBtn').addEventListener('click', () => {
      const all = DB.getAll('isometricos');
      const headers = ['ID','Equipo_TAG','Tipo','Título','Número','Revisión','Fecha','Autor','Estado','URL'];
      const rows = all.map(d => {
        const eq = DB.getById('equipos', d.equipo_id);
        return [d.id, eq?.tag||'', d.tipo, d.titulo, d.numero, d.revision,
          d.fecha, d.autor, d.estado_doc, d.url_externa||''];
      });
      Utils.exportCSV(headers, rows, `isometricos_${Utils.today()}.csv`);
    });
  }

  return { render, openNewDocument: () => openDocForm(null) };
})();
