from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from datetime import date

OUT = r"c:\Desarrollo\plataformadegestion\Documentacion_SGIEE.pdf"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleSG", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=colors.HexColor("#17324D"), alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="SubtitleSG", parent=styles["Normal"], fontSize=11, leading=16, textColor=colors.HexColor("#526270"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="HeadingSG", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=colors.HexColor("#17324D"), spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="SubHeadingSG", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#1A6FC4"), spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name="BodySG", parent=styles["Normal"], fontName="Helvetica", fontSize=9.2, leading=13, textColor=colors.HexColor("#263746"), spaceAfter=5))
styles.add(ParagraphStyle(name="SmallSG", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=10.5, textColor=colors.HexColor("#526270")))
styles.add(ParagraphStyle(name="CodeSG", parent=styles["Normal"], fontName="Courier", fontSize=7.8, leading=10, leftIndent=8, rightIndent=8, backColor=colors.HexColor("#EFF4F8"), borderPadding=6, textColor=colors.HexColor("#263746")))

PRIMARY = colors.HexColor("#1A6FC4")
BORDER = colors.HexColor("#D8E2EA")
LIGHT = colors.HexColor("#F5F8FB")
DARK = colors.HexColor("#17324D")


def P(text, style="BodySG"):
    return Paragraph(text, styles[style])


def bullets(items):
    out=[]
    for item in items:
        out.append(Paragraph("• " + item, styles["BodySG"]))
    return out


def section_title(number, title):
    return P(f"{number}. {title}", "HeadingSG")


