/**
 * SGIEE – Minimum Thickness Calculator Engine
 *
 * Covers:
 *  1. ASME B31.3  – Process Piping (cylindrical pipe, straight + bends)
 *  2. ASME VIII Div.1 – Pressure Vessels (cylindrical shell, hemispherical/ellipsoidal/flat heads)
 *  3. API 650    – Storage Tank Shell courses
 *  4. API 579-1  – FFS Level 1 Remaining Strength Factor (thinning assessment)
 *
 * All inputs in SI: pressure [kPa], dimensions [mm], temperature [°C]
 * All outputs in [mm] unless stated.
 *
 * References:
 *  - ASME B31.3-2020 §304.1.2
 *  - ASME BPVC Sec.VIII Div.1-2021 UG-27, UG-32
 *  - API 653-2014 §4.4
 *  - API 579-1/ASME FFS-1-2021 Part 4
 */
const ThicknessCalc = (() => {

  /* ═══════════════════════════════════════════════════════════
     MATERIAL DATABASE  (allowable stress S in MPa)
     Values from ASME IID Table 1A/1B – most common grades
     at temperature ranges (°C): [min, max, S_MPa]
     ═══════════════════════════════════════════════════════════ */
  const MATERIALS = {
    'SA-516-70':  { nombre:'SA-516-70 (CS HT)',   E_MPa:200000, tablaS:[[-30,250,138],[251,300,138],[301,370,131],[371,425,117]] },
    'SA-516-60':  { nombre:'SA-516-60 (CS)',       E_MPa:200000, tablaS:[[-30,250,124],[251,300,124],[301,370,117],[371,425,103]] },
    'SA-516-55':  { nombre:'SA-516-55 (CS)',       E_MPa:200000, tablaS:[[-30,250,117],[251,300,117],[301,370,110],[371,425, 96]] },
    'SA-285-C':   { nombre:'SA-285-C (CS)',        E_MPa:200000, tablaS:[[-30,250,107],[251,300,107],[301,345, 97]] },
    'A-36':       { nombre:'A-36 (Structural CS)', E_MPa:200000, tablaS:[[-30,250,138],[251,300,138],[301,370,131]] },
    'SA-312-TP304':{ nombre:'SA-312 TP304 (SS)',   E_MPa:195000, tablaS:[[-30,250,138],[251,300,131],[301,370,120],[371,450,110]] },
    'SA-312-TP316':{ nombre:'SA-312 TP316 (SS)',   E_MPa:195000, tablaS:[[-30,250,138],[251,300,135],[301,370,124],[371,450,114]] },
    'SA-312-TP321':{ nombre:'SA-312 TP321 (SS)',   E_MPa:195000, tablaS:[[-30,250,138],[251,300,131],[301,370,122],[371,450,112]] },
    'SA-240-304': { nombre:'SA-240 Gr.304 (SS Plate)',E_MPa:195000,tablaS:[[-30,250,138],[251,300,131],[301,370,120],[371,450,110]] },
    'API 5L Gr.B':{ nombre:'API 5L Gr.B (Pipe)',   E_MPa:207000, tablaS:[[-30,250,138],[251,315,138],[316,370,131]] },
    'API 5L X42': { nombre:'API 5L X42 (Pipe)',    E_MPa:207000, tablaS:[[-30,250,165],[251,315,165],[316,370,152]] },
    'API 5L X52': { nombre:'API 5L X52 (Pipe)',    E_MPa:207000, tablaS:[[-30,250,207],[251,315,207],[316,370,186]] },
    'API 5L X65': { nombre:'API 5L X65 (Pipe)',    E_MPa:207000, tablaS:[[-30,250,255],[251,315,255],[316,370,228]] },
    'SA-106-B':   { nombre:'SA-106-B (Seamless Pipe)',E_MPa:200000,tablaS:[[-30,250,117],[251,300,117],[301,370,110],[371,425, 97]] },
    'SA-335-P11': { nombre:'SA-335 P11 (Cr-Mo)',   E_MPa:198000, tablaS:[[-30,250,124],[251,300,124],[301,370,120],[371,425,117],[426,480,110]] },
    'SA-387-11':  { nombre:'SA-387 Gr.11 (Cr-Mo Plate)',E_MPa:198000,tablaS:[[-30,250,138],[251,300,138],[301,370,138],[371,425,134],[426,480,124]] },
  };

  /* ═══════════════════════════════════════════════════════════
     NPS / Schedule lookup (nominal → OD mm, t mm)
     Source: ASME B36.10M
     ═══════════════════════════════════════════════════════════ */
  const PIPE_SCHEDULES = {
    '0.5-40':  { od:21.3,  t:2.77 }, '0.5-80':  { od:21.3,  t:3.73 },
    '0.75-40': { od:26.7,  t:2.87 }, '0.75-80': { od:26.7,  t:3.91 },
    '1-40':    { od:33.4,  t:3.38 }, '1-80':    { od:33.4,  t:4.55 },
    '1.5-40':  { od:48.3,  t:3.68 }, '1.5-80':  { od:48.3,  t:5.08 },
    '2-40':    { od:60.3,  t:3.91 }, '2-80':    { od:60.3,  t:5.54 },
    '2.5-40':  { od:73.0,  t:5.16 }, '2.5-80':  { od:73.0,  t:7.01 },
    '3-40':    { od:88.9,  t:5.49 }, '3-80':    { od:88.9,  t:7.62 },
    '4-40':    { od:114.3, t:6.02 }, '4-80':    { od:114.3, t:8.56 },
    '6-40':    { od:168.3, t:7.11 }, '6-80':    { od:168.3, t:10.97},
    '8-40':    { od:219.1, t:8.18 }, '8-80':    { od:219.1, t:12.70},
    '10-40':   { od:273.1, t:9.27 }, '10-80':   { od:273.1, t:15.09},
    '12-40':   { od:323.9, t:9.53 }, '12-80':   { od:323.9, t:17.48},
    '14-40':   { od:355.6, t:9.53 }, '14-80':   { od:355.6, t:19.05},
    '16-40':   { od:406.4, t:9.53 }, '16-80':   { od:406.4, t:21.44},
    '18-40':   { od:457.2, t:9.53 }, '18-80':   { od:457.2, t:23.83},
    '20-40':   { od:508.0, t:9.53 }, '20-80':   { od:508.0, t:26.19},
    '24-40':   { od:609.6, t:9.53 }, '24-80':   { od:609.6, t:30.96},
  };

  /* ═══════════════════════════════════════════════════════════
     JOINT EFFICIENCY  E (ASME VIII Div.1 Table UW-12)
     ═══════════════════════════════════════════════════════════ */
  const JOINT_EFF = {
    'Full RT (Type 1)': 1.00,
    'Spot RT (Type 1)': 0.85,
    'No RT (Type 1)':   0.70,
    'No RT (Type 2)':   0.65,
    'No RT (Type 3)':   0.60,
    'Seamless':         1.00,
    'ERW':              0.85,
  };

  const STANDARDS = {
    'ASME B31.3': {
      edition: 'ASME B31.3-2018',
      file: 'ASME B31.3 (2018)(Inglés) (1).pdf',
      appliesTo: ['Tubería a Presión'],
      description: 'Diseño de tuberías de proceso a presión.'
    },
    'ASME VIII Div.1': {
      edition: 'ASME BPVC VIII Division 1-2019',
      file: 'ASME BPVC VIII Div1 (2019)(Inglés) (1).pdf',
      appliesTo: ['Vasija a Presión', 'Intercambiador', 'Caldera / Horno'],
      description: 'Diseño de recipientes a presión.'
    },
    'ASME II-D': {
      edition: 'ASME BPVC II-D-2019',
      file: 'ASME BPVC II D (2019)(Inglés) (1).pdf',
      appliesTo: ['Vasija a Presión', 'Intercambiador', 'Tubería a Presión', 'Tanque Atmosférico', 'Caldera / Horno'],
      description: 'Propiedades admisibles y datos de materiales.'
    },
    'API 650': {
      edition: 'API 650 12th Edition - 2013',
      file: 'API 650 (2013)(Inglés) (1).pdf',
      appliesTo: ['Tanque Atmosférico'],
      description: 'Diseño de tanques soldados de almacenamiento atmosférico.'
    }
  };

  /* ═══════════════════════════════════════════════════════════
     HELPER: get allowable stress at temperature
     ═══════════════════════════════════════════════════════════ */
  function getAllowableStress(material, temp_C) {
    const mat = MATERIALS[material];
    if (!mat) return null;
    for (const [tMin, tMax, S] of mat.tablaS) {
      if (temp_C >= tMin && temp_C <= tMax) return S;
    }
    // above last range → use last value with warning
    const last = mat.tablaS[mat.tablaS.length - 1];
    return { S: last[2], warning: `Temperatura ${temp_C}°C excede rango tabulado (${last[1]}°C). Verificar.` };
  }

  /* ═══════════════════════════════════════════════════════════
     1. ASME B31.3 – Tubería a Presión
        §304.1.2  Eq.(3a) thick wall, Eq.(3b) thin wall
        t = P·D / (2·(S·E·W + P·Y))
        where Y = coefficient (0.4 for ferritic < 482°C, 0.0 for austenitic)
     ═══════════════════════════════════════════════════════════ */
  function calcB313(params) {
    const { P_kPa, OD_mm, material, temp_C, E_joint, W = 1.0, CA_mm = 0, mill_tol_pct = 12.5 } = params;

    const P  = P_kPa / 1000;         // MPa
    const D  = OD_mm;                 // mm
    const SA = getAllowableStress(material, temp_C);

    if (!SA) return { error: 'Material no reconocido.' };
    const S_val   = typeof SA === 'object' ? SA.S   : SA;
    const warning = typeof SA === 'object' ? SA.warning : null;

    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);

    // Y coefficient (0.4 austenitic ≥ 482°C, else 0.4 ferritic below threshold)
    const isAustenitic = material.includes('304') || material.includes('316') || material.includes('321');
    const Y = (isAustenitic && temp_C >= 482) ? 0.0 : 0.4;

    // Minimum design thickness (§304.1.2 Eq.3a)
    const t_design = (P * D) / (2 * (S_val * E * W + P * Y));

    // Add CA and mill tolerance
    const t_min_CA = t_design + CA_mm;
    const mill_factor = 1 / (1 - mill_tol_pct / 100);
    const t_nominal_req = t_min_CA * mill_factor;

    // MAOP check: P_max = 2·S·E·W·(t - CA) / (D - 2·Y·(t - CA))
    // (useful for fitness-for-service)
    const t_meas = params.t_measured_mm;
    let MAOP = null, RL = null;
    if (t_meas !== undefined && CA_mm > 0 && params.CR_mmpa > 0) {
      const t_eff = t_meas - CA_mm;
      MAOP = (2 * S_val * E * W * t_eff) / (D - 2 * Y * t_eff) * 1000; // kPa
      RL = (t_meas - t_design - CA_mm) / params.CR_mmpa;
    }

    return {
      norm: 'ASME B31.3',
      P_MPa: P,
      S_MPa: S_val,
      E_joint: E,
      Y,
      t_design_mm: t_design,
      t_min_CA_mm: t_min_CA,
      t_nominal_req_mm: t_nominal_req,
      MAOP_kPa: MAOP,
      remaining_life_a: RL,
      warning,
      formula: 't = P·D / [2·(S·E·W + P·Y)]',
    };
  }

  /* ═══════════════════════════════════════════════════════════
     2a. ASME VIII Div.1 – Cilindro (Shell)
         UG-27(c)(1):  t = P·R / (S·E - 0.6·P)
         or            t = P·R / (S·E - 0.4·P)  for t ≥ 0.5R
     ═══════════════════════════════════════════════════════════ */
  function calcVIII_cylinder(params) {
    const { P_kPa, ID_mm, material, temp_C, E_joint, CA_mm = 0 } = params;

    const P = P_kPa / 1000;  // MPa
    const R = ID_mm / 2;     // mm

    const SA = getAllowableStress(material, temp_C);
    if (!SA) return { error: 'Material no reconocido.' };
    const S_val   = typeof SA === 'object' ? SA.S   : SA;
    const warning = typeof SA === 'object' ? SA.warning : null;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);

    // UG-27(c)(1) thin wall
    const t_design = (P * R) / (S_val * E - 0.6 * P);
    const t_min_CA = t_design + CA_mm;

    // MAWP from existing thickness
    let MAWP = null, RL = null;
    if (params.t_actual_mm !== undefined) {
      const t = params.t_actual_mm - CA_mm;
      MAWP = (S_val * E * t) / (R + 0.6 * t) * 1000; // kPa
    }
    if (params.CR_mmpa > 0 && params.t_actual_mm !== undefined) {
      RL = (params.t_actual_mm - t_design - CA_mm) / params.CR_mmpa;
    }

    // Hoop stress check
    const sigma_H = (P * R) / (params.t_actual_mm ?? t_min_CA);
    const eta = sigma_H / (S_val * E);  // utilisation

    return {
      norm: 'ASME VIII Div.1 – UG-27',
      tipo: 'Cuerpo cilíndrico',
      P_MPa: P,
      R_mm: R,
      S_MPa: S_val,
      E_joint: E,
      t_design_mm: t_design,
      t_min_CA_mm: t_min_CA,
      MAWP_kPa: MAWP,
      remaining_life_a: RL,
      eta_pct: eta * 100,
      warning,
      formula: 't = P·R / (S·E – 0.6·P)',
    };
  }

  /* ═══════════════════════════════════════════════════════════
     2b. ASME VIII Div.1 – Cabeza Hemisférica
         UG-27(d):  t = P·R / (2·S·E - 0.2·P)
     ═══════════════════════════════════════════════════════════ */
  function calcVIII_hemi(params) {
    const { P_kPa, ID_mm, material, temp_C, E_joint, CA_mm = 0 } = params;
    const P = P_kPa / 1000;
    const R = ID_mm / 2;
    const SA = getAllowableStress(material, temp_C);
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_design = (P * R) / (2 * S * E - 0.2 * P);
    return {
      norm: 'ASME VIII Div.1 – UG-27',
      tipo: 'Cabeza hemisférica',
      P_MPa: P, S_MPa: S, E_joint: E,
      t_design_mm: t_design,
      t_min_CA_mm: t_design + CA_mm,
      formula: 't = P·R / (2·S·E – 0.2·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  /* ═══════════════════════════════════════════════════════════
     2c. ASME VIII Div.1 – Cabeza Elipsoidal 2:1
         UG-32(d):  t = P·D / (2·S·E - 0.2·P)
     ═══════════════════════════════════════════════════════════ */
  function calcVIII_ellip(params) {
    const { P_kPa, ID_mm, material, temp_C, E_joint, CA_mm = 0 } = params;
    const P = P_kPa / 1000;
    const D = ID_mm;
    const SA = getAllowableStress(material, temp_C);
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_design = (P * D) / (2 * S * E - 0.2 * P);
    return {
      norm: 'ASME VIII Div.1 – UG-32',
      tipo: 'Cabeza elipsoidal 2:1',
      P_MPa: P, S_MPa: S, E_joint: E,
      t_design_mm: t_design,
      t_min_CA_mm: t_design + CA_mm,
      formula: 't = P·D / (2·S·E – 0.2·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  /* ═══════════════════════════════════════════════════════════
     2d. ASME VIII Div.1 – Cabeza Torisférica (Korbbogen)
         UG-32(e):  t = 0.885·P·L / (S·E - 0.1·P)
         L = crown radius (typically L = D for std flanged)
     ═══════════════════════════════════════════════════════════ */
  function calcVIII_tori(params) {
    const { P_kPa, ID_mm, L_crown_mm, material, temp_C, E_joint, CA_mm = 0 } = params;
    const P = P_kPa / 1000;
    const L = L_crown_mm || ID_mm;
    const SA = getAllowableStress(material, temp_C);
    if (!SA) return { error: 'Material no reconocido.' };
    const S = typeof SA === 'object' ? SA.S : SA;
    const E = typeof E_joint === 'number' ? E_joint : (JOINT_EFF[E_joint] ?? 1.0);
    const t_design = (0.885 * P * L) / (S * E - 0.1 * P);
    return {
      norm: 'ASME VIII Div.1 – UG-32',
      tipo: 'Cabeza torisférica',
      P_MPa: P, S_MPa: S, E_joint: E, L_crown_mm: L,
      t_design_mm: t_design,
      t_min_CA_mm: t_design + CA_mm,
      formula: 't = 0.885·P·L / (S·E – 0.1·P)',
      warning: typeof SA === 'object' ? SA.warning : null,
    };
  }

  /* ═══════════════════════════════════════════════════════════
     3. API 653 – Tank Shell Course
        §4.4.1  t_min = 4.9·D·(H - 0.3)·G / S_A
        where:
          D  = tank diameter [m]
          H  = height of liquid above course bottom [m]
          G  = design specific gravity
          S_A= allowable stress [MPa] = min(0.80·SMYS, 0.429·UTS) for hydro
     ═══════════════════════════════════════════════════════════ */
  function calcAPI653(params) {
    const { D_m, H_m, G = 1.0, SMYS_MPa, UTS_MPa, CA_mm = 0 } = params;

    // Allowable stress (design): 0.80 SMYS (§4.4.1)
    const S_A = 0.80 * SMYS_MPa;
    // Hydrostatic test: use 0.80 SMYS or 0.429 UTS whichever less
    const S_A_hydro = Math.min(0.80 * SMYS_MPa, (UTS_MPa ? 0.429 * UTS_MPa : S_A));

    if (H_m <= 0.3) return { error: 'Altura H debe ser > 0.3 m.' };

    const t_design    = (4.9 * D_m * (H_m - 0.3) * G) / S_A;
    const t_hydro     = (4.9 * D_m * (H_m - 0.3) * 1.0) / S_A_hydro;
    const t_min_CA    = t_design + CA_mm;

    return {
      norm: 'API 653 §4.4',
      tipo: 'Virola de tanque',
      S_A_MPa: S_A,
      S_A_hydro_MPa: S_A_hydro,
      t_design_mm: t_design,
      t_hydro_mm: t_hydro,
      t_min_CA_mm: t_min_CA,
      formula: 't = 4.9·D·(H–0.3)·G / S_A',
    };
  }

  /* ═══════════════════════════════════════════════════════════
     4. API 579-1 Part 4 – FFS Level 1 Uniform Thinning
        RSF = (t_mm - t_min) / t_nominal
        Acceptability: RSF ≥ RSF_a  (default 0.90 per API 579)
        t_lim = t_min + (1 - RSF_a)·t_nominal  → lower bound
     ═══════════════════════════════════════════════════════════ */
  function calcFFS_thinning(params) {
    const {
      t_nominal_mm,
      t_actual_mm,
      t_min_mm,            // minimum required thickness (from B31.3 or VIII)
      CR_mmpa = 0,         // corrosion rate mm/year
      RSF_a = 0.90,        // allowable RSF (default API 579 §4.4.3.1)
      future_inspect_a = 0 // future corrosion period to inspection
    } = params;

    const RSF = (t_actual_mm - t_min_mm) / t_nominal_mm;
    const acceptable = RSF >= RSF_a;

    // Future thickness at next inspection
    const t_future = t_actual_mm - CR_mmpa * future_inspect_a;
    const RSF_future = (t_future - t_min_mm) / t_nominal_mm;

    // Remaining life to RSF_a limit
    const t_lim = t_min_mm + (1 - RSF_a) * t_nominal_mm;
    const RL = CR_mmpa > 0 ? (t_actual_mm - t_lim) / CR_mmpa : Infinity;

    // Maximum inspection interval per CBM half-life (API 510/570)
    const max_interval = isFinite(RL) ? RL / 2 : null;

    return {
      norm: 'API 579-1 Parte 4 – FFS Nivel 1',
      RSF,
      RSF_a,
      acceptable,
      t_lim_mm: t_lim,
      remaining_life_a: RL,
      max_cbm_interval_a: max_interval,
      t_future_mm: t_future,
      RSF_future,
      nivel_ffs: acceptable ? 'ACEPTABLE' : 'NO ACEPTABLE',
      formula: 'RSF = (t_actual – t_min) / t_nominal ≥ RSF_a',
    };
  }

  /* ═══════════════════════════════════════════════════════════
     5. Combined: design + FFS in one call
     ═══════════════════════════════════════════════════════════ */
  function fullAssessment(tipo, designParams, ffsParams) {
    let design;
    switch (tipo) {
      case 'B313':        design = calcB313(designParams);         break;
      case 'VIII_shell':  design = calcVIII_cylinder(designParams); break;
      case 'VIII_hemi':   design = calcVIII_hemi(designParams);     break;
      case 'VIII_ellip':  design = calcVIII_ellip(designParams);    break;
      case 'VIII_tori':   design = calcVIII_tori(designParams);     break;
      case 'API653':      design = calcAPI653(designParams);        break;
      case 'API650':      design = calcAPI650(designParams);        break;
      default: return { error: 'Tipo de cálculo no reconocido.' };
    }
    if (design.error) return design;

    const t_min = design.t_min_CA_mm;
    const ffs = ffsParams ? calcFFS_thinning({ ...ffsParams, t_min_mm: t_min }) : null;

    return { design, ffs };
  }

  /* ═══════════════════════════════════════════════════════════
     6. Utility: list of materials
     ═══════════════════════════════════════════════════════════ */
  function getMaterials() {
    return Object.entries(MATERIALS).map(([key, v]) => ({ key, nombre: v.nombre }));
  }

  function getJointEfficiencies() {
    return Object.entries(JOINT_EFF).map(([k, v]) => ({ key: k, value: v }));
  }

  function getPipeSchedules() {
    return Object.entries(PIPE_SCHEDULES).map(([k, v]) => ({
      key: k, nps: k.split('-')[0], sch: k.split('-')[1],
      od_mm: v.od, t_mm: v.t
    }));
  }

  function getApplicableStandards(equipmentType) {
    return Object.entries(STANDARDS)
      .filter(([, standard]) => standard.appliesTo.includes(equipmentType))
      .map(([key, standard]) => ({ key, ...standard }));
  }

  function validateStandardForEquipment(equipmentType, standard) {
    const applicable = getApplicableStandards(equipmentType);
    return applicable.some(item => item.key === standard);
  }

  /* ═══════════════════════════════════════════════════════════
     7. Corrosion rate interpolation (linear regression)
        Returns CR in mm/yr
     ═══════════════════════════════════════════════════════════ */
  function corrosionRateFromReadings(readings) {
    // readings: [{fecha:'YYYY-MM-DD', espesor_mm: number}]
    if (!readings || readings.length < 2) return null;
    const pts = readings
      .map(r => ({ t: new Date(r.fecha).getTime(), e: r.espesor_mm }))
      .sort((a,b) => a.t - b.t);

    const n = pts.length;
    const sumX = pts.reduce((s,p) => s + p.t, 0);
    const sumY = pts.reduce((s,p) => s + p.e, 0);
    const sumXY = pts.reduce((s,p) => s + p.t * p.e, 0);
    const sumX2 = pts.reduce((s,p) => s + p.t * p.t, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    // slope is in mm/ms → convert to mm/yr
    const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
    return -slope * MS_PER_YEAR;   // negative slope = thinning
  }

  /* ═══════════════════════════════════════════════════════════
     API 650 – Tanques de almacenamiento atmosférico
     Base de cálculo de virolas: t = 4.9·D·(H–0.3)·G/S_d + CA
     Usar con los requisitos completos de API 650 Edición 2013.
     ═══════════════════════════════════════════════════════════ */
  function calcAPI650(params) {
    const { D_m, H_m, G = 1.0, SMYS_MPa, UTS_MPa, CA_mm = 0 } = params;

    if (!(D_m > 0) || !(H_m > 0.3)) {
      return { error: 'Se requiere diámetro D > 0 m y altura H > 0.3 m.' };
    }
    if (!(SMYS_MPa > 0)) {
      return { error: 'Se requiere la resistencia mínima de cedencia (SMYS) del material.' };
    }

    const S_d = 0.80 * SMYS_MPa;
    const S_hydro = UTS_MPa ? Math.min(0.80 * SMYS_MPa, 0.429 * UTS_MPa) : S_d;
    const t_design = (4.9 * D_m * (H_m - 0.3) * G) / S_d;
    const t_hydro = (4.9 * D_m * (H_m - 0.3)) / S_hydro;

    return {
      norm: 'API 650 12th Ed. (2013) – §5.6',
      tipo: 'Virola de tanque atmosférico',
      S_d_MPa: S_d,
      S_hydro_MPa: S_hydro,
      t_design_mm: t_design,
      t_hydro_mm: t_hydro,
      t_min_CA_mm: t_design + CA_mm,
      warning: 'Verificar categorías de diseño, soldaduras, redondeos y requisitos adicionales de API 650.',
      formula: 't = 4.9·D·(H–0.3)·G / S_d',
    };
  }

  return {
    calcB313,
    calcVIII_cylinder,
    calcVIII_hemi,
    calcVIII_ellip,
    calcVIII_tori,
    calcAPI653,
    calcAPI650,
    calcFFS_thinning,
    fullAssessment,
    getMaterials,
    getJointEfficiencies,
    getPipeSchedules,
    getApplicableStandards,
    validateStandardForEquipment,
    getAllowableStress,
    corrosionRateFromReadings,
    MATERIALS,
    JOINT_EFF,
    PIPE_SCHEDULES,
  };
})();
