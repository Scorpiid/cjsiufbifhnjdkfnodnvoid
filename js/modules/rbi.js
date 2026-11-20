/**
 * SGIEE – Módulo: RBI (Risk-Based Inspection)
 *
 * Scope per API 580 §1.2 (simplified):
 *  - Damage mechanism: Thinning (adelgazamiento uniforme / localizado)
 *  - POF:  derived from corrosion rate, remaining life, and inspection effectiveness
 *  - COF:  user-entered category (qualitative input per API 580 §10)
 *  - Risk = POF × COF → 5×5 matrix → risk rank (Low/Medium/High/Very High)
 *  - Output: inspection interval, next inspection date, recommended method
 *
 * POF Categories (5-level, Table 2 API 580):
 *   1=Remote (<0.00001/yr), 2=Very Low, 3=Low, 4=Moderate, 5=High (>0.1/yr)
 *
 * COF Categories (user-entered, 5-level per API 580 §10):
 *   A=Negligible, B=Low, C=Medium, D=High, E=Very High
 *
 * Risk Matrix: standard 5×5, colors per API 580 Figure 2
 */
const ModRBI = (() => {

  /* ═══════════════════════════════════════════════════════════
     Risk Matrix definition (POF row 1–5, COF col A–E)
     Values: 'low'|'medium'|'high'|'vhigh'
     ═══════════════════════════════════════════════════════════ */
  const MATRIX = [
    //          A          B          C          D          E
    /* POF 1 */['low',    'low',    'low',    'medium',  'medium'],
    /* POF 2 */['low',    'low',    'medium', 'medium',  'high'  ],
    /* POF 3 */['low',    'medium', 'medium', 'high',    'high'  ],
    /* POF 4 */['medium', 'medium', 'high',   'high',    'vhigh' ],
    /* POF 5 */['medium', 'high',   'high',   'vhigh',   'vhigh' ],
  ];

  const POF_LABELS = ['', 'Remote', 'Very Low', 'Low', 'Moderate', 'High'];
  const COF_LABELS = { A:'Negligible', B:'Low', C:'Medium', D:'High', E:'Very High' };
  const RISK_LABELS = { low:'Bajo', medium:'Medio', high:'Alto', vhigh:'Muy Alto' };
  const RISK_COLORS = { low:'#22a06b', medium:'#e8a020', high:'#e05d20', vhigh:'#d93025' };

  // Inspection interval per risk level (years)  API 580 guidance
  const RISK_INTERVAL = { low: 10, medium: 5, high: 3, vhigh: 1 };

  // Recommended inspection method per COF × damage
  const RECOMMENDED_METHODS = {
    low:    ['Visual externa', 'UT spot check (10%)'],
    medium: ['UT escáner (25–50%)', 'Radiografía perfil', 'CML monitoring'],
    high:   ['UT escáner (>50%)', 'RT/TOFD en áreas críticas', 'Incrementar frecuencia CML'],
    vhigh:  ['Inspección interna completa', 'UT 100% cuerpo', 'Evaluación FFS API 579', 'Acción inmediata'],
  };

  /* ── State ──────────────────────────────────────────────── */
  let selectedEquipoId = null;

  /* ── Main render ────────────────────────────────────────── */
  function render() {
    const el = document.getElementById('mod-rbi');
    if (!el) return;

    const evals = DB.getAll('rbi_evaluaciones')
      .sort((a,b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion));

    el.innerHTML = `
      <div class="section-header">
        <h2>Evaluación RBI – Adelgazamiento (API 580)</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="rbi-exportBtn">⬇ CSV</button>
          <button class="btn btn-primary"          id="rbi-newBtn">＋ Nueva Evaluación</button>
        </div>
      </div>

      <div class="alert alert-info mb-2">
        <span class="alert-icon">ℹ️</span>
        <div>
          Evaluación RBI simplificada per <strong>API 580 3ª Ed.</strong> – Mecanismo único:
          <strong>Adelgazamiento (Thinning)</strong>. POF calculada desde datos de CML/TML.
          COF es <strong>valor de entrada</strong> del usuario.
        </div>
      </div>

      <!-- KPI strip -->
      <div id="rbi-kpis" class="mini-stat-row mb-2"></div>

      <div class="grid-2" style="align-items:start;gap:24px">
        <!-- Left: evaluator form -->
        <div>
          <div class="card">
            <div class="card-header"><h3>⚙ Calculadora RBI</h3></div>
            <div class="card-body" id="rbi-calcPanel">
              ${_buildCalcForm()}
            </div>
          </div>
          <!-- Risk matrix reference -->
          <div class="card mt-2">
            <div class="card-header"><h3>📊 Matriz de Riesgo (5×5)</h3></div>
            <div class="card-body">
              ${_buildMatrixHTML()}
              <div class="mt-2 text-xs text-muted">
                Matriz de riesgo según API 580 Figura 7. POF = eje vertical (1-5),
                COF = eje horizontal (A-E). Intervalo de inspección basado en nivel de riesgo resultante.
              </div>
            </div>
          </div>
        </div>

        <!-- Right: results + history -->
        <div>
          <div id="rbi-resultPanel">
            <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px">
              <div class="empty-icon">⚠</div>
              <h3>Resultado RBI</h3>
              <p>Complete el formulario y presione "Evaluar" para calcular el riesgo</p>
            </div>
          </div>
          <!-- History table -->
          <div class="card mt-2">
            <div class="card-header">
              <h3>📋 Evaluaciones Registradas</h3>
              <span class="badge badge-primary">${evals.length}</span>
            </div>
            <div class="card-body" style="padding:0">
              ${_buildHistoryTable(evals)}
            </div>
          </div>
        </div>
      </div>`;

    _bindCalcEvents(el);
    _renderKPIs();
  }

  /* ── KPIs ───────────────────────────────────────────────── */
  function _renderKPIs() {
    const all   = DB.getAll('rbi_evaluaciones');
    const dist  = { low:0, medium:0, high:0, vhigh:0 };
    all.forEach(r => { if (dist[r.riesgo_color] !== undefined) dist[r.riesgo_color]++; });
    document.getElementById('rbi-kpis').innerHTML = `
      <div class="mini-stat">
        <div class="ms-label">Total Evaluaciones</div>
        <div class="ms-val" style="color:var(--c-primary)">${all.length}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Riesgo Muy Alto</div>
        <div class="ms-val" style="color:#d93025">${dist.vhigh}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Riesgo Alto</div>
        <div class="ms-val" style="color:#e05d20">${dist.high}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Riesgo Medio</div>
        <div class="ms-val" style="color:#e8a020">${dist.medium}</div>
      </div>
      <div class="mini-stat">
        <div class="ms-label">Riesgo Bajo</div>
        <div class="ms-val" style="color:#22a06b">${dist.low}</div>
      </div>`;
  }

  /* ── Calc Form ──────────────────────────────────────────── */
  function _buildCalcForm() {
    const eqOpts = DB.getAll('equipos').sort((a,b)=>a.tag.localeCompare(b.tag))
      .map(e=>`<option value="${e.id}">${e.tag} – ${Utils.escHtml(e.nombre)}</option>`)
      .join('');

    return `
      <form id="rbi-form">
        <div class="form-section">
          <div class="form-section-title">Equipo e Identificación</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Equipo<span class="required">*</span></label>
              <select class="form-control" id="rf_eq">
                <option value="">Seleccionar equipo…</option>${eqOpts}
              </select>
            </div>
            <div class="form-group">
              <label>Fecha evaluación</label>
              <input type="date" class="form-control" id="rf_fecha" value="${Utils.today()}">
            </div>
          </div>
          <div class="form-group">
            <label>Mecanismo de daño</label>
            <select class="form-control" id="rf_mec">
              <option>Corrosión interna uniforme</option>
              <option>Corrosión interna localizada (pitting)</option>
              <option>Erosión-Corrosión</option>
              <option>Corrosión externa (CUI)</option>
              <option>Corrosión bajo aislamiento (CUI)</option>
              <option>Adelgazamiento general</option>
            </select>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Parámetros de Adelgazamiento
            <span class="text-muted text-xs" style="font-weight:400">
              – Determinan la POF automáticamente
            </span>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label>Espesor actual t_act (mm)<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_tact" placeholder="p.ej. 12.4" min="0.01" step="0.01">
            </div>
            <div class="form-group">
              <label>Espesor mínimo t_min (mm)<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_tmin" placeholder="p.ej. 7.2" min="0.01" step="0.01">
              <div class="form-hint">Incluir CA de diseño</div>
            </div>
            <div class="form-group">
              <label>Espesor nominal t_nom (mm)<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_tnom" placeholder="p.ej. 14.0" min="0.01" step="0.01">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Tasa de corrosión CR (mm/año)<span class="required">*</span></label>
              <input type="number" class="form-control" id="rf_cr" placeholder="p.ej. 0.35" min="0" step="0.001">
            </div>
            <div class="form-group">
              <label>Fecha última inspección</label>
              <input type="date" class="form-control" id="rf_lastinsp">
              <div class="form-hint">Para ajustar factor de inspección</div>
            </div>
          </div>
          <div class="form-group">
            <label>Efectividad de inspección pasada</label>
            <select class="form-control" id="rf_insp_eff">
              <option value="1.0">Alta – >60% cobertura, método adecuado (E=1.0)</option>
              <option value="0.8" selected>Media – 25-60% cobertura (E=0.8)</option>
              <option value="0.5">Baja – &lt;25% cobertura o método inadecuado (E=0.5)</option>
              <option value="0.0">Sin inspección previa (E=0)</option>
            </select>
          </div>
          <!-- Auto-load from CML button -->
          <button type="button" class="btn btn-secondary btn-sm" id="rbi-autofillBtn">
            📍 Cargar desde CML del equipo
          </button>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Consecuencia (COF) – Entrada del Usuario
            <span class="text-muted text-xs" style="font-weight:400">
              – API 580 §10
            </span>
          </div>
          <div class="alert alert-warning" style="font-size:.82rem">
            <span class="alert-icon">⚠️</span>
            <div>
              Según API 580 el COF considera: fluido (flammable/tóxico), inventario, densidad poblacional,
              sistemas de mitigación. Seleccione la categoría que corresponde al equipo evaluado.
            </div>
          </div>
          <div class="form-group">
            <label>Categoría de Consecuencia (A–E)<span class="required">*</span></label>
            <div id="cof-selector" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:4px">
              ${['A','B','C','D','E'].map(cat => `
                <label style="cursor:pointer">
                  <input type="radio" name="cof_cat" value="${cat}" ${cat==='C'?'checked':''} style="display:none">
                  <div class="cof-opt" data-cat="${cat}" style="
                    text-align:center;padding:10px 6px;border-radius:var(--r-md);
                    border:2px solid var(--c-border);transition:.15s;
                    ${cat==='C'?'border-color:var(--c-primary);background:rgba(26,111,196,.08)':''}">
                    <div style="font-weight:800;font-size:1.1rem">${cat}</div>
                    <div style="font-size:.7rem;color:var(--c-text-muted)">${COF_LABELS[cat]}</div>
                  </div>
                </label>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>Descripción de la consecuencia (justificación)</label>
            <textarea class="form-control" id="rf_cof_desc" rows="2"
              placeholder="p.ej. Fluido flammable, alta densidad de personal, sin sistema de detección…"></textarea>
          </div>
        </div>

        <div class="form-group">
          <label>Notas adicionales</label>
          <textarea class="form-control" id="rf_notas" rows="2"></textarea>
        </div>

        <button type="button" class="btn btn-primary w-full" id="rbi-evalBtn"
          style="font-size:1rem;padding:10px">
          ⚙ Evaluar Riesgo
        </button>
      </form>`;
  }

  /* ── Risk Matrix HTML ───────────────────────────────────── */
  function _buildMatrixHTML(activePOF = null, activeCOF = null) {
    const cofCols = ['A','B','C','D','E'];

    let html = `
      <div style="display:flex;gap:8px;align-items:flex-end">
        <!-- Y axis label -->
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
          width:28px;min-height:200px">
          <span style="font-size:.72rem;font-weight:700;color:var(--c-text-secondary);
            writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:1px;text-transform:uppercase">
            POF →
          </span>
        </div>
        <!-- Matrix grid -->
        <div>
          <!-- COF header -->
          <div style="display:grid;grid-template-columns:60px repeat(5,1fr);gap:3px;margin-bottom:3px">
            <div></div>
            ${cofCols.map(c=>`<div style="text-align:center;font-size:.75rem;font-weight:700;color:var(--c-text-secondary)">${c}<br><span style="font-weight:400;font-size:.65rem">${COF_LABELS[c]}</span></div>`).join('')}
          </div>
          <!-- Rows POF 5 → 1 (high at top) -->
          ${[5,4,3,2,1].map(pof => `
            <div style="display:grid;grid-template-columns:60px repeat(5,1fr);gap:3px;margin-bottom:3px">
              <div style="display:flex;align-items:center;justify-content:flex-end;padding-right:6px;
                font-size:.72rem;font-weight:600;color:var(--c-text-secondary)">${pof}<br>
                <span style="font-size:.6rem;font-weight:400">${POF_LABELS[pof]}</span>
              </div>
              ${cofCols.map((cof,ci) => {
                const color  = MATRIX[pof-1][ci];
                const isActive = activePOF === pof && activeCOF === cof;
                return `<div style="
                  height:40px;border-radius:4px;
                  background:${RISK_COLORS[color]};
                  opacity:${isActive?1:0.65};
                  border:${isActive?'3px solid #fff':'2px solid transparent'};
                  box-shadow:${isActive?'0 0 0 2px '+RISK_COLORS[color]:'none'};
                  display:flex;align-items:center;justify-content:center;
                  font-size:.65rem;font-weight:700;color:rgba(255,255,255,.85);
                  transition:.15s;cursor:default;
                  transform:${isActive?'scale(1.08)':'scale(1)'}
                " title="${pof},${cof}=${RISK_LABELS[color]}">${RISK_LABELS[color].charAt(0)}</div>`;
              }).join('')}
            </div>`).join('')}
          <!-- X axis label -->
          <div style="text-align:center;font-size:.72rem;font-weight:700;
            color:var(--c-text-secondary);text-transform:uppercase;letter-spacing:1px;margin-top:4px">
            COF (Consecuencia) →
          </div>
        </div>
      </div>
      <!-- Legend -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        ${Object.entries(RISK_LABELS).map(([k,v])=>`
          <div style="display:flex;align-items:center;gap:5px;font-size:.75rem">
            <span style="width:12px;height:12px;border-radius:2px;background:${RISK_COLORS[k]};display:inline-block"></span>
            <span>${v}</span>
          </div>`).join('')}
      </div>`;
    return html;
  }

  /* ── History Table ──────────────────────────────────────── */
  function _buildHistoryTable(evals) {
    if (evals.length === 0) {
      return `<div class="empty-state" style="padding:24px">
        <div class="empty-icon" style="font-size:1.8rem">📋</div>
        <p>Sin evaluaciones registradas.</p>
      </div>`;
    }

    const rows = evals.map(r => {
      const eq = DB.getById('equipos', r.equipo_id);
      return `<tr>
        <td>${Utils.fmtDate(r.fecha_evaluacion)}</td>
        <td><strong class="font-mono">${Utils.escHtml(eq?.tag||r.equipo_id)}</strong></td>
        <td><span class="badge badge-muted" style="font-size:.7rem">${Utils.escHtml(Utils.truncate(r.mecanismo,25))}</span></td>
        <td><span class="badge badge-muted">${Utils.escHtml(r.pof_valor||'—')}</span></td>
        <td><span class="badge badge-muted">${Utils.escHtml(r.cof_valor||'—')}</span></td>
        <td>${Utils.riskBadge(r.riesgo_color)}</td>
        <td>${r.intervalo_inspeccion_a ? r.intervalo_inspeccion_a + ' a' : '—'}</td>
        <td>${Utils.vencimientoBadge(r.proxima_inspeccion)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm" data-rbi-action="view" data-id="${r.id}" title="Ver detalle">🔍</button>
          <button class="btn btn-ghost btn-sm" data-rbi-action="del"  data-id="${r.id}" title="Eliminar"
            style="color:var(--c-danger)">🗑</button>
        </td>
      </tr>`;
    }).join('');

    return `<div class="table-wrapper" style="border-radius:0 0 var(--r-lg) var(--r-lg)">
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Equipo</th><th>Mecanismo</th>
          <th>POF</th><th>COF</th><th>Riesgo</th>
          <th>Intervalo</th><th>Próx. Insp.</th><th class="col-actions">Acc.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  /* ── POF Calculation ────────────────────────────────────── */
  function _calcPOF(tact, tmin, tnom, cr, inspEff, lastInspDate) {
    /*
     * Logic (simplified API 580 qualitative → quantitative mapping):
     *
     * 1. Remaining Life (RL) = (t_act - t_min) / CR
     * 2. RSF = (t_act - t_min) / t_nom   (API 579 proxy)
     * 3. Time since last inspection (years) → inspection credit
     * 4. Combined score → POF category 1–5
     */
    if (cr <= 0 || !isFinite(tact) || !isFinite(tmin) || !isFinite(tnom)) {
      return { pof_cat: 1, pof_label: POF_LABELS[1], rl: Infinity, rsf: null, notes: 'Sin corrosión activa' };
    }

    const rl  = (tact - tmin) / cr;         // years
    const rsf = (tact - tmin) / tnom;       // dimensionless

    // Years since last inspection (reduces confidence → increases POF)
    let timeSinceInsp = 5; // assume 5 years if no date
    if (lastInspDate) {
      timeSinceInsp = (new Date() - new Date(lastInspDate)) / (365.25*24*3600*1000);
    }

    // Inspection credit factor (reduces effective deterioration uncertainty)
    const E = parseFloat(inspEff) || 0;

    // Score components
    let score = 0;

    // RL-based score
    if (rl < 0)        score += 5;
    else if (rl < 2)   score += 4;
    else if (rl < 5)   score += 3;
    else if (rl < 10)  score += 2;
    else               score += 1;

    // RSF penalty
    if (rsf < 0)      score += 2;
    else if (rsf < 0.1) score += 1;

    // Inspection gap penalty
    if (timeSinceInsp > 10) score += 2;
    else if (timeSinceInsp > 5) score += 1;

    // Inspection effectiveness credit
    score -= Math.round(E * 2);

    // Clamp to 1–5
    const pof_cat = Utils.clamp(Math.round(score), 1, 5);

    return {
      pof_cat,
      pof_label: POF_LABELS[pof_cat],
      rl,
      rsf,
      timeSinceInsp,
      score_raw: score,
      notes: `RL=${isFinite(rl)?rl.toFixed(2)+'a':'∞'} · RSF=${rsf.toFixed(3)} · ΔT_insp=${timeSinceInsp.toFixed(1)}a`,
    };
  }

  /* ── Evaluate ───────────────────────────────────────────── */
  function _evaluate() {
    const eqId   = document.getElementById('rf_eq')?.value;
    const tact   = parseFloat(document.getElementById('rf_tact')?.value);
    const tmin   = parseFloat(document.getElementById('rf_tmin')?.value);
    const tnom   = parseFloat(document.getElementById('rf_tnom')?.value);
    const cr     = parseFloat(document.getElementById('rf_cr')?.value);
    const cofCat = document.querySelector('input[name="cof_cat"]:checked')?.value || 'C';
    const fecha  = document.getElementById('rf_fecha')?.value || Utils.today();
    const mec    = document.getElementById('rf_mec')?.value || 'Adelgazamiento';
    const inspEff    = document.getElementById('rf_insp_eff')?.value || '0.8';
    const lastInsp   = document.getElementById('rf_lastinsp')?.value || null;
    const cofDesc    = document.getElementById('rf_cof_desc')?.value?.trim() || '';
    const notas      = document.getElementById('rf_notas')?.value?.trim() || '';

    if (!eqId) { Utils.toast('Requerido','Seleccione un equipo.','error'); return; }
    if ([tact,tmin,tnom,cr].some(isNaN)) {
      Utils.toast('Requerido','Complete t_act, t_min, t_nom y CR.','error'); return;
    }

    const eq = DB.getById('equipos', eqId);

    // Calculate POF
    const pofResult = _calcPOF(tact, tmin, tnom, cr, inspEff, lastInsp);
    const pof_cat   = pofResult.pof_cat;
    const cof_idx   = ['A','B','C','D','E'].indexOf(cofCat);
    const riskColor = MATRIX[pof_cat - 1][cof_idx];

    const interval  = RISK_INTERVAL[riskColor];
    const nextInsp  = Utils.addYears(fecha, interval);
    const methods   = RECOMMENDED_METHODS[riskColor];

    // Show result
    _showResult({
      eq, fecha, mec, pofResult, pof_cat, cofCat,
      riskColor, interval, nextInsp, methods,
      tact, tmin, tnom, cr, cofDesc, notas,
    });
  }

  /* ── Show Result Panel ──────────────────────────────────── */
  function _showResult(d) {
    const { eq, fecha, mec, pofResult, pof_cat, cofCat,
            riskColor, interval, nextInsp, methods,
            tact, tmin, tnom, cr, cofDesc, notas } = d;

    const riskLabel = RISK_LABELS[riskColor];
    const riskHex   = RISK_COLORS[riskColor];
    const rl        = pofResult.rl;

    const statusMsg = rl < 0 ? '⛔ Espesor por debajo del mínimo – acción inmediata' :
                      rl < 2 ? '🚨 Vida remanente crítica (<2 años)' :
                      rl < 5 ? '⚠ Vida remanente corta (<5 años)' :
                                '✅ Condición técnica aceptable';

    const panel = document.getElementById('rbi-resultPanel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="card" style="border-left:4px solid ${riskHex}">
        <div class="card-header" style="background:${riskHex}20">
          <div>
            <div style="font-size:.78rem;color:var(--c-text-muted)">Resultado RBI · ${Utils.fmtDate(fecha)}</div>
            <h3 style="font-size:1.05rem">${Utils.escHtml(eq?.tag||'—')} – ${Utils.escHtml(eq?.nombre||'')}</h3>
          </div>
          <div style="text-align:right">
            <span class="risk-badge risk-${riskColor}" style="font-size:1rem;padding:6px 16px">
              ${riskLabel}
            </span>
          </div>
        </div>
        <div class="card-body">

          <!-- POF × COF visual -->
          <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px">
            <div>
              <div class="text-xs text-muted mb-1" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px">
                Posición en Matriz
              </div>
              ${_buildMatrixHTML(pof_cat, cofCat)}
            </div>
            <div style="flex:1;min-width:200px">
              <div class="result-box" style="margin-top:0">
                <h3>Parámetros Calculados</h3>
                <div class="result-grid">
                  <div class="result-item">
                    <label>POF Categoría</label>
                    <span class="val">${pof_cat}</span>
                    <span class="unit">${pofResult.pof_label}</span>
                  </div>
                  <div class="result-item">
                    <label>COF Categoría</label>
                    <span class="val">${cofCat}</span>
                    <span class="unit">${COF_LABELS[cofCat]}</span>
                  </div>
                  <div class="result-item">
                    <label>Vida Remanente</label>
                    <span class="val">${isFinite(rl)?rl.toFixed(2):'∞'}</span>
                    <span class="unit">años</span>
                  </div>
                  <div class="result-item">
                    <label>RSF</label>
                    <span class="val">${pofResult.rsf!==null?pofResult.rsf.toFixed(3):'—'}</span>
                  </div>
                  <div class="result-item">
                    <label>Intervalo recomendado</label>
                    <span class="val">${interval}</span>
                    <span class="unit">años</span>
                  </div>
                  <div class="result-item">
                    <label>Próxima inspección</label>
                    <span class="val" style="font-size:.9rem">${Utils.fmtDate(nextInsp)}</span>
                  </div>
                </div>
                <div class="result-status ${rl < 0 ? 'critical' : rl < 5 ? 'warn' : 'ok'} mt-2">
                  ${statusMsg}
                </div>
                <div style="margin-top:8px;font-size:.72rem;opacity:.5">${pofResult.notes}</div>
              </div>
            </div>
          </div>

          <!-- Recommended inspection methods -->
          <div class="form-section">
            <div class="form-section-title">Métodos de Inspección Recomendados</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${methods.map(m=>`<span class="badge badge-primary" style="padding:5px 10px;font-size:.8rem">
                🔧 ${Utils.escHtml(m)}</span>`).join('')}
            </div>
          </div>

          <!-- FFS recommendation if critical -->
          ${rl < 5 && rl > 0 ? `
          <div class="alert alert-warning mt-2">
            <span class="alert-icon">⚠️</span>
            <div>Vida remanente ≤ 5 años: Se recomienda ejecutar una <strong>Evaluación FFS Nivel 1
            (API 579-1 Parte 4)</strong> para confirmar la aptitud para el servicio.
            Use el módulo de Cálculo de Espesores → pestaña "API 579-1".</div>
          </div>` : ''}

          ${cofDesc ? `<div class="alert alert-info mt-1">
            <span class="alert-icon">📝</span>
            <div><strong>Justificación COF:</strong> ${Utils.escHtml(cofDesc)}</div></div>` : ''}

          <!-- Save button -->
          <div class="mt-2 d-flex gap-2" style="justify-content:flex-end">
            <button class="btn btn-secondary" id="rbi-discardBtn">↩ Descartar</button>
            <button class="btn btn-primary"   id="rbi-saveEvalBtn">💾 Guardar Evaluación</button>
          </div>
        </div>
      </div>`;

    // Bind save
    document.getElementById('rbi-saveEvalBtn')?.addEventListener('click', () => {
      const eqId = document.getElementById('rf_eq')?.value;
      const data = {
        equipo_id:          eqId,
        fecha_evaluacion:   fecha,
        mecanismo:          mec,
        tasa_corrosion_mmpa: cr,
        espesor_actual_mm:  tact,
        espesor_minimo_mm:  tmin,
        vida_remanente_a:   isFinite(rl) ? Utils.round(rl,2) : null,
        pof_categoria:      pof_cat,
        pof_valor:          pofResult.pof_label,
        cof_categoria:      cof_idx + 1,
        cof_valor:          COF_LABELS[cofCat],
        riesgo_categoria:   riskLabel,
        riesgo_color:       riskColor,
        consecuencia_entrada: COF_LABELS[cofCat],
        intervalo_inspeccion_a: interval,
        proxima_inspeccion: nextInsp,
        estado:             'Vigente',
        notas:              [cofDesc, notas].filter(Boolean).join(' | ') || '',
      };
      DB.insert('rbi_evaluaciones', data);
      Utils.toast('Guardado', 'Evaluación RBI registrada.', 'success');
      render();
    });

    document.getElementById('rbi-discardBtn')?.addEventListener('click', () => {
      panel.innerHTML = `<div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px">
        <div class="empty-icon">⚠</div><h3>Resultado RBI</h3>
        <p>Complete el formulario y presione "Evaluar"</p></div>`;
    });
  }

  /* ── Autofill from CML ──────────────────────────────────── */
  function _autofillFromCML() {
    const eqId = document.getElementById('rf_eq')?.value;
    if (!eqId) { Utils.toast('Seleccione equipo', 'Primero seleccione un equipo.', 'warning'); return; }

    const eq   = DB.getById('equipos', eqId);
    const cmls = DB.query('cmls', c => c.equipo_id === eqId && c.activo !== false);

    if (cmls.length === 0) {
      Utils.toast('Sin CMLs', 'El equipo no tiene CMLs activos.', 'warning'); return;
    }

    // Use worst-case CML (highest corrosion rate)
    let worstCml = null, worstCR = -Infinity;
    cmls.forEach(c => {
      const cr = DB.calcCorrosionRate(c.id);
      if (cr !== null && cr > worstCR) { worstCR = cr; worstCml = c; }
    });

    const lm = worstCml ? DB.lastMedicion(worstCml.id) : null;

    // Fill form
    if (eq.espesor_nominal_mm) document.getElementById('rf_tnom').value = eq.espesor_nominal_mm;
    if (eq.espesor_minimo_mm)  document.getElementById('rf_tmin').value = eq.espesor_minimo_mm;
    if (lm) {
      document.getElementById('rf_tact').value  = lm.espesor_mm;
      document.getElementById('rf_lastinsp').value = lm.fecha;
    }
    if (worstCR > 0) document.getElementById('rf_cr').value = Utils.round(worstCR, 4);

    Utils.toast('Datos cargados',
      `Peor CML: ${worstCml?.nombre||''} · CR=${Utils.round(worstCR,4)} mm/a`, 'success');
  }

  /* ── Bind events ────────────────────────────────────────── */
  function _bindCalcEvents(el) {
    el.querySelector('#rbi-evalBtn')?.addEventListener('click', _evaluate);
    el.querySelector('#rbi-autofillBtn')?.addEventListener('click', _autofillFromCML);
    el.querySelector('#rbi-newBtn')?.addEventListener('click', () => {
      el.querySelector('#rf_eq').value = '';
      el.querySelectorAll('#rbi-form input[type="number"]').forEach(i => i.value = '');
      el.querySelectorAll('#rbi-form textarea').forEach(t => t.value = '');
      document.querySelector('input[name="cof_cat"][value="C"]').checked = true;
      _updateCOFSelector();
      document.getElementById('rbi-resultPanel').innerHTML =
        `<div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px">
          <div class="empty-icon">⚠</div><h3>Resultado RBI</h3><p>Complete el formulario</p></div>`;
    });
    el.querySelector('#rbi-exportBtn')?.addEventListener('click', _exportCSV);

    // COF selector visual update
    el.querySelectorAll('input[name="cof_cat"]').forEach(r =>
      r.addEventListener('change', _updateCOFSelector)
    );

    // History table actions (delegated)
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-rbi-action]');
      if (!btn) return;
      const { rbiAction, id } = btn.dataset;
      if (rbiAction === 'view') _viewEval(id);
      if (rbiAction === 'del')  _deleteEval(id);
    });
  }

  function _updateCOFSelector() {
    const checked = document.querySelector('input[name="cof_cat"]:checked')?.value;
    document.querySelectorAll('.cof-opt').forEach(opt => {
      const isActive = opt.dataset.cat === checked;
      opt.style.borderColor  = isActive ? 'var(--c-primary)' : 'var(--c-border)';
      opt.style.background   = isActive ? 'rgba(26,111,196,.08)' : '';
      opt.style.fontWeight   = isActive ? '700' : '400';
    });
  }

  /* ── View saved eval ────────────────────────────────────── */
  function _viewEval(id) {
    const r  = DB.getById('rbi_evaluaciones', id);
    if (!r) return;
    const eq = DB.getById('equipos', r.equipo_id);

    Utils.openModal(
      `🔍 Evaluación RBI – ${eq?.tag||r.equipo_id} · ${Utils.fmtDate(r.fecha_evaluacion)}`,
      `<div class="form-row cols-2">
        <div class="form-section">
          <div class="form-section-title">Identificación</div>
          ${_dRow('Equipo',    eq ? `${eq.tag} – ${eq.nombre}` : r.equipo_id)}
          ${_dRow('Mecanismo', r.mecanismo)}
          ${_dRow('Fecha',     Utils.fmtDate(r.fecha_evaluacion))}
          ${_dRow('Estado',    r.estado)}
        </div>
        <div class="form-section">
          <div class="form-section-title">Parámetros</div>
          ${_dRow('Tasa corrosión', (r.tasa_corrosion_mmpa||0) + ' mm/a')}
          ${_dRow('Esp. actual',    r.espesor_actual_mm + ' mm')}
          ${_dRow('Esp. mínimo',    r.espesor_minimo_mm + ' mm')}
          ${_dRow('Vida remanente', r.vida_remanente_a ? r.vida_remanente_a + ' a' : '∞')}
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-section">
          <div class="form-section-title">Riesgo</div>
          ${_dRow('POF',     r.pof_valor)}
          ${_dRow('COF',     r.cof_valor)}
          ${_dRow('Riesgo',  '', true, Utils.riskBadge(r.riesgo_color))}
          ${_dRow('Intervalo', r.intervalo_inspeccion_a + ' años')}
          ${_dRow('Próx. insp.', '', true, Utils.vencimientoBadge(r.proxima_inspeccion))}
        </div>
        <div class="form-section">
          <div class="form-section-title">Notas</div>
          <p class="text-sm">${Utils.escHtml(r.notas||'—')}</p>
        </div>
      </div>`,
      { size: 'modal-lg' }
    );
  }

  function _dRow(label, val, raw=false, rawVal='') {
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;
      border-bottom:1px solid var(--c-border);font-size:.88rem">
      <span style="color:var(--c-text-muted)">${label}</span>
      <span style="font-weight:600">${raw ? rawVal : Utils.escHtml(String(val||'—'))}</span>
    </div>`;
  }

  function _deleteEval(id) {
    Utils.confirm('¿Eliminar esta evaluación RBI?', () => {
      DB.remove('rbi_evaluaciones', id);
      Utils.toast('Eliminado','Evaluación eliminada.','warning');
      render();
    });
  }

  function _exportCSV() {
    const all = DB.getAll('rbi_evaluaciones');
    const headers = ['ID','Equipo_TAG','Fecha','Mecanismo','CR_mmpa',
      'Esp_act_mm','Esp_min_mm','RL_a','POF_cat','POF_valor',
      'COF_cat','COF_valor','Riesgo','Intervalo_a','Próxima_insp','Estado'];
    const rows = all.map(r => {
      const eq = DB.getById('equipos', r.equipo_id);
      return [r.id, eq?.tag||'', r.fecha_evaluacion, r.mecanismo, r.tasa_corrosion_mmpa,
        r.espesor_actual_mm, r.espesor_minimo_mm, r.vida_remanente_a||'',
        r.pof_categoria, r.pof_valor, r.cof_categoria, r.cof_valor,
        r.riesgo_categoria, r.intervalo_inspeccion_a, r.proxima_inspeccion||'', r.estado];
    });
    Utils.exportCSV(headers, rows, `rbi_evaluaciones_${Utils.today()}.csv`);
  }

  return { render };
})();
