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

    // Visual corrosion representation
    const corrosionVisual = _buildDetailedCorrosionInspector(cml, eq, lm, cr);

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

          <!-- Visual representation of corrosion -->
          ${corrosionVisual}

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
    _bindDetailedCorrosionInspector(detArea, cml, eq, lm, cr);
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

  /* ── Quick action: New Measurement using first CML ─────── */
  function openNewMeasurement() {
    const cml = DB.getAll('cmls').find(c => c.activo !== false);
    if (!cml) {
      Utils.toast('Sin CML', 'Primero registre un CML para asociar la medición.', 'warning');
      openCmlForm(null);
      return;
    }
    openMedForm(cml.id, null);
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

  return { render, openNewMeasurement };
})();

/* ── Corrosion pipe visualization (front + side) ────────── */
function _buildCorrosionVisual(cml, eq, lm, cr) {
  const nominal = Number(eq?.espesor_nominal_mm);
  const minimum = Number(eq?.espesor_minimo_mm);
  const actual = lm ? Number(lm.espesor_mm) : null;

  let lossPct = 0;
  if (actual && nominal > 0) {
    lossPct = Utils.clamp(((nominal - actual) / nominal) * 100, 0, 100);
  }

  const belowMinimum = minimum > 0 && actual !== null && actual < minimum;
  const redOpacity = actual === null ? 0 : 0.18 + Utils.clamp(lossPct / 100, 0, 1) * 0.82;
  const patchWidth = actual === null ? 0 : 18 + Utils.clamp(lossPct / 100, 0, 1) * 78;
  const remainingText = actual !== null ? `${actual.toFixed(2)} mm` : 'Sin medición';
  const lossText = actual !== null ? `${lossPct.toFixed(1)}% pérdida` : 'Sin datos';
  const corrosionText = cr !== null && cr !== undefined
    ? `${Utils.round(cr, 4)} mm/año`
    : 'No calculada';

  return `
    <div class="card mb-2" style="background:var(--c-surface-2);border:1px solid var(--c-border)">
      <div class="card-header" style="padding:10px 14px">
        <h3 style="font-size:.9rem">🔴 Representación de Corrosión – ${Utils.escHtml(cml.nombre)}</h3>
        <span class="badge ${belowMinimum ? 'badge-danger' : 'badge-muted'}">
          ${belowMinimum ? 'Debajo de t_mín' : 'Espesor observado'}
        </span>
      </div>
      <div class="card-body" style="padding:14px">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px">
          <!-- Front view: pipe cross-section -->
          <div style="text-align:center">
            <div class="text-xs font-bold mb-1">Vista frontal – Sección transversal</div>
            <svg viewBox="0 0 220 190" width="220" height="190" style="max-width:100%"
              role="img" aria-label="Vista frontal de tubería mostrando corrosión">
              <defs>
                <radialGradient id="pipeMetal-${cml.id}" cx="35%" cy="28%">
                  <stop offset="0" stop-color="#dbe6ef"/>
                  <stop offset="1" stop-color="#708090"/>
                </radialGradient>
              </defs>
              <circle cx="110" cy="95" r="74" fill="url(#pipeMetal-${cml.id})" stroke="#526270" stroke-width="3"/>
              <circle cx="110" cy="95" r="46" fill="#f7fafc" stroke="#526270" stroke-width="3"/>
              <!-- Four points in a cross formation: P1 top, P2 right, P3 bottom, P4 left -->
              <g fill="#dc2626" stroke="#fff" stroke-width="2">
                <circle cx="110" cy="21" r="7"/><circle cx="184" cy="95" r="7"/>
                <circle cx="110" cy="169" r="7"/><circle cx="36" cy="95" r="7"/>
              </g>
              <g fill="#334155" font-size="9" font-weight="700">
                <text x="110" y="10" text-anchor="middle">P1</text>
                <text x="194" y="98">P2</text>
                <text x="110" y="187" text-anchor="middle">P3</text>
                <text x="16" y="98">P4</text>
              </g>
              <path d="M110 169 A74 74 0 0 1 38 67"
                fill="none" stroke="#e11d48" stroke-width="${12 + lossPct * 0.18}"
                stroke-linecap="round" opacity="${redOpacity}"/>
              <path d="M110 169 A74 74 0 0 1 38 67"
                fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="5 6" opacity=".9"/>
              <text x="110" y="91" text-anchor="middle" fill="#334155" font-size="12" font-weight="700">t = ${remainingText}</text>
              <text x="110" y="108" text-anchor="middle" fill="#e11d48" font-size="11" font-weight="700">${lossText}</text>
              <text x="110" y="184" text-anchor="middle" fill="#64748b" font-size="10">Zona frontal de pérdida de metal</text>
            </svg>
          </div>

          <!-- Side view: longitudinal section -->
          <div style="text-align:center">
            <div class="text-xs font-bold mb-1">Vista lateral – Adelgazamiento externo</div>
            <svg viewBox="0 0 300 190" width="300" height="190" style="max-width:100%"
              role="img" aria-label="Vista lateral de tubería mostrando corrosión">
              <defs>
                <linearGradient id="pipeSide-${cml.id}" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#eef4f8"/>
                  <stop offset=".45" stop-color="#9cabb7"/>
                  <stop offset="1" stop-color="#667786"/>
                </linearGradient>
              </defs>
              <rect x="28" y="47" width="244" height="96" rx="2" fill="url(#pipeSide-${cml.id})" stroke="#526270" stroke-width="3"/>
              <rect x="28" y="47" width="244" height="16" rx="2" fill="#eff6fa" opacity=".8"/>
              <line x1="28" y1="143" x2="272" y2="143" stroke="#526270" stroke-width="3"/>

              ${actual === null ? '' : `
                <g opacity="${redOpacity}">
                  <rect x="78" y="136" width="${Math.max(patchWidth, 95)}" height="15" rx="7" fill="#991b1b"/>
                  <rect x="${86 + lossPct * 0.2}" y="142" width="${Math.max(patchWidth * 0.92, 82)}" height="${10 + lossPct * 0.28}" rx="5" fill="#dc2626"/>
                  <path d="M84 136 C105 128 128 145 150 136 C174 127 198 145 222 136" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
                  <circle cx="104" cy="142" r="5" fill="#7f1d1d"/><circle cx="138" cy="139" r="7" fill="#7f1d1d"/>
                  <circle cx="178" cy="142" r="4" fill="#7f1d1d"/><circle cx="208" cy="138" r="6" fill="#7f1d1d"/>
                </g>
                <line x1="78" y1="136" x2="78" y2="174" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
                <line x1="222" y1="136" x2="222" y2="174" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
                <line x1="78" y1="169" x2="222" y2="169" stroke="#dc2626" stroke-width="2"/>
                <text x="150" y="184" text-anchor="middle" fill="#dc2626" font-size="11" font-weight="700">Zona extensa de corrosión</text>
              `}

              <text x="150" y="30" text-anchor="middle" fill="#334155" font-size="12" font-weight="700">
                ${Utils.escHtml(cml.nombre)} – ${Utils.escHtml(cml.ubicacion || 'Ubicación no definida')}
              </text>
            </svg>
          </div>
        </div>

        <div style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-top:8px" class="text-xs">
          <span><strong>Tasa:</strong> ${corrosionText}</span>
          <span><strong>Actual:</strong> ${remainingText}</span>
          <span><strong>Nominal:</strong> ${nominal > 0 ? nominal.toFixed(2) + ' mm' : '—'}</span>
          <span><strong>Admisible mínimo:</strong> ${minimum > 0 ? minimum.toFixed(2) + ' mm' : '—'}</span>
        </div>
        <div class="text-xs text-muted mt-2" style="text-align:center">
          🔴 El área roja representa la zona y magnitud relativa de la pérdida de metal. La escala es visual y no sustituye una inspección dimensional.
        </div>
      </div>
    </div>`;
}

