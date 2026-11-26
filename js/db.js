/**
 * SGIEE – Data Layer (LocalStorage-backed)
 * All collections: equipos, cmls, mediciones, inspecciones, isometricos, rbi_evaluaciones, planes
 */
const DB = (() => {
  const PREFIX = 'sgiee_';
  const STORES = ['equipos','cmls','mediciones','inspecciones','isometricos','rbi_evaluaciones','planes'];

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    STORES.forEach(s => {
      if (!localStorage.getItem(PREFIX + s)) {
        localStorage.setItem(PREFIX + s, JSON.stringify([]));
      }
    });
    _seedIfEmpty();
  }

  // ── Core CRUD ─────────────────────────────────────────────────
  function getAll(store) {
    return JSON.parse(localStorage.getItem(PREFIX + store) || '[]');
  }

  function getById(store, id) {
    return getAll(store).find(r => r.id === id) || null;
  }

  function insert(store, record) {
    const list = getAll(store);
    record.id = record.id || _uid();
    record._createdAt = record._createdAt || new Date().toISOString();
    record._updatedAt = new Date().toISOString();
    list.push(record);
    _save(store, list);
    return record;
  }

  function update(store, id, patch) {
    const list = getAll(store);
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, _updatedAt: new Date().toISOString() };
    _save(store, list);
    return list[idx];
  }

  function remove(store, id) {
    const list = getAll(store).filter(r => r.id !== id);
    _save(store, list);
  }

  function query(store, filterFn) {
    return getAll(store).filter(filterFn);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _save(store, data) {
    localStorage.setItem(PREFIX + store, JSON.stringify(data));
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Seed data ─────────────────────────────────────────────────
  function _seedIfEmpty() {
    if (getAll('equipos').length > 0) return;

    const equiposSeed = [
      {
        id: 'EQ-001', tag: 'V-101', nombre: 'Separador de Gas', tipo: 'Vasija a Presión',
        planta: 'Tren A', sistema: 'Separación', fluido: 'Gas/Condensado',
        material: 'SA-516-70', diametro_mm: 1200, longitud_mm: 4000,
        presion_diseno_kPa: 2500, temp_diseno_C: 120,
        espesor_nominal_mm: 14, espesor_minimo_mm: 7.2, ca_mm: 3.0,
        fecha_fabricacion: '2010-06-15', fecha_instalacion: '2011-03-01',
        estado: 'Activo', criticidad: 'Alta', norma_diseno: 'ASME VIII Div.1',
        notas: 'Incluye separador ciclónico interno'
      },
      {
        id: 'EQ-002', tag: 'P-201A', nombre: 'Línea de Proceso Principal', tipo: 'Tubería a Presión',
        planta: 'Tren A', sistema: 'Transferencia', fluido: 'Crudo',
        material: 'API 5L Gr.B', diametro_mm: 150, longitud_mm: 1200,
        presion_diseno_kPa: 4000, temp_diseno_C: 80,
        espesor_nominal_mm: 7.1, espesor_minimo_mm: 3.9, ca_mm: 1.5,
        fecha_fabricacion: '2010-06-15', fecha_instalacion: '2011-03-01',
        estado: 'Activo', criticidad: 'Media', norma_diseno: 'ASME B31.3',
        notas: 'NPS 6" Schedule 40'
      },
      {
        id: 'EQ-003', tag: 'E-301', nombre: 'Intercambiador de Calor', tipo: 'Intercambiador',
        planta: 'Tren B', sistema: 'Precalentamiento', fluido: 'Condensado / Vapor',
        material: 'SA-516-60', diametro_mm: 600, longitud_mm: 3000,
        presion_diseno_kPa: 1800, temp_diseno_C: 200,
        espesor_nominal_mm: 10, espesor_minimo_mm: 5.5, ca_mm: 2.5,
        fecha_fabricacion: '2015-02-10', fecha_instalacion: '2015-09-01',
        estado: 'Activo', criticidad: 'Alta', norma_diseno: 'ASME VIII Div.1',
        notas: 'TEMA tipo AEL'
      },
      {
        id: 'EQ-004', tag: 'TK-401', nombre: 'Tanque de Almacenamiento', tipo: 'Tanque Atmosférico',
        planta: 'Almacenamiento', sistema: 'Almacenamiento', fluido: 'Crudo Estabilizado',
        material: 'A-36', diametro_mm: 12000, longitud_mm: 8000,
        presion_diseno_kPa: 10, temp_diseno_C: 65,
        espesor_nominal_mm: 8, espesor_minimo_mm: 2.5, ca_mm: 1.5,
        fecha_fabricacion: '2008-04-20', fecha_instalacion: '2008-11-01',
        estado: 'Activo', criticidad: 'Alta', norma_diseno: 'API 650',
        notas: 'Fondo cónico con drenaje central'
      },
      {
        id: 'EQ-005', tag: 'D-501', nombre: 'Acumulador de Condensado', tipo: 'Vasija a Presión',
        planta: 'Tren B', sistema: 'Condensados', fluido: 'Condensado de Gas',
        material: 'SA-516-70', diametro_mm: 800, longitud_mm: 2400,
        presion_diseno_kPa: 1200, temp_diseno_C: 90,
        espesor_nominal_mm: 10, espesor_minimo_mm: 5.8, ca_mm: 2.0,
        fecha_fabricacion: '2015-02-10', fecha_instalacion: '2015-09-01',
        estado: 'Inactivo', criticidad: 'Media', norma_diseno: 'ASME VIII Div.1',
        notas: 'En mantenimiento programado'
      }
    ];

    const cmlsSeed = [
      { id:'CML-001', equipo_id:'EQ-001', nombre:'CML-N1', descripcion:'Cabeza superior', ubicacion:'0°/90°', activo:true },
      { id:'CML-002', equipo_id:'EQ-001', nombre:'CML-N2', descripcion:'Cuerpo zona E', ubicacion:'0°/180°', activo:true },
      { id:'CML-003', equipo_id:'EQ-001', nombre:'CML-N3', descripcion:'Cabeza inferior', ubicacion:'0°/270°', activo:true },
      { id:'CML-004', equipo_id:'EQ-002', nombre:'CML-P1', descripcion:'Codo entrada 6"', ubicacion:'Km 0+5', activo:true },
      { id:'CML-005', equipo_id:'EQ-002', nombre:'CML-P2', descripcion:'Tramo recto', ubicacion:'Km 1+2', activo:true },
      { id:'CML-006', equipo_id:'EQ-003', nombre:'CML-E1', descripcion:'Cabeza flotante', ubicacion:'Shell side', activo:true },
      { id:'CML-007', equipo_id:'EQ-004', nombre:'CML-T1', descripcion:'Fondo anular', ubicacion:'Radio ext', activo:true },
      { id:'CML-008', equipo_id:'EQ-004', nombre:'CML-T2', descripcion:'Primera virola', ubicacion:'N-S-E-O', activo:true },
    ];

    const medicionesSeed = [
      {id:'M-001',cml_id:'CML-001',equipo_id:'EQ-001',fecha:'2020-03-10',espesor_mm:13.8,metodo:'UT-A',tecnico:'López J.',notas:''},
      {id:'M-002',cml_id:'CML-001',equipo_id:'EQ-001',fecha:'2022-04-15',espesor_mm:13.1,metodo:'UT-A',tecnico:'Martínez R.',notas:''},
      {id:'M-003',cml_id:'CML-001',equipo_id:'EQ-001',fecha:'2024-05-20',espesor_mm:12.4,metodo:'UT-A',tecnico:'López J.',notas:'Leve pitting zona 3'},
      {id:'M-004',cml_id:'CML-002',equipo_id:'EQ-001',fecha:'2020-03-10',espesor_mm:13.9,metodo:'UT-A',tecnico:'López J.',notas:''},
      {id:'M-005',cml_id:'CML-002',equipo_id:'EQ-001',fecha:'2022-04-15',espesor_mm:13.5,metodo:'UT-A',tecnico:'Martínez R.',notas:''},
      {id:'M-006',cml_id:'CML-002',equipo_id:'EQ-001',fecha:'2024-05-20',espesor_mm:13.2,metodo:'UT-A',tecnico:'López J.',notas:''},
      {id:'M-007',cml_id:'CML-004',equipo_id:'EQ-002',fecha:'2021-06-10',espesor_mm:6.8,metodo:'UT-B',tecnico:'García P.',notas:''},
      {id:'M-008',cml_id:'CML-004',equipo_id:'EQ-002',fecha:'2023-07-25',espesor_mm:6.1,metodo:'UT-B',tecnico:'García P.',notas:'Erosión visible'},
      {id:'M-009',cml_id:'CML-007',equipo_id:'EQ-004',fecha:'2019-11-01',espesor_mm:7.6,metodo:'UT-A',tecnico:'Rodríguez L.',notas:''},
      {id:'M-010',cml_id:'CML-007',equipo_id:'EQ-004',fecha:'2022-11-15',espesor_mm:6.9,metodo:'UT-A',tecnico:'Rodríguez L.',notas:''},
    ];

    const inspeccionesSeed = [
      {id:'INS-001',equipo_id:'EQ-001',fecha:'2024-05-20',tipo:'Interna',resultado:'Satisfactorio',
       hallazgos:'Leve pitting en zona E cabeza superior',recomendaciones:'Monitorear CML-N1',
       tecnico:'López J.',proxima_fecha:'2027-05-20',estado:'Cerrada'},
      {id:'INS-002',equipo_id:'EQ-002',fecha:'2023-07-25',tipo:'Externa',resultado:'Atención Requerida',
       hallazgos:'Erosión en codo entrada, espesor crítico',recomendaciones:'Remplazar codo en próxima parada',
       tecnico:'García P.',proxima_fecha:'2025-01-25',estado:'Cerrada'},
      {id:'INS-003',equipo_id:'EQ-003',fecha:'2023-09-10',tipo:'Visual',resultado:'Satisfactorio',
       hallazgos:'Sin anomalías detectadas',recomendaciones:'Mantener intervalo programado',
       tecnico:'Martínez R.',proxima_fecha:'2026-09-10',estado:'Cerrada'},
      {id:'INS-004',equipo_id:'EQ-004',fecha:'2022-11-15',tipo:'Fondo',resultado:'Atención Requerida',
       hallazgos:'Corrosión uniforme en fondo, zona anular con adelgazamiento',
       recomendaciones:'Evaluar RBI para ajustar próxima inspección',
       tecnico:'Rodríguez L.',proxima_fecha:'2025-05-15',estado:'Abierta'},
    ];

    const rbiSeed = [
      {
        id:'RBI-001', equipo_id:'EQ-001', fecha_evaluacion:'2024-06-01',
        mecanismo:'Corrosión interna uniforme',
        tasa_corrosion_mmpa:0.35, espesor_actual_mm:12.4, espesor_minimo_mm:7.2,
        vida_remanente_a:14.9, pof_categoria:2, pof_valor:'Baja',
        cof_categoria:4, cof_valor:'Alta',
        riesgo_categoria:'Medio-Alto', riesgo_color:'high',
        consecuencia_entrada:'Alta', intervalo_inspeccion_a:3,
        proxima_inspeccion:'2027-06-01', estado:'Vigente', notas:''
      },
      {
        id:'RBI-002', equipo_id:'EQ-002', fecha_evaluacion:'2024-01-15',
        mecanismo:'Erosión-Corrosión en codo',
        tasa_corrosion_mmpa:0.7, espesor_actual_mm:6.1, espesor_minimo_mm:3.9,
        vida_remanente_a:3.1, pof_categoria:4, pof_valor:'Alta',
        cof_categoria:3, cof_valor:'Media',
        riesgo_categoria:'Alto', riesgo_color:'vhigh',
        consecuencia_entrada:'Media', intervalo_inspeccion_a:1,
        proxima_inspeccion:'2025-01-15', estado:'Vigente', notas:'Reemplazar codo en parada 2025'
      },
    ];

    equiposSeed.forEach(e => { e._createdAt = e._updatedAt = new Date().toISOString(); insert('equipos', e); });
    cmlsSeed.forEach(c => { c._createdAt = c._updatedAt = new Date().toISOString(); insert('cmls', c); });
    medicionesSeed.forEach(m => { m._createdAt = m._updatedAt = new Date().toISOString(); insert('mediciones', m); });
    inspeccionesSeed.forEach(i => { i._createdAt = i._updatedAt = new Date().toISOString(); insert('inspecciones', i); });
    rbiSeed.forEach(r => { r._createdAt = r._updatedAt = new Date().toISOString(); insert('rbi_evaluaciones', r); });
  }

  // ── Computed helpers ──────────────────────────────────────────
  /**
   * Returns last measurement for a CML
   */
  function lastMedicion(cml_id) {
    return getAll('mediciones')
      .filter(m => m.cml_id === cml_id)
      .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
  }

  /**
   * Calculates corrosion rate (mm/yr) for a CML from its measurement history
   * Uses linear regression over all readings.
   */
  function calcCorrosionRate(cml_id) {
    const meds = getAll('mediciones')
      .filter(m => m.cml_id === cml_id)
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    if (meds.length < 2) return null;

    // Simple: (first - last) / years
    const first = meds[0];
    const last  = meds[meds.length - 1];
    const years = (new Date(last.fecha) - new Date(first.fecha)) / (365.25 * 24 * 3600 * 1000);
    if (years <= 0) return null;
    return (first.espesor_mm - last.espesor_mm) / years;
  }

  /**
   * Remaining life in years for a CML
   */
  function remainingLife(cml_id, t_min_mm) {
    const rate = calcCorrosionRate(cml_id);
    const last = lastMedicion(cml_id);
    if (!rate || !last || rate <= 0) return Infinity;
    return (last.espesor_mm - t_min_mm) / rate;
  }

  /**
   * Next inspection date based on CBM half-life rule (API 510 / 570)
   */
  function nextInspectionCBM(cml_id, t_min_mm) {
    const rl = remainingLife(cml_id, t_min_mm);
    if (rl === Infinity) return null;
    return rl / 2;   // years to next inspection
  }

  /**
   * Aggregate stats for dashboard
   */
  function dashboardStats() {
    const equipos   = getAll('equipos');
    const cmls      = getAll('cmls');
    const insp      = getAll('inspecciones');
    const rbis      = getAll('rbi_evaluaciones');
    const planes    = getAll('planes');

    const hoy = new Date();
    const vencidas = insp.filter(i => i.proxima_fecha && new Date(i.proxima_fecha) < hoy && i.estado !== 'Cancelada');
    const proximas = insp.filter(i => {
      if (!i.proxima_fecha) return false;
      const d = new Date(i.proxima_fecha);
      const diff = (d - hoy) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 90;
    });
    const rbi_alto = rbis.filter(r => ['high','vhigh'].includes(r.riesgo_color));

    return {
      total_equipos:  equipos.length,
      equipos_activos: equipos.filter(e => e.estado === 'Activo').length,
      total_cmls:     cmls.length,
      insp_vencidas:  vencidas.length,
      insp_proximas:  proximas.length,
      rbi_alto:       rbi_alto.length,
      total_planes:   planes.length,
    };
  }

  return {
    init, getAll, getById, insert, update, remove, query,
    lastMedicion, calcCorrosionRate, remainingLife, nextInspectionCBM,
    dashboardStats,
  };
})();
