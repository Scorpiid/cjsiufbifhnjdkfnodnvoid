/**
 * SGIEE – Módulo: CML / TML Management
 * Corrosion Monitoring Locations + thickness measurement history,
 * corrosion rate calculation, remaining life, CBM interval recommendation
 */
const ModCML = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let selectedEquipoId = null;
  let selectedCmlId    = null;
  let searchTerm       = '';

  /* ── Entry point (may receive equipoId from navigation) ─── */
  function render(equipoId = null) {
    if (equipoId) selectedEquipoId = equipoId;

    const el = document.getElementById('mod-cml');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>CML / TML – Puntos de Monitoreo de Corrosión</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="cml-exportBtn">⬇ CSV</button>
        </div>
      </div>

      <!-- Equipo selector -->
      <div class="card mb-2">
        <div class="card-body" style="padding:14px 20px">
          <div class="d-flex align-center gap-2" style="flex-wrap:wrap">
            <label style="margin:0;white-space:nowrap;font-weight:600">Equipo:</label>
            <select class="form-control" id="cml-eqSel" style="max-width:420px">${_equipoOptions()}</select>
            <button class="btn btn-primary btn-sm" id="cml-newCmlBtn">＋ Nuevo CML</button>
          </div>
        </div>
      </div>

      <!-- CML list -->
      <div class="grid-2" id="cml-mainGrid" style="align-items:start">
        <!-- Left: CML list -->
        <div>
          <div class="filter-bar" style="margin-bottom:12px">
            <div class="search-input flex-1">
              <input type="text" id="cml-search" placeholder="Buscar CML…">
            </div>
          </div>
          <div id="cml-listArea"></div>
        </div>
        <!-- Right: Measurement history -->
        <div id="cml-detailArea">
          <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:32px">
            <div class="empty-icon">📍</div>
            <h3>Seleccione un CML</h3>
            <p>Haga clic en un CML para ver su historial de mediciones</p>
          </div>
        </div>
      </div>`;

    _bindEvents(el);
    _applyEquipoSel();
  }

  /* ── Equipo selector ────────────────────────────────────── */
  function _equipoOptions() {
    const equipos = DB.getAll('equipos').sort((a,b) => a.tag.localeCompare(b.tag));
    return `<option value="">— Todos los equipos —</option>` +
      equipos.map(e =>
        `<option value="${e.id}" ${selectedEquipoId === e.id ? 'selected' : ''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`
      ).join('');
  }

  function _applyEquipoSel() {
    _renderCmlList();
    if (selectedCmlId) _renderCmlDetail(selectedCmlId);
  }

  /* ── CML List ───────────────────────────────────────────── */
  function _renderCmlList() {
    let cmls = selectedEquipoId
      ? DB.query('cmls', c => c.equipo_id === selectedEquipoId)
      : DB.getAll('cmls');

    if (searchTerm) {
      cmls = cmls.filter(c =>
        [c.nombre, c.descripcion, c.ubicacion]
          .some(v => (v||'').toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    const listArea = document.getElementById('cml-listArea');
    if (!listArea) return;

    if (cmls.length === 0) {
      listArea.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📍</div>
        <h3>Sin CMLs</h3>
        <p>Agregue puntos de monitoreo para este equipo.</p>
      </div>`;
      return;
    }

    const cards = cmls.map(c => {
      const eq  = DB.getById('equipos', c.equipo_id);
      const cr  = DB.calcCorrosionRate(c.id);
      const lm  = DB.lastMedicion(c.id);
      const rl  = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
      const meds = DB.query('mediciones', m => m.cml_id === c.id).length;
      const isSelected = c.id === selectedCmlId;

      const rlTxt = isFinite(rl) ? `${rl.toFixed(1)} a` : '∞';
      const rlCls = Utils.rlClass(rl);

      return `
        <div class="cml-card ${isSelected ? 'selected' : ''}" data-cml="${c.id}"
          style="background:var(--c-surface);border:1px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-border)'};
          border-radius:var(--r-lg);padding:14px 16px;margin-bottom:10px;cursor:pointer;
          transition:border-color .15s,box-shadow .15s;
          ${isSelected ? 'box-shadow:0 0 0 3px rgba(26,111,196,.15)' : ''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <div style="font-weight:700;font-size:.95rem">${Utils.escHtml(c.nombre)}</div>
              <div class="text-sm text-muted">${Utils.escHtml(c.descripcion || '—')}</div>
              ${eq ? `<div class="text-xs text-muted mt-1">${eq.tag} · ${Utils.escHtml(c.ubicacion || '')}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" data-cml-action="edit"   data-cml="${c.id}" title="Editar CML">✏️</button>
              <button class="btn btn-ghost btn-sm" data-cml-action="del"    data-cml="${c.id}" title="Eliminar"
                style="color:var(--c-danger)">🗑</button>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
            <div style="text-align:center">
              <div class="text-xs text-muted">Último espesor</div>
              <div style="font-weight:700;font-family:var(--font-mono)">${lm ? lm.espesor_mm + ' mm' : '—'}</div>
            </div>
            <div style="text-align:center">
              <div class="text-xs text-muted">Tasa corr.</div>
              <div>${Utils.crBadge(cr)}</div>
            </div>
            <div style="text-align:center">
              <div class="text-xs text-muted">Vida rem.</div>
              <div class="font-bold ${rlCls}">${rlTxt}</div>
            </div>
            <div style="text-align:center">
              <div class="text-xs text-muted">Lecturas</div>
              <div class="font-bold">${meds}</div>
            </div>
            <div style="text-align:center">
              <div class="text-xs text-muted">Estado</div>
              <div>${c.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    listArea.innerHTML = cards;

    // Bind card clicks
    listArea.querySelectorAll('.cml-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        selectedCmlId = card.dataset.cml;
        _renderCmlList();
        _renderCmlDetail(selectedCmlId);
      });
    });

    listArea.querySelectorAll('[data-cml-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { cmlAction, cml } = btn.dataset;
        if (cmlAction === 'edit') openCmlForm(cml);
        if (cmlAction === 'del')  deleteCml(cml);
      });
    });
  }

  /* ── CML Detail Panel ───────────────────────────────────── */
  function _renderCmlDetail(cmlId) {
    const cml  = DB.getById('cmls', cmlId);
    const detArea = document.getElementById('cml-detailArea');
    if (!cml || !detArea) return;

    const eq   = DB.getById('equipos', cml.equipo_id);
    const meds = DB.query('mediciones', m => m.cml_id === cmlId)
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    const cr   = DB.calcCorrosionRate(cmlId);
    const rl   = eq ? DB.remainingLife(cmlId, eq.espesor_minimo_mm) : Infinity;
    const cbm  = eq ? DB.nextInspectionCBM(cmlId, eq.espesor_minimo_mm) : null;
    const lm   = meds.length > 0 ? meds[meds.length - 1] : null;

    // Trend data for mini-chart
    const trendHtml = _buildTrendChart(meds, eq);

    // Measurement rows
    const medRows = [...meds].reverse().map(m => `<tr>
      <td>${Utils.fmtDate(m.fecha)}</td>
      <td class="font-mono font-bold">${m.espesor_mm} mm</td>
      <td>${Utils.escHtml(m.metodo)}</td>
      <td>${Utils.escHtml(m.tecnico)}</td>
      <td>${Utils.escHtml(m.notas || '—')}</td>
      <td class="col-actions">
        <button class="btn btn-ghost btn-sm" data-med-action="edit" data-med="${m.id}">✏️</button>
        <button class="btn btn-ghost btn-sm" data-med-action="del"  data-med="${m.id}"
          style="color:var(--c-danger)">🗑</button>
      </td>
    </tr>`).join('');

    // CBM recommendation
    const cbmHtml = _buildCBMBox(cr, rl, cbm, eq, lm);

    detArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>📍 ${Utils.escHtml(cml.nombre)} – ${Utils.escHtml(cml.descripcion || '')}</h3>
          <button class="btn btn-primary btn-sm" id="cml-newMedBtn">＋ Nueva Medición</button>
        </div>
        <div class="card-body">

          <!-- Summary -->
          <div class="mini-stat-row mb-2">
            <div class="mini-stat">
              <div class="ms-label">Último espesor</div>
              <div class="ms-val font-mono">${lm ? lm.espesor_mm + ' mm' : '—'}</div>
            </div>
            <div class="mini-stat">
              <div class="ms-label">Tasa corrosión</div>
              <div class="ms-val">${cr !== null ? Utils.round(cr,4) + ' mm/a' : '—'}</div>
            </div>
            <div class="mini-stat">
              <div class="ms-label">Esp. mínimo eq.</div>
              <div class="ms-val font-mono">${eq?.espesor_minimo_mm ?? '—'} mm</div>
            </div>
            <div class="mini-stat">
              <div class="ms-label">Vida remanente</div>
              <div class="ms-val ${Utils.rlClass(rl)}">${isFinite(rl) ? rl.toFixed(2) + ' a' : '∞'}</div>
            </div>
            <div class="mini-stat">
              <div class="ms-label">Lecturas</div>
              <div class="ms-val">${meds.length}</div>
            </div>
          </div>

          <!-- Trend chart -->
          ${trendHtml}

          <!-- CBM recommendation -->
          ${cbmHtml}

          <!-- Measurements table -->
          <div class="section-header mt-2">
            <h3 class="text-sm">Historial de Mediciones</h3>
          </div>
          ${meds.length === 0
            ? `<div class="empty-state" style="padding:24px">
                <div class="empty-icon" style="font-size:1.8rem">📏</div>
                <p>Sin mediciones registradas aún.</p>
               </div>`
            : `<div class="table-wrapper">
                <table class="data-table" id="med-table">
                  <thead><tr>
                    <th>Fecha</th><th>Espesor</th><th>Método</th><th>Técnico</th><th>Notas</th><th class="col-actions">Acc.</th>
                  </tr></thead>
                  <tbody>${medRows}</tbody>
                </table>
               </div>`}
        </div>
      </div>`;

    // Bind detail events
    document.getElementById('cml-newMedBtn')?.addEventListener('click', () => openMedForm(cmlId, null));
    detArea.querySelectorAll('[data-med-action]').forEach(btn => {
      const { medAction, med } = btn.dataset;
      btn.addEventListener('click', () => {
        if (medAction === 'edit') openMedForm(cmlId, med);
        if (medAction === 'del')  deleteMedicion(med, cmlId);
      });
    });
  }

  /* ── Trend chart (SVG) ──────────────────────────────────── */
  function _buildTrendChart(meds, eq) {
    if (meds.length < 2) return `<div class="text-muted text-sm mb-2" style="text-align:center;padding:8px">
      Se necesitan al menos 2 mediciones para mostrar tendencia.</div>`;

    const W = 440, H = 100, PAD = { t:10, b:30, l:45, r:20 };
    const iW = W - PAD.l - PAD.r;
    const iH = H - PAD.t - PAD.b;

    const dates = meds.map(m => new Date(m.fecha).getTime());
    const esps  = meds.map(m => m.espesor_mm);
    const tMin  = Math.min(...dates), tMax  = Math.max(...dates);
    const eMin  = Math.min(...esps) * 0.95;
    const eMax  = Math.max(...esps) * 1.05;
    const tnom  = eq?.espesor_nominal_mm;
    const tminV = eq?.espesor_minimo_mm;

    const xScale = d => ((d - tMin) / (tMax - tMin || 1)) * iW + PAD.l;
    const yScale = v => iH - ((v - eMin) / (eMax - eMin || 1)) * iH + PAD.t;

    // Polyline
    const pts = meds.map(m => `${xScale(new Date(m.fecha).getTime())},${yScale(m.espesor_mm)}`).join(' ');
    const circles = meds.map(m => `<circle cx="${xScale(new Date(m.fecha).getTime())}" cy="${yScale(m.espesor_mm)}"
      r="4" fill="var(--c-primary)" stroke="white" stroke-width="1.5"/>`).join('');

    // Last date label
    const lastDate = new Date(dates[dates.length-1]).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const firstDate = new Date(dates[0]).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'});

    // Trend projection (extend 3 more years if CR > 0)
    const cr = DB.calcCorrosionRate(meds[0]?.cml_id || '');
    let projLine = '';
    if (cr > 0) {
      const lastEsp = esps[esps.length - 1];
      const lastMs  = dates[dates.length - 1];
      const proj3Ms = lastMs + 3 * 365.25 * 24 * 3600 * 1000;
      const proj3Esp = lastEsp - cr * 3;
      const pxLast = xScale(lastMs); const pyLast = yScale(lastEsp);
      const tMaxExt = Math.max(tMax, proj3Ms);
      const pxProj = PAD.l + ((proj3Ms - tMin) / (tMaxExt - tMin)) * iW;
      const pyProj = yScale(proj3Esp);
      projLine = `<line x1="${pxLast}" y1="${pyLast}" x2="${Math.min(pxProj, W-PAD.r)}" y2="${Math.min(pyProj, iH+PAD.t)}"
        stroke="var(--c-warning)" stroke-width="1.5" stroke-dasharray="5,3" opacity=".7"/>`;
    }

    // t_min line
    let tminLine = '';
    if (tminV && tminV >= eMin && tminV <= eMax) {
      const y = yScale(tminV);
      tminLine = `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}"
        stroke="var(--c-danger)" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="${PAD.l + 2}" y="${y - 3}" font-size="9" fill="var(--c-danger)">t_min</text>`;
    }

    return `
      <div style="margin-bottom:16px">
        <div class="text-xs text-muted mb-1" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px">
          Tendencia de Espesor
        </div>
        <div style="overflow-x:auto">
          <svg width="${W}" height="${H}" style="max-width:100%">
            <!-- Grid -->
            ${[0,0.25,0.5,0.75,1].map(f => {
              const y = PAD.t + f * iH;
              const v = eMax - f * (eMax - eMin);
              return `<line x1="${PAD.l}" y1="${y}" x2="${W-PAD.r}" y2="${y}" stroke="var(--c-border)" stroke-width=".5"/>
                <text x="${PAD.l - 4}" y="${y + 3}" font-size="9" fill="var(--c-text-muted)" text-anchor="end">${v.toFixed(1)}</text>`;
            }).join('')}
            <!-- Axis labels -->
            <text x="${PAD.l}" y="${H - 4}" font-size="9" fill="var(--c-text-muted)">${firstDate}</text>
            <text x="${W - PAD.r}" y="${H - 4}" font-size="9" fill="var(--c-text-muted)" text-anchor="end">${lastDate}</text>
            <text x="10" y="${H/2}" font-size="9" fill="var(--c-text-muted)" transform="rotate(-90 10 ${H/2})">mm</text>
            <!-- tmin line -->
            ${tminLine}
            <!-- Projection -->
            ${projLine}
            <!-- Actual data -->
            <polyline points="${pts}" fill="none" stroke="var(--c-primary)" stroke-width="2"/>
            ${circles}
          </svg>
        </div>
      </div>`;
  }

  /* ── CBM Recommendation Box ─────────────────────────────── */
  function _buildCBMBox(cr, rl, cbm, eq, lm) {
    if (cr === null || !lm) return '';

    const isOk     = isFinite(rl) && rl > 10;
    const isWarn   = isFinite(rl) && rl > 3 && rl <= 10;
    const isCrit   = isFinite(rl) && rl <= 3;
    const isExpired = isFinite(rl) && rl < 0;

    const boxCls = isExpired ? 'alert-danger' : isCrit ? 'alert-danger' : isWarn ? 'alert-warning' : 'alert-success';
    const icon   = isExpired ? '⛔' : isCrit ? '🚨' : isWarn ? '⚠️' : '✅';
    const cbmYrs = cbm ? Utils.round(cbm, 2) : null;
    const nextDate = cbm && lm ? Utils.addYears(lm.fecha, cbm) : null;

    return `
      <div class="alert ${boxCls} mb-2">
        <span class="alert-icon">${icon}</span>
        <div>
          <strong>Recomendación CBM (API 510/570 – Regla de Vida Media)</strong><br>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:8px">
            <div>
              <div class="text-xs text-muted">Tasa de corrosión</div>
              <div class="font-bold">${cr > 0 ? cr.toFixed(4) + ' mm/año' : 'Sin pérdida'}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Vida remanente</div>
              <div class="font-bold">${isFinite(rl) ? rl.toFixed(2) + ' años' : '∞'}</div>
            </div>
            ${cbmYrs ? `<div>
              <div class="text-xs text-muted">Intervalo máx. inspección</div>
              <div class="font-bold">${cbmYrs} años</div>
            </div>` : ''}
            ${nextDate ? `<div>
              <div class="text-xs text-muted">Próxima inspección</div>
              <div class="font-bold">${Utils.fmtDate(nextDate)}</div>
            </div>` : ''}
          </div>
          ${isExpired ? `<div class="mt-1 font-bold">⛔ ESPESOR BAJO MÍNIMO REQUERIDO – Acción inmediata</div>` : ''}
        </div>
      </div>`;
  }

  /* ── CML Form ───────────────────────────────────────────── */
  function openCmlForm(cmlId) {
    const cml   = cmlId ? DB.getById('cmls', cmlId) : null;
    const title = cml ? `✏️ Editar CML – ${cml.nombre}` : '＋ Nuevo CML';

    const equipoOpts = DB.getAll('equipos').sort((a,b) => a.tag.localeCompare(b.tag))
      .map(e => `<option value="${e.id}" ${(cml?.equipo_id === e.id || selectedEquipoId === e.id) ? 'selected' : ''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');

    const v = (f, d='') => Utils.escHtml(cml ? (cml[f]??d) : d);

    const body = `
      <form id="cml-form">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Equipo<span class="required">*</span></label>
            <select class="form-control" id="cf_eq">${equipoOpts}</select>
          </div>
          <div class="form-group">
            <label>Nombre CML<span class="required">*</span></label>
            <input class="form-control" id="cf_nombre" value="${v('nombre')}" placeholder="p.ej. CML-N1">
          </div>
        </div>
        <div class="form-group">
          <label>Descripción / Ubicación</label>
          <input class="form-control" id="cf_desc" value="${v('descripcion')}" placeholder="p.ej. Cabeza superior zona E">
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Referencia de posición</label>
            <input class="form-control" id="cf_ubic" value="${v('ubicacion')}" placeholder="p.ej. 0°/90°, Km 1+2">
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select class="form-control" id="cf_activo">
              <option value="true"  ${cml?.activo !== false ? 'selected' : ''}>Activo</option>
              <option value="false" ${cml?.activo === false ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea class="form-control" id="cf_notas" rows="2">${v('notas')}</textarea>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-md',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="cml-saveBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('cml-saveBtn').addEventListener('click', () => {
        const nombre = document.getElementById('cf_nombre')?.value?.trim();
        const eq_id  = document.getElementById('cf_eq')?.value;
        if (!nombre || !eq_id) {
          Utils.toast('Requerido', 'Complete Equipo y Nombre.', 'error'); return;
        }
        const data = {
          equipo_id:   eq_id,
          nombre,
          descripcion: document.getElementById('cf_desc')?.value?.trim() || '',
          ubicacion:   document.getElementById('cf_ubic')?.value?.trim() || '',
          activo:      document.getElementById('cf_activo')?.value === 'true',
          notas:       document.getElementById('cf_notas')?.value?.trim() || '',
        };
        if (cmlId) { DB.update('cmls', cmlId, data); Utils.toast('Actualizado','CML actualizado.','success'); }
        else       { DB.insert('cmls', data);        Utils.toast('Creado','CML creado.','success'); }
        Utils.closeModal();
        selectedEquipoId = data.equipo_id;
        render();
      });
    }, 50);
  }

  function deleteCml(cmlId) {
    const cml = DB.getById('cmls', cmlId);
    if (!cml) return;
    Utils.confirm(`¿Eliminar CML "${cml.nombre}" y todas sus mediciones?`, () => {
      DB.query('mediciones', m => m.cml_id === cmlId).forEach(m => DB.remove('mediciones', m.id));
      DB.remove('cmls', cmlId);
      if (selectedCmlId === cmlId) selectedCmlId = null;
      Utils.toast('Eliminado', 'CML y mediciones eliminados.', 'warning');
      render();
    });
  }

  /* ── Medicion Form ──────────────────────────────────────── */
  function openMedForm(cmlId, medId) {
    const cml = DB.getById('cmls', cmlId);
    const med = medId ? DB.getById('mediciones', medId) : null;
    const eq  = cml   ? DB.getById('equipos', cml.equipo_id) : null;
    const title = med ? '✏️ Editar Medición' : '＋ Nueva Medición';

    const v = (f, d='') => Utils.escHtml(med ? (med[f]??d) : d);

    const body = `
      <form id="med-form">
        <div class="alert alert-info mb-2">
          <span class="alert-icon">📍</span>
          <div>
            <strong>${Utils.escHtml(cml?.nombre || cmlId)}</strong> – ${Utils.escHtml(cml?.descripcion || '')}
            ${eq ? `<br><span class="text-xs">Equipo: ${eq.tag} · Esp. nominal: ${eq.espesor_nominal_mm ?? '—'} mm · Esp. mínimo: ${eq.espesor_minimo_mm ?? '—'} mm</span>` : ''}
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Fecha de medición<span class="required">*</span></label>
            <input type="date" class="form-control" id="mf_fecha" value="${v('fecha', Utils.today())}" required>
          </div>
          <div class="form-group">
            <label>Espesor medido (mm)<span class="required">*</span></label>
            <input type="number" class="form-control" id="mf_esp" value="${v('espesor_mm')}" min="0.01" step="0.01" required>
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Método de inspección</label>
            <select class="form-control" id="mf_metodo">
              ${['UT-A (Convencional)','UT-B (B-Scan)','UT-C (C-Scan)','UT-TOFD','Radiografía','MFL','Galga','Visual'].map(m =>
                `<option ${med?.metodo?.startsWith(m.split(' ')[0]) ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Técnico inspector</label>
            <input class="form-control" id="mf_tec" value="${v('tecnico')}" placeholder="Nombre del técnico">
          </div>
        </div>
        <div class="form-group">
          <label>Notas / Observaciones</label>
          <textarea class="form-control" id="mf_notas" rows="2">${v('notas')}</textarea>
        </div>
        ${eq ? `
        <div id="mf_preview" style="display:none" class="result-box mt-2">
          <h3>Vista previa</h3>
          <div class="result-grid" id="mf_previewVals"></div>
        </div>` : ''}
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-md',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="med-saveBtn">💾 Guardar Medición</button>`
    });

    // Live preview
    setTimeout(() => {
      const espInput = document.getElementById('mf_esp');
      espInput?.addEventListener('input', () => {
        if (!eq) return;
        const tact = parseFloat(espInput.value);
        if (isNaN(tact)) return;
        const tmin = eq.espesor_minimo_mm;
        const tnom = eq.espesor_nominal_mm;
        const preview = document.getElementById('mf_preview');
        const previewVals = document.getElementById('mf_previewVals');
        if (!preview || !previewVals) return;
        preview.style.display = 'block';
        const margin = tact - (tmin ?? 0);
        const pct = tnom ? Utils.clamp(((tact - (tmin||0)) / (tnom - (tmin||0))) * 100, 0, 100) : null;
        previewVals.innerHTML = `
          <div class="result-item"><label>Espesor ingresado</label><span class="val">${tact}</span><span class="unit">mm</span></div>
          ${tmin ? `<div class="result-item"><label>Margen sobre t_min</label>
            <span class="val" style="color:${margin<0?'#ff7070':margin<2?'#f0c060':'#4de0a4'}">${margin.toFixed(2)}</span>
            <span class="unit">mm</span></div>` : ''}
          ${pct !== null ? `<div class="result-item"><label>% vida pared</label>
            <span class="val">${pct.toFixed(0)}</span><span class="unit">%</span></div>` : ''}`;
      });

      document.getElementById('med-saveBtn').addEventListener('click', () => {
        const fecha = document.getElementById('mf_fecha')?.value;
        const esp   = parseFloat(document.getElementById('mf_esp')?.value);
        if (!fecha || isNaN(esp) || esp <= 0) {
          Utils.toast('Requerido', 'Ingrese fecha y espesor válido.', 'error'); return;
        }
        const data = {
          cml_id:      cmlId,
          equipo_id:   cml?.equipo_id,
          fecha,
          espesor_mm:  esp,
          metodo:      document.getElementById('mf_metodo')?.value || 'UT-A',
          tecnico:     document.getElementById('mf_tec')?.value?.trim() || '',
          notas:       document.getElementById('mf_notas')?.value?.trim() || '',
        };
        if (medId) { DB.update('mediciones', medId, data); Utils.toast('Actualizado','Medición actualizada.','success'); }
        else       { DB.insert('mediciones', data);        Utils.toast('Guardado','Medición registrada.','success'); }
        Utils.closeModal();
        selectedCmlId = cmlId;
        render();
        setTimeout(() => _renderCmlDetail(cmlId), 100);
      });
    }, 50);
  }

  function deleteMedicion(medId, cmlId) {
    Utils.confirm('¿Eliminar esta medición?', () => {
      DB.remove('mediciones', medId);
      Utils.toast('Eliminado','Medición eliminada.','warning');
      _renderCmlDetail(cmlId);
      _renderCmlList();
    });
  }

  /* ── Bind top-level events ──────────────────────────────── */
  function _bindEvents(el) {
    el.querySelector('#cml-eqSel').addEventListener('change', e => {
      selectedEquipoId = e.target.value || null;
      selectedCmlId    = null;
      _applyEquipoSel();
    });

    el.querySelector('#cml-newCmlBtn').addEventListener('click', () => openCmlForm(null));

    const deb = Utils.debounce(() => _renderCmlList());
    el.querySelector('#cml-search').addEventListener('input', e => {
      searchTerm = e.target.value; deb();
    });

    el.querySelector('#cml-exportBtn').addEventListener('click', () => {
      const all = DB.getAll('cmls');
      const headers = ['CML_ID','Equipo_TAG','Nombre','Descripción','Ubicación','Activo',
        'Último_Esp_mm','Fecha_Ultima','Tasa_CR_mmpa','Vida_Rem_a'];
      const rows = all.map(c => {
        const eq = DB.getById('equipos', c.equipo_id);
        const lm = DB.lastMedicion(c.id);
        const cr = DB.calcCorrosionRate(c.id);
        const rl = eq ? DB.remainingLife(c.id, eq.espesor_minimo_mm) : Infinity;
        return [c.id, eq?.tag||'', c.nombre, c.descripcion, c.ubicacion, c.activo,
          lm?.espesor_mm||'', lm?.fecha||'',
          cr !== null ? cr.toFixed(4) : '', isFinite(rl) ? rl.toFixed(2) : ''];
      });
      Utils.exportCSV(headers, rows, `cml_tml_${Utils.today()}.csv`);
    });
  }

  return { render };
})();
