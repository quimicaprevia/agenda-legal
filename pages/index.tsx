import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useState } from "react"

type Prueba = { id: string; tipo: string; descripcion?: string; estado: string; vencimiento?: string }
type Tarea = { id: string; texto: string; fecha?: string; urgente: boolean; done: boolean; tipo?: string }
type Juicio = { id: string; tipo: string; nro?: string; autos: string; estado: string; fuero?: string; juzgado?: string; secretaria?: string; sala?: string; cosasRelevantes?: string; driveUrl?: string; tareas: Tarea[]; pruebas: Prueba[] }

const ESTADOS: Record<string, string> = {
  "Judicializado": "#E6F1FB",
  "Preparación": "#FAEEDA",
  "Mediacion": "#FAEEDA",
  "Inicio": "#FAEEDA",
  "Finalizado": "#EAF3DE",
  "Renunciado": "#F1EFE8",
}
const ESTADOS_TEXT: Record<string, string> = {
  "Judicializado": "#185FA5",
  "Preparación": "#633806",
  "Mediacion": "#633806",
  "Inicio": "#633806",
  "Finalizado": "#3B6D11",
  "Renunciado": "#444441",
}

export default function Home() {
  const { data: session, status } = useSession()
  const [panel, setPanel] = useState("hoy")
  const [juicios, setJuicios] = useState<Juicio[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<Record<string, string>>({})
  const [nuevaTarea, setNuevaTarea] = useState<Record<string, { texto: string; fecha: string }>>({})
  const [nuevaPrueba, setNuevaPrueba] = useState<Record<string, { tipo: string; desc: string; estado: string; vto: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      Promise.all([
        fetch("/api/juicios").then(r => r.json()),
        fetch("/api/tareas").then(r => r.json()),
      ]).then(([j, t]) => {
        setJuicios(j)
        setTareas(t)
        setLoading(false)
      })
    }
  }, [session])

  if (status === "loading") return <div style={styles.loading}>Cargando...</div>

  if (!session) return (
    <div style={styles.login}>
      <div style={styles.loginCard}>
        <div style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>Agenda Legal</div>
        <div style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Tu gestor de juicios y tareas</div>
        <button style={styles.btnGoogle} onClick={() => signIn("google")}>
          Entrar con Google
        </button>
      </div>
    </div>
  )

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)

  const tareasHoy = tareas.filter(t => {
    if (!t.fecha || t.done) return false
    const f = new Date(t.fecha); f.setHours(0,0,0,0)
    return f <= hoy
  })
  const tareasUrgentes = tareas.filter(t => t.urgente && !t.done)

  const toggleExpand = (id: string) => {
    setExpandido(expandido === id ? null : id)
    if (!tabActiva[id]) setTabActiva(p => ({ ...p, [id]: "tareas" }))
  }

  const toggleDone = async (tarea: Tarea) => {
    await fetch("/api/tareas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tarea.id, done: !tarea.done }) })
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, done: !t.done } : t))
    setJuicios(js => js.map(j => ({ ...j, tareas: j.tareas.map(t => t.id === tarea.id ? { ...t, done: !t.done } : t) })))
  }

  const agregarTarea = async (juicioId: string) => {
    const nt = nuevaTarea[juicioId]
    if (!nt?.texto) return
    const res = await fetch("/api/tareas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: nt.texto, fecha: nt.fecha || null, juicioId, urgente: false }) })
    const t = await res.json()
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, tareas: [...j.tareas, t] } : j))
    setNuevaTarea(p => ({ ...p, [juicioId]: { texto: "", fecha: "" } }))
  }

  const agregarPrueba = async (juicioId: string) => {
    const np = nuevaPrueba[juicioId]
    if (!np?.tipo) return
    const res = await fetch("/api/pruebas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: np.tipo, descripcion: np.desc, estado: np.estado || "Pendiente", vencimiento: np.vto || null, juicioId }) })
    const p = await res.json()
    setJuicios(js => js.map(j => j.id === juicioId ? { ...j, pruebas: [...j.pruebas, p] } : j))
    setNuevaPrueba(p2 => ({ ...p2, [juicioId]: { tipo: "", desc: "", estado: "Pendiente", vto: "" } }))
  }

  const renderJuicioCard = (j: Juicio) => {
    const exp = expandido === j.id
    const tab = tabActiva[j.id] || "tareas"
    const nt = nuevaTarea[j.id] || { texto: "", fecha: "" }
    const np = nuevaPrueba[j.id] || { tipo: "", desc: "", estado: "Pendiente", vto: "" }
    return (
      <div key={j.id} style={{ ...styles.card, borderColor: exp ? "#378ADD" : "#e5e7eb" }}>
        <div style={styles.cardHeader} onClick={() => toggleExpand(j.id)}>
          <div style={{ flex: 1 }}>
            <div style={styles.cardTitle}>{j.autos}</div>
            <div style={styles.cardMeta}>{j.nro && j.nro !== "Iniciar" ? `Expte. ${j.nro} · ` : ""}{j.fuero}{j.juzgado ? ` · Juz. ${j.juzgado}` : ""}</div>
          </div>
          <span style={{ ...styles.badge, background: ESTADOS[j.estado] || "#F1EFE8", color: ESTADOS_TEXT[j.estado] || "#444" }}>{j.estado}</span>
        </div>
        {exp && (
          <div style={{ padding: "0 14px 14px" }} onClick={e => e.stopPropagation()}>
            <div style={styles.tabs}>
              {["tareas", "pruebas", "info"].map(t => (
                <div key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTabActiva(p => ({ ...p, [j.id]: t }))}>
                  {t === "tareas" ? `Tareas (${j.tareas.length})` : t === "pruebas" ? `Prueba (${j.pruebas.length})` : "Info"}
                </div>
              ))}
            </div>

            {tab === "tareas" && (
              <div>
                {j.tareas.map(t => (
                  <div key={t.id} style={styles.tareaRow}>
                    <div style={{ ...styles.check, ...(t.done ? styles.checkDone : {}) }} onClick={() => toggleDone(t)}>{t.done ? "✓" : ""}</div>
                    <div style={{ flex: 1, fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#aaa" : "inherit" }}>{t.texto}</div>
                    {t.urgente && <span style={{ fontSize: 11, color: "#A32D2D", fontWeight: 500 }}>URGENTE</span>}
                    {t.fecha && <div style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{new Date(t.fecha).toLocaleDateString("es-AR")}</div>}
                  </div>
                ))}
                <div style={styles.addRow}>
                  <input style={styles.input} placeholder="Nueva tarea..." value={nt.texto} onChange={e => setNuevaTarea(p => ({ ...p, [j.id]: { ...nt, texto: e.target.value } }))} onKeyDown={e => e.key === "Enter" && agregarTarea(j.id)} />
                  <input type="date" style={{ ...styles.input, width: 140 }} value={nt.fecha} onChange={e => setNuevaTarea(p => ({ ...p, [j.id]: { ...nt, fecha: e.target.value } }))} />
                  <button style={styles.btnPrimary} onClick={() => agregarTarea(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {tab === "pruebas" && (
              <div>
                {j.pruebas.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: "4px 0" }}>Sin pruebas cargadas</div>}
                {j.pruebas.map(p => (
                  <div key={p.id} style={styles.pruebaRow}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{p.tipo}</span>
                      {p.descripcion && <span style={{ color: "#888", fontSize: 12 }}> · {p.descripcion}</span>}
                    </div>
                    <span style={{ ...styles.badge, background: p.estado === "Admitida" ? "#EAF3DE" : p.estado === "Rechazada" ? "#FCEBEB" : "#FAEEDA", color: p.estado === "Admitida" ? "#3B6D11" : p.estado === "Rechazada" ? "#791F1F" : "#633806", fontSize: 11 }}>{p.estado}</span>
                    {p.vencimiento && <div style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>Vto: {new Date(p.vencimiento).toLocaleDateString("es-AR")}</div>}
                  </div>
                ))}
                <div style={{ ...styles.addRow, flexWrap: "wrap" as any, gap: 6 }}>
                  <input style={{ ...styles.input, flex: "1 1 120px" }} placeholder="Tipo de prueba..." value={np.tipo} onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, tipo: e.target.value } }))} />
                  <input style={{ ...styles.input, flex: "2 1 160px" }} placeholder="Descripción..." value={np.desc} onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, desc: e.target.value } }))} />
                  <select style={styles.input} value={np.estado} onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, estado: e.target.value } }))}>
                    <option>Pendiente</option><option>Admitida</option><option>Rechazada</option>
                  </select>
                  <input type="date" style={{ ...styles.input, width: 140 }} value={np.vto} onChange={e => setNuevaPrueba(p => ({ ...p, [j.id]: { ...np, vto: e.target.value } }))} />
                  <button style={styles.btnPrimary} onClick={() => agregarPrueba(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {tab === "info" && (
              <div>
                <div style={styles.fieldRow}>
                  <div style={styles.field}><div style={styles.fieldLabel}>Expediente</div><div>{j.nro || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Fuero</div><div>{j.fuero || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Juzgado</div><div>{j.juzgado || "—"}</div></div>
                  <div style={styles.field}><div style={styles.fieldLabel}>Secretaría</div><div>{j.secretaria || "—"}</div></div>
                </div>
                {j.cosasRelevantes && <div style={{ marginTop: 8 }}><div style={styles.fieldLabel}>Cosas relevantes</div><div style={{ fontSize: 13 }}>{j.cosasRelevantes}</div></div>}
                {j.driveUrl && (
                  <div style={{ marginTop: 12 }}>
                    <a href={j.driveUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, textDecoration: "none", display: "inline-block", fontSize: 12 }}>Abrir carpeta en Drive</a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Agenda Legal</div>
          <div style={{ fontSize: 11, color: "#888" }}>{session.user?.name}</div>
        </div>
        {[
          { id: "hoy", label: "Hoy", badge: tareasHoy.length },
          { id: "urgentes", label: "Urgentes", badge: tareasUrgentes.length },
          { id: "juicios", label: "Juicios", badge: juicios.length },
          { id: "tareas", label: "Todas las tareas", badge: null },
        ].map(item => (
          <div key={item.id} style={{ ...styles.navItem, ...(panel === item.id ? styles.navItemActive : {}) }} onClick={() => setPanel(item.id)}>
            {item.label}
            {item.badge ? <span style={styles.navBadge}>{item.badge}</span> : null}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid #e5e7eb" }}>
          <button style={{ ...styles.btn, fontSize: 12, width: "100%" }} onClick={() => signOut()}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>
            {{ hoy: "Hoy", urgentes: "Urgentes", juicios: "Juicios", tareas: "Tareas" }[panel]}
          </div>
        </div>

        <div style={styles.content}>
          {loading && <div style={{ color: "#888", fontSize: 14 }}>Cargando datos...</div>}

          {!loading && panel === "hoy" && (
            <div>
              <div style={styles.metricsGrid}>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500, color: "#378ADD" }}>{tareasHoy.length}</div><div style={styles.metricLabel}>Vencen hoy</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500, color: "#E24B4A" }}>{tareasUrgentes.length}</div><div style={styles.metricLabel}>Urgentes</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500 }}>{juicios.filter(j => j.estado === "Judicializado").length}</div><div style={styles.metricLabel}>Activos</div></div>
                <div style={styles.metric}><div style={{ fontSize: 22, fontWeight: 500 }}>{juicios.length}</div><div style={styles.metricLabel}>Total juicios</div></div>
              </div>
              {tareasHoy.length === 0 ? <div style={{ color: "#aaa", fontSize: 14 }}>No hay vencimientos para hoy.</div> : tareasHoy.map(t => (
                <div key={t.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.cardTitle}>{t.texto}</div>
                      {t.fecha && <div style={styles.cardMeta}>{new Date(t.fecha).toLocaleDateString("es-AR")}</div>}
                    </div>
                    <div style={{ ...styles.check, ...(t.done ? styles.checkDone : {}), marginLeft: 8 }} onClick={() => toggleDone(t)}>{t.done ? "✓" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && panel === "urgentes" && (
            <div>
              {tareasUrgentes.length === 0 ? <div style={{ color: "#aaa", fontSize: 14 }}>No hay tareas urgentes.</div> : tareasUrgentes.map(t => (
                <div key={t.id} style={{ ...styles.card, borderLeft: "3px solid #E24B4A" }}>
                  <div style={styles.cardHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.cardTitle}>{t.texto}</div>
                      {t.fecha && <div style={styles.cardMeta}>{new Date(t.fecha).toLocaleDateString("es-AR")}</div>}
                    </div>
                    <div style={{ ...styles.check, ...(t.done ? styles.checkDone : {}) }} onClick={() => toggleDone(t)}>{t.done ? "✓" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && panel === "juicios" && juicios.map(renderJuicioCard)}

          {!loading && panel === "tareas" && (
            <div>
              {tareas.filter(t => !t.done).map(t => (
                <div key={t.id} style={{ ...styles.card, ...(t.urgente ? { borderLeft: "3px solid #E24B4A" } : {}) }}>
                  <div style={styles.cardHeader}>
                    <div style={{ ...styles.check, ...(t.done ? styles.checkDone : {}) }} onClick={() => toggleDone(t)}>{t.done ? "✓" : ""}</div>
                    <div style={{ flex: 1, marginLeft: 8 }}>
                      <div style={styles.cardTitle}>{t.texto}</div>
                      {t.fecha && <div style={styles.cardMeta}>{new Date(t.fecha).toLocaleDateString("es-AR")}</div>}
                    </div>
                    {t.urgente && <span style={{ fontSize: 11, color: "#A32D2D", fontWeight: 500 }}>URGENTE</span>}
                  </div>
                </div>
              ))}
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
  topbar: { padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fff" },
  content: { flex: 1, overflowY: "auto", padding: "14px 16px" },
  card: { background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, marginBottom: 8, overflow: "hidden", cursor: "pointer" },
  cardHeader: { padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.35 },
  cardMeta: { fontSize: 11, color: "#888", marginTop: 2 },
  badge: { fontSize: 11, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 },
  tabs: { display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: 12, marginTop: 10 },
  tab: { fontSize: 12, padding: "6px 12px", cursor: "pointer", color: "#888", borderBottom: "2px solid transparent", marginBottom: -0.5 },
  tabActive: { color: "#378ADD", borderBottom: "2px solid #378ADD", fontWeight: 500 },
  tareaRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #f0f0f0" },
  pruebaRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #f0f0f0" },
  check: { width: 14, height: 14, border: "0.5px solid #ccc", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 },
  checkDone: { background: "#EAF3DE", borderColor: "#639922", color: "#3B6D11" },
  addRow: { display: "flex", gap: 6, marginTop: 10 },
  input: { fontSize: 12, padding: "4px 8px", border: "0.5px solid #ccc", borderRadius: 8, background: "#f9f9f8", color: "#111", flex: 1 },
  btn: { fontSize: 12, padding: "5px 12px", border: "0.5px solid #ccc", borderRadius: 8, cursor: "pointer", background: "transparent", color: "#111" },
  btnPrimary: { fontSize: 12, padding: "5px 12px", border: "none", borderRadius: 8, cursor: "pointer", background: "#378ADD", color: "#fff", whiteSpace: "nowrap" },
  btnGoogle: { fontSize: 14, padding: "10px 24px", border: "0.5px solid #ccc", borderRadius: 8, cursor: "pointer", background: "#fff", color: "#111" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 },
  metric: { background: "#f9f9f8", borderRadius: 8, padding: "10px 12px" },
  metricLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  fieldRow: { display: "flex", gap: 16, flexWrap: "wrap" as any },
  field: { flex: 1, minWidth: 100 },
  fieldLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  login: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f9f9f8" },
  loginCard: { background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 40, textAlign: "center" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#888" },
}
