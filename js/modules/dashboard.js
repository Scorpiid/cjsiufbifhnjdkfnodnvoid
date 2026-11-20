/**
 * SGIEE – Módulo: Dashboard Principal
 * Executive summary with KPIs, risk distribution, upcoming inspections,
 * CML health heatmap, corrosion rate chart, and quick-action cards.
 */
const ModDashboard = (() => {

  function render() {
    const el = document.getElementById('mod-dashboard');
    if (!el) return;

    const stats = DB.dashboardStats();
    const equipos = DB.getAll('equipos');
    const rbis    = DB.getAll('rbi_evaluaciones');
    const planes  = DB.getAll('planes');
    const insps   = DB.getAll('inspecciones');
    const cmls    = DB.getAll('cmls');
    const meds    = DB.getAll('mediciones');

    el.innerHTML = `
      <!-- Welcome bar -->
      <div style="margin-bottom:20px">
        <h2 style="font-size:1.3rem;font-weight:700">
          Buenos días, Inspector 👋
        </h2>
        <p class="text-muted text-sm">
          ${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          · SGIEE v1.0 · API 580 / ASME B31.3 / ASME VIII / API 653 / API 579-1
        </p>
      </div>

      <!-- KPI cards -->
      <div class="kpi-grid" id="dash-kpis"></div>

      <!-- Alert banner -->
      <div id="dash-alerts"></div>

      <!-- Main grid -->
      <div class="grid-2 mt-2" style="align-items:start;gap:20px">

        <!-- Left column -->
        <div style="display:flex;flex-direction:column;gap:20px">
          <!-- Risk distribution -->
          <div class="card">
            <div class="card-header"><h3>📊 Distribución de Riesgo (RBI)</h3></div>
            <div class="card-body" id="dash-riskDist"></div>
          </div>

          <!-- CML Health Heatmap -->
          <div class="card">
            <div class="card-header"><h3>🔥 Estado de CMLs – Vida de Pared</h3></div>
            <div class="card-body" id="dash-cmlHeat"></div>
          </div>

          <!-- Corrosion Rate Chart -->
          <div class="card">
            <div class="card-header"><h3>📉 Tasas de Corrosión por Equipo</h3></div>
            <div class="card-body" id="dash-crChart"></div>
          </div>
        </div>

        <!-- Right column -->
        <div style="display:flex;flex-direction:column;gap:20px">
          <!-- Upcoming inspections -->
          <div class="card">
            <div class="card-header">
              <h3>📅 Próximas Inspecciones (90 días)</h3>
              <button class="btn btn-ghost btn-sm" data-nav="planificacion">Ver todas →</button>
            </div>
            <div class="card-body" style="padding:0" id="dash-upcoming"></div>
          </div>

          <!-- RBI ranking -->
          <div class="card">
            <div class="card-header">
              <h3>⚠ Ranking de Equipos por Riesgo</h3>
              <button class="btn btn-ghost btn-sm" data-nav="rbi">Ver RBI →</button>
            </div>
            <div class="card-body" style="padding:0" id="dash-rbiRank"></div>
          </div>

          <!-- Recent activity -->
          <div class="card">
            <div class="card-header"><h3>🕐 Actividad Reciente</h3></div>
            <div class="card-body" id="dash-activity"></div>
          </div>

          <!-- Quick actions -->
          <div class="card">
            <div class="card-header"><h3>⚡ Acciones Rápidas</h3></div>
            <div class="card-body" id="dash-quick"></div>
          </div>
        </div>
      </div>`;

    _renderKPIs(stats, equipos, rbis, planes);
    _renderAlerts(planes, insps);
    _renderRiskDist(rbis);
    _renderCMLHeat(equipos, cmls);
    _renderCRChart(equipos, cmls);
    _renderUpcoming(planes);
    _renderRBIRank(rbis, equipos);
    _renderActivity(insps, meds);
    _renderQuickActions(el);

    // Nav buttons
    el.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.App) App.navigate(btn.dataset.nav);
      });
    });
  }

  /* ── KPI Cards ──────────────────────────────────────────── */
  function _renderKPIs(stats, equipos, rbis, planes) {
    const hoy  = new Date();
    const venc = planes.filter(p => p.estado === 'Programada' && new Date(p.fecha_prog) < hoy).length;
    const alto = rbis.filter(r => ['high','vhigh'].includes(r.riesgo_color)).length;

    const kpis = [
      { label:'Equipos Activos', value: stats.equipos_activos, total: stats.total_equipos,
        cls:'kpi-primary', icon:'🗄', sub:`de ${stats.total_equipos} totales` },
      { label:'CMLs Monitoreados', value: stats.total_cmls, cls:'kpi-primary', icon:'📍',
        sub:'puntos activos' },
      { label:'Inspecciones Vencidas', value: venc, cls: venc > 0 ? 'kpi-danger':'kpi-success',
        icon:'⛔', sub: venc > 0 ? 'Requieren atención' : 'Al día' },
      { label:'Prox. 90 días', value: stats.insp_proximas, cls:'kpi-warning', icon:'📅',
        sub:'inspecciones programadas' },
      { label:'Riesgo Alto / Muy Alto', value: alto, cls: alto > 0 ? 'kpi-danger':'kpi-success',
        icon:'⚠', sub:`de ${rbis.length} evaluaciones RBI` },
    ];

    document.getElementById('dash-kpis').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <span class="kpi-icon">${k.icon}</span>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
        ${k.total ? `<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(100,(k.value/k.total)*100).toFixed(0)}%"></div></div>` : ''}
      </div>`).join('');
  }

  /* ── Alerts ─────────────────────────────────────────────── */
  function _renderAlerts(planes, insps) {
    const hoy  = new Date();
    const pVenc = planes.filter(p => p.estado === 'Programada' && new Date(p.fecha_prog) < hoy);
    const iAbiertas = insps.filter(i => i.estado === 'Abierta');

    let html = '';
    if (pVenc.length > 0) {
      const tags = pVenc.map(p => {
        const eq = DB.getById('equipos', p.equipo_id);
        return eq?.tag || p.equipo_id;
      }).slice(0,5).join(', ');
      html += `<div class="alert alert-danger mb-1">
        <span class="alert-icon">⛔</span>
        <div>
          <strong>${pVenc.length} tarea(s) de inspección VENCIDA(S):</strong> ${Utils.escHtml(tags)}
          ${pVenc.length > 5 ? ` y ${pVenc.length-5} más…` : ''}
          <button class="btn btn-ghost btn-sm ml-auto" data-nav="planificacion" style="margin-left:12px">Ver →</button>
        </div>
      </div>`;
    }
    if (iAbiertas.length > 0) {
      html += `<div class="alert alert-warning mb-1">
        <span class="alert-icon">⚠️</span>
        <div><strong>${iAbiertas.length} hallazgo(s) ABIERTO(S)</strong> pendientes de cierre.
          <button class="btn btn-ghost btn-sm" data-nav="historial" style="margin-left:12px">Revisar →</button>
        </div>
      </div>`;
    }
    document.getElementById('dash-alerts').innerHTML = html;

    document.querySelectorAll('#dash-alerts [data-nav]').forEach(b =>
      b.addEventListener('click', () => window.App && App.navigate(b.dataset.nav))
    );
  }

  /* ── Risk Distribution ──────────────────────────────────── */
  function _renderRiskDist(rbis) {
    const dist = { low:0, medium:0, high:0, vhigh:0 };
    rbis.forEach(r => { if (dist[r.riesgo_color] !== undefined) dist[r.riesgo_color]++; });
    const total = rbis.length || 1;

    const labels = { low:'Bajo', medium:'Medio', high:'Alto', vhigh:'Muy Alto' };
    const colors = { low:'#22a06b', medium:'#e8a020', high:'#e05d20', vhigh:'#d93025' };

    if (rbis.length === 0) {
      document.getElementById('dash-riskDist').innerHTML =
        '<p class="text-muted text-sm">Sin evaluaciones RBI registradas.</p>'; return;
    }

    const bars = Object.entries(dist).map(([k,v]) => {
      const pct = ((v/total)*100).toFixed(1);
      return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${colors[k]};display:inline-block"></span>
            <span class="text-sm font-bold">${labels[k]}</span>
          </span>
          <span class="text-sm font-mono">${v} (${pct}%)</span>
        </div>
        <div class="progress-bar" style="height:10px">
          <div style="height:100%;width:${pct}%;background:${colors[k]};border-radius:4px;transition:width .6s ease"></div>
        </div>
      </div>`;
    }).join('');

    // Mini donut SVG
    const R = 40, CX = 50, CY = 50, strokeW = 18;
    const circumference = 2 * Math.PI * R;
    let offset = 0;
    const slices = Object.entries(dist).filter(([,v]) => v > 0).map(([k,v]) => {
      const pct   = v / total;
      const dash  = pct * circumference;
      const slice = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
        stroke="${colors[k]}" stroke-width="${strokeW}"
        stroke-dasharray="${dash} ${circumference - dash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${CX} ${CY})"/>`;
      offset += dash;
      return slice;
    }).join('');

    document.getElementById('dash-riskDist').innerHTML = `
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <svg width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--c-border)" stroke-width="${strokeW}"/>
          ${slices}
          <text x="${CX}" y="${CY+5}" text-anchor="middle" font-size="13" font-weight="700"
            fill="var(--c-text-primary)" font-family="Segoe UI,sans-serif">${total}</text>
        </svg>
        <div style="flex:1">${bars}</div>
      </div>`;
  }

  /* ── CML Health Heatmap ─────────────────────────────────── */
  function _renderCMLHeat(equipos, cmls) {
    const container = document.getElementById('dash-cmlHeat');
    if (!container) return;

    const cells = equipos.slice(0, 12).map(eq => {
      const eqCmls = cmls.filter(c => c.equipo_id === eq.id);
      if (eqCmls.length === 0) return `
        <div style="text-align:center;padding:8px;border:1px dashed var(--c-border);border-radius:var(--r-md)">
          <div class="font-mono text-sm font-bold">${Utils.escHtml(eq.tag)}</div>
          <div class="text-xs text-muted">Sin CMLs</div>
        </div>`;

      // Worst CML
      let worstPct = 100, worstCr = 0;
      eqCmls.forEach(c => {
        const lm   = DB.lastMedicion(c.id);
        const cr   = DB.calcCorrosionRate(c.id);
        const tnom = eq.espesor_nominal_mm;
        const tmin = eq.espesor_minimo_mm;
        if (lm && tnom && tmin) {
          const pct = Utils.clamp(((lm.espesor_mm - tmin) / (tnom - tmin)) * 100, 0, 100);
          if (pct < worstPct) worstPct = pct;
        }
        if (cr && cr > worstCr) worstCr = cr;
      });

      const bg = worstPct < 20 ? '#d9302520' : worstPct < 40 ? '#e8a02018' : worstPct < 70 ? '#e8f0fe' : '#22a06b15';
      const bd = worstPct < 20 ? '#d93025' : worstPct < 40 ? '#e8a020' : worstPct < 70 ? '#1a6fc4' : '#22a06b';
      const icon = worstPct < 20 ? '🔴' : worstPct < 40 ? '🟠' : worstPct < 70 ? '🔵' : '🟢';

      return `
        <div style="text-align:center;padding:8px;background:${bg};
          border:1px solid ${bd};border-radius:var(--r-md);cursor:pointer"
          data-nav-eq="${eq.id}" title="${eq.tag}: ${worstPct.toFixed(0)}% vida pared">
          <div class="font-mono text-sm font-bold">${Utils.escHtml(eq.tag)}</div>
          <div>${icon}</div>
          <div style="font-size:.7rem;color:${bd};font-weight:700">${worstPct.toFixed(0)}%</div>
          <div class="text-xs text-muted">${eqCmls.length} CML</div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px">
        ${cells}
      </div>
      <div class="text-xs text-muted mt-2" style="display:flex;gap:12px;flex-wrap:wrap">
        <span>🟢 &gt;70% vida</span><span>🔵 40–70%</span><span>🟠 20–40%</span><span>🔴 &lt;20%</span>
        <span style="margin-left:auto">% = (t_act – t_min) / (t_nom – t_min)</span>
      </div>`;

    container.querySelectorAll('[data-nav-eq]').forEach(c =>
      c.addEventListener('click', () => window.App && App.navigate('cml', c.dataset.navEq))
    );
  }

  /* ── Corrosion Rate Chart (SVG bar) ─────────────────────── */
  function _renderCRChart(equipos, cmls) {
    const container = document.getElementById('dash-crChart');
    if (!container) return;

    // Build worst CR per equipo
    const data = equipos.map(eq => {
      const eqCmls = cmls.filter(c => c.equipo_id === eq.id);
      let maxCR = 0;
      eqCmls.forEach(c => {
        const cr = DB.calcCorrosionRate(c.id);
        if (cr && cr > maxCR) maxCR = cr;
      });
      return { tag: eq.tag, cr: maxCR, id: eq.id };
    }).filter(d => d.cr > 0).sort((a,b) => b.cr - a.cr).slice(0,10);

    if (data.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">Sin datos de corrosión calculados. Registre al menos 2 mediciones por CML.</p>';
      return;
    }

    const maxCR   = Math.max(...data.map(d => d.cr)) * 1.1 || 1;
    const W = 400, H = data.length * 32 + 20, barH = 22;

    const bars = data.map((d, i) => {
      const barW = (d.cr / maxCR) * (W - 100);
      const y    = i * 32 + 10;
      const color = d.cr > 0.5 ? '#d93025' : d.cr > 0.1 ? '#e8a020' : '#22a06b';
      return `
        <text x="0" y="${y + barH * 0.72}" font-size="11"
          fill="var(--c-text-primary)" font-family="Segoe UI,sans-serif">${Utils.escHtml(d.tag)}</text>
        <rect x="80" y="${y}" width="${Math.max(barW,2)}" height="${barH}"
          rx="3" fill="${color}" opacity=".85"/>
        <text x="${80 + Math.max(barW,2) + 4}" y="${y + barH*0.72}" font-size="10"
          fill="${color}" font-family="Cascadia Code,Consolas,monospace" font-weight="700">
          ${d.cr.toFixed(3)} mm/a
        </text>`;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%">
          <!-- Grid lines -->
          ${[0.25,0.5,0.75,1].map(f => {
            const x = 80 + f * (W - 100);
            const v = (f * maxCR).toFixed(2);
            return `<line x1="${x}" y1="0" x2="${x}" y2="${H}"
              stroke="var(--c-border)" stroke-width=".5"/>
              <text x="${x}" y="${H}" font-size="9" text-anchor="middle"
                fill="var(--c-text-muted)" font-family="sans-serif">${v}</text>`;
          }).join('')}
          ${bars}
        </svg>
      </div>
      <div class="text-xs text-muted mt-1">
        Peor tasa de corrosión por equipo (mm/año) · 🟢 ≤0.1 · 🟠 0.1–0.5 · 🔴 >0.5
      </div>`;
  }

  /* ── Upcoming Inspections ───────────────────────────────── */
  function _renderUpcoming(planes) {
    const hoy = new Date();
    const upcoming = planes
      .filter(p => {
        if (p.estado === 'Completada' || p.estado === 'Cancelada') return false;
        const d = new Date(p.fecha_prog);
        const diff = (d - hoy) / (1000*3600*24);
        return diff <= 90;
      })
      .sort((a,b) => new Date(a.fecha_prog) - new Date(b.fecha_prog))
      .slice(0, 8);

    const container = document.getElementById('dash-upcoming');
    if (!container) return;

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:20px"><p>Sin inspecciones en los próximos 90 días.</p></div>';
      return;
    }

    const rows = upcoming.map(p => {
      const eq   = DB.getById('equipos', p.equipo_id);
      const days = Utils.daysUntil(p.fecha_prog);
      const isOver = days !== null && days < 0;
      const bg = isOver ? 'rgba(217,48,37,.04)' : '';

      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;
        border-bottom:1px solid var(--c-border);${bg}">
        <div style="flex-shrink:0;text-align:center;min-width:52px">
          <div style="font-size:1.2rem;font-weight:800;color:${isOver?'var(--c-danger)':days<=7?'var(--c-warning)':'var(--c-primary)'}">
            ${isOver ? Math.abs(days)+'d' : days+'d'}
          </div>
          <div class="text-xs text-muted">${isOver?'vencida':'restantes'}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="font-bold text-sm">${Utils.escHtml(eq?.tag||p.equipo_id)} – ${Utils.escHtml(eq?.nombre||'')}</div>
          <div class="text-xs text-muted">${Utils.escHtml(p.tipo_insp||'—')} · ${Utils.fmtDate(p.fecha_prog)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${p.riesgo ? Utils.riskBadge(p.riesgo) : ''}
          <span class="badge ${p.fuente==='RBI'?'badge-primary':'badge-info'}" style="font-size:.7rem">${p.fuente||''}</span>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = rows;
  }

  /* ── RBI Ranking ────────────────────────────────────────── */
  function _renderRBIRank(rbis, equipos) {
    const container = document.getElementById('dash-rbiRank');
    if (!container) return;

    // Latest RBI per equipo, sorted by risk
    const latestByEq = {};
    rbis.forEach(r => {
      if (!latestByEq[r.equipo_id] ||
          new Date(r.fecha_evaluacion) > new Date(latestByEq[r.equipo_id].fecha_evaluacion)) {
        latestByEq[r.equipo_id] = r;
      }
    });

    const rankOrder = { vhigh:0, high:1, medium:2, low:3 };
    const sorted = Object.values(latestByEq)
      .sort((a,b) => (rankOrder[a.riesgo_color]??4) - (rankOrder[b.riesgo_color]??4))
      .slice(0, 8);

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:20px"><p>Sin evaluaciones RBI.</p></div>';
      return;
    }

    const rows = sorted.map((r, i) => {
      const eq = DB.getById('equipos', r.equipo_id);
      const rl = r.vida_remanente_a;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;
        border-bottom:1px solid var(--c-border)">
        <div style="font-size:1.1rem;font-weight:800;color:var(--c-text-muted);min-width:24px">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div class="font-bold text-sm">${Utils.escHtml(eq?.tag||r.equipo_id)} – ${Utils.escHtml(eq?.nombre||'')}</div>
          <div class="text-xs text-muted">
            CR: ${r.tasa_corrosion_mmpa ? r.tasa_corrosion_mmpa+' mm/a' : '—'}
            · RL: ${rl ? rl+' a' : '∞'}
            · Próx: ${Utils.fmtDate(r.proxima_inspeccion)}
          </div>
        </div>
        <div>${Utils.riskBadge(r.riesgo_color)}</div>
      </div>`;
    }).join('');

    container.innerHTML = rows;
  }

  /* ── Recent Activity ────────────────────────────────────── */
  function _renderActivity(insps, meds) {
    const container = document.getElementById('dash-activity');
    if (!container) return;

    // Merge inspections and measurements, sort by date desc
    const events = [
      ...insps.map(i => ({
        date: i.fecha, type: 'insp',
        icon: '🔍',
        text: `Inspección ${i.tipo} – ${DB.getById('equipos',i.equipo_id)?.tag||i.equipo_id}`,
        badge: Utils.resultadoBadge(i.resultado),
      })),
      ...meds.map(m => ({
        date: m.fecha, type: 'med',
        icon: '📏',
        text: `Medición ${m.espesor_mm}mm – CML ${m.cml_id}`,
        badge: `<span class="badge badge-muted">${m.metodo}</span>`,
      })),
    ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (events.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">Sin actividad reciente.</p>'; return;
    }

    container.innerHTML = `<div class="timeline">
      ${events.map(e => `
        <div class="timeline-item">
          <div class="timeline-date">${Utils.fmtDate(e.date)}</div>
          <div class="timeline-title">${e.icon} ${Utils.escHtml(e.text)}</div>
          <div>${e.badge}</div>
        </div>`).join('')}
    </div>`;
  }

  /* ── Quick Actions ──────────────────────────────────────── */
  function _renderQuickActions(el) {
    const container = document.getElementById('dash-quick');
    if (!container) return;

    const actions = [
      { icon:'📐', label:'Calcular Espesor Mínimo', nav:'espesores', color:'var(--c-primary)' },
      { icon:'⚠',  label:'Nueva Evaluación RBI',    nav:'rbi',       color:'var(--c-warning)' },
      { icon:'📏', label:'Registrar Medición CML',   nav:'cml',       color:'var(--c-success)' },
      { icon:'🔍', label:'Registrar Inspección',     nav:'historial', color:'var(--c-info)' },
      { icon:'📐', label:'Agregar Isométrico',       nav:'isometricos',color:'var(--c-accent)' },
      { icon:'📅', label:'Ver Programación',         nav:'planificacion',color:'var(--c-primary)' },
    ];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${actions.map(a => `
          <button class="btn btn-secondary w-full" data-nav="${a.nav}"
            style="flex-direction:column;padding:12px 8px;gap:6px;height:70px;
            border-left:3px solid ${a.color}">
            <span style="font-size:1.3rem">${a.icon}</span>
            <span style="font-size:.75rem;text-align:center;line-height:1.2">${a.label}</span>
          </button>`).join('')}
      </div>`;

    container.querySelectorAll('[data-nav]').forEach(b =>
      b.addEventListener('click', () => window.App && App.navigate(b.dataset.nav))
    );
  }

  return { render };
})();
