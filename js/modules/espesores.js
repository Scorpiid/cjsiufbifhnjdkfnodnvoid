/**
 * SGIEE – Módulo: Cálculo de Espesores Mínimos
 * Covers ASME B31.3, ASME VIII Div.1, API 650, API 579-1 FFS
 */
const ModEspesores = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let currentTab = 'b313';
  let lastResult = null;

  /* ── Main render ────────────────────────────────────────── */
  function render() {
    const el = document.getElementById('mod-espesores');
    if (!el) return;

    el.innerHTML = `
      <div class="section-header">
        <h2>Cálculo de Espesores Mínimos</h2>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" id="esp-clearBtn">🗑 Limpiar</button>
          <button class="btn btn-primary btn-sm" id="esp-reportBtn">📄 Reporte</button>
        </div>
      </div>

      <div class="alert alert-info">
        <span class="alert-icon">ℹ️</span>
        <div>
          Calculadora de espesores mínimos según normas ASME B31.3, ASME VIII Div.1, API 650 y evaluación
          FFS (API 579-1 Parte 4). Todos los valores en <strong>mm</strong> y <strong>kPa</strong>.
        </div>
      </div>

      <!-- Norm tabs -->
      <div class="tab-nav" id="espTabNav">
        <button class="tab-btn active" data-tab="b313">ASME B31.3<br><small>Tuberías</small></button>
        <button class="tab-btn" data-tab="viii_shell">ASME VIII – Cuerpo<br><small>Vasija Cilíndrica</small></button>
        <button class="tab-btn" data-tab="viii_heads">ASME VIII – Cabezas<br><small>Hemisférica / Elipsoidal</small></button>
        <button class="tab-btn" data-tab="api653">API 650<br><small>Tanques</small></button>
        <button class="tab-btn" data-tab="ffs">API 579-1<br><small>FFS Nivel 1</small></button>
      </div>

      <!-- Tab panels -->
      <div class="grid-2" style="align-items:start">
        <div>
          <div class="tab-panel active" id="tp-b313">${renderB313Form()}</div>
          <div class="tab-panel"        id="tp-viii_shell">${renderVIIIShellForm()}</div>
          <div class="tab-panel"        id="tp-viii_heads">${renderVIIIHeadsForm()}</div>
          <div class="tab-panel"        id="tp-api653">${renderAPI653Form()}</div>
          <div class="tab-panel"        id="tp-ffs">${renderFFSForm()}</div>
        </div>
        <div id="espResultPanel">
          ${renderEmptyResult()}
        </div>
      </div>

      <!-- Material reference table -->
      <div class="card mt-3" id="matRefCard">
        <div class="card-header">
          <h3>📚 Referencia de Materiales – Tensión Admisible (MPa)</h3>
          <button class="btn btn-secondary btn-sm" id="toggleMatRef">Ver tabla</button>
        </div>
        <div class="card-body" id="matRefBody" style="display:none">
          ${renderMaterialTable()}
        </div>
      </div>`;

    _bindEvents(el);
  }

  /* ── Forms ──────────────────────────────────────────────── */
  function renderB313Form() {
    const mats  = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}">${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j =>
      `<option value="${j.value}">${j.key} (E=${j.value})</option>`).join('');

    return `
      <div class="card">
        <div class="card-header"><h3>ASME B31.3 – Tubería a Presión</h3></div>
        <div class="card-body">
          <div class="form-section">
            <div class="form-section-title">Condiciones de Diseño</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Presión de diseño (kPa)<span class="required">*</span></label>
                <input type="number" class="form-control" id="b313_P" placeholder="p.ej. 2500" min="0" step="1">
                <div class="form-hint">Presión manométrica interna</div>
              </div>
              <div class="form-group">
                <label>Temperatura de diseño (°C)<span class="required">*</span></label>
                <input type="number" class="form-control" id="b313_T" placeholder="p.ej. 120" step="1">
              </div>
            </div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Diámetro exterior OD (mm)<span class="required">*</span></label>
                <input type="number" class="form-control" id="b313_OD" placeholder="p.ej. 168.3" min="1" step="0.1">
              </div>
              <div class="form-group">
                <label>Corrosión admisible CA (mm)</label>
                <input type="number" class="form-control" id="b313_CA" placeholder="p.ej. 1.5" min="0" step="0.1" value="1.5">
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">Material y Junta</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Material<span class="required">*</span></label>
                <select class="form-control" id="b313_mat">${mats}</select>
              </div>
              <div class="form-group">
                <label>Eficiencia de junta E</label>
                <select class="form-control" id="b313_E">${joints}</select>
              </div>
            </div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Factor de calidad de soldadura W</label>
                <input type="number" class="form-control" id="b313_W" value="1.0" min="0.5" max="1.0" step="0.05">
                <div class="form-hint">§302.3.5 – Usualmente 1.0 para acero al carbono</div>
              </div>
              <div class="form-group">
                <label>Tolerancia de laminación (%)</label>
                <input type="number" class="form-control" id="b313_mill" value="12.5" min="0" max="20" step="0.5">
                <div class="form-hint">ASME B36.10M: 12.5% estándar</div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">FFS / Vida Remanente (Opcional)</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Espesor medido actual (mm)</label>
                <input type="number" class="form-control" id="b313_tact" placeholder="p.ej. 6.1" min="0" step="0.01">
              </div>
              <div class="form-group">
                <label>Tasa de corrosión (mm/año)</label>
                <input type="number" class="form-control" id="b313_CR" placeholder="p.ej. 0.3" min="0" step="0.01">
              </div>
            </div>
          </div>

          <button class="btn btn-primary w-full" id="b313_calcBtn">⚙ Calcular</button>
        </div>
      </div>`;
  }

  function renderVIIIShellForm() {
    const mats  = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}">${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j =>
      `<option value="${j.value}">${j.key} (E=${j.value})</option>`).join('');

    return `
      <div class="card">
        <div class="card-header"><h3>ASME VIII Div.1 – Cuerpo Cilíndrico (UG-27)</h3></div>
        <div class="card-body">
          <div class="form-section">
            <div class="form-section-title">Condiciones de Diseño</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Presión de diseño (kPa)<span class="required">*</span></label>
                <input type="number" class="form-control" id="viii_P" placeholder="p.ej. 2500" min="0">
              </div>
              <div class="form-group">
                <label>Temperatura de diseño (°C)<span class="required">*</span></label>
                <input type="number" class="form-control" id="viii_T" placeholder="p.ej. 150">
              </div>
            </div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Diámetro interior ID (mm)<span class="required">*</span></label>
                <input type="number" class="form-control" id="viii_ID" placeholder="p.ej. 1200" min="1">
              </div>
              <div class="form-group">
                <label>Corrosión admisible CA (mm)</label>
                <input type="number" class="form-control" id="viii_CA" placeholder="p.ej. 3.0" min="0" value="3.0">
              </div>
            </div>
          </div>
          <div class="form-section">
            <div class="form-section-title">Material y Junta</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Material<span class="required">*</span></label>
                <select class="form-control" id="viii_mat">${mats}</select>
              </div>
              <div class="form-group">
                <label>Eficiencia de junta E</label>
                <select class="form-control" id="viii_E">${joints}</select>
              </div>
            </div>
          </div>
          <div class="form-section">
            <div class="form-section-title">FFS / Vida Remanente (Opcional)</div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label>Espesor actual medido (mm)</label>
                <input type="number" class="form-control" id="viii_tact" placeholder="p.ej. 12.4" min="0" step="0.01">
              </div>
              <div class="form-group">
                <label>Tasa de corrosión (mm/año)</label>
                <input type="number" class="form-control" id="viii_CR" placeholder="p.ej. 0.35" min="0" step="0.01">
              </div>
            </div>
          </div>
          <button class="btn btn-primary w-full" id="viii_calcBtn">⚙ Calcular</button>
        </div>
      </div>`;
  }

  function renderVIIIHeadsForm() {
    const mats  = ThicknessCalc.getMaterials().map(m => `<option value="${m.key}">${m.nombre}</option>`).join('');
    const joints = ThicknessCalc.getJointEfficiencies().map(j =>
      `<option value="${j.value}">${j.key} (E=${j.value})</option>`).join('');

    return `
      <div class="card">
        <div class="card-header"><h3>ASME VIII Div.1 – Cabezas (UG-27 / UG-32)</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Tipo de cabeza</label>
            <select class="form-control" id="head_tipo">
              <option value="hemi">Hemisférica (UG-27d)</option>
              <option value="ellip" selected>Elipsoidal 2:1 (UG-32d)</option>
              <option value="tori">Torisférica Flangeada (UG-32e)</option>
            </select>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Presión diseño (kPa)<span class="required">*</span></label>
              <input type="number" class="form-control" id="head_P" placeholder="p.ej. 2500" min="0">
            </div>
            <div class="form-group">
              <label>Temperatura diseño (°C)<span class="required">*</span></label>
              <input type="number" class="form-control" id="head_T" placeholder="p.ej. 150">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Diámetro interior ID (mm)<span class="required">*</span></label>
              <input type="number" class="form-control" id="head_ID" placeholder="p.ej. 1200" min="1">
            </div>
            <div class="form-group">
              <label id="head_L_lbl" style="display:none">Radio corona L (mm) <span class="text-muted text-xs">(Solo torisférica)</span></label>
              <input type="number" class="form-control" id="head_L" placeholder="= ID para std" style="display:none">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Material<span class="required">*</span></label>
              <select class="form-control" id="head_mat">${mats}</select>
            </div>
            <div class="form-group">
              <label>Eficiencia junta E</label>
              <select class="form-control" id="head_E">${joints}</select>
            </div>
          </div>
          <div class="form-group">
            <label>Corrosión admisible CA (mm)</label>
            <input type="number" class="form-control" id="head_CA" value="3.0" min="0" step="0.1">
          </div>
          <button class="btn btn-primary w-full" id="head_calcBtn">⚙ Calcular</button>
        </div>
      </div>`;
  }

  function renderAPI653Form() {
    return `
      <div class="card">
        <div class="card-header"><h3>API 650-2013 – Virola de Tanque Atmosférico</h3></div>
        <div class="card-body">
          <div class="alert alert-info mb-2">
            <span class="alert-icon">ℹ️</span>
            <div>Fórmula simplificada: t = 4.9 · D · (H – 0.3) · G / S_d</div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Diámetro D del tanque (m)<span class="required">*</span></label>
              <input type="number" class="form-control" id="tk_D" placeholder="p.ej. 12.0" min="0.1" step="0.1">
            </div>
            <div class="form-group">
              <label>Altura líquido sobre virola H (m)<span class="required">*</span></label>
              <input type="number" class="form-control" id="tk_H" placeholder="p.ej. 8.0" min="0.4" step="0.1">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>Gravedad específica G</label>
              <input type="number" class="form-control" id="tk_G" value="1.0" min="0.6" max="1.9" step="0.01">
              <div class="form-hint">1.0 para agua, >1 para crudos pesados</div>
            </div>
            <div class="form-group">
              <label>Corrosión admisible CA (mm)</label>
              <input type="number" class="form-control" id="tk_CA" value="1.5" min="0" step="0.1">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label>SMYS del material (MPa)<span class="required">*</span></label>
              <input type="number" class="form-control" id="tk_SMYS" placeholder="p.ej. 250" min="100" step="1">
              <div class="form-hint">A36: 250 MPa · API 650 Gr.A: 207 MPa</div>
            </div>
            <div class="form-group">
              <label>UTS del material (MPa)</label>
              <input type="number" class="form-control" id="tk_UTS" placeholder="p.ej. 400" min="100" step="1">
              <div class="form-hint">Requerido para verificación hidrostática</div>
            </div>
          </div>
          <button class="btn btn-primary w-full" id="tk_calcBtn">⚙ Calcular</button>
        </div>
      </div>`;
  }

  function renderFFSForm() {
    return `
      <div class="card">
        <div class="card-header"><h3>API 579-1 Parte 4 – Evaluación FFS Nivel 1 (Adelgazamiento)</h3></div>
        <div class="card-body">
          <div class="alert alert-warning mb-2">
            <span class="alert-icon">⚠️</span>
            <div>Este módulo evalúa si un componente con adelgazamiento puede seguir en servicio.
            El espesor mínimo requerido t_min debe obtenerse del cálculo de diseño correspondiente.</div>
          </div>
          <div class="form-section">
            <div class="form-section-title">Espesores</div>
            <div class="form-row cols-3">
              <div class="form-group">
                <label>Espesor nominal t_nominal (mm)<span class="required">*</span></label>
                <input type="number" class="form-control" id="ffs_tnom" placeholder="p.ej. 14" min="0.1" step="0.01">
              </div>
              <div class="form-group">
                <label>Espesor medido actual t_actual (mm)<span class="required">*</span></label>
                <input type="number" class="form-control" id="ffs_tact" placeholder="p.ej. 12.4" min="0.1" step="0.01">
              </div>
              <div class="form-group">
                <label>Espesor mínimo requerido t_min (mm)<span class="required">*</span></label>
                <input type="number" class="form-control" id="ffs_tmin" placeholder="p.ej. 7.2" min="0.1" step="0.01">
                <div class="form-hint">Incluye CA de diseño</div>
              </div>
            </div>
          </div>
          <div class="form-section">
            <div class="form-section-title">Parámetros de Corrosión</div>
            <div class="form-row cols-3">
              <div class="form-group">
                <label>Tasa de corrosión CR (mm/año)<span class="required">*</span></label>
                <input type="number" class="form-control" id="ffs_CR" placeholder="p.ej. 0.35" min="0" step="0.001">
              </div>
              <div class="form-group">
                <label>RSF admisible (RSF_a)</label>
                <input type="number" class="form-control" id="ffs_RSFa" value="0.90" min="0.5" max="1.0" step="0.01">
                <div class="form-hint">API 579: 0.90 por defecto</div>
              </div>
              <div class="form-group">
                <label>Período futuro hasta inspección (años)</label>
                <input type="number" class="form-control" id="ffs_fut" value="2" min="0" step="0.5">
              </div>
            </div>
          </div>
          <button class="btn btn-primary w-full" id="ffs_calcBtn">⚙ Evaluar FFS</button>
        </div>
      </div>`;
  }

  function renderEmptyResult() {
    return `
      <div class="empty-state" style="border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:40px;">
        <div class="empty-icon">🔧</div>
        <h3>Resultados</h3>
        <p>Complete el formulario y presione Calcular</p>
      </div>`;
  }

  /* ── Result renderers ───────────────────────────────────── */
  function renderB313Result(r) {
    if (r.error) return renderError(r.error);
    const { design } = r;
    const d = design;

    const rl   = d.remaining_life_a;
    const maop = d.MAOP_kPa;

    const statusCls = !rl ? '' : rl < 0 ? 'critical' : rl < 5 ? 'warn' : 'ok';
    const statusTxt = !rl ? '' : rl < 0 ? '⛔ Espesor por debajo del mínimo' : rl < 5 ? '⚠ Vida remanente corta' : '✅ Condición aceptable';

    return `
      <div class="result-box">
        <h3>ASME B31.3 – Resultados de Cálculo</h3>
        <div class="result-grid">
          <div class="result-item">
            <label>t diseño</label>
            <span class="val">${d.t_design_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>t mín + CA</label>
            <span class="val">${d.t_min_CA_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>t nominal req.</label>
            <span class="val">${d.t_nominal_req_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>Tensión admisible S</label>
            <span class="val">${d.S_MPa.toFixed(1)}</span><span class="unit">MPa</span>
          </div>
          <div class="result-item">
            <label>Eficiencia junta E</label>
            <span class="val">${d.E_joint.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <label>Coef. Y</label>
            <span class="val">${d.Y.toFixed(1)}</span>
          </div>
          ${maop ? `<div class="result-item"><label>MAOP</label>
            <span class="val">${(maop/1000).toFixed(2)}</span><span class="unit">MPa</span></div>` : ''}
          ${rl !== null ? `<div class="result-item"><label>Vida Remanente</label>
            <span class="val">${isFinite(rl) ? rl.toFixed(1) : '∞'}</span><span class="unit">años</span></div>` : ''}
        </div>
        ${statusTxt ? `<div class="result-status ${statusCls}">${statusTxt}</div>` : ''}
        ${d.warning ? `<div style="margin-top:10px;font-size:.78rem;color:#f0c060;opacity:.9">⚠ ${d.warning}</div>` : ''}
        <div style="margin-top:12px;font-size:.72rem;opacity:.5;font-family:var(--font-mono)">${d.formula}</div>
      </div>
      ${renderCorrosionVisual({title:'Tubería ASME B31.3',actual:getVal('b313_tact'),nominal:d.t_nominal_req_mm,minimum:d.t_min_CA_mm,cr:getVal('b313_CR'),location:'Tubería a presión'})}
      ${renderNormNote('B31.3')}`;
  }

  function renderVIIIResult(r) {
    if (r.error) return renderError(r.error);
    const { design } = r;
    const d = design;
    const rl = d.remaining_life_a;
    const mawp = d.MAWP_kPa;
    const eta  = d.eta_pct;

    const statusCls = !rl ? '' : rl < 0 ? 'critical' : rl < 5 ? 'warn' : 'ok';
    const statusTxt = !rl ? '' : rl < 0 ? '⛔ Espesor por debajo del mínimo' : rl < 5 ? '⚠ Vida remanente corta' : '✅ Condición aceptable';

    return `
      <div class="result-box">
        <h3>ASME VIII Div.1 – Resultados de Cálculo</h3>
        <div class="result-grid">
          <div class="result-item">
            <label>t diseño</label>
            <span class="val">${d.t_design_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>t mín + CA</label>
            <span class="val">${d.t_min_CA_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>Radio interior R</label>
            <span class="val">${d.R_mm.toFixed(1)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>Tensión admisible S</label>
            <span class="val">${d.S_MPa.toFixed(1)}</span><span class="unit">MPa</span>
          </div>
          <div class="result-item">
            <label>Eficiencia junta E</label>
            <span class="val">${d.E_joint.toFixed(2)}</span>
          </div>
          ${mawp ? `<div class="result-item"><label>MAWP</label>
            <span class="val">${(mawp/1000).toFixed(3)}</span><span class="unit">MPa</span></div>` : ''}
          ${eta ? `<div class="result-item"><label>Utilización</label>
            <span class="val">${eta.toFixed(1)}</span><span class="unit">%</span></div>` : ''}
          ${rl !== null ? `<div class="result-item"><label>Vida Remanente</label>
            <span class="val">${isFinite(rl) ? rl.toFixed(1) : '∞'}</span><span class="unit">años</span></div>` : ''}
        </div>
        ${statusTxt ? `<div class="result-status ${statusCls}">${statusTxt}</div>` : ''}
        ${d.warning ? `<div style="margin-top:10px;font-size:.78rem;color:#f0c060;opacity:.9">⚠ ${d.warning}</div>` : ''}
        <div style="margin-top:12px;font-size:.72rem;opacity:.5;font-family:var(--font-mono)">${d.formula}</div>
      </div>
      ${renderCorrosionVisual({title:'Vasija ASME VIII Div.1',actual:getVal('viii_tact'),nominal:d.t_min_CA_mm + (getVal('viii_tact')||0),minimum:d.t_min_CA_mm,cr:getVal('viii_CR'),location:'Cuerpo cilíndrico'})}
      ${renderNormNote('VIII')}`;
  }

  function renderAPI653Result(r) {
    if (r.error) return renderError(r.error);
    return `
      <div class="result-box">
        <h3>API 650-2013 – Resultados de Cálculo</h3>
        <div class="result-grid">
          <div class="result-item"><label>t diseño</label><span class="val">${r.t_design_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>t prueba hidrostática</label><span class="val">${r.t_hydro_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>t mín + CA</label><span class="val">${r.t_min_CA_mm.toFixed(3)}</span><span class="unit">mm</span></div>
          <div class="result-item"><label>S_d diseño</label><span class="val">${r.S_d_MPa.toFixed(1)}</span><span class="unit">MPa</span></div>
          <div class="result-item"><label>S hidráulica</label><span class="val">${r.S_hydro_MPa.toFixed(1)}</span><span class="unit">MPa</span></div>
        </div>
        ${r.warning ? `<div class="alert alert-warning"><span>⚠</span><div>${Utils.escHtml(r.warning)}</div></div>` : ''}
        <div class="result-status ok">✅ Cálculo completado</div>
        <div style="margin-top:12px;font-size:.72rem;opacity:.5;font-family:var(--font-mono)">${r.formula}</div>
      </div>
      ${renderCorrosionVisual({title:'Tanque API 650-2013',actual:null,nominal:r.t_min_CA_mm*1.25,minimum:r.t_min_CA_mm,cr:0,location:'Virola de tanque'})}
      ${renderNormNote('API650')}`;
  }

  function renderFFSResult(r) {
    if (r.error) return renderError(r.error);
    const statusCls = r.acceptable ? 'ok' : 'critical';
    const statusTxt = r.acceptable ? '✅ ACEPTABLE – El componente puede seguir en servicio' : '⛔ NO ACEPTABLE – Requiere acción inmediata';

    const rl  = r.remaining_life_a;
    const rli = isFinite(rl) ? rl.toFixed(2) : '∞';
    const mci = r.max_cbm_interval_a ? r.max_cbm_interval_a.toFixed(2) : '—';

    return `
      <div class="result-box">
        <h3>API 579-1 – Evaluación FFS Nivel 1</h3>
        <div class="result-grid">
          <div class="result-item">
            <label>RSF calculado</label>
            <span class="val">${r.RSF.toFixed(4)}</span>
          </div>
          <div class="result-item">
            <label>RSF admisible</label>
            <span class="val">${r.RSF_a.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <label>t límite FFS</label>
            <span class="val">${r.t_lim_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>Vida remanente</label>
            <span class="val">${rli}</span><span class="unit">años</span>
          </div>
          <div class="result-item">
            <label>Intervalo máx CBM</label>
            <span class="val">${mci}</span><span class="unit">años</span>
          </div>
          <div class="result-item">
            <label>t futuro (período)</label>
            <span class="val">${r.t_future_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>RSF futuro</label>
            <span class="val">${r.RSF_future.toFixed(4)}</span>
          </div>
        </div>
        <div class="result-status ${statusCls}">${statusTxt}</div>
        <div style="margin-top:12px;font-size:.72rem;opacity:.5;font-family:var(--font-mono)">${r.formula}</div>
      </div>
      ${renderCorrosionVisual({title:'Componente API 579-1 FFS',actual:getVal('ffs_tact'),nominal:getVal('ffs_tnom'),minimum:getVal('ffs_tmin'),cr:getVal('ffs_CR'),location:'Zona de adelgazamiento uniforme'})}
      ${renderNormNote('FFS')}`;
  }

  function renderHeadResult(r) {
    if (r.error) return renderError(r.error);
    const d = r.design ?? r;
    return `
      <div class="result-box">
        <h3>ASME VIII Div.1 – Resultados Cabeza</h3>
        <div style="font-size:.8rem;color:rgba(255,255,255,.5);margin-bottom:10px">${Utils.escHtml(d.tipo)}</div>
        <div class="result-grid">
          <div class="result-item">
            <label>t diseño</label>
            <span class="val">${d.t_design_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>t mín + CA</label>
            <span class="val">${d.t_min_CA_mm.toFixed(3)}</span><span class="unit">mm</span>
          </div>
          <div class="result-item">
            <label>Tensión admisible S</label>
            <span class="val">${d.S_MPa.toFixed(1)}</span><span class="unit">MPa</span>
          </div>
          <div class="result-item">
            <label>Eficiencia junta E</label>
            <span class="val">${d.E_joint.toFixed(2)}</span>
          </div>
          ${d.L_crown_mm ? `<div class="result-item"><label>Radio corona L</label>
            <span class="val">${d.L_crown_mm.toFixed(1)}</span><span class="unit">mm</span></div>` : ''}
        </div>
        <div class="result-status ok">✅ Cálculo completado</div>
        ${d.warning ? `<div style="margin-top:10px;font-size:.78rem;color:#f0c060;opacity:.9">⚠ ${d.warning}</div>` : ''}
        <div style="margin-top:12px;font-size:.72rem;opacity:.5;font-family:var(--font-mono)">${d.formula}</div>
      </div>
      ${renderCorrosionVisual({title:`Cabeza ASME VIII – ${d.tipo}`,actual:null,nominal:d.t_min_CA_mm*1.25,minimum:d.t_min_CA_mm,cr:0,location:d.tipo})}
      ${renderNormNote('VIII')}`;
  }

  function renderError(msg) {
    return `<div class="alert alert-danger"><span class="alert-icon">❌</span><div><strong>Error:</strong> ${Utils.escHtml(msg)}</div></div>`;
  }

  function renderNormNote(norm) {
    const notes = {
      'B31.3': 'ASME B31.3-2018 §304.1.2 – Process Piping',
      'VIII' : 'ASME BPVC Sec.VIII Div.1-2019 UG-27',
      'API650': 'API 650-2013 §5.6 – Welded Tanks for Oil Storage',
      'FFS'  : 'API 579-1/ASME FFS-1 Parte 4 – Uniform Metal Loss',
    };
    return `<div style="margin-top:12px;font-size:.72rem;color:var(--c-text-muted);text-align:right">📖 ${notes[norm] || ''}</div>`;
  }

  function renderMaterialTable() {
    const mats = ThicknessCalc.getMaterials();
    const rows = mats.map(m => {
      const mat = ThicknessCalc.MATERIALS[m.key];
      const ranges = mat.tablaS.map(r => `${r[0]}–${r[1]}°C: <strong>${r[2]} MPa</strong>`).join(' | ');
      return `<tr>
        <td>${Utils.escHtml(m.key)}</td>
        <td>${Utils.escHtml(m.nombre)}</td>
        <td style="font-size:.78rem">${ranges}</td>
      </tr>`;
    }).join('');

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Especificación</th><th>Nombre</th><th>Tensión Admisible S (MPa) por Rango de Temperatura</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-xs text-muted mt-1">Fuente: ASME IID Tables 1A/1B. Valores orientativos – verificar edición vigente.</p>`;
  }

  /* ── Event binding ──────────────────────────────────────── */
  function _bindEvents(el) {
    // Tab navigation
    el.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        el.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        el.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('active', p.id === `tp-${currentTab}`);
        });
        document.getElementById('espResultPanel').innerHTML = renderEmptyResult();
      });
    });

    // Head type toggle
    el.querySelector('#head_tipo')?.addEventListener('change', e => {
      const isTori = e.target.value === 'tori';
      el.querySelector('#head_L').style.display = isTori ? 'block' : 'none';
      el.querySelector('#head_L_lbl').style.display = isTori ? 'block' : 'none';
    });

    // Calculate buttons
    el.querySelector('#b313_calcBtn')?.addEventListener('click', () => runB313(el));
    el.querySelector('#viii_calcBtn')?.addEventListener('click', () => runVIIIShell(el));
    el.querySelector('#head_calcBtn')?.addEventListener('click', () => runHeads(el));
    el.querySelector('#tk_calcBtn')?.addEventListener('click', () => runAPI653(el));
    el.querySelector('#ffs_calcBtn')?.addEventListener('click', () => runFFS(el));

    // Clear
    el.querySelector('#esp-clearBtn')?.addEventListener('click', () => {
      el.querySelectorAll('input[type="number"]').forEach(i => {
        if (!['b313_CA','b313_W','b313_mill','viii_CA','head_CA','tk_CA','tk_G','ffs_RSFa','ffs_fut'].includes(i.id)) {
          i.value = '';
        }
      });
      document.getElementById('espResultPanel').innerHTML = renderEmptyResult();
      lastResult = null;
    });

    // Report
    el.querySelector('#esp-reportBtn')?.addEventListener('click', () => {
      if (!lastResult) { Utils.toast('Sin resultados','Realice un cálculo primero.','warning'); return; }
      Utils.toast('Reporte','Para imprimir use Ctrl+P.','info');
      window.print();
    });

    // Material ref toggle
    el.querySelector('#toggleMatRef')?.addEventListener('click', () => {
      const body = document.getElementById('matRefBody');
      const btn  = document.getElementById('toggleMatRef');
      const vis  = body.style.display !== 'none';
      body.style.display = vis ? 'none' : 'block';
      btn.textContent = vis ? 'Ver tabla' : 'Ocultar';
    });
  }

  /* ── Calculation runners ────────────────────────────────── */
  function getVal(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : NaN;
  }
  function getStr(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function runB313(el) {
    const P  = getVal('b313_P');
    const T  = getVal('b313_T');
    const OD = getVal('b313_OD');
    if (isNaN(P) || isNaN(T) || isNaN(OD)) {
      Utils.toast('Campos requeridos','Complete Presión, Temperatura y OD.','error'); return;
    }
    const params = {
      P_kPa: P, temp_C: T, OD_mm: OD,
      material:    getStr('b313_mat'),
      E_joint:     getVal('b313_E'),
      W:           getVal('b313_W') || 1.0,
      CA_mm:       getVal('b313_CA') || 0,
      mill_tol_pct: getVal('b313_mill') || 12.5,
      t_measured_mm: isNaN(getVal('b313_tact')) ? undefined : getVal('b313_tact'),
      CR_mmpa:     getVal('b313_CR') || 0,
    };
    const r = ThicknessCalc.fullAssessment('B313', params, null);
    lastResult = r;
    document.getElementById('espResultPanel').innerHTML = renderB313Result(r);
    Utils.toast('Cálculo completado','ASME B31.3 procesado.','success', 2500);
  }

  function runVIIIShell(el) {
    const P  = getVal('viii_P');
    const T  = getVal('viii_T');
    const ID = getVal('viii_ID');
    if (isNaN(P) || isNaN(T) || isNaN(ID)) {
      Utils.toast('Campos requeridos','Complete Presión, Temperatura y ID.','error'); return;
    }
    const tact = getVal('viii_tact');
    const CR   = getVal('viii_CR') || 0;
    const params = {
      P_kPa: P, temp_C: T, ID_mm: ID,
      material: getStr('viii_mat'),
      E_joint:  getVal('viii_E'),
      CA_mm:    getVal('viii_CA') || 0,
      t_actual_mm: isNaN(tact) ? undefined : tact,
      CR_mmpa: CR,
    };
    const r = ThicknessCalc.fullAssessment('VIII_shell', params, null);
    lastResult = r;
    document.getElementById('espResultPanel').innerHTML = renderVIIIResult(r);
    Utils.toast('Cálculo completado','ASME VIII Div.1 procesado.','success', 2500);
  }

  function runHeads(el) {
    const tipo = getStr('head_tipo');
    const P  = getVal('head_P');
    const T  = getVal('head_T');
    const ID = getVal('head_ID');
    if (isNaN(P) || isNaN(T) || isNaN(ID)) {
      Utils.toast('Campos requeridos','Complete Presión, Temperatura y ID.','error'); return;
    }
    const params = {
      P_kPa: P, temp_C: T, ID_mm: ID,
      material: getStr('head_mat'),
      E_joint: getVal('head_E'),
      CA_mm: getVal('head_CA') || 0,
      L_crown_mm: tipo === 'tori' ? (getVal('head_L') || ID) : undefined,
    };
    const typeMap = { hemi:'VIII_hemi', ellip:'VIII_ellip', tori:'VIII_tori' };
    const r = ThicknessCalc.fullAssessment(typeMap[tipo], params, null);
    lastResult = r;
    // Heads return design directly (no ffs wrapper in fullAssessment for these)
    const disp = r.design ?? r;
    document.getElementById('espResultPanel').innerHTML = renderHeadResult({ design: disp });
    Utils.toast('Cálculo completado','ASME VIII Div.1 cabeza procesada.','success', 2500);
  }

  function runAPI653(el) {
    const D    = getVal('tk_D');
    const H    = getVal('tk_H');
    const SMYS = getVal('tk_SMYS');
    if (isNaN(D) || isNaN(H) || isNaN(SMYS)) {
      Utils.toast('Campos requeridos','Complete D, H y SMYS.','error'); return;
    }
    const params = {
      D_m: D, H_m: H,
      G: getVal('tk_G') || 1.0,
      SMYS_MPa: SMYS,
      UTS_MPa: isNaN(getVal('tk_UTS')) ? undefined : getVal('tk_UTS'),
      CA_mm: getVal('tk_CA') || 0,
    };
    const r = ThicknessCalc.calcAPI650(params);
    lastResult = r;
    document.getElementById('espResultPanel').innerHTML = renderAPI653Result(r);
    Utils.toast('Cálculo completado','API 650-2013 procesado.','success', 2500);
  }

  function runFFS(el) {
    const tnom = getVal('ffs_tnom');
    const tact = getVal('ffs_tact');
    const tmin = getVal('ffs_tmin');
    const CR   = getVal('ffs_CR');
    if (isNaN(tnom) || isNaN(tact) || isNaN(tmin)) {
      Utils.toast('Campos requeridos','Complete t_nominal, t_actual y t_min.','error'); return;
    }
    if (isNaN(CR)) {
      Utils.toast('Campo requerido','Ingrese la tasa de corrosión CR.','error'); return;
    }
    const params = {
      t_nominal_mm: tnom,
      t_actual_mm: tact,
      t_min_mm: tmin,
      CR_mmpa: CR,
      RSF_a: getVal('ffs_RSFa') || 0.90,
      future_inspect_a: getVal('ffs_fut') || 0,
    };
    const r = ThicknessCalc.calcFFS_thinning(params);
    lastResult = r;
    document.getElementById('espResultPanel').innerHTML = renderFFSResult(r);
    Utils.toast('Evaluación FFS completada','API 579-1 Parte 4.','success', 2500);
  }

  /* ── Visual corrosion section for thickness calculations ── */
  function renderCorrosionVisual({ title='Componente', actual=null, nominal=null, minimum=null, cr=0, location='Punto de cálculo' }={}) {
    const n = Number(nominal);
    const a = Number(actual);
    const m = Number(minimum);
    const actualValid = Number.isFinite(a) && a > 0;
    const nominalValid = Number.isFinite(n) && n > 0;
    const loss = actualValid && nominalValid ? Utils.clamp((n-a)/n*100, 0, 100) : 0;
    const minLoss = m > 0 && actualValid ? Utils.clamp((m-a)/(m || 1)*100, -100, 100) : 0;
    const below = m > 0 && actualValid && a < m;
    const patch = 70 + loss*1.15;
    const opacity = actualValid ? 0.25 + loss/100*0.75 : 0;

    return `
      <div class="card mt-2" style="background:var(--c-surface-2)">
        <div class="card-header" style="padding:10px 14px">
          <h3 style="font-size:.9rem">🔴 Vista gráfica de corrosión – ${Utils.escHtml(title)}</h3>
          <span class="badge ${below?'badge-danger':'badge-muted'}">${below?'Debajo de t_mín':'Espesor calculado'}</span>
        </div>
        <div class="card-body" style="padding:14px">
          <div style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px">
            <div style="text-align:center">
              <div class="text-xs font-bold mb-1">Vista frontal – 4 puntos de medición</div>
              <svg viewBox="0 0 220 190" width="220" height="190" style="max-width:100%" role="img">
                <defs>
                  <radialGradient id="calcPipe" cx="35%" cy="28%"><stop offset="0" stop-color="#dbe6ef"/><stop offset="1" stop-color="#708090"/></radialGradient>
                </defs>
                <circle cx="110" cy="95" r="74" fill="url(#calcPipe)" stroke="#526270" stroke-width="3"/>
                <circle cx="110" cy="95" r="46" fill="#f7fafc" stroke="#526270" stroke-width="3"/>
                <path d="M110 169 A74 74 0 0 1 38 67" fill="none" stroke="#dc2626" stroke-width="${10+loss*.22}" stroke-linecap="round" opacity="${opacity}"/>
                <g fill="#dc2626" stroke="#fff" stroke-width="2">
                  <circle cx="110" cy="21" r="7"/><circle cx="184" cy="95" r="7"/>
                  <circle cx="110" cy="169" r="7"/><circle cx="36" cy="95" r="7"/>
                </g>
                <g fill="#334155" font-size="9" font-weight="700">
                  <text x="110" y="10" text-anchor="middle">P1</text><text x="194" y="98">P2</text>
                  <text x="110" y="187" text-anchor="middle">P3</text><text x="16" y="98">P4</text>
                </g>
                <text x="110" y="91" text-anchor="middle" fill="#334155" font-size="12" font-weight="700">t = ${actualValid?a.toFixed(2)+' mm':(nominalValid?n.toFixed(2)+' mm':'—')}</text>
                <text x="110" y="108" text-anchor="middle" fill="#dc2626" font-size="11" font-weight="700">${loss.toFixed(1)}% pérdida</text>
                <text x="110" y="184" text-anchor="middle" fill="#64748b" font-size="10">${Utils.escHtml(location)}</text>
              </svg>
            </div>
            <div style="text-align:center">
              <div class="text-xs font-bold mb-1">Vista lateral – Zona extensa de corrosión</div>
              <svg viewBox="0 0 300 190" width="300" height="190" style="max-width:100%" role="img">
                <defs><linearGradient id="calcSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f8"/><stop offset=".5" stop-color="#9cabb7"/><stop offset="1" stop-color="#667786"/></linearGradient></defs>
                <rect x="28" y="47" width="244" height="96" rx="2" fill="url(#calcSide)" stroke="#526270" stroke-width="3"/>
                <rect x="28" y="47" width="244" height="16" rx="2" fill="#eff6fa" opacity=".8"/>
                <g opacity="${opacity}">
                  <rect x="78" y="136" width="${Math.max(patch, 95)}" height="15" rx="7" fill="#991b1b"/>
                  <rect x="${86+loss*.2}" y="142" width="${Math.max(patch*.92,82)}" height="${10+loss*.28}" rx="5" fill="#dc2626"/>
                  <path d="M84 136 C105 128 128 145 150 136 C174 127 198 145 222 136" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
                  <circle cx="104" cy="142" r="5" fill="#7f1d1d"/><circle cx="138" cy="139" r="7" fill="#7f1d1d"/>
                  <circle cx="178" cy="142" r="4" fill="#7f1d1d"/><circle cx="208" cy="138" r="6" fill="#7f1d1d"/>
                </g>
                <line x1="78" y1="136" x2="78" y2="174" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
                <line x1="222" y1="136" x2="222" y2="174" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
                <text x="150" y="184" text-anchor="middle" fill="#dc2626" font-size="11" font-weight="700">Zona extensa de corrosión</text>
              </svg>
            </div>
          </div>
          <div style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-top:8px" class="text-xs">
            <span><strong>Actual:</strong> ${actualValid?a.toFixed(2)+' mm':'—'}</span>
            <span><strong>Nominal:</strong> ${nominalValid?n.toFixed(2)+' mm':'—'}</span>
            <span><strong>t_mín:</strong> ${m>0?m.toFixed(2)+' mm':'—'}</span>
            <span><strong>Tasa CR:</strong> ${cr>0?Number(cr).toFixed(4)+' mm/a':'No ingresada'}</span>
            ${actualValid && m>0 ? `<span><strong>Margen:</strong> ${(a-m).toFixed(2)} mm</span>`:''}
          </div>
          <div class="text-xs text-muted mt-2" style="text-align:center">🔴 La zona roja representa la pérdida relativa de metal. Es una representación visual preliminar.</div>
        </div>
      </div>`;
  }

  return { render };
})();
