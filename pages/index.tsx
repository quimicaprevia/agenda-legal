import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useState } from "react"

type Prueba = { id: string; tipo: string; descripcion?: string; contenido?: string; detalle?: string; estado: string; vencimiento?: string }
type Tarea = { id: string; texto: string; fecha?: string; urgente: boolean; done: boolean; tipo?: string; tema?: string; juicioId?: string; juicio?: { autos: string; id: string } }
type Honorario = { id: string; clienteContraparte?: string; total?: string; pagado?: string; estado: string; observaciones?: string }
type Juicio = { id: string; tipo: string; nro?: string; autos: string; estado: string; fuero?: string; juzgado?: string; secretaria?: string; sala?: string; cosasRelevantes?: string; advertencia?: string; driveUrl?: string; iaUrl?: string; datosJuzgado?: string; datosContacto?: string; otraInfo?: string; tareas: Tarea[]; pruebas: Prueba[]; honorarios?: Honorario[] }

const ESTADOS: Record<string, string> = {
  "Judicializado": "#E6F1FB", "Preparación": "#FAEEDA", "Mediacion": "#FAEEDA",
  "Inicio": "#FAEEDA", "Finalizado": "#EAF3DE", "Renunciado": "#F1EFE8", "En Trámite": "#E6F1FB",
}
const ESTADOS_TEXT: Record<string, string> = {
  "Judicializado": "#185FA5", "Preparación": "#633806", "Mediacion": "#633806",
  "Inicio": "#633806", "Finalizado": "#3B6D11", "Renunciado": "#444441", "En Trámite": "#185FA5",
}
const TODOS_ESTADOS = ["Judicializado", "Preparación", "Mediacion", "Inicio", "Finalizado", "Renunciado", "En Trámite"]
const TIPOS_PRUEBA = ["Confesional","Informativa","Testimonial","Reconocimiento","Pericial contable","Pericial informática","Pericial médica","Pericial técnica","Pericial (otra)"]
const ESTADOS_PRUEBA = ["Ofrecida","En curso","Desistida","Finalizada"]
const ESTADOS_HONORARIO = ["Pendiente","Pago Parcial","Pago total"]