/* ── Detailed corrosion representation ───────────────────── */
function _buildDetailedCorrosionInspector(cml, eq, lm, cr) {
  return `<div id="corrosion-interactive" class="card mb-2"></div>`;
}

function _bindDetailedCorrosionInspector(detArea, cml, eq, lm, cr) {
  const host = detArea?.querySelector('#corrosion-interactive');
  if (!host) return;

  const mock = cml.nombre === 'CML-N1';
  const nominal = mock ? 14 : (Number(eq?.espesor_nominal_mm) || 14);
  const minimum = mock ? 7.20 : (Number(eq?.espesor_minimo_mm) || 7.20);
  const rate = mock ? 0.3338 : (Number(cr) > 0 ? Number(cr) : 0.3338);
  const base = mock ? {P1:13.85,P2:13.60,P3:12.40,P4:12.75} : {
    P1:Number(lm?.espesor_mm||nominal), P2:Number(lm?.espesor_mm||nominal)-0.10,
    P3:Number(lm?.espesor_mm||nominal)-0.35, P4:Number(lm?.espesor_mm||nominal)-0.20
  };
  const state = { years:0, wall:'internal', scale:1, selected:'P3' };

  const projected = () => Object.fromEntries(Object.entries(base).map(([p,v]) => [p, Math.max(0,v-rate*state.years)]));
  const loss = t => Utils.clamp((nominal-t)/nominal*100,0,100);
  const margin = t => t-minimum;
  const remaining = t => rate>0 ? (t-minimum)/rate : Infinity;

  function render() {
    const vals=projected();
    const lowest=Math.min(...Object.values(vals));
    const status=lowest<minimum
      ? {label:'Crítico',color:'#d93025',bg:'#d9302518'}
      : lowest<minimum+1.5
        ? {label:'Advertencia',color:'#e8a020',bg:'#e8a02018'}
        : {label:'Óptimo',color:'#22a06b',bg:'#22a06b15'};
    const selected=state.selected;
    const selectedLoss=loss(vals[selected]);
    const magnitude=state.scale===3 ? selectedLoss*3 : selectedLoss;
    const bite=Utils.clamp(magnitude/100*28,0,28);
    const degrees={P1:'0°',P2:'90°',P3:'180°',P4:'270°'};

    const pointTable=Object.entries(vals).map(([p,t])=>{
      const lp=loss(t), rl=remaining(t), crStatus=t<minimum?'Crítico':lp>11?'Alerta':'En rango';
      const limitYear=Number.isFinite(rl)?new Date().getFullYear()+state.years+Math.max(0,Math.ceil(rl)):null;
      const pointColor=t<minimum?'#d93025':lp>11?'#e8a020':'#22a06b';
      return `<tr data-select-point="${p}" style="cursor:pointer">
        <td><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:${pointColor}"></span><strong>${p}</strong></span></td>
        <td>${degrees[p]}</td>
        <td class="font-mono">${t.toFixed(2)} mm</td>
        <td class="font-mono">${lp.toFixed(1)}%</td>
        <td class="font-mono ${margin(t)<0?'text-danger':''}">${margin(t)>=0?'+':''}${margin(t).toFixed(2)} mm</td>
        <td>${crStatus}</td>
        <td>${limitYear?limitYear:'Sin límite'}</td>
      </tr>`;
    }).join('');

    host.innerHTML=`
      <div class="card-header" style="align-items:flex-start">
        <div><h3 style="margin:0">🔎 Análisis dimensional – ${Utils.escHtml(cml.nombre)}</h3>
          <div class="text-xs text-muted mt-1">Corte transversal + perfil longitudinal · proyección a ${state.years} años</div></div>
        <span style="padding:6px 12px;border-radius:999px;background:${status.bg};color:${status.color};font-weight:800;border:1px solid ${status.color}">${status.label}</span>
      </div>
      <div class="card-body" style="padding:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
          <div style="display:flex;border:1px solid var(--c-border);border-radius:8px;padding:3px;background:var(--c-surface-2)">
            <button id="d-wall-internal" class="btn btn-sm ${state.wall==='internal'?'btn-primary':'btn-ghost'}">Pared interior</button>
            <button id="d-wall-external" class="btn btn-sm ${state.wall==='external'?'btn-primary':'btn-ghost'}">Pared exterior</button>
          </div>
          <button id="d-scale-toggle" class="btn btn-sm ${state.scale===3?'btn-primary':'btn-secondary'}">Escala ${state.scale===1?'1× real':'3× ampliada'}</button>
          <div style="flex:1;min-width:240px">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;font-weight:700"><span>Proyección</span><span style="font-family:var(--font-mono)">+${state.years} años</span></div>
            <input id="d-projection" type="range" min="0" max="15" step="1" value="${state.years}" style="width:100%">
            <div style="display:flex;justify-content:space-between;font-size:.66rem;color:var(--c-text-muted)"><span>Hoy</span><span>+5</span><span>+10</span><span>+15 años</span></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(270px,.78fr) minmax(360px,1.22fr);gap:18px">
          <div style="text-align:center">
            <div class="text-xs font-bold mb-1">Sección transversal – cuatro ángulos</div>
            <svg viewBox="0 0 240 240" width="240" height="240" style="max-width:100%;overflow:visible">
              <defs><pattern id="d-mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#82909b" stroke-width=".5" opacity=".25"/></pattern></defs>
              <circle cx="120" cy="120" r="88" fill="#bcc7cf" stroke="#526270" stroke-width="4"/>
              <circle cx="120" cy="120" r="88" fill="url(#d-mesh)"/>
              <circle cx="120" cy="120" r="56" fill="#f8fafc" stroke="#526270" stroke-width="4"/>
              <circle cx="120" cy="120" r="${56+(nominal-minimum)/nominal*32}" fill="none" stroke="#d93025" stroke-width="2" stroke-dasharray="5 5"/>
              ${state.wall==='internal'
                ? `<path d="M120 176 A56 56 0 0 1 64 120 L76 120 A44 44 0 0 0 120 164 Z" fill="#dc2626" opacity="${0.38+bite/100}"/>`
                : `<path d="M120 32 A88 88 0 0 1 198 120 L${198-bite} 120 A${88-bite} ${88-bite} 0 0 0 120 ${32+bite} Z" fill="#dc2626" opacity="${0.38+bite/100}"/>`}
              ${[{p:'P1',x:120,y:32,a:'0°'},{p:'P2',x:208,y:120,a:'90°'},{p:'P3',x:120,y:208,a:'180°'},{p:'P4',x:32,y:120,a:'270°'}].map(o=>`
                <line x1="120" y1="120" x2="${o.x}" y2="${o.y}" stroke="#64748b" stroke-width="1" stroke-dasharray="3 4" opacity=".45"/>
                <circle data-d-point="${o.p}" cx="${o.x}" cy="${o.y}" r="11" fill="${vals[o.p]<minimum?'#d93025':loss(vals[o.p])>11?'#e8a020':'#22a06b'}" stroke="${selected===o.p?'#17202a':'#fff'}" stroke-width="${selected===o.p?'4':'3'}" style="cursor:pointer"/>
                <text x="${o.x}" y="${o.y+3.5}" text-anchor="middle" fill="#fff" font-size="9" font-weight="800" pointer-events="none">${o.p}</text>
              `).join('')}
              <text x="120" y="116" text-anchor="middle" fill="#334155" font-size="11" font-weight="800">${selected}</text>
              <text x="120" y="132" text-anchor="middle" fill="#334155" font-size="12" font-family="var(--font-mono)">${vals[selected].toFixed(2)} mm</text>
              <text x="120" y="226" text-anchor="middle" fill="#64748b" font-size="9">Anillo punteado: límite mínimo ${minimum.toFixed(2)} mm</text>
            </svg>
            <div id="d-tooltip" style="display:none;position:fixed;z-index:1000;background:#17202a;color:#fff;border-radius:8px;padding:9px 11px;font-size:.75rem;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none"></div>
          </div>

          <div>
            <div class="text-xs font-bold mb-1 text-center">Perfil longitudinal – eje de ${selected} (${degrees[selected]})</div>
            <svg viewBox="0 0 420 240" width="420" height="240" style="max-width:100%">
              <defs><linearGradient id="d-pipe-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f8"/><stop offset=".5" stop-color="#adb9c2"/><stop offset="1" stop-color="#7d8b96"/></linearGradient></defs>
              <rect x="28" y="62" width="364" height="116" rx="4" fill="url(#d-pipe-wall)" stroke="#526270" stroke-width="3"/>
              <rect x="28" y="62" width="364" height="18" fill="#eff6fa" opacity=".9"/>
              <line x1="28" y1="178" x2="392" y2="178" stroke="#526270" stroke-width="2"/>
              ${state.wall==='internal'
                ? `<path d="M28 178 C80 ${178+bite*.5} 115 ${178+bite*.9} 155 ${178+bite*.7} C205 ${178+bite*1.1} 280 ${178+bite*.6} 392 178 L392 178 L28 178 Z" fill="#dc2626" opacity=".72"/>`
                : `<rect x="${210-bite*3}" y="62" width="${bite*6+38}" height="${18+bite*.45}" rx="5" fill="#dc2626" opacity=".78"/>`}
              <line x1="210" y1="48" x2="210" y2="198" stroke="#334155" stroke-width="1.5" stroke-dasharray="5 4"/>
              <text x="210" y="218" text-anchor="middle" fill="#334155" font-size="11" font-weight="800">${selected} · ${vals[selected].toFixed(2)} mm · pérdida ${loss(vals[selected]).toFixed(1)}%</text>
              <text x="28" y="42" fill="#64748b" font-size="9">Pared externa</text>
              <text x="28" y="198" fill="#64748b" font-size="9">Pared interna / flujo</text>
            </svg>

            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px">
              ${Object.entries(vals).map(([p,t])=>`<button data-d-card="${p}" class="btn ${selected===p?'btn-primary':'btn-secondary'} btn-sm" style="height:auto;padding:8px;flex-direction:column">
                <strong>${p} · ${degrees[p]}</strong><span class="font-mono">${t.toFixed(2)} mm</span>
              </button>`).join('')}
            </div>
          </div>
        </div>

        <div class="table-wrapper mt-2">
          <table class="data-table">
            <thead><tr><th>Punto</th><th>Ángulo</th><th>Espesor</th><th>Pérdida</th><th>Margen t_mín</th><th>Estado</th><th>Año límite*</th></tr></thead>
            <tbody>${pointTable}</tbody>
          </table>
        </div>

        <div style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
            <strong>Punto crítico: ${Object.entries(vals).sort((a,b)=>a[1]-b[1])[0][0]} · ${lowest.toFixed(2)} mm</strong>
            <span>Nominal ${nominal.toFixed(2)} mm</span>
          </div>
          <div style="height:16px;border-radius:8px;background:#e6edf3;position:relative;overflow:hidden">
            <div style="position:absolute;left:${Utils.clamp(minimum/nominal*100,0,100)}%;top:0;bottom:0;width:2px;background:#d93025;z-index:3"></div>
            <div style="width:${Utils.clamp(lowest/nominal*100,0,100)}%;height:100%;background:${status.color};transition:width .25s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--c-text-muted);margin-top:4px"><span>0 mm</span><span style="color:#d93025">Mínimo ${minimum.toFixed(2)} mm</span><span>Nominal ${nominal.toFixed(2)} mm</span></div>
          <div class="text-xs text-muted mt-2">* Año límite estimado linealmente con CR ${rate.toFixed(4)} mm/a. No reemplaza una evaluación ASME/API.</div>
        </div>
      </div>`;

    host.querySelector('#d-wall-internal')?.addEventListener('click',()=>{state.wall='internal';render();});
    host.querySelector('#d-wall-external')?.addEventListener('click',()=>{state.wall='external';render();});
    host.querySelector('#d-scale-toggle')?.addEventListener('click',()=>{state.scale=state.scale===1?3:1;render();});
    host.querySelector('#d-projection')?.addEventListener('input',e=>{state.years=Number(e.target.value);render();});
    host.querySelectorAll('[data-d-card],[data-d-point],[data-select-point]').forEach(el=>{
      el.addEventListener('click',()=>{state.selected=el.dataset.dCard||el.dataset.dPoint||el.dataset.selectPoint;render();});
    });

    const tooltip=host.querySelector('#d-tooltip');
    host.querySelectorAll('[data-d-point]').forEach(marker=>{
      const show=(ev)=>{
        const p=marker.dataset.dPoint, t=vals[p], lp=loss(t), rl=remaining(t);
        tooltip.innerHTML=`<strong>${p} · ${degrees[p]}</strong><br><span style="font-family:var(--font-mono)">${t.toFixed(2)} mm</span> · ${lp.toFixed(1)}% pérdida<br>Margen: ${margin(t)>=0?'+':''}${margin(t).toFixed(2)} mm<br>Vida: ${isFinite(rl)?rl.toFixed(1)+' años':'∞'}`;
        tooltip.style.display='block';
        const rect=ev.currentTarget.getBoundingClientRect();
        tooltip.style.left=`${Math.min(rect.right+8,window.innerWidth-230)}px`;
        tooltip.style.top=`${Math.max(rect.top-18,8)}px`;
      };
      marker.addEventListener('mouseenter',show); marker.addEventListener('mousemove',show); marker.addEventListener('mouseleave',()=>tooltip.style.display='none');
    });
  }
  render();
}
