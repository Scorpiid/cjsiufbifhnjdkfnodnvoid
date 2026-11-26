/**
 * SGIEE – Módulo: Registro de Equipos Estáticos
 * Full CRUD with filtering, sorting, detail view, and design data
 */
const ModEquipos = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let searchTerm  = '';
  let filterTipo  = '';
  let filterEstado = '';
  let sortKey     = 'tag';
  let sortDir     = 'asc';
  let page        = 1;
  const PAGE_SIZE = 10;

  /* ── Main render ────────────────────────────────────────── */
  function render() {
    const el = document.getElementById('mod-equipos');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Registro de Equipos</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="eq-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="eq-newBtn">＋ Nuevo Equipo</button>
        </div>
      </div>

      <!-- KPI strip -->
      <div id="eq-kpis" class="mini-stat-row mb-2"></div>

      <!-- Filters -->
      <div class="filter-bar" id="eq-filterBar">
        <div class="search-input flex-1">
          <input type="text" id="eq-search" placeholder="Buscar por TAG, nombre, planta…" autocomplete="off">
        </div>
        <select class="form-control" id="eq-filterTipo" style="width:180px">
          <option value="">Todos los tipos</option>
          <option>Vasija a Presión</option>
          <option>Tubería a Presión</option>
          <option>Intercambiador</option>
          <option>Tanque Atmosférico</option>
          <option>Caldera / Horno</option>
          <option>Dispositivo de Alivio</option>
        </select>
        <select class="form-control" id="eq-filterEstado" style="width:150px">
          <option value="">Todos los estados</option>
          <option>Activo</option>
          <option>Inactivo</option>
          <option>Parado</option>
          <option>Retirado</option>
        </select>
      </div>

      <!-- Table -->
      <div id="eq-tableArea"></div>

      <!-- Pagination -->
      <div id="eq-pagination"></div>`;

    _bindListEvents(el);
    _renderKPIs();
    _renderTable();
  }

  /* ── KPI strip ──────────────────────────────────────────── */
  function _renderKPIs() {
    const all   = DB.getAll('equipos');
    const activos = all.filter(e => e.estado === 'Activo').length;
    const tipos = [...new Set(all.map(e => e.tipo))].length;
    const plantas = [...new Set(all.map(e => e.planta))].length;
    const criticos = all.filter(e => e.criticidad === 'Alta').length;

    document.getElementById('eq-kpis').innerHTML = `
      <div class="mini-stat">
        <div class="ms-label">Total Equipos</div>
        <div class="ms-val" style="color:var(--c-primary)">${all.length}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Activos</div>
        <div class="ms-val" style="color:var(--c-success)">${activos}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Críticos (Alta)</div>
        <div class="ms-val" style="color:var(--c-danger)">${criticos}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Tipos</div>
        <div class="ms-val">${tipos}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Plantas</div>
        <div class="ms-val">${plantas}</div>
      </div>`;
  }

  /* ── Table ──────────────────────────────────────────────── */
  function _renderTable() {
    const all = DB.getAll('equipos');

    // Filter
    let rows = all.filter(e => {
      const hayTerm = searchTerm
        ? [e.tag, e.nombre, e.planta, e.sistema, e.fluido, e.material]
            .some(v => (v || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const hayTipo   = filterTipo   ? e.tipo   === filterTipo   : true;
      const hayEstado = filterEstado ? e.estado === filterEstado : true;
      return hayTerm && hayTipo && hayEstado;
    });

    // Sort
    rows.sort((a, b) => {
      const va = (a[sortKey] ?? '').toString().toLowerCase();
      const vb = (b[sortKey] ?? '').toString().toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const total = rows.length;
    const start = (page - 1) * PAGE_SIZE;
    const paged = rows.slice(start, start + PAGE_SIZE);

    const trs = paged.map(eq => {
      const cmls = DB.query('cmls', c => c.equipo_id === eq.id);
      const ultimaInsp = DB.query('inspecciones', i => i.equipo_id === eq.id)
        .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))[0];
      const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === eq.id)
        .sort((a,b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];

      return `<tr>
        <td><strong class="font-mono">${Utils.escHtml(eq.tag)}</strong></td>
        <td>${Utils.escHtml(eq.nombre)}</td>
        <td><span class="badge badge-muted">${Utils.escHtml(eq.tipo)}</span></td>
        <td>${Utils.escHtml(eq.planta)}</td>
        <td>${Utils.escHtml(eq.material)}</td>
        <td>${eq.presion_diseno_kPa ? (eq.presion_diseno_kPa/1000).toFixed(2) + ' MPa' : '—'}</td>
        <td>${eq.temp_diseno_C ? eq.temp_diseno_C + ' °C' : '—'}</td>
        <td>${Utils.criticidadBadge(eq.criticidad)}</td>
        <td>${Utils.estadoBadge(eq.estado)}</td>
        <td>${rbi ? Utils.riskBadge(rbi.riesgo_color) : '<span class="badge badge-muted">Sin RBI</span>'}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-action="detail" data-id="${eq.id}" title="Ver detalle">🔍</button>
          <button class="btn btn-ghost btn-sm" data-action="edit"   data-id="${eq.id}" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" data-action="cmls"   data-id="${eq.id}" title="Ver CMLs"
            style="color:var(--c-primary)">${cmls.length} CML</button>
          <button class="btn btn-ghost btn-sm" data-action="del"    data-id="${eq.id}" title="Eliminar"
            style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    const headers = [
      { label:'TAG',         sortKey:'tag' },
      { label:'Nombre',      sortKey:'nombre' },
      { label:'Tipo' },
      { label:'Planta',      sortKey:'planta' },
      { label:'Material' },
      { label:'P Diseño' },
      { label:'T Diseño' },
      { label:'Criticidad',  sortKey:'criticidad' },
      { label:'Estado',      sortKey:'estado' },
      { label:'Riesgo RBI' },
      { label:'Acciones',    cls:'col-actions' },
    ].map(h => {
      let cls = h.cls || '';
      if (h.sortKey && h.sortKey === sortKey) cls += ' ' + (sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      return `<th${h.sortKey ? ` data-sort="${h.sortKey}"` : ''}${cls ? ` class="${cls.trim()}"` : ''}>${h.label}</th>`;
    }).join('');

    const html = rows.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🗄</div><h3>Sin equipos</h3>
          <p>No se encontraron equipos con los filtros actuales.</p></div>`
      : `<div class="table-wrapper">
          <table class="data-table" id="eq-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>`;

    document.getElementById('eq-tableArea').innerHTML = html;
    _renderPagination(total);
    _bindTableEvents();
  }

  function _renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { document.getElementById('eq-pagination').innerHTML = ''; return; }

    let btns = `<span class="pagination-info">Mostrando ${Math.min((page-1)*PAGE_SIZE+1,total)}–${Math.min(page*PAGE_SIZE,total)} de ${total}</span>`;
    btns += `<button class="page-btn" data-p="${page-1}" ${page===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
        btns += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
      } else if (Math.abs(i - page) === 2) {
        btns += `<span class="page-btn" style="pointer-events:none">…</span>`;
      }
    }
    btns += `<button class="page-btn" data-p="${page+1}" ${page===pages?'disabled':''}>›</button>`;
    document.getElementById('eq-pagination').innerHTML = `<div class="pagination">${btns}</div>`;

    document.querySelectorAll('#eq-pagination .page-btn[data-p]').forEach(b => {
      b.addEventListener('click', () => { page = parseInt(b.dataset.p); _renderTable(); });
    });
  }

  /* ── Bind events ────────────────────────────────────────── */
  function _bindListEvents(el) {
    el.querySelector('#eq-newBtn').addEventListener('click', () => openForm(null));
    el.querySelector('#eq-exportBtn').addEventListener('click', exportCSV);

    const debouncedSearch = Utils.debounce(() => { page = 1; _renderTable(); });
    el.querySelector('#eq-search').addEventListener('input', e => {
      searchTerm = e.target.value; debouncedSearch();
    });
    el.querySelector('#eq-filterTipo').addEventListener('change', e => {
      filterTipo = e.target.value; page = 1; _renderTable();
    });
    el.querySelector('#eq-filterEstado').addEventListener('change', e => {
      filterEstado = e.target.value; page = 1; _renderTable();
    });
  }

  function _bindTableEvents() {
    // Sort
    document.querySelectorAll('#eq-table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        _renderTable();
      });
    });

    // Row actions
    document.querySelectorAll('#eq-tableArea [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        if (action === 'detail') openDetail(id);
        if (action === 'edit')   openForm(id);
        if (action === 'del')    deleteEquipo(id);
        if (action === 'cmls')   openCMLsForEquipo(id);
      });
    });
  }

  /* ── Detail modal ───────────────────────────────────────── */
  function openDetail(id) {
    const eq = DB.getById('equipos', id);
    if (!eq) return;

    const cmls = DB.query('cmls', c => c.equipo_id === id);
    const insps = DB.query('inspecciones', i => i.equipo_id === id)
      .sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === id)
      .sort((a,b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];

    // Corrosion summary per CML
    const cmlRows = cmls.map(c => {
      const cr  = DB.calcCorrosionRate(c.id);
      const rl  = DB.remainingLife(c.id, eq.espesor_minimo_mm);
      const lm  = DB.lastMedicion(c.id);
      return `<tr>
        <td><strong>${Utils.escHtml(c.nombre)}</strong></td>
        <td>${Utils.escHtml(c.descripcion)}</td>
        <td>${lm ? `${lm.espesor_mm} mm` : '—'}</td>
        <td>${Utils.crBadge(cr)}</td>
        <td class="${Utils.rlClass(rl)}">${isFinite(rl) ? rl.toFixed(1) + ' a' : '∞'}</td>
      </tr>`;
    }).join('');

    const insp_rows = insps.slice(0,3).map(i => `
      <div class="timeline-item">
        <div class="timeline-date">${Utils.fmtDate(i.fecha)} · ${Utils.escHtml(i.tipo)}</div>
        <div class="timeline-title">${Utils.resultadoBadge(i.resultado)} ${Utils.estadoInsBadge(i.estado)}</div>
        <div class="timeline-body">${Utils.escHtml(i.hallazgos || '—')}</div>
      </div>`).join('');

    const body = `
      <div class="tab-nav" id="detTabNav">
        <button class="tab-btn active" data-dtab="info">Datos Generales</button>
        <button class="tab-btn" data-dtab="dis">Diseño</button>
        <button class="tab-btn" data-dtab="cmls">CMLs (${cmls.length})</button>
        <button class="tab-btn" data-dtab="hist">Historial</button>
        ${rbi ? '<button class="tab-btn" data-dtab="rbi">RBI</button>' : ''}
      </div>

      <!-- Info -->
      <div class="tab-panel active" id="dtp-info">
        <div class="form-row cols-2">
          ${_detRow('TAG',          eq.tag)}
          ${_detRow('Nombre',       eq.nombre)}
          ${_detRow('Tipo',         eq.tipo)}
          ${_detRow('Planta',       eq.planta)}
          ${_detRow('Sistema',      eq.sistema)}
          ${_detRow('Fluido',       eq.fluido)}
          ${_detRow('Estado',       Utils.estadoBadge(eq.estado), true)}
          ${_detRow('Criticidad',   Utils.criticidadBadge(eq.criticidad), true)}
          ${_detRow('Fab.',         Utils.fmtDate(eq.fecha_fabricacion))}
          ${_detRow('Instalación',  Utils.fmtDate(eq.fecha_instalacion))}
        </div>
        ${eq.notas ? `<div class="alert alert-info mt-2"><span class="alert-icon">📝</span><div>${Utils.escHtml(eq.notas)}</div></div>` : ''}
      </div>

      <!-- Diseño -->
      <div class="tab-panel" id="dtp-dis">
        <div class="form-row cols-3">
          ${_detRow('Norma diseño',   eq.norma_diseno)}
          ${_detRow('Material',       eq.material)}
          ${_detRow('P diseño',       eq.presion_diseno_kPa ? (eq.presion_diseno_kPa/1000).toFixed(3) + ' MPa' : '—')}
          ${_detRow('T diseño',       eq.temp_diseno_C ? eq.temp_diseno_C + ' °C' : '—')}
          ${_detRow('Diámetro',       eq.diametro_mm ? eq.diametro_mm + ' mm' : '—')}
          ${_detRow('Longitud',       eq.longitud_mm ? eq.longitud_mm + ' mm' : '—')}
          ${_detRow('Esp. nominal',   eq.espesor_nominal_mm ? eq.espesor_nominal_mm + ' mm' : '—')}
          ${_detRow('Esp. mínimo',    eq.espesor_minimo_mm  ? eq.espesor_minimo_mm  + ' mm' : '—')}
          ${_detRow('Corrosión adm.', eq.ca_mm ? eq.ca_mm + ' mm' : '—')}
        </div>
        <!-- Life bar -->
        ${_renderLifeBar(eq)}
      </div>

      <!-- CMLs -->
      <div class="tab-panel" id="dtp-cmls">
        ${cmls.length === 0
          ? '<p class="text-muted text-sm">Sin CMLs registrados para este equipo.</p>'
          : `<div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>CML</th><th>Descripción</th><th>Último esp.</th><th>Tasa corr.</th><th>Vida rem.</th></tr></thead>
                <tbody>${cmlRows}</tbody>
              </table>
            </div>`}
        <div class="mt-2">
          <button class="btn btn-primary btn-sm" data-action="gomod" data-module="cml" data-eq="${id}">
            ＋ Gestionar CMLs
          </button>
        </div>
      </div>

      <!-- Historial -->
      <div class="tab-panel" id="dtp-hist">
        ${insps.length === 0
          ? '<p class="text-muted text-sm">Sin inspecciones registradas.</p>'
          : `<div class="timeline">${insp_rows}</div>
             ${insps.length > 3 ? `<p class="text-sm text-muted mt-1">+${insps.length-3} inspecciones más. Ver módulo Historial.</p>` : ''}`}
      </div>

      ${rbi ? `
      <!-- RBI -->
      <div class="tab-panel" id="dtp-rbi">
        <div class="mini-stat-row">
          <div class="mini-stat"><div class="ms-label">Mecanismo</div>
            <div class="ms-val text-sm" style="font-size:1rem">${Utils.escHtml(rbi.mecanismo)}</div></div>
          <div class="mini-stat"><div class="ms-label">POF</div>
            <div class="ms-val">${Utils.escHtml(rbi.pof_valor)}</div></div>
          <div class="mini-stat"><div class="ms-label">COF</div>
            <div class="ms-val">${Utils.escHtml(rbi.cof_valor)}</div></div>
          <div class="mini-stat"><div class="ms-label">Riesgo</div>
            <div class="ms-val">${Utils.riskBadge(rbi.riesgo_color)}</div></div>
          <div class="mini-stat"><div class="ms-label">Próx. Insp.</div>
            <div class="ms-val">${Utils.vencimientoBadge(rbi.proxima_inspeccion)}</div></div>
        </div>
      </div>` : ''}`;

    Utils.openModal(
      `🔍 ${Utils.escHtml(eq.tag)} – ${Utils.escHtml(eq.nombre)}`,
      body,
      { size: 'modal-xl' }
    );

    // Bind detail tabs
    setTimeout(() => {
      document.querySelectorAll('#detTabNav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#detTabNav .tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.modal-body .tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `dtp-${btn.dataset.dtab}`);
          });
        });
      });
      // Navigate to CML module button
      document.querySelectorAll('[data-action="gomod"]').forEach(b => {
        b.addEventListener('click', () => {
          Utils.closeModal();
          if (window.App) App.navigate('cml', b.dataset.eq);
        });
      });
    }, 50);
  }

  function _detRow(label, val, raw = false) {
    return `<div class="form-group mb-1">
      <label class="text-xs" style="margin-bottom:2px">${label}</label>
      <div class="text-sm font-bold">${raw ? val : Utils.escHtml(String(val ?? '—'))}</div>
    </div>`;
  }

  function _renderLifeBar(eq) {
    if (!eq.espesor_nominal_mm || !eq.espesor_minimo_mm) return '';
    const cmls = DB.query('cmls', c => c.equipo_id === eq.id);
    if (cmls.length === 0) return '';

    const bars = cmls.map(c => {
      const lm = DB.lastMedicion(c.id);
      if (!lm) return '';
      const tact = lm.espesor_mm;
      const tnom = eq.espesor_nominal_mm;
      const tmin = eq.espesor_minimo_mm;
      const pct  = Utils.clamp(((tact - tmin) / (tnom - tmin)) * 100, 0, 100);
      const cls  = pct > 60 ? 'success' : pct > 30 ? 'warn' : 'danger';
      return `<div class="mb-1">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:3px">
          <span>${Utils.escHtml(c.nombre)}</span>
          <span>${tact} mm (${pct.toFixed(0)}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="gauge-label"><span>t_min=${tmin} mm</span><span>t_nom=${tnom} mm</span></div>
      </div>`;
    }).join('');

    return `<div class="form-section mt-2">
      <div class="form-section-title">Vida de Pared (CMLs)</div>
      ${bars}
    </div>`;
  }

  /* ── Form modal ─────────────────────────────────────────── */
  function openForm(id) {
    const eq  = id ? DB.getById('equipos', id) : null;
    const title = eq ? `✏️ Editar – ${eq.tag}` : '＋ Nuevo Equipo';

    const mats = ThicknessCalc.getMaterials()
      .map(m => `<option value="${m.key}" ${eq?.material===m.key?'selected':''}>${m.nombre}</option>`)
      .join('');

    const v = (field, def = '') => Utils.escHtml(eq ? (eq[field] ?? def) : def);
    const sel = (field, val) => eq?.[field] === val ? 'selected' : '';

    const body = `
      <form id="eq-form" autocomplete="off">
        <div class="form-section">
          <div class="form-section-title">Identificación</div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>TAG<span class="required">*</span></label>
              <input class="form-control" id="f_tag" value="${v('tag')}" placeholder="p.ej. V-101" required>
            </div>
            <div class="form-group">
              <label>Nombre<span class="required">*</span></label>
              <input class="form-control" id="f_nombre" value="${v('nombre')}" required>
            </div>
            <div class="form-group">
              <label>Tipo<span class="required">*</span></label>
              <select class="form-control" id="f_tipo">
                <option value="" ${sel('tipo','')}>Seleccionar…</option>
                ${['Vasija a Presión','Tubería a Presión','Intercambiador','Tanque Atmosférico','Caldera / Horno','Dispositivo de Alivio']
                  .map(t=>`<option ${sel('tipo',t)}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Planta</label>
              <input class="form-control" id="f_planta" value="${v('planta')}">
            </div>
            <div class="form-group">
              <label>Sistema</label>
              <input class="form-control" id="f_sistema" value="${v('sistema')}">
            </div>
            <div class="form-group">
              <label>Fluido</label>
              <input class="form-control" id="f_fluido" value="${v('fluido')}">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Estado</label>
              <select class="form-control" id="f_estado">
                ${['Activo','Inactivo','Parado','Retirado'].map(s=>`<option ${sel('estado',s)}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Criticidad</label>
              <select class="form-control" id="f_criticidad">
                ${['Alta','Media','Baja'].map(c=>`<option ${sel('criticidad',c)}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Norma de diseño</label>
              <select class="form-control" id="f_norma">
                ${['ASME VIII Div.1','ASME B31.3','API 650','ASME II-D']
                  .map(n=>`<option ${sel('norma_diseno',n)}>${n}</option>`).join('')}
              </select>
              <div class="form-hint" id="f_norma_hint"></div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Parámetros de Diseño</div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Material</label>
              <select class="form-control" id="f_material">${mats}</select>
            </div>
            <div class="form-group">
              <label>Presión diseño (kPa)</label>
              <input type="number" class="form-control" id="f_P" value="${v('presion_diseno_kPa')}" min="0" step="1">
            </div>
            <div class="form-group">
              <label>Temperatura diseño (°C)</label>
              <input type="number" class="form-control" id="f_T" value="${v('temp_diseno_C')}" step="1">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Diámetro (mm)</label>
              <input type="number" class="form-control" id="f_diam" value="${v('diametro_mm')}" min="0">
            </div>
            <div class="form-group">
              <label>Longitud (mm)</label>
              <input type="number" class="form-control" id="f_long" value="${v('longitud_mm')}" min="0">
            </div>
            <div class="form-group">
              <label>Corrosión admisible CA (mm)</label>
              <input type="number" class="form-control" id="f_ca" value="${v('ca_mm', 1.5)}" min="0" step="0.1">
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Espesor nominal (mm)</label>
              <input type="number" class="form-control" id="f_tnom" value="${v('espesor_nominal_mm')}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Espesor mínimo requerido (mm)</label>
              <input type="number" class="form-control" id="f_tmin" value="${v('espesor_minimo_mm')}" min="0" step="0.01">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Fechas</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Fecha de fabricación</label>
              <input type="date" class="form-control" id="f_ffab" value="${v('fecha_fabricacion')}">
            </div>
            <div class="form-group">
              <label>Fecha de instalación</label>
              <input type="date" class="form-control" id="f_fins" value="${v('fecha_instalacion')}">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Notas</div>
          <textarea class="form-control" id="f_notas" rows="3">${v('notas')}</textarea>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-xl',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="eq-saveBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      const tipoSelect = document.getElementById('f_tipo');
      const normaSelect = document.getElementById('f_norma');
      const hint = document.getElementById('f_norma_hint');
      const applyNormas = () => {
        const tipo = tipoSelect?.value;
        if (!tipo || !normaSelect) return;
        const items = ThicknessCalc.getApplicableStandards(tipo);
        const previous = normaSelect.value;
        normaSelect.innerHTML = items.map(s => `<option value="${s.key}" ${previous === s.key ? 'selected' : ''}>${s.edition}</option>`).join('');
        if (!items.some(s => s.key === previous) && items.length) {
          const primary = items.find(s => s.key !== 'ASME II-D') || items[0];
          normaSelect.value = primary.key;
        }
        const selected = items.find(s => s.key === normaSelect.value);
        hint.textContent = selected
          ? `Aplicable: ${selected.description} | Archivo: ${selected.file}`
          : 'Seleccione un tipo de equipo para verificar la norma aplicable.';
      };
      tipoSelect?.addEventListener('change', applyNormas);
      applyNormas();
      document.getElementById('eq-saveBtn').addEventListener('click', () => saveEquipo(eq?.id));
    }, 50);
  }

  /* ── Save ───────────────────────────────────────────────── */
  function saveEquipo(id) {
    const g = sid => document.getElementById(sid)?.value?.trim() || '';
    const gn = sid => { const v = parseFloat(document.getElementById(sid)?.value); return isNaN(v) ? null : v; };

    const tag    = g('f_tag');
    const nombre = g('f_nombre');
    const tipo   = g('f_tipo');
    if (!tag || !nombre || !tipo) {
      Utils.toast('Campos requeridos', 'TAG, Nombre y Tipo son obligatorios.', 'error'); return;
    }

    const norma = g('f_norma');
    if (!ThicknessCalc.validateStandardForEquipment(tipo, norma)) {
      Utils.toast('Norma no aplicable', `La norma ${norma || '(vacía)'} no corresponde al tipo ${tipo}.`, 'error');
      return;
    }

    const data = {
      tag, nombre, tipo,
      planta:          g('f_planta'),
      sistema:         g('f_sistema'),
      fluido:          g('f_fluido'),
      estado:          g('f_estado') || 'Activo',
      criticidad:      g('f_criticidad') || 'Media',
      norma_diseno:    g('f_norma'),
      material:        g('f_material'),
      presion_diseno_kPa: gn('f_P'),
      temp_diseno_C:   gn('f_T'),
      diametro_mm:     gn('f_diam'),
      longitud_mm:     gn('f_long'),
      ca_mm:           gn('f_ca'),
      espesor_nominal_mm: gn('f_tnom'),
      espesor_minimo_mm:  gn('f_tmin'),
      fecha_fabricacion: g('f_ffab') || null,
      fecha_instalacion: g('f_fins') || null,
      notas:           g('f_notas'),
    };

    if (id) {
      DB.update('equipos', id, data);
      Utils.toast('Actualizado', `Equipo ${tag} actualizado.`, 'success');
    } else {
      data.id = 'EQ-' + Date.now().toString(36).toUpperCase();
      DB.insert('equipos', data);
      Utils.toast('Creado', `Equipo ${tag} registrado.`, 'success');
    }
    Utils.closeModal();
    render();
  }

  /* ── Delete ─────────────────────────────────────────────── */
  function deleteEquipo(id) {
    const eq = DB.getById('equipos', id);
    if (!eq) return;
    Utils.confirm(
      `¿Eliminar el equipo ${eq.tag}? Se eliminarán también sus CMLs e inspecciones asociadas.`,
      () => {
        DB.remove('equipos', id);
        DB.query('cmls', c => c.equipo_id === id).forEach(c => DB.remove('cmls', c.id));
        DB.query('inspecciones', i => i.equipo_id === id).forEach(i => DB.remove('inspecciones', i.id));
        DB.query('rbi_evaluaciones', r => r.equipo_id === id).forEach(r => DB.remove('rbi_evaluaciones', r.id));
        Utils.toast('Eliminado', `Equipo ${eq.tag} eliminado.`, 'warning');
        render();
      }
    );
  }

  /* ── Open CMLs for equipo (navigate to CML module) ──────── */
  function openCMLsForEquipo(id) {
    if (window.App) App.navigate('cml', id);
  }

  /* ── CSV Export ─────────────────────────────────────────── */
  function exportCSV() {
    const all = DB.getAll('equipos');
    const headers = ['TAG','Nombre','Tipo','Planta','Sistema','Fluido','Material',
      'P_diseño_kPa','T_diseño_C','Diámetro_mm','Esp_nominal_mm','Esp_min_mm','CA_mm',
      'Criticidad','Estado','Norma','Fab.','Instalación'];
    const rows = all.map(e => [
      e.tag, e.nombre, e.tipo, e.planta, e.sistema, e.fluido, e.material,
      e.presion_diseno_kPa, e.temp_diseno_C, e.diametro_mm,
      e.espesor_nominal_mm, e.espesor_minimo_mm, e.ca_mm,
      e.criticidad, e.estado, e.norma_diseno,
      e.fecha_fabricacion, e.fecha_instalacion
    ]);
    Utils.exportCSV(headers, rows, `equipos_${Utils.today()}.csv`);
  }

  return { render };
})();
