/**
 * SGIEE – Módulo: Planificación y Programación de Inspecciones
 *
 * Combines:
 *  - CBM (Condition-Based Maintenance): half-life rule per API 510/570
 *  - RBI intervals from stored evaluations
 *  - Manual override capability
 *  - Calendar view (12-month Gantt-like) + list view
 *  - Work order generation
 */
const ModPlanificacion = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let viewMode      = 'list';    // 'list' | 'calendar'
  let filterEstado  = '';
  let filterEquipo  = '';
  let currentYear   = new Date().getFullYear();
  let page          = 1;
  const PAGE_SIZE   = 15;

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    const el = document.getElementById('mod-planificacion');
    if (!el) return;

    // Auto-generate plans if none exist
    _autogeneratePlans();

    el.innerHTML = `
      <div class="section-header">
        <h2>Programación de Inspecciones (CBM + RBI)</h2>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" id="plan-viewToggle">📅 Calendario</button>
          <button class="btn btn-secondary btn-sm" id="plan-regen">♻ Regenerar desde CBM/RBI</button>
          <button class="btn btn-secondary btn-sm" id="plan-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="plan-newBtn">＋ Nueva Tarea</button>
        </div>
      </div>

      <div class="alert alert-info mb-2">
        <span class="alert-icon">ℹ️</span>
        <div>
          Intervalos CBM calculados por <strong>Regla de Vida Media (API 510/570)</strong>:
          Intervalo = Vida_Remanente / 2. Intervalos RBI tomados de las evaluaciones vigentes.
          Los planes marcados como "RBI" prevalecen sobre los CBM del mismo equipo.
        </div>
      </div>

      <!-- KPI strip -->
      <div id="plan-kpis" class="mini-stat-row mb-2"></div>

      <!-- Alert strip -->
      <div id="plan-alerts"></div>

      <!-- Filters -->
      <div class="filter-bar">
        <select class="form-control" id="plan-fEq" style="width:220px">
          <option value="">Todos los equipos</option>
          ${DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
            .map(e=>`<option value="${e.id}">${e.tag} – ${Utils.escHtml(e.nombre)}</option>`).join('')}
        </select>
        <select class="form-control" id="plan-fEst" style="width:160px">
          <option value="">Todos los estados</option>
          <option>Programada</option>
          <option>En Ejecución</option>
          <option>Completada</option>
          <option>Vencida</option>
          <option>Cancelada</option>
        </select>
      </div>

      <!-- Main content -->
      <div id="plan-content"></div>
      <div id="plan-pagination"></div>`;

    _bindEvents(el);
    _renderKPIs();
    _renderAlerts();
    _renderContent();
  }

  /* ── Auto-generate plans from CBM + RBI ─────────────────── */
  function _autogeneratePlans() {
    const equipos = DB.getAll('equipos');
    const existing = DB.getAll('planes');

    equipos.forEach(eq => {
      const hasRBIPlan = existing.some(p => p.equipo_id === eq.id && p.fuente === 'RBI');
      const hasCBMPlan = existing.some(p => p.equipo_id === eq.id && p.fuente === 'CBM');

      // RBI-based plan
      const rbi = DB.query('rbi_evaluaciones', r => r.equipo_id === eq.id && r.estado === 'Vigente')
        .sort((a,b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion))[0];
      if (rbi && !hasRBIPlan && rbi.proxima_inspeccion) {
        DB.insert('planes', {
          equipo_id:    eq.id,
          fecha_prog:   rbi.proxima_inspeccion,
          tipo_insp:    'RBI-Dirigida',
          fuente:       'RBI',
          riesgo:       rbi.riesgo_color,
          metodos:      _methodsFromRisk(rbi.riesgo_color),
          prioridad:    rbi.riesgo_color === 'vhigh' ? 1 : rbi.riesgo_color === 'high' ? 2 : 3,
          estado:       'Programada',
          notas:        `Generado desde RBI-${rbi.id}. Intervalo: ${rbi.intervalo_inspeccion_a} a.`,
          rbi_id:       rbi.id,
        });
      }

      // CBM-based plan (worst CML half-life)
      if (!hasCBMPlan && eq.espesor_minimo_mm) {
        const cmls = DB.query('cmls', c => c.equipo_id === eq.id && c.activo !== false);
        let minInterval = Infinity, refCml = null;

        cmls.forEach(c => {
          const cbm = DB.nextInspectionCBM(c.id, eq.espesor_minimo_mm);
          if (cbm !== null && cbm < minInterval) { minInterval = cbm; refCml = c; }
        });

        if (refCml && isFinite(minInterval) && minInterval > 0) {
          const lm = DB.lastMedicion(refCml.id);
          const baseDate = lm?.fecha || Utils.today();
          const fechaProg = Utils.addYears(baseDate, minInterval);
          DB.insert('planes', {
            equipo_id:   eq.id,
            fecha_prog:  fechaProg,
            tipo_insp:   'CBM-UT',
            fuente:      'CBM',
            riesgo:      minInterval < 2 ? 'high' : minInterval < 5 ? 'medium' : 'low',
            metodos:     'UT escáner, Medición espesor CML',
            prioridad:   minInterval < 2 ? 2 : 3,
            estado:      'Programada',
            notas:       `CBM desde CML: ${refCml.nombre}. Intervalo: ${Utils.round(minInterval,2)} a.`,
            cml_id:      refCml.id,
          });
        }
      }
    });
  }

  /* ── KPIs ───────────────────────────────────────────────── */
  function _renderKPIs() {
    const all   = DB.getAll('planes');
    const hoy   = new Date();
    const venc  = all.filter(p => p.estado === 'Programada' && new Date(p.fecha_prog) < hoy).length;
    const prox30 = all.filter(p => {
      if (p.estado !== 'Programada') return false;
      const d = (new Date(p.fecha_prog) - hoy) / (1000*3600*24);
      return d >= 0 && d <= 30;
    }).length;
    const comp  = all.filter(p => p.estado === 'Completada').length;
    const prog  = all.filter(p => p.estado === 'Programada').length;

    document.getElementById('plan-kpis').innerHTML = `
      <div class="mini-stat">
        <div class="ms-label">Total Tareas</div>
        <div class="ms-val" style="color:var(--c-primary)">${all.length}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Programadas</div>
        <div class="ms-val">${prog}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Vencidas</div>
        <div class="ms-val" style="color:${venc>0?'var(--c-danger)':'var(--c-success)'}">${venc}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Próx. 30 días</div>
        <div class="ms-val" style="color:${prox30>0?'var(--c-warning)':'var(--c-success)'}">${prox30}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Completadas</div>
        <div class="ms-val" style="color:var(--c-success)">${comp}</div>
      </div>`;
  }

  /* ── Alerts ─────────────────────────────────────────────── */
  function _renderAlerts() {
    const hoy = new Date();
    const venc = DB.getAll('planes').filter(p =>
      p.estado === 'Programada' && new Date(p.fecha_prog) < hoy
    );
    if (venc.length === 0) { document.getElementById('plan-alerts').innerHTML = ''; return; }

    const tags = venc.map(p => {
      const eq = DB.getById('equipos', p.equipo_id);
      return eq?.tag || p.equipo_id;
    }).join(', ');
    document.getElementById('plan-alerts').innerHTML = `
      <div class="alert alert-danger mb-2">
        <span class="alert-icon">⛔</span>
        <div><strong>${venc.length} tarea(s) VENCIDA(S):</strong> ${Utils.escHtml(tags)}</div>
      </div>`;
  }

  /* ── Content ────────────────────────────────────────────── */
  function _renderContent() {
    const content = document.getElementById('plan-content');
    if (!content) return;
    viewMode === 'calendar'
      ? _renderCalendar(content)
      : _renderList(content);
  }

  /* ── List view ──────────────────────────────────────────── */
  function _renderList(container) {
    let planes = DB.getAll('planes');
    if (filterEquipo) planes = planes.filter(p => p.equipo_id === filterEquipo);
    if (filterEstado) planes = planes.filter(p => p.estado === filterEstado);

    // Sort: vencidas first, then by date
    const hoy = new Date();
    planes.sort((a,b) => {
      const aV = new Date(a.fecha_prog) < hoy && a.estado === 'Programada';
      const bV = new Date(b.fecha_prog) < hoy && b.estado === 'Programada';
      if (aV !== bV) return aV ? -1 : 1;
      return new Date(a.fecha_prog) - new Date(b.fecha_prog);
    });

    const total  = planes.length;
    const paged  = planes.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

    if (total === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📅</div><h3>Sin tareas programadas</h3>
        <p>Genere planes desde CBM/RBI o cree tareas manualmente.</p></div>`;
      document.getElementById('plan-pagination').innerHTML = '';
      return;
    }

    const rows = paged.map(p => {
      const eq   = DB.getById('equipos', p.equipo_id);
      const days = Utils.daysUntil(p.fecha_prog);
      const isOver = days !== null && days < 0 && p.estado === 'Programada';

      return `<tr ${isOver?'style="background:rgba(217,48,37,.04)"':''}>
        <td>${Utils.vencimientoBadge(p.fecha_prog)}</td>
        <td>
          <strong class="font-mono">${Utils.escHtml(eq?.tag||p.equipo_id)}</strong>
          <div class="text-xs text-muted">${Utils.escHtml(eq?.nombre||'')}</div>
        </td>
        <td><span class="badge badge-muted">${Utils.escHtml(p.tipo_insp||'—')}</span></td>
        <td><span class="badge ${p.fuente==='RBI'?'badge-primary':'badge-info'}">${Utils.escHtml(p.fuente||'—')}</span></td>
        <td>${p.riesgo ? Utils.riskBadge(p.riesgo) : '—'}</td>
        <td>${Utils.escHtml(Utils.truncate(p.metodos||'—', 40))}</td>
        <td>${_estadoPlanBadge(p.estado)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-plan-action="view"     data-id="${p.id}" title="Ver">🔍</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="edit"     data-id="${p.id}" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="complete" data-id="${p.id}" title="Completar"
            ${p.estado==='Completada'?'disabled':''}>✅</button>
          <button class="btn btn-ghost btn-sm" data-plan-action="del"      data-id="${p.id}" title="Eliminar"
            style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `<div class="table-wrapper">
      <table class="data-table" id="plan-table">
        <thead><tr>
          <th>Fecha Prog.</th><th>Equipo</th><th>Tipo Inspección</th>
          <th>Fuente</th><th>Riesgo</th><th>Métodos</th><th>Estado</th>
          <th class="col-actions">Acc.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    _renderPagination(total);
    _bindTableEvents();
  }

  /* ── Calendar view (12-month bar chart) ─────────────────── */
  function _renderCalendar(container) {
    const planes = DB.getAll('planes').filter(p => {
      if (!p.fecha_prog) return false;
      const yr = new Date(p.fecha_prog).getFullYear();
      return yr === currentYear || yr === currentYear + 1;
    });

    const months = Array.from({length:12}, (_,i) => ({
      label: new Date(currentYear, i, 1).toLocaleDateString('es-ES',{month:'short'}),
      month: i,
      items: planes.filter(p => {
        const d = new Date(p.fecha_prog);
        return d.getFullYear() === currentYear && d.getMonth() === i;
      })
    }));

    const monthCols = months.map(m => {
      const cells = m.items.map(p => {
        const eq = DB.getById('equipos', p.equipo_id);
        const bg = { vhigh:'#d93025', high:'#e05d20', medium:'#e8a020', low:'#22a06b' }[p.riesgo] || '#1a6fc4';
        return `<div style="
          background:${bg}18;border-left:3px solid ${bg};
          border-radius:3px;padding:3px 6px;margin-bottom:3px;
          font-size:.72rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
          data-plan-cal="${p.id}" title="${eq?.tag||p.equipo_id}: ${p.tipo_insp}">
          <strong>${Utils.escHtml(eq?.tag||p.equipo_id)}</strong> ${Utils.escHtml(p.tipo_insp||'')}
        </div>`;
      }).join('');

      const isCurrentMonth = m.month === new Date().getMonth() && currentYear === new Date().getFullYear();

      return `<div style="
        flex:1;min-width:80px;border-right:1px solid var(--c-border);
        ${isCurrentMonth?'background:rgba(26,111,196,.04)':''}">
        <div style="text-align:center;padding:6px 4px;font-size:.78rem;font-weight:700;
          text-transform:uppercase;letter-spacing:.5px;color:${isCurrentMonth?'var(--c-primary)':'var(--c-text-secondary)'};
          border-bottom:1px solid var(--c-border)">
          ${m.label}
          ${m.items.length > 0 ? `<span class="badge badge-primary" style="margin-left:4px;font-size:.65rem">${m.items.length}</span>` : ''}
        </div>
        <div style="padding:4px;min-height:80px">${cells || '<div style="height:40px"></div>'}</div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:12px">
            <button class="btn btn-ghost btn-sm" id="cal-prevYear">‹</button>
            <h3>${currentYear}</h3>
            <button class="btn btn-ghost btn-sm" id="cal-nextYear">›</button>
          </div>
          <div style="display:flex;gap:8px">
            ${Object.entries({low:'Bajo',medium:'Medio',high:'Alto',vhigh:'Muy Alto'}).map(([k,v])=>
              `<span style="display:flex;align-items:center;gap:4px;font-size:.75rem">
                <span style="width:10px;height:10px;border-radius:2px;background:${{low:'#22a06b',medium:'#e8a020',high:'#e05d20',vhigh:'#d93025'}[k]};display:inline-block"></span>
                ${v}</span>`
            ).join('')}
          </div>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <div style="display:flex;min-width:960px">${monthCols}</div>
        </div>
      </div>`;

    document.getElementById('cal-prevYear')?.addEventListener('click', () => { currentYear--; _renderContent(); });
    document.getElementById('cal-nextYear')?.addEventListener('click', () => { currentYear++; _renderContent(); });

    // Calendar item click → show detail
    container.querySelectorAll('[data-plan-cal]').forEach(item => {
      item.addEventListener('click', () => _openDetail(item.dataset.planCal));
    });
  }

  /* ── Badge ──────────────────────────────────────────────── */
  function _estadoPlanBadge(estado) {
    const map = {
      'Programada':   'badge-primary',
      'En Ejecución': 'badge-warning',
      'Completada':   'badge-success',
      'Vencida':      'badge-danger',
      'Cancelada':    'badge-muted',
    };
    return `<span class="badge ${map[estado]||'badge-muted'}">${Utils.escHtml(estado)}</span>`;
  }

  /* ── Helper: methods from risk ───────────────────────────── */
  function _methodsFromRisk(risk) {
    const map = {
      low:    'Visual externa, UT spot check',
      medium: 'UT escáner 25-50%, RT perfil',
      high:   'UT escáner >50%, TOFD en zonas críticas',
      vhigh:  'Inspección interna, UT 100%, FFS API 579',
    };
    return map[risk] || 'UT General';
  }

  /* ── Detail modal ───────────────────────────────────────── */
  function _openDetail(id) {
    const p  = DB.getById('planes', id);
    if (!p) return;
    const eq = DB.getById('equipos', p.equipo_id);

    Utils.openModal(
      `📅 Tarea de Inspección – ${eq?.tag||p.equipo_id}`,
      `<div class="form-row cols-2">
        <div class="form-section">
          <div class="form-section-title">Programación</div>
          ${_dRow('Equipo',    eq ? `${eq.tag} – ${eq.nombre}` : p.equipo_id)}
          ${_dRow('Tipo',      p.tipo_insp)}
          ${_dRow('Fuente',    p.fuente)}
          ${_dRow('Fecha programada', Utils.fmtDate(p.fecha_prog))}
          ${_dRow('Prioridad', p.prioridad === 1 ? '🔴 Alta' : p.prioridad === 2 ? '🟠 Media' : '🟢 Baja')}
          ${_dRow('Estado',    '', true, _estadoPlanBadge(p.estado))}
        </div>
        <div class="form-section">
          <div class="form-section-title">Detalles Técnicos</div>
          ${p.riesgo ? `<div style="margin-bottom:8px">${Utils.riskBadge(p.riesgo)}</div>` : ''}
          ${_dRow('Métodos', p.metodos)}
          ${_dRow('Notas',   p.notas || '—')}
          ${p.rbi_id ? `${_dRow('Ref. RBI', p.rbi_id)}` : ''}
          ${p.cml_id ? `${_dRow('Ref. CML', p.cml_id)}` : ''}
        </div>
      </div>
      <!-- Work order area -->
      <div class="form-section mt-2">
        <div class="form-section-title">Generar Orden de Trabajo</div>
        <div id="wo-area">
          <button class="btn btn-secondary btn-sm" id="genWOBtn">🖨 Generar OT</button>
        </div>
      </div>`,
      {
        size: 'modal-lg',
        footerHtml: `
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cerrar</button>
          <button class="btn btn-primary" id="det-editPlanBtn">✏️ Editar</button>
          <button class="btn btn-success" id="det-completePlanBtn"
            ${p.estado==='Completada'?'disabled':''}>✅ Marcar Completada</button>`
      }
    );

    setTimeout(() => {
      document.getElementById('det-editPlanBtn')?.addEventListener('click', () => {
        Utils.closeModal(); _openForm(id);
      });
      document.getElementById('det-completePlanBtn')?.addEventListener('click', () => {
        _completePlan(id); Utils.closeModal();
      });
      document.getElementById('genWOBtn')?.addEventListener('click', () => {
        document.getElementById('wo-area').innerHTML = _buildWorkOrder(p, eq);
      });
    }, 50);
  }

  /* ── Work Order HTML ────────────────────────────────────── */
  function _buildWorkOrder(p, eq) {
    const woNum = `OT-${Date.now().toString(36).toUpperCase()}`;
    return `<div style="border:2px solid var(--c-border);border-radius:var(--r-md);padding:16px;font-size:.85rem"
      id="wo-print">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--c-border);padding-bottom:10px;margin-bottom:12px">
        <div>
          <div style="font-size:1.1rem;font-weight:800">ORDEN DE TRABAJO DE INSPECCIÓN</div>
          <div style="font-weight:700;font-family:var(--font-mono)">${woNum}</div>
        </div>
        <div style="text-align:right;font-size:.8rem;color:var(--c-text-muted)">
          Emisión: ${Utils.fmtDate(Utils.today())}<br>
          SGIEE v1.0
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-weight:700;text-transform:uppercase;font-size:.72rem;color:var(--c-text-muted);margin-bottom:4px">Equipo</div>
          <div><strong>${Utils.escHtml(eq?.tag||p.equipo_id)}</strong> – ${Utils.escHtml(eq?.nombre||'')}</div>
          <div class="text-xs text-muted">${Utils.escHtml(eq?.planta||'')} · ${Utils.escHtml(eq?.sistema||'')}</div>
          <div class="text-xs">${Utils.escHtml(eq?.tipo||'')} · ${Utils.escHtml(eq?.material||'')}</div>
        </div>
        <div>
          <div style="font-weight:700;text-transform:uppercase;font-size:.72rem;color:var(--c-text-muted);margin-bottom:4px">Programación</div>
          <div>Fecha programada: <strong>${Utils.fmtDate(p.fecha_prog)}</strong></div>
          <div>Tipo: ${Utils.escHtml(p.tipo_insp||'—')}</div>
          <div>Fuente: ${Utils.escHtml(p.fuente||'—')} · ${p.riesgo ? Utils.riskBadge(p.riesgo) : '—'}</div>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-weight:700;text-transform:uppercase;font-size:.72rem;color:var(--c-text-muted);margin-bottom:6px">Alcance y Métodos</div>
        <div>${Utils.escHtml(p.metodos||'—')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        ${_woCell('Prioridad', p.prioridad===1?'Alta':p.prioridad===2?'Media':'Baja')}
        ${_woCell('P diseño', eq?.presion_diseno_kPa ? (eq.presion_diseno_kPa/1000).toFixed(2)+' MPa' : '—')}
        ${_woCell('T diseño', eq?.temp_diseno_C ? eq.temp_diseno_C+' °C' : '—')}
        ${_woCell('Esp. nominal', eq?.espesor_nominal_mm ? eq.espesor_nominal_mm+' mm' : '—')}
        ${_woCell('Esp. mínimo', eq?.espesor_minimo_mm ? eq.espesor_minimo_mm+' mm' : '—')}
        ${_woCell('CA diseño', eq?.ca_mm ? eq.ca_mm+' mm' : '—')}
      </div>
      <!-- CML listing -->
      ${_woCMLs(p.equipo_id)}
      <!-- Sign-off -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;border-top:1px solid var(--c-border);padding-top:12px">
        ${['Preparado por','Aprobado por','Ejecutado por'].map(r=>`
          <div style="border-bottom:1px solid var(--c-border);padding-top:30px;font-size:.78rem;color:var(--c-text-muted)">${r}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-secondary btn-sm mt-1" onclick="window.print()">🖨 Imprimir OT</button>`;
  }

  function _woCell(label, val) {
    return `<div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:4px;padding:6px 8px">
      <div style="font-size:.7rem;color:var(--c-text-muted)">${label}</div>
      <div style="font-weight:700">${Utils.escHtml(String(val))}</div>
    </div>`;
  }

  function _woCMLs(eqId) {
    const cmls = DB.query('cmls', c => c.equipo_id === eqId);
    if (cmls.length === 0) return '';
    const rows = cmls.map(c => {
      const lm = DB.lastMedicion(c.id);
      const cr = DB.calcCorrosionRate(c.id);
      return `<tr>
        <td>${Utils.escHtml(c.nombre)}</td>
        <td>${Utils.escHtml(c.descripcion||'')}</td>
        <td>${lm ? lm.espesor_mm+' mm' : '—'}</td>
        <td>${cr!==null ? cr.toFixed(4)+' mm/a' : '—'}</td>
        <td style="border:1px solid #ccc;min-width:60px">&nbsp;</td>
      </tr>`;
    }).join('');
    return `<div style="margin-bottom:8px">
      <div style="font-weight:700;text-transform:uppercase;font-size:.72rem;color:var(--c-text-muted);margin-bottom:4px">
        CMLs / TMLs (registrar mediciones)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.8rem">
        <thead style="background:#f5f7fa">
          <tr><th style="padding:4px 6px;text-align:left;border:1px solid #dde">CML</th>
          <th style="padding:4px 6px;text-align:left;border:1px solid #dde">Descripción</th>
          <th style="padding:4px 6px;border:1px solid #dde">Últ. Esp.</th>
          <th style="padding:4px 6px;border:1px solid #dde">CR</th>
          <th style="padding:4px 6px;border:1px solid #dde">Nueva Medición</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function _dRow(label, val, raw=false, rawVal='') {
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;
      border-bottom:1px solid var(--c-border);font-size:.88rem">
      <span style="color:var(--c-text-muted)">${label}</span>
      <span style="font-weight:600">${raw ? rawVal : Utils.escHtml(String(val||'—'))}</span>
    </div>`;
  }

  /* ── Form ───────────────────────────────────────────────── */
  function _openForm(id) {
    const p     = id ? DB.getById('planes', id) : null;
    const title = p ? '✏️ Editar Tarea' : '＋ Nueva Tarea de Inspección';

    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e=>`<option value="${e.id}" ${p?.equipo_id===e.id?'selected':''}>${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');
    const v = (f,d='') => Utils.escHtml(p ? (p[f]??d) : d);
    const sel = (f,val) => p?.[f]===val ? 'selected':'';

    const body = `
      <form id="plan-form">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Equipo<span class="required">*</span></label>
            <select class="form-control" id="pf_eq">${eqOpts}</select>
          </div>
          <div class="form-group">
            <label>Fecha programada<span class="required">*</span></label>
            <input type="date" class="form-control" id="pf_fecha" value="${v('fecha_prog', Utils.today())}">
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label>Tipo de inspección</label>
            <select class="form-control" id="pf_tipo">
              ${['Interna','Externa','UT General','CBM-UT','RBI-Dirigida','Hidrostática','NDE Avanzado','Fondo']
                .map(t=>`<option ${sel('tipo_insp',t)}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Fuente de planificación</label>
            <select class="form-control" id="pf_fuente">
              ${['CBM','RBI','Manual','Legal/Normativa'].map(f=>`<option ${sel('fuente',f)}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Riesgo asociado</label>
            <select class="form-control" id="pf_riesgo">
              <option value="">—</option>
              ${['low','medium','high','vhigh'].map(r=>`<option value="${r}" ${sel('riesgo',r)}>${{low:'Bajo',medium:'Medio',high:'Alto',vhigh:'Muy Alto'}[r]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Métodos de inspección</label>
          <input class="form-control" id="pf_metodos" value="${v('metodos')}"
            placeholder="p.ej. UT escáner, RT perfil, Visual…">
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Prioridad</label>
            <select class="form-control" id="pf_prior">
              <option value="1" ${v('prioridad')==='1'?'selected':''}>1 – Alta</option>
              <option value="2" ${(v('prioridad',3)==='2'||!p)?'selected':''}>2 – Media</option>
              <option value="3" ${v('prioridad')==='3'?'selected':''}>3 – Baja</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select class="form-control" id="pf_estado">
              ${['Programada','En Ejecución','Completada','Cancelada']
                .map(s=>`<option ${sel('estado',s)||(!p&&s==='Programada'?'selected':'')}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea class="form-control" id="pf_notas" rows="2">${v('notas')}</textarea>
        </div>
      </form>`;

    Utils.openModal(title, body, {
      size: 'modal-lg',
      footerHtml: `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="plan-saveBtn">💾 Guardar</button>`
    });

    setTimeout(() => {
      document.getElementById('plan-saveBtn')?.addEventListener('click', () => {
        const eq_id = document.getElementById('pf_eq')?.value;
        const fecha = document.getElementById('pf_fecha')?.value;
        if (!eq_id || !fecha) { Utils.toast('Requerido','Complete equipo y fecha.','error'); return; }
        const data = {
          equipo_id:  eq_id,
          fecha_prog: fecha,
          tipo_insp:  document.getElementById('pf_tipo')?.value,
          fuente:     document.getElementById('pf_fuente')?.value,
          riesgo:     document.getElementById('pf_riesgo')?.value || null,
          metodos:    document.getElementById('pf_metodos')?.value?.trim() || '',
          prioridad:  parseInt(document.getElementById('pf_prior')?.value) || 2,
          estado:     document.getElementById('pf_estado')?.value || 'Programada',
          notas:      document.getElementById('pf_notas')?.value?.trim() || '',
        };
        if (id) { DB.update('planes',id,data); Utils.toast('Actualizado','Tarea actualizada.','success'); }
        else    { DB.insert('planes',data);    Utils.toast('Guardado','Tarea creada.','success'); }
        Utils.closeModal(); render();
      });
    }, 50);
  }

  /* ── Complete ───────────────────────────────────────────── */
  function _completePlan(id) {
    DB.update('planes', id, { estado: 'Completada', fecha_completado: Utils.today() });
    Utils.toast('Completada','Tarea marcada como completada.','success');
    render();
  }

  /* ── Delete ─────────────────────────────────────────────── */
  function _deletePlan(id) {
    Utils.confirm('¿Eliminar esta tarea de inspección?', () => {
      DB.remove('planes',id);
      Utils.toast('Eliminado','Tarea eliminada.','warning');
      render();
    });
  }

  /* ── Pagination ─────────────────────────────────────────── */
  function _renderPagination(total) {
    const pages = Math.ceil(total/PAGE_SIZE);
    if (pages <= 1) { document.getElementById('plan-pagination').innerHTML=''; return; }
    let html = `<span class="pagination-info">${Math.min((page-1)*PAGE_SIZE+1,total)}–${Math.min(page*PAGE_SIZE,total)} de ${total}</span>`;
    html += `<button class="page-btn" data-p="${page-1}" ${page===1?'disabled':''}>‹</button>`;
    for (let i=1;i<=pages;i++) {
      if (i===1||i===pages||Math.abs(i-page)<=1)
        html += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
      else if (Math.abs(i-page)===2)
        html += `<span class="page-btn" style="pointer-events:none">…</span>`;
    }
    html += `<button class="page-btn" data-p="${page+1}" ${page===pages?'disabled':''}>›</button>`;
    document.getElementById('plan-pagination').innerHTML = `<div class="pagination">${html}</div>`;
    document.querySelectorAll('#plan-pagination .page-btn[data-p]').forEach(b =>
      b.addEventListener('click', () => { page=parseInt(b.dataset.p); _renderContent(); })
    );
  }

  /* ── Event binding ──────────────────────────────────────── */
  function _bindEvents(el) {
    el.querySelector('#plan-newBtn').addEventListener('click', () => _openForm(null));
    el.querySelector('#plan-exportBtn').addEventListener('click', _exportCSV);
    el.querySelector('#plan-regen').addEventListener('click', () => {
      Utils.confirm('¿Regenerar planes desde CBM/RBI? Se agregarán nuevos planes para equipos sin planes existentes.', () => {
        _autogeneratePlans();
        Utils.toast('Regenerado','Planes CBM/RBI actualizados.','success');
        render();
      });
    });
    el.querySelector('#plan-viewToggle').addEventListener('click', () => {
      viewMode = viewMode === 'list' ? 'calendar' : 'list';
      el.querySelector('#plan-viewToggle').textContent = viewMode === 'list' ? '📅 Calendario' : '📋 Lista';
      _renderContent();
    });
    el.querySelector('#plan-fEq').addEventListener('change', e => { filterEquipo=e.target.value; page=1; _renderContent(); });
    el.querySelector('#plan-fEst').addEventListener('change', e => { filterEstado=e.target.value; page=1; _renderContent(); });
  }

  function _bindTableEvents() {
    document.querySelectorAll('[data-plan-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { planAction, id } = btn.dataset;
        if (planAction === 'view')     _openDetail(id);
        if (planAction === 'edit')     _openForm(id);
        if (planAction === 'complete') _completePlan(id);
        if (planAction === 'del')      _deletePlan(id);
      });
    });
  }

  function _exportCSV() {
    const all = DB.getAll('planes');
    const headers = ['ID','Equipo_TAG','Tipo','Fuente','Fecha_prog','Riesgo','Métodos','Prioridad','Estado','Notas'];
    const rows = all.map(p => {
      const eq = DB.getById('equipos', p.equipo_id);
      return [p.id, eq?.tag||'', p.tipo_insp, p.fuente, p.fecha_prog,
        p.riesgo||'', p.metodos, p.prioridad, p.estado, p.notas];
    });
    Utils.exportCSV(headers, rows, `plan_inspecciones_${Utils.today()}.csv`);
  }

  return { render };
})();