def data_table(headers, rows, widths=None):
    data=[[P(str(h), "SmallSG") for h in headers]]
    for row in rows:
        data.append([P(str(v), "SmallSG") for v in row])
    table=Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),PRIMARY),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("FONTNAME",(0,1),(-1,-1),"Helvetica"),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,LIGHT]),
        ("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]))
    return table


def header_footer(canvas, doc):
    canvas.saveState()
    w,h=A4
    canvas.setFillColor(DARK)
    canvas.rect(0,h-14*mm,w,14*mm,fill=1,stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold",9)
    canvas.drawString(16*mm,h-9*mm,"SGIEE · Documentación técnica")
    canvas.setFont("Helvetica",8)
    canvas.drawRightString(w-16*mm,h-9*mm,"Sistema de Gestión de Integridad")
    canvas.setStrokeColor(BORDER)
    canvas.line(16*mm,12*mm,w-16*mm,12*mm)
    canvas.setFillColor(colors.HexColor("#526270"))
    canvas.setFont("Helvetica",8)
    canvas.drawString(16*mm,8*mm,"Uso interno · Ingeniería de integridad")
    canvas.drawRightString(w-16*mm,8*mm,f"Página {doc.page}")
    canvas.restoreState()


doc=SimpleDocTemplate(OUT,pagesize=A4,leftMargin=16*mm,rightMargin=16*mm,topMargin=20*mm,bottomMargin=16*mm,title="Documentación SGIEE",author="SGIEE")
story=[]

story += [Spacer(1,22*mm), P("SGIEE", "TitleSG"), P("Sistema de Gestión de Integridad de Equipos Estáticos", "SubtitleSG"), Spacer(1,5*mm),
          P("Manual funcional y técnico", "SubtitleSG"), Spacer(1,18*mm),
          Table([[P("Versión", "SmallSG"),P("1.0.0","SmallSG"),P("Fecha","SmallSG"),P(date.today().isoformat(),"SmallSG")]],colWidths=[22*mm,48*mm,22*mm,48*mm],style=[("GRID",(0,0),(-1,-1),0.5,BORDER),("BACKGROUND",(0,0),(-1,-1),LIGHT),("VALIGN",(0,0),(-1,-1),"MIDDLE")]),
          Spacer(1,8*mm), P("Propósito: centralizar equipos estáticos, CML/TML, mediciones, inspecciones, RBI, espesores mínimos, planificación y reportes.", "BodySG")]

story += [PageBreak(), section_title("1","Descripción general"),
          P("SGIEE es una aplicación web frontal que funciona sin servidor mediante archivos HTML, CSS y JavaScript. Los datos se almacenan en el navegador mediante localStorage. Permite consultar, registrar y visualizar información de integridad mecánica de equipos estáticos."),
          P("Arquitectura", "SubHeadingSG"),
          data_table(["Capa","Archivo principal","Responsabilidad"],[
              ["Interfaz","index.html","Contenedores de módulos, barra lateral, área principal y modal."],
              ["Diseño","styles.css","Tema claro, tarjetas, tablas, formularios, SVG y responsividad."],
              ["Controlador","js/app.js","Inicializa datos, navega módulos y ejecuta acciones rápidas."],
              ["Datos","js/db.js","CRUD, datos iniciales, cálculos de corrosión y vida remanente."],
              ["Utilidades","js/utils.js","Formato, validación visual, modales, alertas y exportación CSV."],
              ["Ingeniería","js/thicknessCalc.js","Cálculos ASME/API y selección de normas aplicables."],
              ["Módulos","js/modules/*.js","Funcionalidad específica de cada opción del menú."],
          ],[28*mm,46*mm,98*mm]),
          P("Ejecución", "SubHeadingSG"), P("Abrir index.html mediante un servidor local o VS Code Live Server. Al cargar la página, App.init() inicializa DB, vincula navegación y abre el Dashboard."),
          P("Alcance", "SubHeadingSG")]+bullets([
              "Registro y clasificación de equipos estáticos.","Seguimiento dimensional de CML/TML.","Inspecciones e isométricos.","Cálculos de espesor mínimo y vida remanente.","Evaluación RBI simplificada.","Programación CBM/RBI y generación de reportes."
          ])

story += [PageBreak(), section_title("2","Flujo de navegación y datos"),
          P("Cada módulo se renderiza dentro de una sección <section class=\"module-view\">. El controlador App utiliza el atributo data-module de la barra lateral para cambiar de módulo."),
          P("Modelo de almacenamiento", "SubHeadingSG"),
          P("Los datos se guardan en colecciones independientes de localStorage. La clave principal agrupa equipos, CML, mediciones, inspecciones, isométricos, evaluaciones RBI y planes."),
          data_table(["Colección","Contenido principal"],[
              ["equipos","TAG, nombre, tipo, planta, material, presión, temperatura y espesores."],
              ["cmls","Punto CML/TML, ubicación, equipo asociado y descripción."],
              ["mediciones","Fecha, espesor medido, método, técnico y observaciones."],
              ["inspecciones","Equipo, fecha, tipo, resultado, hallazgos y recomendaciones."],
              ["isometricos","Documentos técnicos asociados a equipos y coordenadas de CML."],
              ["rbi_evaluaciones","POF, COF, riesgo, intervalo y próxima inspección."],
              ["planes","Tareas programadas, tipo de inspección, fuente, estado y fecha."]
          ],[42*mm,128*mm]),
          P("Funciones CRUD principales", "SubHeadingSG"),
          data_table(["Función","Uso"],[
              ["DB.init()","Crea las colecciones, carga datos de ejemplo y prepara el entorno."],
              ["DB.getAll(store)","Obtiene todos los registros de una colección."],
              ["DB.getById(store,id)","Busca un registro por su identificador."],
              ["DB.insert(store,record)","Inserta un registro y asigna metadatos de creación."],
              ["DB.update(store,id,patch)","Actualiza campos y marca la fecha de modificación."],
              ["DB.remove(store,id)","Elimina un registro por identificador."],
              ["DB.query(store,filter)","Filtra registros mediante una función JavaScript."]
          ],[52*mm,118*mm])]

story += [PageBreak(), section_title("3","Dashboard principal"),
          P("El Dashboard concentra el estado integral de la planta y utiliza enlaces rápidos para acceder a cada módulo. Las tarjetas y gráficos están construidos con datos existentes, no con valores de diseño independientes."),
          data_table(["Componente","Propósito"],[
              ["KPI de equipos activos","Resumen del inventario activo y total."],
              ["KPI de CML/TML","Cantidad total de puntos monitorizados."],
              ["Inspecciones vencidas","Planificación vencida que requiere atención."],
              ["Próximas inspecciones","Tareas dentro de los próximos 90 días."],
              ["Riesgo alto/muy alto","Evaluaciones RBI con riesgo mayor."],
              ["Distribución RBI","Conteo y gráfico por nivel Bajo, Medio, Alto y Muy Alto."],
              ["Mapa de vida de pared","Colorea equipos por porcentaje de vida restante."],
              ["Tasas de corrosión","Gráfico SVG de peor tasa por equipo y retiro estimado."],
              ["Próximas tareas","Listado navegable de inspecciones cercanas."],
              ["Ranking RBI","Ordena evaluaciones por criticidad."],
              ["Actividad reciente","Une inspecciones y mediciones por fecha."],
              ["Acciones rápidas","Navega o abre formularios directamente."]
          ],[48*mm,122*mm]),
          P("Navegación del Dashboard", "SubHeadingSG"), P("El manejador delegado detecta atributos data-nav, data-nav-eq, data-modal-cml, data-nav-rbi y data-nav-plan. Esto permite que tarjetas, gráficos y filas dirijan al módulo correspondiente sin vincular funciones manualmente por cada elemento."),
          P("Modal gráfico de CML", "SubHeadingSG"), P("Al seleccionar una tarjeta de CML, se abre un modal con vista frontal y lateral. En el panel se muestran espesor actual, mínimo, nominal, vida remanente y tasa de corrosión calculada.")]

story += [PageBreak(), section_title("4","Módulo Equipos"),
          P("Permite crear, editar, consultar y eliminar equipos estáticos, así como exportarlos a CSV."),
          data_table(["Función","Qué hace","Para qué sirve"],[
              ["render()","Construye tabla, KPI y filtros.","Presentar el inventario completo."],
              ["_renderTable()","Filtra, ordena y pagina equipos.","Facilitar búsquedas rápidas."],
              ["openDetail(id)","Abre el detalle e integra CML e inspecciones.","Consultar el expediente del equipo."],
              ["openForm(id)","Abre el formulario de alta o edición.","Capturar datos de diseño y operación."],
              ["saveEquipo(id)","Valida los datos y guarda el equipo.","Mantener el registro maestro actualizado."],
              ["openCMLsForEquipo(id)","Navega al módulo CML filtrado por equipo.","Revisar puntos de monitoreo."],
              ["exportCSV()","Exporta equipos visibles o completos.","Interoperabilidad y respaldo tabular."],
              ["Validación de norma","Compara tipo de equipo y norma seleccionada.","Evitar asignar una norma incompatible."]
          ],[38*mm,63*mm,69*mm]),
          P("Tipos compatibles", "SubHeadingSG"),
          data_table(["Tipo","Norma principal"],[
              ["Tubería a Presión","ASME B31.3"],
              ["Vasija a Presión / Intercambiador","ASME VIII Div.1"],
              ["Tanque Atmosférico","API 650-2013"],
              ["Todos los equipos estáticos","ASME II-D-2019 para propiedades de materiales"]
          ],[78*mm,92*mm])]

story += [PageBreak(), section_title("5","CML / TML y mediciones"),
          P("El módulo CML/TML administra puntos de monitoreo de corrosión y las mediciones históricas asociadas. Es la base del cálculo de tasa de pérdida y vida remanente."),
          data_table(["Función","Propósito"],[
              ["render(equipoId)","Inicia el módulo y aplica un equipo seleccionado si existe."],
              ["_renderCmlList()","Muestra CML disponibles y valores resumidos."],
              ["_renderCmlDetail(cmlId)","Carga mediciones, gráficos, estado CBM y visualización gráfica."],
              ["openCmlForm(cmlId)","Alta o edición de puntos CML/TML."],
              ["openMedForm(cmlId,medId)","Registra o modifica una medición."],
              ["deleteMedicion()","Elimina una medición y recalcula el CML."],
              ["openNewMeasurement()","Acción rápida para abrir una medición."],
              ["_buildTrendChart()","Construye la tendencia de espesor mediante SVG."],
              ["_buildCBMBox()","Presenta la recomendación de vida remanente e intervalo CBM."]
          ],[58*mm,112*mm]),
          P("Representación gráfica detallada", "SubHeadingSG")]+bullets([
              "Muestra P1 a 0°, P2 a 90°, P3 a 180° y P4 a 270°.",
              "Diferencia visualmente desgaste interior y exterior.",
              "Permite seleccionar un punto y actualizar el corte longitudinal.",
              "Alterna escala real 1× y ampliada 3×.",
              "Proyecta espesores de 0 a 15 años.",
              "Calcula pérdida porcentual, margen sobre t_mín, vida remanente y año límite lineal.",
              "Presenta una tabla dimensional por punto y una barra comparativa nominal/mínimo/actual."])+[
          P("Convenciones del semáforo", "SubHeadingSG"),
          data_table(["Estado","Criterio visual"],[
              ["Óptimo","Espesor crítico por encima del mínimo y margen suficiente."],
              ["Advertencia","El espesor se aproxima al mínimo admisible."],
              ["Crítico","Al menos un punto está por debajo de t_mín."]
          ],[38*mm,132*mm])]

story += [PageBreak(), section_title("6","Cálculos de corrosión y vida"),
          P("Estas funciones están implementadas principalmente en DB y thicknessCalc. Los cálculos son herramientas de apoyo y deben validarse con la norma aplicable, el código vigente y criterios de ingeniería.", "BodySG"),
          data_table(["Función","Fórmula o criterio","Resultado"],[
              ["DB.calcCorrosionRate(cml_id)","Regresión lineal de espesor versus tiempo.","Tasa CR en mm/a."],
              ["DB.remainingLife(cml_id,t_min)","(Espesor actual – t_mín) / CR.","Vida remanente aproximada en años."],
              ["DB.nextInspectionCBM(cml_id,t_min)","Vida remanente / 2.","Intervalo máximo CBM propuesto."],
              ["ThicknessCalc.calcB313()","t = P·D / [2·(S·E·W + P·Y)].","Espesor mínimo ASME B31.3."],
              ["ThicknessCalc.calcVIII_cylinder()","t = P·R / (S·E – 0.6·P).","Espesor de cuerpo cilíndrico ASME VIII."],
              ["ThicknessCalc.calcVIII_hemi()","t = P·R / (2·S·E – 0.2·P).","Espesor de cabeza hemisférica."],
              ["ThicknessCalc.calcVIII_ellip()","t = P·D / (2·S·E – 0.2·P).","Espesor de cabeza elipsoidal 2:1."],
              ["ThicknessCalc.calcVIII_tori()","t = 0.885·P·L / (S·E – 0.1·P).","Espesor de cabeza torisférica."],
              ["ThicknessCalc.calcAPI650()","t = 4.9·D·(H–0.3)·G / S_d.","Espesor simplificado de virola API 650."],
              ["ThicknessCalc.calcFFS_thinning()","RSF = (t_actual – t_mín) / t_nominal.","Aceptabilidad FFS simplificada."]
          ],[52*mm,66*mm,52*mm]),
          P("Importante", "SubHeadingSG"), P("Los datos de materiales y tensiones admisibles deben corresponder exactamente a la edición de la norma y al rango de temperatura. Las ecuaciones presentadas son aproximaciones de interfaz y no sustituyen el diseño completo, geometría, soldadura, presión externa, fatiga, embutición, defectos ni evaluación profesional.")]

story += [PageBreak(), section_title("7","Cálculo de Espesores"),
          P("Este módulo proporciona fichas de cálculo y resultados gráficos para tuberías, recipientes, cabezas, tanques y FFS."),
          data_table(["Solapa","Entradas principales","Salida"],[
              ["ASME B31.3","P, T, OD, material, E, W, CA, tolerancia.","t diseño, t mínimo, nominal requerido, MAOP y vida."],
              ["ASME VIII Cuerpo","P, T, ID, material, E, CA y espesor actual.","t diseño, MAWP, utilización y vida remanente."],
              ["ASME VIII Cabezas","Tipo, P, T, ID, radio, material y E.","Espesor por forma de cabeza."],
              ["API 650","D, H, gravedad, SMYS, UTS y CA.","Espesor de virola y prueba hidrostática."],
              ["API 579 FFS","t_nominal, t_actual, t_mín, CR y RSF admisible.","RSF, aceptabilidad, vida y intervalo CBM."]
          ],[38*mm,74*mm,58*mm]),
          P("Flujo del usuario", "SubHeadingSG")]+bullets([
              "Seleccionar una norma.","Completar las condiciones de diseño.","Elegir material y eficiencia de junta cuando corresponda.","Ejecutar el cálculo.","Revisar estado, advertencias y valores mínimos.","Generar representación gráfica y imprimir si se requiere."])+[
          P("Funciones de interfaz", "SubHeadingSG"),
          data_table(["Función","Para qué sirve"],[
              ["runB313()","Lee el formulario de tubería y ejecuta ASME B31.3."],
              ["runVIIIShell()","Ejecuta el cálculo del cuerpo cilíndrico."],
              ["runHeads()","Distingue cabeza hemisférica, elipsoidal o torisférica."],
              ["runAPI653()","Ejecuta el cálculo actualizado de tanque API 650."],
              ["runFFS()","Evalúa adelgazamiento uniforme bajo API 579."],
              ["renderCorrosionVisual()","Añade una representación transversal y lateral al resultado."]
          ],[48*mm,122*mm])]

story += [PageBreak(), section_title("8","RBI – Evaluación de Riesgo"),
          P("El módulo RBI calcula una aproximación de Probabilidad de Falla y Consecuencia de Falla para clasificar el riesgo de equipos estáticos."),
          data_table(["Función","Propósito"],[
              ["render()","Muestra formulario, matriz, KPI e historial."],
              ["_buildCalcForm()","Define entradas técnicas y categorización COF."],
              ["_buildMatrixHTML()","Representa la matriz POF/COF con selección visual."],
              ["_calcPOF()","Calcula categoría y valor POF a partir de vida, corrosión e inspección."],
              ["_evaluate()","Calcula el riesgo final y genera el intervalo sugerido."],
              ["_showResult()","Presenta POF, COF, riesgo y próxima inspección."],
              ["_autofillFromCML()","Toma el peor CML medido y llena espesor, CR y fecha."],
              ["_deleteEval()","Elimina una evaluación registrada."],
              ["openNewEvaluation()","Restablece el formulario desde una acción rápida."]
          ],[52*mm,118*mm]),
          P("Uso recomendado", "SubHeadingSG"), P("Seleccionar el equipo, indicar mecanismo y datos dimensionales, ajustar la corrosión y calidad de inspección, calcular POF/COF y guardar la evaluación. El módulo permite seleccionar el mecanismo de adelgazamiento y visualizar el resultado RBI."),
          P("Normas relacionadas", "SubHeadingSG"), P("API 580 para metodología RBI; ASME/API de integridad para los criterios técnicos usados por cada componente. La implementación interna debe revisarse frente a la edición contractual vigente.")]

story += [PageBreak(), section_title("9","Historial e Isométricos"),
          P("Historial de Inspecciones", "SubHeadingSG"), P("Administra inspecciones realizadas o pendientes, resultados, hallazgos y recomendaciones. Permite buscar, filtrar, paginar, ver detalle, editar, eliminar y exportar datos."),
          data_table(["Función destacada","Uso"],[
              ["openForm(id)","Alta o edición de inspección."],
              ["openDetail(id)","Visualiza equipo, hallazgos y recomendación."],
              ["deleteInsp(id)","Elimina una inspección con confirmación."],
              ["exportCSV()","Exporta el historial completo."]
          ],[52*mm,118*mm]),
          P("Isométricos", "SubHeadingSG"), P("Administra documentos técnicos y permite superponer puntos CML sobre un esquema SVG, imágenes o diagramas almacenados."),
          data_table(["Función destacada","Uso"],[
              ["openDocForm(docId)","Alta o edición de documento isométrico."],
              ["_openViewer(docId)","Abre el visor y prepara CML asociados."],
              ["_buildDrawing()","Dibuja el esquema predeterminado según equipo."],
              ["openAddPinModal()","Permite asociar un CML a una coordenada visual."],
              ["deleteDoc(docId)","Elimina el documento técnico."]
          ],[52*mm,118*mm])]

story += [PageBreak(), section_title("10","Planificación y Reportes"),
          P("Planificación", "SubHeadingSG"), P("Convierte evaluaciones RBI/CBM en tareas programadas, muestra calendario y vista de lista, genera órdenes de trabajo y controla estados."),
          data_table(["Función","Uso"],[
              ["_autogeneratePlans()","Genera tareas desde datos existentes."],
              ["_openForm(id)","Crear o editar una tarea."],
              ["_openDetail(id)","Consultar tarea y datos asociados."],
              ["_buildWorkOrder()","Genera orden de trabajo con CML asociados."],
              ["_completePlan(id)","Marca una tarea como completada."],
              ["_exportCSV()","Exporta la programación."]
          ],[48*mm,122*mm]),
          P("Reportes", "SubHeadingSG"), P("Produce informes visuales dentro del navegador y exportaciones CSV específicas."),
          data_table(["Reporte","Información incluida"],[
              ["Equipos","Inventario, norma, datos de diseño y estado."],
              ["CML/TML","Puntos, ubicación, medición actual y vida."],
              ["RBI","Evaluaciones, POF, COF, riesgo e intervalos."],
              ["Inspecciones","Resultados, hallazgos y recomendaciones."],
              ["Programación","Tareas, fechas, fuente y estado."],
              ["Tasas de corrosión","Tasa por CML, equipo y vida remanente."]
          ],[48*mm,122*mm])]

story += [PageBreak(), section_title("11","Utilidades transversales"),
          data_table(["Función","Servicio"],[
              ["Utils.fmtDate()","Formatea fechas en formato localizado."],
              ["Utils.today()","Devuelve la fecha actual ISO."],
              ["Utils.round()","Redondea valores técnicos."],
              ["Utils.clamp()","Limita valores a un rango."],
              ["Utils.escHtml()","Escapa texto para prevenir HTML/JS inyectado."],
              ["Utils.toast()","Muestra mensajes temporales de éxito, error o aviso."],
              ["Utils.openModal()","Crea ventanas modales responsivas."],
              ["Utils.confirm()","Solicita confirmación antes de acciones destructivas."],
              ["Utils.exportCSV()","Descarga tablas como archivos CSV."],
              ["Utils.crClass() / rlClass()","Define clases visuales por corrosión o vida remanente."],
              ["Utils.debounce()","Reduce frecuencia de actualización en búsquedas."]
          ],[52*mm,118*mm]),
          P("Limitaciones conocidas", "SubHeadingSG")]+bullets([
              "localStorage no constituye una base de datos industrial centralizada.",
              "Los datos no cuentan con sincronización multiusuario.",
              "No reemplaza sistemas CMMS, DMS o ERP.",
              "Las exportaciones deben revisarse antes de usarse como registro oficial.",
              "Las fórmulas simplificadas requieren validación normativa y revisión profesional."])+[
          P("Recomendación de despliegue", "SubHeadingSG"), P("Para uso operativo, se recomienda incorporar respaldo/exportación periódica, control de usuarios y roles, trazabilidad de cambios, validación de ediciones normativas y migración a una base de datos respaldada por servidor.")]

story += [PageBreak(), section_title("12","Guía rápida de uso"),
          data_table(["Paso","Acción","Resultado"],[
              ["1","Registrar equipo","Se crea el activo y su norma compatible."],
              ["2","Crear CML/TML","Se definen puntos de monitoreo dimensional."],
              ["3","Registrar mediciones","Se almacena la pérdida de espesor por fecha."],
              ["4","Revisar Dashboard","Se visualizan alertas, tasas y equipos críticos."],
              ["5","Calcular espesores","Se compara diseño mínimo con medición."],
              ["6","Evaluar RBI","Se obtiene POF, COF y riesgo aproximado."],
              ["7","Programar inspección","Se genera la tarea CBM/RBI."],
              ["8","Registrar inspección","Se documenta resultado y hallazgos."],
              ["9","Generar reportes","Se obtiene documentación y exportación CSV."]
          ],[18*mm,60*mm,92*mm]),
          Spacer(1,12*mm), P("Fin del documento", "HeadingSG"), P("SGIEE · Sistema de Gestión de Integridad de Equipos Estáticos", "SubtitleSG")]

doc.build(story,onFirstPage=header_footer,onLaterPages=header_footer)
print(OUT)