// Parsear fecha sin conversión de timezone
function parseFecha(fechaStr: string): Date {
  const [y, m, d] = fechaStr.split("T")[0].split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatFecha(fechaStr: string): string {
  return parseFecha(fechaStr).toLocaleDateString("es-AR")
}

export default function Home() {
  const { data: session, status } = useSession()
  const [panel, setPanel] = useState("tareas")
  const [juicios, setJuicios] = useState<Juicio[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<Record<string, string>>({})
  const [nuevaTarea, setNuevaTarea] = useState<Record<string, { texto: string; fecha: string; urgente: boolean }>>({})
  const [nuevaPrueba, setNuevaPrueba] = useState<Record<string, { tipo: string; contenido: string; detalle: string; estado: string }>>({})
  const [nuevoHonorario, setNuevoHonorario] = useState<Record<string, { clienteContraparte: string; total: string; pagado: string; estado: string; observaciones: string }>>({})
  const [loading, setLoading] = useState(true)
  const [filtroTipos, setFiltroTipos] = useState<string[]>([])
  const [filtroEstadosJuicio, setFiltroEstadosJuicio] = useState<string[]>([])
  const [editandoTarea, setEditandoTarea] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState("")
  const [editFecha, setEditFecha] = useState("")
  const [editUrgente, setEditUrgente] = useState(false)
  const [mostrarConcluidas, setMostrarConcluidas] = useState<Record<string, boolean>>({})
  const [editandoEstadoJuicio, setEditandoEstadoJuicio] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      Promise.all([
        fetch("/api/juicios").then(r => r.json()),
        fetch("/api/tareas").then(r => r.json()),
      ]).then(([j, t]) => {
        setJuicios(Array.isArray(j) ? j : [])
        setTareas(Array.isArray(t) ? t : [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [session])

  if (status === "loading") return <div style={styles.loading}>Cargando...</div>
  if (!session) return (
    <div style={styles.login}>
      <div style={styles.loginCard}>
        <div style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>Agenda Legal</div>
        <div style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Tu gestor de juicios y tareas</div>
        <button style={styles.btnGoogle} onClick={() => signIn("google")}>Entrar con Google</button>
      </div>
    </div>
  )

  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const tareasActivas = tareas.filter(t => !t.done)

  const esAtrasada = (t: Tarea) => { if (!t.fecha) return false; const f = parseFecha(t.fecha); return f < hoy }
  const esHoy = (t: Tarea) => { if (!t.fecha) return false; const f = parseFecha(t.fecha); return f.getTime() === hoy.getTime() }
  const esProxima = (t: Tarea) => { if (!t.fecha) return false; const f = parseFecha(t.fecha); return f > hoy }
  const esSinFecha = (t: Tarea) => !t.fecha

  // Urgentes que aparecen ARRIBA: solo si vencen hoy o están atrasadas
  const urgentesArriba = tareasActivas.filter(t => t.urgente && (esAtrasada(t) || esHoy(t)))
  // Atrasadas (no urgentes que ya están arriba, o urgentes que no son hoy/atrasadas)
  const atrasadas = tareasActivas.filter(t => esAtrasada(t) && !urgentesArriba.includes(t))
  const vencenHoy = tareasActivas.filter(t => esHoy(t) && !urgentesArriba.includes(t))
  const proximas = tareasActivas.filter(t => (esProxima(t) || esSinFecha(t)) && !urgentesArriba.includes(t))
    .sort((a, b) => {
      if (a.urgente && !b.urgente) return -1
      if (!a.urgente && b.urgente) return 1
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      return parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime()
    })

  const tareasHoy = tareasActivas.filter(t => esHoy(t))
  const tareasAtrasadas = tareasActivas.filter(t => esAtrasada(t))
  const tareasUrgentes = tareasActivas.filter(t => t.urgente)

  const toggleExpand = (id: string) => {
    setExpandido(expandido === id ? null : id)
    if (!tabActiva[id]) setTabActiva(p => ({ ...p, [id]: "tareas" }))
  }

  const toggleDone = async (tarea: Tarea) => {
    await fetch("/api/tareas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tarea.id, done: !tarea.done }) })
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, done: !t.done } : t))
    setJuicios(js => js.map(j => ({ ...j, tareas: j.tareas.map(t => t.id === tarea.id ? { ...t, done: !t.done } : t) })))
  }

  const guardarEdicion = async (tarea: Tarea) => {
    const body: any = { id: tarea.id, texto: editTexto, urgente: editUrgente }
    if (editFecha) body.fecha = editFecha
    else body.fecha = null
    await fetch("/api/tareas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const nuevaFecha = editFecha || undefined
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, texto: editTexto, fecha: nuevaFecha, urgente: editUrgente } : t))
    setJuicios(js => js.map(j => ({ ...j, tareas: j.tareas.map(t => t.id === tarea.id ? { ...t, texto: editTexto, fecha: nuevaFecha, urgente: editUrgente } : t) })))
    setEditandoTarea(null)
  }

  const agregarTareaJuicio = async (juicioId: string) => {
    const nt = nuevaTarea[juicioId] || { texto: "", fecha: "", urgente: false }
    if (!nt.texto.trim()) return
    const body: any = { texto: nt.texto, juicioId, urgente: nt.urgente, tipo: "Juicio" }
    if (nt.fecha) body.fecha = nt.fecha
    const res = await fetch("/api/tareas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!res.ok) { alert("Error al agregar tarea"); return }
    const t = await res.json()
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, tareas: [...j.tareas, t] } : j))
    setTareas(ts => [...ts, t])
    setNuevaTarea(p => ({ ...p, [juicioId]: { texto: "", fecha: "", urgente: false } }))
  }

  const agregarPruebaJuicio = async (juicioId: string) => {
    const np = nuevaPrueba[juicioId] || { tipo: "", contenido: "", detalle: "", estado: "Ofrecida" }
    if (!np.tipo) return
    const res = await fetch("/api/pruebas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: np.tipo, contenido: np.contenido, detalle: np.detalle, estado: np.estado, juicioId }) })
    if (!res.ok) { alert("Error al agregar prueba"); return }
    const p = await res.json()
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, pruebas: [...j.pruebas, p] } : j))
    setNuevaPrueba(p2 => ({ ...p2, [juicioId]: { tipo: "", contenido: "", detalle: "", estado: "Ofrecida" } }))
  }

  const agregarHonorario = async (juicioId: string) => {
    const nh = nuevoHonorario[juicioId] || { clienteContraparte: "", total: "", pagado: "", estado: "Pendiente", observaciones: "" }
    if (!nh.clienteContraparte.trim()) return
    const res = await fetch("/api/honorarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteContraparte: nh.clienteContraparte, total: nh.total, pagado: nh.pagado, estado: nh.estado, observaciones: nh.observaciones, juicioId }) })
    if (!res.ok) { alert("Error al agregar honorario"); return }
    const h = await res.json()
    setJuicios(js => js.map(jj => jj.id === juicioId ? { ...jj, honorarios: [...(jj.honorarios || []), h] } : jj))
    setNuevoHonorario(p => ({ ...p, [juicioId]: { clienteContraparte: "", total: "", pagado: "", estado: "Pendiente", observaciones: "" } }))
  }

  const borrarPrueba = async (juicioId: string, pruebaId: string) => {
    await fetch("/api/pruebas", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pruebaId }) })
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, pruebas: j.pruebas.filter(p => p.id !== pruebaId) } : j))
  }

  const cambiarEstadoJuicio = async (juicioId: string, estado: string) => {
    await fetch("/api/juicios", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: juicioId, estado }) })
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, estado } : j))
    setEditandoEstadoJuicio(null)
  }

  const tareaColor = (t: Tarea) => {
    if (t.urgente && (esAtrasada(t) || esHoy(t))) return "#FFF0F0"
    if (t.urgente) return "#FFF0F0"
    if (esAtrasada(t)) return "#F5F0FF"
    return "#fff"
  }
  const tareaBorderColor = (t: Tarea) => {
    if (t.urgente) return "#E24B4A"
    if (esAtrasada(t)) return "#9B59B6"
    return "#e5e7eb"
  }

  const renderTareaRow = (t: Tarea, showJuicio = true) => {
    const isEditing = editandoTarea === t.id
    const juicioNombre = t.juicio?.autos || t.tema
    return (
      <div key={t.id} style={{ ...styles.card, background: tareaColor(t), borderColor: tareaBorderColor(t), marginBottom: 6, cursor: "default" }}>
        <div style={styles.cardHeader}>
          <div style={{ ...styles.check, ...(t.done ? styles.checkDone : {}), marginTop: 2 }} onClick={() => toggleDone(t)}>{t.done ? "✓" : ""}</div>
          <div style={{ flex: 1, marginLeft: 8 }}>
            {showJuicio && juicioNombre && (
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: "#111" }}>{juicioNombre}</div>
            )}
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column" as any, gap: 6 }}>
                <input style={{ ...styles.input, fontSize: 13 }} value={editTexto} onChange={e => setEditTexto(e.target.value)} autoFocus />
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as any }}>
                  <input type="date" style={{ ...styles.input, width: 150 }} value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={editUrgente} onChange={e => setEditUrgente(e.target.checked)} /> Urgente
                  </label>
                  <button style={styles.btnPrimary} onClick={() => guardarEdicion(t)}>Actualizar</button>
                  <button style={styles.btn} onClick={() => setEditandoTarea(null)}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#aaa" : "#111" }}>{t.texto}</div>
            )}
            {!isEditing && (
              <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center", flexWrap: "wrap" as any }}>
                {t.fecha && <span style={{ fontSize: 11, color: "#888" }}>{formatFecha(t.fecha)}</span>}
                {t.tipo && <span style={{ fontSize: 10, background: "#f0f0f0", color: "#666", padding: "1px 6px", borderRadius: 8 }}>{t.tipo}</span>}
              </div>
            )}
          </div>
          {!isEditing && (
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
              {t.urgente && <span style={{ fontSize: 10, color: "#A32D2D", fontWeight: 600, background: "#FCEBEB", padding: "1px 6px", borderRadius: 8 }}>URGENTE</span>}
              {t.juicio?.id && (
                <a href={`/juicios?id=${t.juicio.id}`} onClick={e => { e.preventDefault(); setPanel("juicios"); setExpandido(t.juicio!.id) }} style={{ ...styles.btnMini, textDecoration: "none", color: "#378ADD", fontSize: 11 }} title="Ir al juicio">⚖</a>
              )}
              {!t.done && (
                <button style={{ ...styles.btnMini, color: t.urgente ? "#A32D2D" : "#aaa", fontWeight: 700 }}
                  onClick={() => {
                    fetch("/api/tareas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, urgente: !t.urgente }) })
                    setTareas(ts => ts.map(x => x.id === t.id ? { ...x, urgente: !x.urgente } : x))
                    setJuicios(js => js.map(j => ({ ...j, tareas: j.tareas.map(x => x.id === t.id ? { ...x, urgente: !x.urgente } : x) })))
                  }} title={t.urgente ? "Quitar urgente" : "Marcar urgente"}>!</button>
              )}
              {!t.done && (
                <button style={styles.btnMini} onClick={() => { setEditandoTarea(t.id); setEditTexto(t.texto); setEditFecha(t.fecha ? t.fecha.split("T")[0] : ""); setEditUrgente(t.urgente) }}>✎</button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderSeccion = (label: string, items: Tarea[], colorLabel?: string) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div style={{ ...styles.sectionLabel, color: colorLabel || "#888" }}>{label}</div>
        {items.map(t => renderTareaRow(t))}
      </div>
    )
  }

  const renderJuicioCard = (j: Juicio) => {
    const exp = expandido === j.id
    const tab = tabActiva[j.id] || "tareas"
    const nt = nuevaTarea[j.id] || { texto: "", fecha: "", urgente: false }
    const np = nuevaPrueba[j.id] || { tipo: "", contenido: "", detalle: "", estado: "Ofrecida" }
    const nh = nuevoHonorario[j.id] || { clienteContraparte: "", total: "", pagado: "", estado: "Pendiente", observaciones: "" }
    const jTareasActivas = j.tareas.filter(t => !t.done).sort((a, b) => {
      if (a.urgente && !b.urgente) return -1; if (!a.urgente && b.urgente) return 1
      if (!a.fecha) return 1; if (!b.fecha) return -1
      return parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime()
    })
    const jTareasConcluidas = j.tareas.filter(t => t.done).slice(-5)
    const mostrarConc = mostrarConcluidas[j.id]
    const editandoEste = editandoEstadoJuicio === j.id

    return (
      <div key={j.id} style={{ ...styles.card, borderColor: exp ? "#378ADD" : "#e5e7eb" }}>
        <div style={styles.cardHeader} onClick={() => { if (!editandoEste) toggleExpand(j.id) }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={styles.cardTitle}>{j.autos}</div>
            </div>
            <div style={styles.cardMeta}>{j.nro && j.nro !== "Iniciar" ? `Expte. ${j.nro} · ` : ""}{j.fuero}{j.juzgado ? ` · Juz. ${parseInt(j.juzgado) || j.juzgado}` : ""}</div>
            {j.advertencia && <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 3, fontWeight: 500 }}>⚠ {j.advertencia}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {editandoEste ? (
              <select style={{ ...styles.input, width: "auto", fontSize: 12 }} autoFocus
                onChange={e => cambiarEstadoJuicio(j.id, e.target.value)}
                onBlur={() => setEditandoEstadoJuicio(null)}
                defaultValue={j.estado}>
                {TODOS_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            ) : (
              <span style={{ ...styles.badge, background: ESTADOS[j.estado] || "#F1EFE8", color: ESTADOS_TEXT[j.estado] || "#444", cursor: "pointer" }}
                onClick={() => setEditandoEstadoJuicio(j.id)} title="Click para cambiar estado">{j.estado}</span>
            )}
            {j.iaUrl && (
              <a href={j.iaUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.btnMini, textDecoration: "none", fontSize: 11 }} title="Proyecto IA">🤖</a>
            )}
          </div>
        </div>

        {exp && (
          <div style={{ padding: "0 14px 14px" }} onClick={e => e.stopPropagation()}>
            <div style={styles.tabs}>
              {["tareas","pruebas","honorarios","info"].map(t => (
                <div key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTabActiva(p => ({ ...p, [j.id]: t }))}>
                  {t === "tareas" ? `Tareas (${jTareasActivas.length})` : t === "pruebas" ? `Prueba (${j.pruebas.length})` : t === "honorarios" ? `Honorarios (${(j.honorarios||[]).length})` : "Info"}
                </div>
              ))}
            </div>

            {tab === "tareas" && (
              <div>
                {jTareasActivas.map(t => renderTareaRow(t, false))}
                {jTareasActivas.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: "4px 0" }}>Sin tareas activas</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" as any }}>
                  <input style={{ ...styles.input, flex: "3 1 200px" }} placeholder="Nueva tarea..." value={nt.texto}
                    onChange={e => setNuevaTarea(p => ({ ...p, [j.id]: { ...nt, texto: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && agregarTareaJuicio(j.id)} />
                  <input type="date" style={{ ...styles.input, flex: "1 1 140px" }} value={nt.fecha}
                    onChange={e => setNuevaTarea(p => ({ ...p, [j.id]: { ...nt, fecha: e.target.value } }))} />
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", whiteSpace: "nowrap" as any }}>
                    <input type="checkbox" checked={nt.urgente} onChange={e => setNuevaTarea(p => ({ ...p, [j.id]: { ...nt, urgente: e.target.checked } }))} /> Urgente
                  </label>
                  <button style={styles.btnPrimary} onClick={() => agregarTareaJuicio(j.id)}>+ Agregar</button>
                </div>
                {jTareasConcluidas.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#888", cursor: "pointer", userSelect: "none" as any, padding: "4px 0" }}
                      onClick={() => setMostrarConcluidas(p => ({ ...p, [j.id]: !mostrarConc }))}>
                      {mostrarConc ? "▾" : "▸"} Tareas concluidas ({jTareasConcluidas.length})
                    </div>
                    {mostrarConc && jTareasConcluidas.map(t => renderTareaRow(t, false))}
                  </div>
                )}
              </div>
            )}

            {tab === "pruebas" && (
              <div>
                {j.pruebas.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: "4px 0" }}>Sin pruebas cargadas</div>}
                {j.pruebas.map(p => (
                  <div key={p.id} style={styles.pruebaRow}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{p.tipo}</span>
                      {p.contenido && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{p.contenido}</div>}
                      {p.detalle && <div style={{ fontSize: 11, color: "#888" }}>{p.detalle}</div>}
                    </div>
                    <span style={{ ...styles.badge, background: "#f0f0f0", color: "#555", fontSize: 11 }}>{p.estado}</span>
                    <button style={{ ...styles.btnMini, color: "#E24B4A" }} onClick={() => borrarPrueba(j.id, p.id)}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" as any }}>
                  <select style={{ ...styles.input, flex: "1 1 160px" }} value={np.tipo}
                    onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, tipo: e.target.value } }))}>
                    <option value="">Tipo de prueba...</option>
                    {TIPOS_PRUEBA.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input style={{ ...styles.input, flex: "2 1 200px" }} placeholder="Contenido..." value={np.contenido}
                    onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, contenido: e.target.value } }))} />
                  <input style={{ ...styles.input, flex: "2 1 200px" }} placeholder="Detalle..." value={np.detalle}
                    onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, detalle: e.target.value } }))} />
                  <select style={{ ...styles.input, flex: "1 1 120px" }} value={np.estado}
                    onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, estado: e.target.value } }))}>
                    {ESTADOS_PRUEBA.map(e => <option key={e}>{e}</option>)}
                  </select>
                  <button style={styles.btnPrimary} onClick={() => agregarPruebaJuicio(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {tab === "honorarios" && (
              <div>
                {(j.honorarios || []).length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: "4px 0" }}>Sin honorarios cargados</div>}
                {(j.honorarios || []).map(h => (
                  <div key={h.id} style={{ ...styles.pruebaRow, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{h.clienteContraparte}</div>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        {h.total && `Total: ${h.total}`}{h.pagado ? ` · Pagado: ${h.pagado}` : ""}
                      </div>
                      {h.observaciones && <div style={{ fontSize: 11, color: "#888" }}>{h.observaciones}</div>}
                    </div>
                    <span style={{ ...styles.badge, background: h.estado === "Pago total" ? "#EAF3DE" : h.estado === "Pago Parcial" ? "#E6F1FB" : "#FAEEDA", color: h.estado === "Pago total" ? "#3B6D11" : h.estado === "Pago Parcial" ? "#185FA5" : "#633806", fontSize: 11 }}>{h.estado}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" as any }}>
                  <input style={{ ...styles.input, flex: "2 1 160px" }} placeholder="Cliente / Contraparte *" value={nh.clienteContraparte}
                    onChange={e => setNuevoHonorario(p => ({ ...p, [j.id]: { ...nh, clienteContraparte: e.target.value } }))} />
                  <input style={{ ...styles.input, flex: "1 1 100px" }} placeholder="Total" value={nh.total}
                    onChange={e => setNuevoHonorario(p => ({ ...p, [j.id]: { ...nh, total: e.target.value } }))} />
                  <input style={{ ...styles.input, flex: "1 1 100px" }} placeholder="Pagado" value={nh.pagado}
                    onChange={e => setNuevoHonorario(p => ({ ...p, [j.id]: { ...nh, pagado: e.target.value } }))} />
                  <select style={{ ...styles.input, flex: "1 1 120px" }} value={nh.estado}
                    onChange={e => setNuevoHonorario(p => ({ ...p, [j.id]: { ...nh, estado: e.target.value } }))}>
                    {ESTADOS_HONORARIO.map(e => <option key={e}>{e}</option>)}
                  </select>
                  <input style={{ ...styles.input, flex: "2 1 180px" }} placeholder="Observaciones" value={nh.observaciones}
                    onChange={e => setNuevoHonorario(p => ({ ...p, [j.id]: { ...nh, observaciones: e.target.value } }))} />
                  <button style={styles.btnPrimary} onClick={() => agregarHonorario(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {tab === "info" && (
              <div>
                {j.advertencia && (
                  <div style={{ background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#A32D2D", fontWeight: 500, marginBottom: 2 }}>ADVERTENCIA</div>
                    <div style={{ fontSize: 13 }}>{j.advertencia}</div>
                  </div>
                )}
                <div style={styles.fieldRow}>
                  <div style={styles.field}><div style={styles.fieldLabel}>Expediente</div><div>{j.nro || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Fuero</div><div>{j.fuero || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Juzgado</div><div>{j.juzgado ? (parseInt(j.juzgado) || j.juzgado) : "—"}</div></div>
                </div>
                <div style={styles.fieldRow}>
                  <div style={styles.field}><div style={styles.fieldLabel}>Secretaría</div><div>{j.secretaria || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Sala</div><div>{j.sala || "—"}</div></div>
                </div>
                {j.datosJuzgado && <div style={{ marginBottom: 8 }}><div style={styles.fieldLabel}>Datos del juzgado</div><div style={{ fontSize: 13 }}>{j.datosJuzgado}</div></div>}
                {j.datosContacto && <div style={{ marginBottom: 8 }}><div style={styles.fieldLabel}>Datos de contacto</div><div style={{ fontSize: 13 }}>{j.datosContacto}</div></div>}
                {j.cosasRelevantes && <div style={{ marginBottom: 8 }}><div style={styles.fieldLabel}>Cosas relevantes</div><div style={{ fontSize: 13 }}>{j.cosasRelevantes}</div></div>}
                {j.otraInfo && <div style={{ marginBottom: 8 }}><div style={styles.fieldLabel}>Otra información</div><div style={{ fontSize: 13 }}>{j.otraInfo}</div></div>}
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" as any }}>
                  {j.driveUrl && <a href={j.driveUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, textDecoration: "none", display: "inline-block", fontSize: 12 }}>📁 Drive</a>}
                  {j.iaUrl && <a href={j.iaUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, textDecoration: "none", display: "inline-block", fontSize: 12 }}>🤖 Proyecto IA</a>}
                  {j.nro && j.nro !== "Iniciar" && (
                    <a href={`https://scw.pjn.gov.ar/scw/home.seam`} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, textDecoration: "none", display: "inline-block", fontSize: 12 }}>⚖ PJN (requiere login)</a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const tiposTarea = ["Juicio", "Pro Bono", "Docencia", "Personales", "General", "Honorarios"]

  const tareasFiltradas = tareasActivas
    .filter(t => filtroTipos.length === 0 || filtroTipos.includes(t.tipo || "General"))
    .sort((a, b) => {
      if (a.urgente && !b.urgente) return -1; if (!a.urgente && b.urgente) return 1
      if (!a.fecha && !b.fecha) return 0; if (!a.fecha) return 1; if (!b.fecha) return -1
      return parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime()
    })

  const juiciosFiltrados = juicios.filter(j => {
    if (filtroEstadosJuicio.length === 0) return !["Finalizado","Renunciado"].includes(j.estado)
    return filtroEstadosJuicio.includes(j.estado)
  }).sort((a, b) => a.autos.localeCompare(b.autos, "es"))

  const honorariosPendientes = juicios.flatMap(j => (j.honorarios || []).filter(h => h.estado !== "Pago total").map(h => ({ ...h, autos: j.autos, juicioId: j.id })))

  const panelTitle: Record<string, string> = { tareas: "Tareas", juicios: "Juicios", probono: "Pro Bono", docencia: "Docencia", personales: "Personales", honorarios: "Honorarios" }

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Agenda Legal</div>
          <div style={{ fontSize: 11, color: "#888" }}>{session.user?.name}</div>
        </div>
        {[
          { id: "tareas", label: "Tareas", badge: tareasAtrasadas.length + tareasHoy.length },
          { id: "juicios", label: "Juicios", badge: juiciosFiltrados.length },
          { id: "probono", label: "Pro Bono", badge: null },
          { id: "docencia", label: "Docencia", badge: null },
          { id: "personales", label: "Personales", badge: null },
          { id: "honorarios", label: "Honorarios", badge: honorariosPendientes.length || null },
        ].map(item => (
          <div key={item.id} style={{ ...styles.navItem, ...(panel === item.id ? styles.navItemActive : {}) }} onClick={() => setPanel(item.id)}>
            {item.label}
            {item.badge ? <span style={styles.navBadge}>{item.badge}</span> : null}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid #e5e7eb" }}>
          {juicios.length === 0 && (
            <button style={{ ...styles.btnPrimary, fontSize: 12, width: "100%", marginBottom: 6 }} onClick={async () => {
              const r = await fetch('/api/seed', { method: 'POST' })
              const d = await r.json()
              if (d.ok) window.location.reload()
              else alert(d.msg || 'Error')
            }}>Importar mis datos</button>
          )}
          <button style={{ ...styles.btn, fontSize: 12, width: "100%" }} onClick={() => signOut()}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>{panelTitle[panel] || panel}</div>
          {panel === "juicios" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as any, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#888" }}>Estado:</span>
              {TODOS_ESTADOS.map(e => (
                <button key={e} style={{ ...styles.btn, fontSize: 11, padding: "3px 8px",
                  background: filtroEstadosJuicio.includes(e) ? ESTADOS[e] || "#f0f0f0" : "transparent",
                  color: filtroEstadosJuicio.includes(e) ? ESTADOS_TEXT[e] || "#333" : "#888",
                  borderColor: filtroEstadosJuicio.includes(e) ? ESTADOS_TEXT[e] || "#ccc" : "#e5e7eb" }}
                  onClick={() => setFiltroEstadosJuicio(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])}>
                  {e}
                </button>
              ))}
              {filtroEstadosJuicio.length > 0 && (
                <button style={{ ...styles.btn, fontSize: 11, color: "#888" }} onClick={() => setFiltroEstadosJuicio([])}>✕</button>
              )}
            </div>
          )}
          {panel === "tareas" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as any, alignItems: "center" }}>
              {tiposTarea.map(tipo => (
                <button key={tipo} style={{ ...styles.btn, fontSize: 11, padding: "3px 8px",
                  background: filtroTipos.includes(tipo) ? "#378ADD" : "transparent",
                  color: filtroTipos.includes(tipo) ? "#fff" : "#888",
                  borderColor: filtroTipos.includes(tipo) ? "#378ADD" : "#e5e7eb" }}
                  onClick={() => setFiltroTipos(p => p.includes(tipo) ? p.filter(x => x !== tipo) : [...p, tipo])}>
                  {tipo}
                </button>
              ))}
              {filtroTipos.length > 0 && <button style={{ ...styles.btn, fontSize: 11, color: "#888" }} onClick={() => setFiltroTipos([])}>✕ Limpiar</button>}
            </div>
          )}
        </div>

        <div style={styles.content}>
          {loading && <div style={{ color: "#888", fontSize: 14 }}>Cargando datos...</div>}

          {!loading && panel === "tareas" && (
            <div>
              <div style={styles.metricsGrid}>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500, color: "#378ADD" }}>{tareasHoy.length}</div><div style={styles.metricLabel}>Vencen hoy</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500, color: "#E24B4A" }}>{tareasUrgentes.length}</div><div style={styles.metricLabel}>Urgentes</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500, color: "#9B59B6" }}>{tareasAtrasadas.length}</div><div style={styles.metricLabel}>Atrasadas</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500 }}>{tareasActivas.length}</div><div style={styles.metricLabel}>Total activas</div></div>
              </div>
              {filtroTipos.length > 0 ? (
                tareasFiltradas.length === 0
                  ? <div style={{ color: "#aaa", fontSize: 14 }}>No hay tareas.</div>
                  : tareasFiltradas.map(t => renderTareaRow(t))
              ) : (
                <>
                  {renderSeccion("URGENTES", urgentesArriba, "#E24B4A")}
                  {renderSeccion("ATRASADAS", atrasadas, "#9B59B6")}
                  {renderSeccion("HOY", vencenHoy, "#378ADD")}
                  {renderSeccion("PRÓXIMAS TAREAS", proximas, "#555")}
                  {urgentesArriba.length === 0 && atrasadas.length === 0 && vencenHoy.length === 0 && proximas.length === 0 && (
                    <div style={{ color: "#aaa", fontSize: 14 }}>No hay tareas activas.</div>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && panel === "juicios" && (
            <div>{juiciosFiltrados.length === 0
              ? <div style={{ color: "#aaa", fontSize: 14 }}>No hay juicios con ese filtro.</div>
              : juiciosFiltrados.map(renderJuicioCard)}
            </div>
          )}

          {!loading && panel === "honorarios" && (
            <div>
              {honorariosPendientes.length === 0
                ? <div style={{ color: "#aaa", fontSize: 14 }}>No hay honorarios pendientes.</div>
                : honorariosPendientes.map((h, i) => (
                  <div key={i} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.cardTitle}>{(h as any).autos}</div>
                        <div style={styles.cardMeta}>{h.clienteContraparte}{h.total ? ` · Total: ${h.total}` : ""}{h.pagado ? ` · Pagado: ${h.pagado}` : ""}</div>
                        {h.observaciones && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{h.observaciones}</div>}
                      </div>
                      <span style={{ ...styles.badge, background: h.estado === "Pago Parcial" ? "#E6F1FB" : "#FAEEDA", color: h.estado === "Pago Parcial" ? "#185FA5" : "#633806" }}>{h.estado}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {!loading && (panel === "probono" || panel === "docencia" || panel === "personales") && (
            <div style={{ color: "#aaa", fontSize: 14 }}>
              Próximamente — gestión de asuntos de {panel === "probono" ? "Pro Bono" : panel === "docencia" ? "Docencia" : "Personales"}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#111" },
  sidebar: { width: 220, background: "#f9f9f8", borderRight: "0.5px solid #e5e7eb", display: "flex", flexDirection: "column" },
  sidebarHeader: { padding: "14px 14px 10px", borderBottom: "0.5px solid #e5e7eb" },
  navItem: { padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#666", borderLeft: "2px solid transparent" },
  navItemActive: { background: "#fff", color: "#111", borderLeft: "2px solid #378ADD", fontWeight: 500 },
  navBadge: { float: "right", background: "#E6F1FB", color: "#185FA5", fontSize: 11, padding: "1px 6px", borderRadius: 10 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topbar: { padding: "10px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  content: { flex: 1, overflowY: "auto", padding: "14px 16px" },
  card: { background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  cardHeader: { padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  cardTitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.35 },
  cardMeta: { fontSize: 11, color: "#888", marginTop: 2 },
  badge: { fontSize: 11, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 },
  tabs: { display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 12, marginTop: 10 },
  tab: { fontSize: 12, padding: "6px 12px", cursor: "pointer", color: "#888", borderBottom: "2px solid transparent", marginBottom: -0.5 },
  tabActive: { color: "#378ADD", borderBottom: "2px solid #378ADD", fontWeight: 500 },
  pruebaRow: { display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: "0.5px solid #f0f0f0" },
  check: { width: 15, height: 15, border: "0.5px solid #ccc", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 },
  checkDone: { background: "#EAF3DE", borderColor: "#639922", color: "#3B6D11" },
  input: { fontSize: 12, padding: "4px 8px", border: "0.5px solid #ccc", borderRadius: 8, background: "#f9f9f8", color: "#111", flex: 1 },
  btn: { fontSize: 12, padding: "5px 12px", border: "0.5px solid #ccc", borderRadius: 8, cursor: "pointer", background: "transparent", color: "#111" },
  btnPrimary: { fontSize: 12, padding: "5px 12px", border: "none", borderRadius: 8, cursor: "pointer", background: "#378ADD", color: "#fff", whiteSpace: "nowrap" },
  btnMini: { fontSize: 12, padding: "2px 6px", border: "0.5px solid #e5e7eb", borderRadius: 6, cursor: "pointer", background: "transparent", color: "#888" },
  btnGoogle: { fontSize: 14, padding: "10px 24px", border: "0.5px solid #ccc", borderRadius: 8, cursor: "pointer", background: "#fff", color: "#111" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 },
  metric: { background: "#f9f9f8", borderRadius: 8, padding: "10px 12px" },
  metricLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginTop: 14, marginBottom: 6, paddingBottom: 4, borderBottom: "0.5px solid #e5e7eb" },
  fieldRow: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 },
  field: { flex: 1, minWidth: 100 },
  fieldLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  login: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f9f9f8" },
  loginCard: { background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 40, textAlign: "center" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#888" },
  addRow: { display: "flex", gap: 6, marginTop: 10 },
}
