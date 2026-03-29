import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useState, useRef } from "react"

// ─── TIPOS ───────────────────────────────────────────────────────────────────
type Prueba    = { id: string; tipo: string; contenido?: string; detalle?: string; estado: string }
type Honorario = { id: string; clienteContraparte?: string; total?: string; pagado?: string; estado: string; observaciones?: string }
type ClienteJuicio = { id: string; apellido: string; nombre: string; dni?: string; correo?: string; telefono?: string; domicilio?: string }
type Tarea     = { id: string; texto: string; fecha?: string; urgente: boolean; done: boolean; tipo?: string; tema?: string; juicioId?: string; asuntoId?: string; juicio?: { autos: string; id: string }; info?: string; webUrl?: string }
type Juicio    = { id: string; nro?: string; autos: string; estado: string; fuero?: string; juzgado?: string; secretaria?: string; sala?: string; advertencia?: string; driveUrl?: string; iaUrl?: string; datosJuzgado?: string; otraInfo?: string; compartidoCon?: string; categoria?: string; tareas: Tarea[]; pruebas: Prueba[]; honorarios?: Honorario[]; clientes?: ClienteJuicio[] }
type Asunto    = { id: string; nombre: string; tipo: string; estado: string; advertencia?: string; otraInfo?: string; driveUrl?: string; webUrl?: string; tareas: Tarea[] }

type JuicioForm = { autos: string; estado: string; nro: string; fuero: string; juzgado: string; secretaria: string; sala: string; advertencia: string; datosJuzgado: string; otraInfo: string; compartidoCon: string; categoria: string; driveUrl: string; iaUrl: string; pjnUrl: string }
type AsuntoForm = { nombre: string; tipo: string; estado: string; advertencia: string; otraInfo: string; driveUrl: string; webUrl: string }

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const FORM_JUICIO_VACIO: JuicioForm = { autos:"", estado:"Judicializado", nro:"", fuero:"", juzgado:"", secretaria:"", sala:"", advertencia:"", datosJuzgado:"", otraInfo:"", compartidoCon:"", categoria:"", driveUrl:"", iaUrl:"", pjnUrl:"" }
const FORM_ASUNTO_VACIO: AsuntoForm = { nombre:"", tipo:"probono", estado:"Abierta", advertencia:"", otraInfo:"", driveUrl:"", webUrl:"" }

const TODOS_ESTADOS_JUICIO = ["Inicio","Mediación","Administrativo","En preparación","Judicializado","Finalizado","Renunciado"]
const INACTIVOS = ["Finalizado","Renunciado"]

const ESTADOS_BG: Record<string,string>   = { "Judicializado":"#E6F1FB","En preparación":"#FAEEDA","Mediación":"#FAEEDA","Administrativo":"#FFF3E0","Inicio":"#FAEEDA","Finalizado":"#EAF3DE","Renunciado":"#F1EFE8" }
const ESTADOS_TX: Record<string,string>   = { "Judicializado":"#185FA5","En preparación":"#633806","Mediación":"#633806","Administrativo":"#7A4800","Inicio":"#633806","Finalizado":"#3B6D11","Renunciado":"#444441" }

const TIPOS_PRUEBA   = ["Confesional","Informativa","Testimonial","Reconocimiento","Pericial contable","Pericial informática","Pericial médica","Pericial técnica","Pericial (otra)"]
const ESTADOS_PRUEBA = ["Ofrecida","En curso","Desistida","Finalizada"]
const ESTADOS_HON    = ["Pendiente","Pago Parcial","Pago total"]
const TIPOS_TAREA    = ["Casos y Juicios","Pro Bono","Docencia","Consultoría","Asuntos Personales"]
const FRANJA: Record<string,string> = { "Casos y Juicios":"#3C3489","Pro Bono":"#3B6D11","Docencia":"#185FA5","Consultoría":"#7A4800","Personales":"#A32D2D","Asuntos Personales":"#A32D2D","General":"#444" }
const TOPBAR_BG: Record<string,string> = { tareas:"#F1EFE8", juicios:"#EEEDFE", probono:"#EAF3DE", docencia:"#E6F1FB", consultoria:"#FFF3E0", personales:"#FCEBEB", honorarios:"#FAEEDA", clientes:"#F5EFE6" }
const TOPBAR_TX: Record<string,string> = { tareas:"#444441", juicios:"#3C3489", probono:"#3B6D11", docencia:"#185FA5", consultoria:"#7A4800", personales:"#A32D2D", honorarios:"#633806", clientes:"#6B4226" }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseFecha(s: string): Date { const [y,m,d]=s.split("T")[0].split("-").map(Number); return new Date(y,m-1,d) }
function formatFecha(s: string): string { return parseFecha(s).toLocaleDateString("es-AR") }
function hoyDate(): Date { const h=new Date(); h.setHours(0,0,0,0); return h }

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession()

  // Estado global
  const [panel, setPanel]       = useState("tareas")
  const [juicios, setJuicios]   = useState<Juicio[]>([])
  const [asuntos, setAsuntos]   = useState<Asunto[]>([])
  const [tareas, setTareas]     = useState<Tarea[]>([])
  const [loading, setLoading]   = useState(true)

  // Vista congelada (panel tareas)
  const [vistaCongelada, setVistaCongelada] = useState<Tarea[]>([])
  const [cambios, setCambios]               = useState<Record<string,Partial<Tarea>>>({})

  // Expansión / tabs
  const [expandido, setExpandido]         = useState<string|null>(null)
  const [expandidoSet, setExpandidoSet]   = useState<Set<string>>(new Set())
  const [tabActiva, setTabActiva]         = useState<Record<string,string>>({})
  // Forms inline (por id de juicio/asunto)
  const [ntMap, setNtMap] = useState<Record<string,{texto:string;fecha:string;urgente:boolean}>>({})
  const [npMap, setNpMap] = useState<Record<string,{tipo:string;contenido:string;detalle:string;estado:string}>>({})
  const [nhMap, setNhMap] = useState<Record<string,{clienteContraparte:string;total:string;pagado:string;estado:string;observaciones:string}>>({})
  const [ncMap, setNcMap] = useState<Record<string,{apellido:string;nombre:string;dni:string;correo:string;telefono:string;domicilio:string}>>({})
  const [ntaMap, setNtaMap] = useState<Record<string,{texto:string;fecha:string;urgente:boolean}>>({}) // tareas de asuntos

  // Edición inline de tareas
  const [editId, setEditId]         = useState<string|null>(null)
  const [editTexto, setEditTexto]   = useState("")
  const [editFecha, setEditFecha]   = useState("")
  const [editUrgente, setEditUrgente] = useState(false)

  // Posponer
  const [posponerOpen, setPosponerOpen] = useState<string|null>(null)
  const [posponerFecha, setPosponerFecha] = useState("")

  // Mostrar concluidas dentro de juicio
  const [mostrarConc, setMostrarConc] = useState<Record<string,boolean>>({})

  // Filtros
  const [filtroTipos, setFiltroTipos]         = useState<string[]>([])
  const [filtroEstados, setFiltroEstados]     = useState<string[]>([])
  const [filtroAsuntos, setFiltroAsuntos]     = useState<string>("")
  const [filtroCategoria, setFiltroCategoria] = useState<string>("")
  const [ordenPrueba, setOrdenPrueba]         = useState<string>("")

  // Panel derecho (tareas)
  const [panelDerechoVisible, setPanelDerechoVisible] = useState(true)
  const [juicioSeleccionado, setJuicioSeleccionado]   = useState<string|null>(null)
  const [asuntoSeleccionado, setAsuntoSeleccionado]   = useState<string|null>(null)
  const [tareaSeleccionada, setTareaSeleccionada]     = useState<string|null>(null)

  // Barra lateral juicios (estadísticas)
  const [statsVisible, setStatsVisible] = useState(true)

  // Modal juicio
  const [modalJuicioOpen, setModalJuicioOpen]       = useState(false)
  const [editandoJuicio, setEditandoJuicio]          = useState<Juicio|null>(null)
  const [formJuicio, setFormJuicio]                  = useState<JuicioForm>(FORM_JUICIO_VACIO)
  const [saving, setSaving]                          = useState(false)

  // Modal asunto
  const [modalAsuntoOpen, setModalAsuntoOpen]   = useState(false)
  const [editandoAsunto, setEditandoAsunto]     = useState<Asunto|null>(null)
  const [formAsunto, setFormAsunto]             = useState<AsuntoForm>(FORM_ASUNTO_VACIO)

  // Búsqueda de clientes existentes
  const [clienteBusqueda, setClienteBusqueda]   = useState<Record<string,string>>({})
  const [clienteSugerencias, setClienteSugerencias] = useState<Record<string,ClienteJuicio[]>>({})

  // Nueva tarea personal
  const [ntPersonal, setNtPersonal] = useState({texto:"",fecha:"",urgente:false,info:"",webUrl:""})

  useEffect(() => {
    if (expandido) {
      setTimeout(() => {
        const el = document.getElementById(`item-${expandido}`)
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" })
      }, 80)
    }
  }, [expandido])

  useEffect(() => {
    if (session && loading) {
      Promise.all([
        fetch("/api/juicios").then(r=>r.json()),
        fetch("/api/tareas").then(r=>r.json()),
        fetch("/api/asuntos").then(r=>r.json()).catch(()=>[]),
      ]).then(([j,t,a]) => {
        const js = Array.isArray(j)?j:[]
        const ts = Array.isArray(t)?t:[]
        const as_ = Array.isArray(a)?a:[]
        setJuicios(js)
        setAsuntos(as_)
        setTareas(ts)
        setVistaCongelada(ts.filter(x=>!x.done))
        setExpandidoSet(new Set(as_.map((x:Asunto)=>x.id)))
        setLoading(false)
      }).catch(()=>setLoading(false))
    }
  }, [session])

  if (status==="loading") return <div style={S.loading}>Cargando...</div>
  if (!session) return (
    <div style={S.login}><div style={S.loginCard}>
      <div style={{fontSize:28,fontWeight:500,marginBottom:8}}>Agenda Legal</div>
      <div style={{color:"#888",marginBottom:24,fontSize:14}}>Tu gestor de juicios y tareas</div>
      <button style={S.btnGoogle} onClick={()=>signIn("google")}>Entrar con Google</button>
    </div></div>
  )

  // ─── CÁLCULOS BASE ───────────────────────────────────────────────────────────
  const hoy = hoyDate()
  const inactivosSet = new Set(juicios.filter(j=>INACTIVOS.includes(j.estado)).map(j=>j.id))
  const tareasActivas = tareas.filter(t=>!t.done && !(t.juicioId&&inactivosSet.has(t.juicioId)))

  const esAtrasada = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha)<hoy }
  const esHoy_     = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha).getTime()===hoy.getTime() }
  const esProxima  = (t:Tarea) => !esAtrasada(t)&&!esHoy_(t)

  // Vista congelada con cambios aplicados visualmente
  const vistaActual = vistaCongelada
    .filter(t=>!(t.juicioId&&inactivosSet.has(t.juicioId)))
    .map(t=>({...t,...(cambios[t.id]||{})}))

  // recienCompletadas: tareas que se marcaron done en esta sesión (cambios) pero aún están en vistaCongelada
  // Se muestran tachadas/opacas en su sección original hasta que se presione "Actualizar vista"
  const recienCompletadas = vistaActual.filter(t=>t.done&&cambios[t.id]?.done===true)

  const urgentesArriba = vistaActual.filter(t=>!t.done&&t.urgente&&(esAtrasada(t)||esHoy_(t)))
  // Para cada sección incluimos también las recién completadas que "pertenecían" a ella
  const urgentesCompletadas = recienCompletadas.filter(t=>t.urgente&&(esAtrasada(t)||esHoy_(t)))
  const atrasadas      = vistaActual.filter(t=>!t.done&&esAtrasada(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const atrasadasCompletadas = recienCompletadas.filter(t=>esAtrasada(t)&&!urgentesCompletadas.find(u=>u.id===t.id))
  const vencenHoy      = vistaActual.filter(t=>!t.done&&esHoy_(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const vencenHoyCompletadas = recienCompletadas.filter(t=>esHoy_(t)&&!urgentesCompletadas.find(u=>u.id===t.id))
  const proximas       = vistaActual.filter(t=>!t.done&&esProxima(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const proximasCompletadas = recienCompletadas.filter(t=>esProxima(t))
  const hayPendientes  = Object.keys(cambios).length > 0

  const tareasFiltradas = vistaActual
    .filter(t=>{
      if(filtroTipos.length===0) return true
      const label = t.tipo==="Juicio"?"Casos y Juicios":t.tipo==="Personales"?"Asuntos Personales":t.tipo||"Casos y Juicios"
      return filtroTipos.includes(label)
    })
    .sort((a,b)=>{
      if(a.urgente&&!b.urgente)return -1; if(!a.urgente&&b.urgente)return 1
      if(!a.fecha&&!b.fecha)return 0; if(!a.fecha)return 1; if(!b.fecha)return -1
      return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()
    })

  const juiciosFiltrados = juicios
    .filter(j=>(filtroEstados.length===0?!INACTIVOS.includes(j.estado):filtroEstados.includes(j.estado))&&(!filtroCategoria||j.categoria===filtroCategoria))
    .sort((a,b)=>a.autos.localeCompare(b.autos,"es"))

  const honorariosPendientes = juicios.flatMap(j=>
    (j.honorarios||[]).filter(h=>h.estado!=="Pago total").map(h=>({...h,autos:j.autos}))
  )

  // Todos los clientes cargados en cualquier juicio (para autocompletar)
  const todosClientes: ClienteJuicio[] = juicios.flatMap(j=>j.clientes||[])

  // ─── ACCIONES TAREAS (sin "Actualizar vista" — van directo a API y cambios) ──
  // NOTA: toggleDone, posponer y toggleUrgente guardan en cambios[] PERO también
  // persisten en la API inmediatamente. La vista no se reordena hasta "Actualizar".
  const toggleDone = (t:Tarea) => {
    const doneActual = cambios[t.id]?.done ?? t.done
    if (!doneActual && t.juicioId) {
      const j = juicios.find(j=>j.id===t.juicioId)
      if (j && !INACTIVOS.includes(j.estado) && j.tareas.filter(x=>!x.done).length===1) {
        alert("No puede eliminarse la última tarea de un juicio activo.")
        return
      }
    }
    const nuevoDone = !doneActual
    // Persiste en API
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,done:nuevoDone})})
    // Solo registra en cambios — NO reordena vistaCongelada
    setCambios(p=>({...p,[t.id]:{...p[t.id],done:nuevoDone}}))
  }

  const toggleUrgente = (t:Tarea) => {
    const nuevoUrgente = !(cambios[t.id]?.urgente ?? t.urgente)
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,urgente:nuevoUrgente})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],urgente:nuevoUrgente}}))
  }

  const posponer = (t:Tarea) => {
    if (!posponerFecha) return
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,fecha:posponerFecha})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],fecha:posponerFecha}}))
    setPosponerOpen(null); setPosponerFecha("")
  }

  const guardarEdicion = (t:Tarea) => {
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,texto:editTexto,urgente:editUrgente,fecha:editFecha||null})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],texto:editTexto,urgente:editUrgente,fecha:editFecha||undefined}}))
    setEditId(null)
  }

  // Actualizar vista: reordena y limpia cambios
  const actualizarVista = () => {
    const nuevasTareas = tareas.map(t=>cambios[t.id]?{...t,...cambios[t.id]}:t)
    setTareas(nuevasTareas)
    setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(t=>cambios[t.id]?{...t,...cambios[t.id]}:t)})))
    const nuevaVista = nuevasTareas
      .filter(t=>!t.done&&!(t.juicioId&&inactivosSet.has(t.juicioId)))
      .sort((a,b)=>{
        if(a.urgente&&!b.urgente)return -1; if(!a.urgente&&b.urgente)return 1
        if(!a.fecha&&!b.fecha)return 0; if(!a.fecha)return 1; if(!b.fecha)return -1
        return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()
      })
    setVistaCongelada(nuevaVista)
    setCambios({})
  }

  // ─── ACCIONES JUICIOS ────────────────────────────────────────────────────────
  const abrirNuevoJuicio = () => { setEditandoJuicio(null); setFormJuicio(FORM_JUICIO_VACIO); setModalJuicioOpen(true) }
  const abrirEditarJuicio = (j:Juicio, e:React.MouseEvent) => {
    e.stopPropagation()
    setEditandoJuicio(j)
    setFormJuicio({ autos:j.autos||"", estado:j.estado||"Judicializado", nro:j.nro||"", fuero:j.fuero||"", juzgado:j.juzgado||"", secretaria:j.secretaria||"", sala:j.sala||"", advertencia:j.advertencia||"", datosJuzgado:j.datosJuzgado||"", otraInfo:j.otraInfo||"", compartidoCon:j.compartidoCon||"", categoria:j.categoria||"", driveUrl:j.driveUrl||"", iaUrl:j.iaUrl||"", pjnUrl:(j as any).pjnUrl||"" })
    setModalJuicioOpen(true)
  }

  const guardarJuicio = async () => {
    if (!formJuicio.autos.trim()) { alert("El nombre del juicio es obligatorio"); return }
    setSaving(true)
    try {
      if (editandoJuicio) {
        await fetch("/api/juicios",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editandoJuicio.id,...formJuicio})})
        setJuicios(js=>js.map(j=>j.id===editandoJuicio.id?{...j,...formJuicio}:j))
      } else {
        const res = await fetch("/api/juicios",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(formJuicio)})
        const nuevo = await res.json()
        setJuicios(js=>[{...nuevo,tareas:[],pruebas:[],honorarios:[],clientes:[]},...js])
      }
      setModalJuicioOpen(false)
    } catch { alert("Error al guardar") }
    setSaving(false)
  }

  const eliminarJuicio = async (j:Juicio, e:React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar "${j.autos}"?`)) return
    if (!confirm("Confirmación final: se eliminarán todas las tareas, pruebas y honorarios asociados. ¿Continuar?")) return
    await fetch("/api/juicios",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:j.id})})
    setJuicios(js=>js.filter(x=>x.id!==j.id))
  }

  // ─── ACCIONES ASUNTOS ────────────────────────────────────────────────────────
  const abrirNuevoAsunto = (tipo:string) => { setEditandoAsunto(null); setFormAsunto({...FORM_ASUNTO_VACIO,tipo}); setModalAsuntoOpen(true) }
  const abrirEditarAsunto = (a:Asunto, e:React.MouseEvent) => {
    e.stopPropagation()
    setEditandoAsunto(a)
    setFormAsunto({ nombre:a.nombre||"", tipo:a.tipo||"probono", estado:a.estado||"Abierta", advertencia:a.advertencia||"", otraInfo:a.otraInfo||"", driveUrl:a.driveUrl||"", webUrl:a.webUrl||"" })
    setModalAsuntoOpen(true)
  }

  const guardarAsunto = async () => {
    if (!formAsunto.nombre.trim()) { alert("El nombre es obligatorio"); return }
    setSaving(true)
    try {
      if (editandoAsunto) {
        await fetch("/api/asuntos",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editandoAsunto.id,...formAsunto})})
        setAsuntos(as=>as.map(a=>a.id===editandoAsunto.id?{...a,...formAsunto}:a))
      } else {
        const res = await fetch("/api/asuntos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(formAsunto)})
        const nuevo = await res.json()
        setAsuntos(as=>[{...nuevo,tareas:[]},...as])
        setExpandidoSet(s=>{const n=new Set(s);n.add(nuevo.id);return n})
      }
      setModalAsuntoOpen(false)
    } catch { alert("Error al guardar") }
    setSaving(false)
  }

  const eliminarAsunto = async (a:Asunto, e:React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar "${a.nombre}"?`)) return
    if (!confirm("Confirmación final: se eliminarán todas las tareas asociadas. ¿Continuar?")) return
    await fetch("/api/asuntos",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id})})
    setAsuntos(as=>as.filter(x=>x.id!==a.id))
  }

  // ─── ACCIONES TAREAS DE JUICIO ───────────────────────────────────────────────
  const agregarTareaJuicio = async (juicioId:string) => {
    const nt = ntMap[juicioId]||{texto:"",fecha:"",urgente:false}
    if (!nt.texto.trim()) return
    const body:any={texto:nt.texto,juicioId,urgente:nt.urgente,tipo:"Juicio"}
    if(nt.fecha) body.fecha=nt.fecha
    const res = await fetch("/api/tareas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    if(!res.ok){alert("Error al agregar tarea");return}
    const t = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,tareas:[...j.tareas,t]}:j))
    setTareas(ts=>[...ts,t])
    setVistaCongelada(vs=>[...vs,t])
    setNtMap(p=>({...p,[juicioId]:{texto:"",fecha:"",urgente:false}}))
  }

  // ─── ACCIONES TAREAS DE ASUNTO ───────────────────────────────────────────────
  const agregarTareaAsunto = async (asuntoId:string, tipo:string) => {
    const nt = ntaMap[asuntoId]||{texto:"",fecha:"",urgente:false}
    if (!nt.texto.trim()) return
    const body:any={texto:nt.texto,asuntoId,urgente:nt.urgente,tipo}
    if(nt.fecha) body.fecha=nt.fecha
    const res = await fetch("/api/tareas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    if(!res.ok){alert("Error al agregar tarea");return}
    const t = await res.json()
    setAsuntos(as=>as.map(a=>a.id===asuntoId?{...a,tareas:[...a.tareas,t]}:a))
    setTareas(ts=>[...ts,t])
    setVistaCongelada(vs=>[...vs,t])
    setNtaMap(p=>({...p,[asuntoId]:{texto:"",fecha:"",urgente:false}}))
  }

  // ─── TAREAS PERSONALES ───────────────────────────────────────────────────────
  const agregarTareaPersonal = async () => {
    if (!ntPersonal.texto.trim()) return
    const body:any={texto:ntPersonal.texto,urgente:ntPersonal.urgente,tipo:"Personales"}
    if(ntPersonal.fecha) body.fecha=ntPersonal.fecha
    if(ntPersonal.info) body.info=ntPersonal.info
    if(ntPersonal.webUrl) body.webUrl=ntPersonal.webUrl
    const res = await fetch("/api/tareas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    if(!res.ok){alert("Error al agregar tarea");return}
    const t = await res.json()
    setTareas(ts=>[...ts,t])
    setVistaCongelada(vs=>[...vs,t])
    setNtPersonal({texto:"",fecha:"",urgente:false,info:"",webUrl:""})
  }

  const eliminarTareaPersonal = async (tareaId:string) => {
    if(!confirm("¿Eliminar esta actividad personal?")) return
    await fetch("/api/tareas",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:tareaId})})
    setTareas(ts=>ts.filter(t=>t.id!==tareaId))
    setVistaCongelada(vs=>vs.filter(t=>t.id!==tareaId))
    setCambios(p=>{const c={...p};delete c[tareaId];return c})
  }

  // ─── PRUEBAS ─────────────────────────────────────────────────────────────────
  const agregarPrueba = async (juicioId:string) => {
    const np = npMap[juicioId]||{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}
    if(!np.tipo) return
    const res = await fetch("/api/pruebas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tipo:np.tipo,contenido:np.contenido,detalle:np.detalle,estado:np.estado,juicioId})})
    if(!res.ok){alert("Error al agregar prueba");return}
    const p = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,pruebas:[...j.pruebas,p]}:j))
    setNpMap(p2=>({...p2,[juicioId]:{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}}))
  }

  const borrarPrueba = async (juicioId:string,pruebaId:string) => {
    await fetch("/api/pruebas",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:pruebaId})})
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,pruebas:j.pruebas.filter(p=>p.id!==pruebaId)}:j))
  }

  // ─── HONORARIOS ──────────────────────────────────────────────────────────────
  const agregarHonorario = async (juicioId:string) => {
    const nh = nhMap[juicioId]||{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}
    if(!nh.clienteContraparte.trim()) return
    const res = await fetch("/api/honorarios",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...nh,juicioId})})
    if(!res.ok){alert("Error al agregar honorario");return}
    const h = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,honorarios:[...(j.honorarios||[]),h]}:j))
    setNhMap(p=>({...p,[juicioId]:{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}}))
  }

  // ─── CLIENTES ────────────────────────────────────────────────────────────────
  const agregarCliente = async (juicioId:string) => {
    const nc = ncMap[juicioId]||{apellido:"",nombre:"",dni:"",correo:"",telefono:"",domicilio:""}
    if(!nc.apellido.trim()) return
    const res = await fetch("/api/clientes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...nc,juicioId})})
    if(!res.ok){alert("Error al agregar cliente");return}
    const c = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,clientes:[...(j.clientes||[]),c]}:j))
    setNcMap(p=>({...p,[juicioId]:{apellido:"",nombre:"",dni:"",correo:"",telefono:"",domicilio:""}}))
    setClienteBusqueda(p=>({...p,[juicioId]:""}))
    setClienteSugerencias(p=>({...p,[juicioId]:[]}))
  }

  const borrarCliente = async (juicioId:string, clienteId:string) => {
    await fetch("/api/clientes",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:clienteId})})
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,clientes:(j.clientes||[]).filter(c=>c.id!==clienteId)}:j))
  }

  const buscarClientes = (juicioId:string, q:string) => {
    setClienteBusqueda(p=>({...p,[juicioId]:q}))
    if(q.length<2){setClienteSugerencias(p=>({...p,[juicioId]:[]}));return}
    const ql=q.toLowerCase()
    const sugs = todosClientes.filter(c=>(c.apellido+c.nombre).toLowerCase().includes(ql)).slice(0,5)
    setClienteSugerencias(p=>({...p,[juicioId]:sugs}))
  }

  const seleccionarClienteSugerencia = (juicioId:string, c:ClienteJuicio) => {
    setNcMap(p=>({...p,[juicioId]:{apellido:c.apellido,nombre:c.nombre,dni:c.dni||"",correo:c.correo||"",telefono:c.telefono||"",domicilio:c.domicilio||""}}))
    setClienteBusqueda(p=>({...p,[juicioId]:""}))
    setClienteSugerencias(p=>({...p,[juicioId]:[]}))
  }

  // ─── BACKUP ──────────────────────────────────────────────────────────────────
  const descargarBackup = async () => {
    try {
      const res = await fetch("/api/backup")
      if(!res.ok){alert("Error al generar backup");return}
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href=url; a.download=`backup-agenda-legal-${new Date().toISOString().split("T")[0]}.xlsx`
      a.click(); URL.revokeObjectURL(url)
    } catch { alert("Error al descargar backup") }
  }

  // ─── RENDER: TAREA (panel tareas) ────────────────────────────────────────────
  const renderTarea = (t:Tarea) => {
    const isDone   = cambios[t.id]?.done    ?? t.done
    const urgente  = cambios[t.id]?.urgente ?? t.urgente
    const fecha    = cambios[t.id]?.fecha   ?? t.fecha
    const texto    = cambios[t.id]?.texto   ?? t.texto
    const isEdit   = editId===t.id
    const tipoLabel = t.tipo==="Juicio"?"Casos y Juicios":t.tipo==="Personales"?"Asuntos Personales":t.tipo||"Casos y Juicios"
    const franja   = FRANJA[tipoLabel]||FRANJA[t.tipo||""]||"#888"
    const bgColor  = isDone?"#f9f9f8":urgente?"#FFF0F0":esAtrasada({...t,fecha})?"#F5F0FF":"#fff"
    const bdrColor = isDone?"#e5e7eb":urgente?"#E24B4A":esAtrasada({...t,fecha})?"#C9A8F0":"#e5e7eb"
    const juicioInfo = t.juicioId ? juicios.find(j=>j.id===t.juicioId) : null
    const driveUrl   = juicioInfo?.driveUrl
    const pjnUrl     = (juicioInfo as any)?.pjnUrl || (juicioInfo?.nro&&juicioInfo.nro!=="Iniciar"?"https://scw.pjn.gov.ar/scw/home.seam":null)
    return (
      <div key={t.id}
        style={{display:"flex",width:"100%",background:bgColor,border:`0.5px solid ${bdrColor}`,borderRadius:10,marginBottom:6,overflow:"visible",opacity:isDone?0.65:1,cursor:"default",boxSizing:"border-box"}}
        onClick={e=>{
          const tg=e.target as HTMLElement
          if(tg.closest("button")||tg.closest("a")||tg.closest(".check-box")||tg.closest(".caratula"))return
          if(t.juicioId){setJuicioSeleccionado(t.juicioId);setAsuntoSeleccionado(null);setTareaSeleccionada(t.id);if(!panelDerechoVisible)setPanelDerechoVisible(true)}
          else if(t.asuntoId){setAsuntoSeleccionado(t.asuntoId);setJuicioSeleccionado(null);setTareaSeleccionada(t.id);if(!panelDerechoVisible)setPanelDerechoVisible(true)}
        }}
      >
        <div style={{width:5,flexShrink:0,background:franja,borderRadius:"10px 0 0 10px"}}/>
        <div style={{flex:1,padding:"11px 13px",minWidth:0}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
            <div className="check-box" style={{...S.check,...(isDone?S.checkDone:{})}} onClick={e=>{e.stopPropagation();toggleDone(t)}}>{isDone?"✓":""}</div>
            <div style={{flex:1,minWidth:0}}>
              <span className="caratula"
                style={{fontSize:14,fontWeight:600,color:isDone?"#aaa":franja,cursor:"pointer",lineHeight:1.4,textDecoration:isDone?"line-through":"none"}}
                onClick={e=>{e.stopPropagation();if(t.juicioId){setPanel("juicios");setExpandido(t.juicioId);setTabActiva(p=>({...p,[t.juicioId!]:"tareas"}))}}}
              >{t.juicio?.autos||t.tema||tipoLabel}</span>
              {isEdit?(
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  <input style={{...S.input,fontSize:13}} value={editTexto} onChange={e=>setEditTexto(e.target.value)} autoFocus/>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <input type="date" style={{...S.input,width:150}} value={editFecha} onChange={e=>setEditFecha(e.target.value)}/>
                    <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                      <input type="checkbox" checked={editUrgente} onChange={e=>setEditUrgente(e.target.checked)}/> Urgente
                    </label>
                    <button style={S.btnPrimary} onClick={e=>{e.stopPropagation();guardarEdicion(t)}}>Guardar</button>
                    <button style={S.btn} onClick={e=>{e.stopPropagation();setEditId(null)}}>✕</button>
                  </div>
                </div>
              ):(
                <div style={{fontSize:14,color:isDone?"#aaa":"#222",textDecoration:isDone?"line-through":"none",marginTop:4,lineHeight:1.35}}>{texto}</div>
              )}
            </div>
            {!isEdit&&!isDone&&(
              <button style={S.btnEdit} onClick={e=>{e.stopPropagation();setEditId(t.id);setEditTexto(texto);setEditFecha(fecha?fecha.split("T")[0]:"");setEditUrgente(urgente)}}>✎</button>
            )}
          </div>
          {!isEdit&&(
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:9,paddingTop:8,borderTop:"0.5px solid #ebebeb",flexWrap:"wrap"}}>
              {driveUrl&&<a href={driveUrl} target="_blank" rel="noopener noreferrer" style={S.linkDrive} onClick={e=>e.stopPropagation()}>📁 Drive</a>}
              {pjnUrl&&<a href={pjnUrl} target="_blank" rel="noopener noreferrer" style={S.linkPjn} onClick={e=>e.stopPropagation()}>⚖ PJN</a>}
              {fecha&&<span style={{fontSize:12,color:"#555",fontWeight:500,whiteSpace:"nowrap",marginLeft:"auto"}}>{formatFecha(fecha)}</span>}
              {!isDone&&(
                <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
                  <button style={S.btnPosponer} onClick={()=>{setPosponerOpen(posponerOpen===t.id?null:t.id);setPosponerFecha("")}}>↷ Posponer</button>
                  {posponerOpen===t.id&&(
                    <div style={{position:"absolute",top:30,right:0,background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:8,padding:"8px 10px",boxShadow:"0 4px 12px rgba(0,0,0,0.12)",zIndex:100,display:"flex",gap:6,alignItems:"center",whiteSpace:"nowrap"}}>
                      <input type="date" style={{fontSize:12,padding:"3px 6px",border:"0.5px solid #ccc",borderRadius:6}} value={posponerFecha} onChange={e=>setPosponerFecha(e.target.value)}/>
                      <button style={{fontSize:11,padding:"3px 8px",background:"#378ADD",color:"#fff",border:"none",borderRadius:6,cursor:"pointer"}} onClick={()=>posponer(t)}>OK</button>
                    </div>
                  )}
                </div>
              )}
              {!isDone&&<button style={{...S.btnUrgente,...(urgente?{background:"#E24B4A",color:"#fff"}:{})}} onClick={e=>{e.stopPropagation();toggleUrgente(t)}}>! urgente</button>}
              {!isDone&&t.tipo==="Personales"&&<button style={{...S.btnMini,color:"#E24B4A"}} onClick={e=>{e.stopPropagation();eliminarTareaPersonal(t.id)}}>✕</button>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const seccion = (label:string, items:Tarea[], completadas:Tarea[], color?:string) => {
    const todas = [...items, ...completadas]
    if(todas.length===0)return null
    return (
      <div key={label}>
        <div style={{...S.sectionLabel,color:color||"#888"}}>{label}</div>
        {todas.map(t=>renderTarea(t))}
      </div>
    )
  }

  // ─── RENDER: PANEL DERECHO ────────────────────────────────────────────────────
  const juicioPanel = juicioSeleccionado ? juicios.find(j=>j.id===juicioSeleccionado) : null
  const asuntoPanel = asuntoSeleccionado ? asuntos.find(a=>a.id===asuntoSeleccionado) : null
  const renderPanelDerecho = () => {
    if (!juicioPanel && !asuntoPanel) return (
      <div style={{padding:"18px 16px"}}>
        <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:"0.06em",marginBottom:14}}>RESUMEN</div>
        {[
          {num:tareasActivas.filter(t=>esHoy_(t)).length, label:"Vencen hoy",  color:"#378ADD"},
          {num:tareasActivas.filter(t=>t.urgente).length, label:"Urgentes",    color:"#E24B4A"},
          {num:tareasActivas.filter(t=>esAtrasada(t)).length, label:"Atrasadas",color:"#9B59B6"},
          {num:tareasActivas.length,                       label:"Total activas",color:"#111"},
        ].map(m=>(
          <div key={m.label} style={{background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:10,padding:"14px 16px",marginBottom:8}}>
            <div style={{fontSize:28,fontWeight:500,color:m.color}}>{m.num}</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>{m.label}</div>
          </div>
        ))}
      </div>
    )
    if (asuntoPanel) {
      const tipoLabel = asuntoPanel.tipo==="probono"?"Pro Bono":asuntoPanel.tipo==="consultoria"?"Consultoría":"Docencia"
      const color = FRANJA[tipoLabel]||"#888"
      const otrasTareas = asuntoPanel.tareas.filter(t=>!t.done&&t.id!==tareaSeleccionada)
      return (
        <div style={{padding:"18px 16px"}}>
          <span style={{fontSize:11,color:"#aaa",cursor:"pointer",marginBottom:12,display:"inline-block"}} onClick={()=>setAsuntoSeleccionado(null)}>← volver</span>
          <div style={{fontSize:14,fontWeight:600,color,marginBottom:6,lineHeight:1.4}}>{asuntoPanel.nombre}</div>
          <div style={{...S.badge,background:asuntoPanel.estado==="Abierta"?"#E6F1FB":"#EAF3DE",color:asuntoPanel.estado==="Abierta"?"#185FA5":"#3B6D11",display:"inline-block",marginBottom:10}}>{asuntoPanel.estado}</div>
          {asuntoPanel.advertencia&&<div style={{fontSize:12,color:"#A32D2D",background:"#fff5f5",border:"0.5px solid #f5c5c5",borderRadius:6,padding:"6px 10px",marginBottom:10}}>⚠ {asuntoPanel.advertencia}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
            {asuntoPanel.driveUrl&&<a href={asuntoPanel.driveUrl} target="_blank" rel="noopener noreferrer" style={S.pjLink}>📁 Drive</a>}
            {asuntoPanel.webUrl&&<a href={asuntoPanel.webUrl} target="_blank" rel="noopener noreferrer" style={{...S.pjLink,color:"#185FA5"}}>🌐 Web</a>}
          </div>
          {asuntoPanel.otraInfo&&<div style={{marginTop:10}}><div style={S.fieldLabel}>INFORMACIÓN</div><div style={{fontSize:13}}>{asuntoPanel.otraInfo}</div></div>}
          {otrasTareas.length>0&&(
            <div style={{marginTop:14,paddingTop:12,borderTop:"0.5px solid #e5e7eb"}}>
              <div style={S.fieldLabel}>TAREAS PENDIENTES</div>
              {otrasTareas.map(t=>(
                <div key={t.id} style={{fontSize:12,color:"#333",padding:"5px 0",borderBottom:"0.5px solid #f0f0f0"}}>{t.texto}{t.fecha?` · ${formatFecha(t.fecha)}`:""}</div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (juicioPanel) {
      const otrasTareas = juicioPanel.tareas.filter(t=>!t.done&&t.id!==tareaSeleccionada)
      return (
        <div style={{padding:"18px 16px"}}>
          <span style={{fontSize:11,color:"#aaa",cursor:"pointer",marginBottom:12,display:"inline-block"}} onClick={()=>setJuicioSeleccionado(null)}>← volver</span>
          <div style={{fontSize:14,fontWeight:600,color:FRANJA["Casos y Juicios"],marginBottom:6,lineHeight:1.4}}>{juicioPanel.autos}</div>
          <div style={{...S.badge,background:ESTADOS_BG[juicioPanel.estado]||"#F1EFE8",color:ESTADOS_TX[juicioPanel.estado]||"#444",display:"inline-block",marginBottom:10}}>{juicioPanel.estado}</div>
          {juicioPanel.advertencia&&<div style={{fontSize:12,color:"#A32D2D",background:"#fff5f5",border:"0.5px solid #f5c5c5",borderRadius:6,padding:"6px 10px",marginBottom:10}}>⚠ {juicioPanel.advertencia}</div>}
          {juicioPanel.nro&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>EXPEDIENTE</div><div style={{fontSize:13}}>{juicioPanel.nro}</div></div>}
          {juicioPanel.fuero&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>FUERO</div><div style={{fontSize:13}}>{juicioPanel.fuero}</div></div>}
          {juicioPanel.juzgado&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>JUZGADO</div><div style={{fontSize:13}}>Juz. {parseInt(juicioPanel.juzgado)||juicioPanel.juzgado}{juicioPanel.secretaria?` · Sec. ${juicioPanel.secretaria}`:""}</div></div>}
          {juicioPanel.compartidoCon&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>COMPARTIDO CON</div><div style={{fontSize:13}}>{juicioPanel.compartidoCon}</div></div>}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:12}}>
            {juicioPanel.driveUrl&&<a href={juicioPanel.driveUrl} target="_blank" rel="noopener noreferrer" style={S.pjLink}>📁 Drive</a>}
            {(juicioPanel as any).pjnUrl&&<a href={(juicioPanel as any).pjnUrl} target="_blank" rel="noopener noreferrer" style={{...S.pjLink,color:"#185FA5",borderColor:"#b5d4f4",background:"#E6F1FB"}}>⚖ PJN</a>}
            {juicioPanel.iaUrl&&<a href={juicioPanel.iaUrl} target="_blank" rel="noopener noreferrer" style={{...S.pjLink,color:"#7B3F9E",borderColor:"#d5b5f5",background:"#f5eeff"}}>🤖 IA</a>}
          </div>
          {otrasTareas.length>0&&(
            <div style={{marginTop:14,paddingTop:12,borderTop:"0.5px solid #e5e7eb"}}>
              <div style={S.fieldLabel}>TAREAS PENDIENTES</div>
              {otrasTareas.map(t=>(
                <div key={t.id} style={{fontSize:12,color:"#333",padding:"5px 0",borderBottom:"0.5px solid #f0f0f0"}}>{t.texto}{t.fecha?` · ${formatFecha(t.fecha)}`:""}</div>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  // ─── RENDER: JUICIO CARD ─────────────────────────────────────────────────────
  const renderJuicio = (j:Juicio) => {
    const exp      = expandido===j.id
    const tab      = tabActiva[j.id]||"tareas"
    const nt       = ntMap[j.id]||{texto:"",fecha:"",urgente:false}
    const np       = npMap[j.id]||{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}
    const nh       = nhMap[j.id]||{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}
    const nc       = ncMap[j.id]||{apellido:"",nombre:"",dni:"",correo:"",telefono:"",domicilio:""}
    const activas  = j.tareas.filter(t=>!t.done).sort((a,b)=>{if(a.urgente&&!b.urgente)return -1;if(!a.urgente&&b.urgente)return 1;if(!a.fecha)return 1;if(!b.fecha)return -1;return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()})
    const concluidas = j.tareas.filter(t=>t.done).slice(-5)
    const primerCliente = (j.clientes||[])[0]
    const busq     = clienteBusqueda[j.id]||""
    const sugs     = clienteSugerencias[j.id]||[]

    return (
      <div key={j.id} id={`item-${j.id}`} style={{...S.card,borderColor:exp?"#378ADD":"#e5e7eb"}}>
        <div style={S.cardHeader} onClick={()=>{setExpandido(exp?null:j.id);if(!tabActiva[j.id])setTabActiva(p=>({...p,[j.id]:"tareas"}))}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500,lineHeight:1.35,color:FRANJA["Casos y Juicios"]}}>{j.autos}</div>
            <div style={S.cardMeta}>
              {primerCliente?`${primerCliente.apellido}, ${primerCliente.nombre}`:`${j.nro&&j.nro!=="Iniciar"?`Expte. ${j.nro} · `:""}${j.fuero||""}${j.juzgado?` · Juz. ${parseInt(j.juzgado)||j.juzgado}`:""}`}
            </div>
            {j.advertencia&&<div style={{fontSize:11,color:"#A32D2D",marginTop:3,fontWeight:500}}>⚠ {j.advertencia}</div>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            <span style={{...S.badge,background:ESTADOS_BG[j.estado]||"#F1EFE8",color:ESTADOS_TX[j.estado]||"#444"}}>{j.estado}</span>
            <button style={S.btnMini} onClick={e=>abrirEditarJuicio(j,e)} title="Editar">✎</button>
            <button style={{...S.btnMini,color:"#E24B4A"}} onClick={e=>eliminarJuicio(j,e)} title="Eliminar">✕</button>
          </div>
        </div>

        {exp&&(
          <div style={{padding:"0 14px 14px"}} onClick={e=>e.stopPropagation()}>
            {/* Links rápidos */}
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              {j.driveUrl&&<a href={j.driveUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#4285F4"}}>📁 Drive</a>}
              {(j as any).pjnUrl&&<a href={(j as any).pjnUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#185FA5"}}>⚖ PJN</a>}
              {j.iaUrl&&<a href={j.iaUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#7B3F9E"}}>🤖 IA</a>}
            </div>

            {/* Tabs */}
            <div style={S.tabs}>
              {["tareas","pruebas","honorarios","clientes"].map(t=>(
                <div key={t} style={{...S.tab,...(tab===t?S.tabActive:{})}} onClick={()=>setTabActiva(p=>({...p,[j.id]:t}))}>
                  {t==="tareas"?`Tareas (${activas.length})`:t==="pruebas"?`Prueba (${j.pruebas.length})`:t==="honorarios"?`Honorarios (${(j.honorarios||[]).length})`:`Clientes (${(j.clientes||[]).length})`}
                </div>
              ))}
            </div>

            {/* ── Tab Tareas ── */}
            {tab==="tareas"&&(
              <div>
                {activas.map(t=>(
                  <div key={t.id} style={{...S.card,background:t.urgente?"#FFF0F0":esAtrasada(t)?"#F5F0FF":"#fff",borderColor:t.urgente?"#E24B4A":esAtrasada(t)?"#C9A8F0":"#e5e7eb",marginBottom:6,display:"flex",overflow:"hidden"}}>
                    <div style={{width:4,flexShrink:0,background:FRANJA["Casos y Juicios"],borderRadius:"12px 0 0 12px"}}/>
                    <div style={{flex:1}}>
                    <div style={S.cardHeader}>
                      <div style={{...S.check,...(t.done?S.checkDone:{})}} onClick={()=>toggleDone(t)}>{t.done?"✓":""}</div>
                      <div style={{flex:1,marginLeft:8,fontSize:13}}>{t.texto}</div>
                      {t.urgente&&<span style={{fontSize:10,color:"#A32D2D",fontWeight:600,background:"#FCEBEB",padding:"1px 6px",borderRadius:8}}>URG</span>}
                      {t.fecha&&<span style={{fontSize:11,color:"#888",whiteSpace:"nowrap"}}>{formatFecha(t.fecha)}</span>}
                      <button style={{...S.btnMini,color:t.urgente?"#A32D2D":"#aaa",fontWeight:700}} onClick={()=>toggleUrgente(t)}>!</button>
                      <button style={S.btnMini} onClick={()=>{setEditId(t.id);setEditTexto(t.texto);setEditFecha(t.fecha?t.fecha.split("T")[0]:"");setEditUrgente(t.urgente)}}>✎</button>
                    </div>
                    {editId===t.id&&(
                      <div style={{padding:"0 14px 10px",display:"flex",gap:6,flexWrap:"wrap"}}>
                        <input style={{...S.input,flex:"3 1 180px"}} value={editTexto} onChange={e=>setEditTexto(e.target.value)} autoFocus/>
                        <input type="date" style={{...S.input,flex:"1 1 130px"}} value={editFecha} onChange={e=>setEditFecha(e.target.value)}/>
                        <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={editUrgente} onChange={e=>setEditUrgente(e.target.checked)}/> Urgente</label>
                        <button style={S.btnPrimary} onClick={()=>guardarEdicion(t)}>Guardar</button>
                        <button style={S.btn} onClick={()=>setEditId(null)}>✕</button>
                      </div>
                    )}
                    </div>
                  </div>
                ))}
                {activas.length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin tareas activas</div>}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <input style={{...S.input,flex:"3 1 200px"}} placeholder="Nueva tarea..." value={nt.texto} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,texto:e.target.value}}))} onKeyDown={e=>e.key==="Enter"&&agregarTareaJuicio(j.id)}/>
                  <input type="date" style={{...S.input,flex:"1 1 140px"}} value={nt.fecha} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,fecha:e.target.value}}))}/>
                  <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer",whiteSpace:"nowrap"}}><input type="checkbox" checked={nt.urgente} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,urgente:e.target.checked}}))}/> Urgente</label>
                  <button style={S.btnPrimary} onClick={()=>agregarTareaJuicio(j.id)}>+ Agregar</button>
                </div>

                {/* Info del juicio debajo del form de tareas */}
                <div style={{marginTop:16,paddingTop:14,borderTop:"0.5px solid #ebebeb"}}>
                  <div style={S.fieldRow}>
                    <div style={S.field}><div style={S.fieldLabel}>Expediente</div><div style={{fontSize:13}}>{j.nro||"—"}</div></div>
                    <div style={S.field}><div style={S.fieldLabel}>Fuero</div><div style={{fontSize:13}}>{j.fuero||"—"}</div></div>
                    <div style={S.field}><div style={S.fieldLabel}>Juzgado</div><div style={{fontSize:13}}>{j.juzgado?(parseInt(j.juzgado)||j.juzgado):"—"}</div></div>
                    <div style={S.field}><div style={S.fieldLabel}>Secretaría</div><div style={{fontSize:13}}>{j.secretaria||"—"}</div></div>
                    <div style={S.field}><div style={S.fieldLabel}>Sala</div><div style={{fontSize:13}}>{j.sala||"—"}</div></div>
                  </div>
                  {j.datosJuzgado&&<div style={{marginBottom:6}}><div style={S.fieldLabel}>Datos del juzgado</div><div style={{fontSize:13}}>{j.datosJuzgado}</div></div>}
                  {j.otraInfo&&<div style={{marginBottom:6}}><div style={S.fieldLabel}>Otra información</div><div style={{fontSize:13}}>{j.otraInfo}</div></div>}
                  {j.compartidoCon&&<div style={{marginBottom:6}}><div style={S.fieldLabel}>Compartido con</div><div style={{fontSize:13}}>{j.compartidoCon}</div></div>}
                  {j.categoria&&<div style={{marginBottom:6}}><div style={S.fieldLabel}>Categoría</div><div style={{fontSize:13}}>{j.categoria}</div></div>}
                </div>

                {/* Concluidas */}
                {concluidas.length>0&&(
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:"#888",cursor:"pointer",userSelect:"none",padding:"4px 0"}} onClick={()=>setMostrarConc(p=>({...p,[j.id]:!mostrarConc[j.id]}))}>
                      {mostrarConc[j.id]?"▾":"▸"} Tareas concluidas ({concluidas.length})
                    </div>
                    {mostrarConc[j.id]&&concluidas.map(t=>(
                      <div key={t.id} style={{...S.card,opacity:0.6,marginBottom:4}}>
                        <div style={S.cardHeader}>
                          <div style={{...S.check,...S.checkDone}} onClick={()=>toggleDone(t)}>✓</div>
                          <div style={{flex:1,marginLeft:8,fontSize:13,textDecoration:"line-through",color:"#aaa"}}>{t.texto}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab Pruebas ── */}
            {tab==="pruebas"&&(
              <div>
                {j.pruebas.length>0&&(
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap" as const}}>
                    <span style={{fontSize:11,color:"#888",alignSelf:"center"}}>Ordenar:</span>
                    <button style={{...S.filterBtn,...(ordenPrueba==="tipo"?S.filterBtnActive:{})}} onClick={()=>setOrdenPrueba(ordenPrueba==="tipo"?"":"tipo")}>Tipo</button>
                    <button style={{...S.filterBtn,...(ordenPrueba==="estado"?S.filterBtnActive:{})}} onClick={()=>setOrdenPrueba(ordenPrueba==="estado"?"":"estado")}>Estado</button>
                  </div>
                )}
                {j.pruebas.length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin pruebas cargadas</div>}
                {[...j.pruebas].sort((a,b)=>{
                  if(ordenPrueba==="tipo") return a.tipo.localeCompare(b.tipo,"es")
                  if(ordenPrueba==="estado") return ESTADOS_PRUEBA.indexOf(a.estado)-ESTADOS_PRUEBA.indexOf(b.estado)
                  return 0
                }).map(p=>{
                  const ec = p.estado==="Finalizada"?"#3B6D11":p.estado==="En curso"?"#185FA5":p.estado==="Desistida"?"#A32D2D":"#633806"
                  const eb = p.estado==="Finalizada"?"#EAF3DE":p.estado==="En curso"?"#E6F1FB":p.estado==="Desistida"?"#FCEBEB":"#FAEEDA"
                  return (
                    <div key={p.id} style={{display:"flex",overflow:"hidden",border:"0.5px solid #e5e7eb",borderRadius:10,marginBottom:6,background:"#fff"}}>
                      <div style={{width:4,flexShrink:0,background:ec,borderRadius:"10px 0 0 10px"}}/>
                      <div style={{flex:1,padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <span style={{fontWeight:500,fontSize:13,color:"#111"}}>{p.tipo}</span>
                          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                            <span style={{...S.badge,background:eb,color:ec,fontSize:11}}>{p.estado}</span>
                            <button style={{...S.btnMini,color:"#E24B4A"}} onClick={()=>borrarPrueba(j.id,p.id)}>✕</button>
                          </div>
                        </div>
                        {p.contenido&&<div style={{fontSize:12,color:"#333",marginTop:5,lineHeight:1.4}}>{p.contenido}</div>}
                        {p.detalle&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{p.detalle}</div>}
                      </div>
                    </div>
                  )
                })}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <select style={{...S.input,flex:"1 1 160px"}} value={np.tipo} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,tipo:e.target.value}}))}><option value="">Tipo de prueba...</option>{TIPOS_PRUEBA.map(t=><option key={t}>{t}</option>)}</select>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Contenido..." value={np.contenido} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,contenido:e.target.value}}))}/>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Detalle..." value={np.detalle} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,detalle:e.target.value}}))}/>
                  <select style={{...S.input,flex:"1 1 120px"}} value={np.estado} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,estado:e.target.value}}))}>
                    {ESTADOS_PRUEBA.map(e=><option key={e}>{e}</option>)}
                  </select>
                  <button style={S.btnPrimary} onClick={()=>agregarPrueba(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {/* ── Tab Honorarios ── */}
            {tab==="honorarios"&&(
              <div>
                {(j.honorarios||[]).length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin honorarios cargados</div>}
                {(j.honorarios||[]).map(h=>{
                  const hc = h.estado==="Pago total"?"#3B6D11":h.estado==="Pago Parcial"?"#185FA5":"#633806"
                  const hb = h.estado==="Pago total"?"#EAF3DE":h.estado==="Pago Parcial"?"#E6F1FB":"#FAEEDA"
                  return (
                    <div key={h.id} style={{display:"flex",overflow:"hidden",border:"0.5px solid #e5e7eb",borderRadius:10,marginBottom:6,background:"#fff"}}>
                      <div style={{width:4,flexShrink:0,background:hc,borderRadius:"10px 0 0 10px"}}/>
                      <div style={{flex:1,padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <div style={{fontWeight:500,fontSize:13,color:"#111"}}>{h.clienteContraparte}</div>
                          <span style={{...S.badge,background:hb,color:hc,fontSize:11,flexShrink:0}}>{h.estado}</span>
                        </div>
                        <div style={{fontSize:12,color:"#555",marginTop:4}}>{h.total&&`Total: ${h.total}`}{h.pagado?` · Pagado: ${h.pagado}`:""}</div>
                        {h.observaciones&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{h.observaciones}</div>}
                      </div>
                    </div>
                  )
                })}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <select style={{...S.input,flex:"2 1 160px"}} value={nh.clienteContraparte} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,clienteContraparte:e.target.value}}))}>
                    <option value="">Cliente / Contraparte...</option>
                    {(j.clientes||[]).map(c=><option key={c.id} value={`${c.apellido}, ${c.nombre}`}>{c.apellido}, {c.nombre}</option>)}
                    <option value="__otro__">Otro (escribir abajo)</option>
                  </select>
                  {nh.clienteContraparte==="__otro__"&&<input style={{...S.input,flex:"2 1 160px"}} placeholder="Escribir nombre..." onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,clienteContraparte:e.target.value}}))}/>}
                  <input style={{...S.input,flex:"1 1 100px"}} placeholder="Total" value={nh.total} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,total:e.target.value}}))}/>
                  <input style={{...S.input,flex:"1 1 100px"}} placeholder="Pagado" value={nh.pagado} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,pagado:e.target.value}}))}/>
                  <select style={{...S.input,flex:"1 1 120px"}} value={nh.estado} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,estado:e.target.value}}))}>{ESTADOS_HON.map(e=><option key={e}>{e}</option>)}</select>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Observaciones" value={nh.observaciones} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,observaciones:e.target.value}}))}/>
                  <button style={S.btnPrimary} onClick={()=>agregarHonorario(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}

            {/* ── Tab Clientes ── */}
            {tab==="clientes"&&(
              <div>
                {(j.clientes||[]).length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin clientes cargados</div>}
                {(j.clientes||[]).map(c=>(
                  <div key={c.id} style={{...S.pruebaRow,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500,fontSize:13}}>{c.apellido}, {c.nombre}</div>
                      {c.dni&&<div style={{fontSize:12,color:"#555"}}>DNI: {c.dni}</div>}
                      {c.correo&&<div style={{fontSize:12,color:"#555"}}>✉ {c.correo}</div>}
                      {c.telefono&&<div style={{fontSize:12,color:"#555"}}>📞 {c.telefono}</div>}
                      {c.domicilio&&<div style={{fontSize:12,color:"#555"}}>📍 {c.domicilio}</div>}
                    </div>
                    <button style={{...S.btnMini,color:"#E24B4A"}} onClick={()=>borrarCliente(j.id,c.id)}>✕</button>
                  </div>
                ))}
                {/* Búsqueda entre clientes existentes */}
                <div style={{marginTop:12,marginBottom:8,position:"relative"}}>
                  <input style={{...S.input,width:"100%"}} placeholder="Buscar cliente existente (apellido o nombre)..." value={busq} onChange={e=>buscarClientes(j.id,e.target.value)}/>
                  {sugs.length>0&&(
                    <div style={{position:"absolute",top:32,left:0,right:0,background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",zIndex:50}}>
                      {sugs.map(c=>(
                        <div key={c.id} style={{padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:"0.5px solid #f0f0f0"}}
                          onClick={()=>seleccionarClienteSugerencia(j.id,c)}
                          onMouseOver={e=>(e.currentTarget.style.background="#f9f9f8")}
                          onMouseOut={e=>(e.currentTarget.style.background="#fff")}
                        >{c.apellido}, {c.nombre}{c.dni?` · DNI ${c.dni}`:""}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <input style={S.input} placeholder="Apellido *" value={nc.apellido} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,apellido:e.target.value}}))}/>
                  <input style={S.input} placeholder="Nombre" value={nc.nombre} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,nombre:e.target.value}}))}/>
                  <input style={S.input} placeholder="DNI" value={nc.dni} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,dni:e.target.value}}))}/>
                  <input style={S.input} placeholder="Correo" value={nc.correo} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,correo:e.target.value}}))}/>
                  <input style={S.input} placeholder="Teléfono" value={nc.telefono} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,telefono:e.target.value}}))}/>
                  <input style={S.input} placeholder="Domicilio" value={nc.domicilio} onChange={e=>setNcMap(p=>({...p,[j.id]:{...nc,domicilio:e.target.value}}))}/>
                </div>
                <button style={{...S.btnPrimary,marginTop:8}} onClick={()=>agregarCliente(j.id)}>+ Agregar cliente</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER: ASUNTO CARD (Pro Bono / Docencia) ────────────────────────────────
  const renderAsunto = (a:Asunto) => {
    const exp    = expandidoSet.has(a.id)
    const toggleExp = () => setExpandidoSet(s=>{ const n=new Set(s); n.has(a.id)?n.delete(a.id):n.add(a.id); return n })
    const nt     = ntaMap[a.id]||{texto:"",fecha:"",urgente:false}
    const activas = a.tareas.filter(t=>!t.done).sort((a,b)=>{if(a.urgente&&!b.urgente)return -1;if(!a.urgente&&b.urgente)return 1;if(!a.fecha)return 1;if(!b.fecha)return -1;return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()})
    const concluidas = a.tareas.filter(t=>t.done).slice(-5)
    const tipoLabel = a.tipo==="probono"?"Pro Bono":a.tipo==="consultoria"?"Consultoría":"Docencia"
    return (
      <div key={a.id} id={`item-${a.id}`} style={{...S.card,borderColor:exp?FRANJA[tipoLabel]:"#e5e7eb"}}>
        <div style={S.cardHeader} onClick={toggleExp}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500,lineHeight:1.35,color:FRANJA[tipoLabel]}}>{a.nombre}</div>
            {a.advertencia&&<div style={{fontSize:11,color:"#A32D2D",marginTop:3,fontWeight:500}}>⚠ {a.advertencia}</div>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            <span style={{...S.badge,background:a.estado==="Abierta"?"#E6F1FB":"#EAF3DE",color:a.estado==="Abierta"?"#185FA5":"#3B6D11"}}>{a.estado}</span>
            <button style={S.btnMini} onClick={e=>abrirEditarAsunto(a,e)}>✎</button>
            <button style={{...S.btnMini,color:"#E24B4A"}} onClick={e=>eliminarAsunto(a,e)}>✕</button>
          </div>
        </div>
        {exp&&(
          <div style={{padding:"0 14px 14px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              {a.driveUrl&&<a href={a.driveUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#4285F4"}}>📁 Drive</a>}
              {a.webUrl&&<a href={a.webUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#185FA5"}}>🌐 Web</a>}
            </div>
            {activas.map(t=>(
              <div key={t.id} style={{...S.card,background:t.urgente?"#FFF0F0":"#fff",borderColor:t.urgente?"#E24B4A":"#e5e7eb",marginBottom:6,display:"flex",overflow:"hidden"}}>
                <div style={{width:4,flexShrink:0,background:FRANJA[tipoLabel]||"#888",borderRadius:"12px 0 0 12px"}}/>
                <div style={{flex:1}}>
                <div style={S.cardHeader}>
                  <div style={{...S.check,...(t.done?S.checkDone:{})}} onClick={()=>toggleDone(t)}>{t.done?"✓":""}</div>
                  <div style={{flex:1,marginLeft:8,fontSize:13}}>{t.texto}</div>
                  {t.urgente&&<span style={{fontSize:10,color:"#A32D2D",fontWeight:600,background:"#FCEBEB",padding:"1px 6px",borderRadius:8}}>URG</span>}
                  {t.fecha&&<span style={{fontSize:11,color:"#888",whiteSpace:"nowrap"}}>{formatFecha(t.fecha)}</span>}
                  <button style={{...S.btnMini,color:t.urgente?"#A32D2D":"#aaa",fontWeight:700}} onClick={()=>toggleUrgente(t)}>!</button>
                  <button style={S.btnMini} onClick={()=>{setEditId(t.id);setEditTexto(t.texto);setEditFecha(t.fecha?t.fecha.split("T")[0]:"");setEditUrgente(t.urgente)}}>✎</button>
                </div>
                {editId===t.id&&(
                  <div style={{padding:"0 14px 10px",display:"flex",gap:6,flexWrap:"wrap"}}>
                    <input style={{...S.input,flex:"3 1 180px"}} value={editTexto} onChange={e=>setEditTexto(e.target.value)} autoFocus/>
                    <input type="date" style={{...S.input,flex:"1 1 130px"}} value={editFecha} onChange={e=>setEditFecha(e.target.value)}/>
                    <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={editUrgente} onChange={e=>setEditUrgente(e.target.checked)}/> Urgente</label>
                    <button style={S.btnPrimary} onClick={()=>guardarEdicion(t)}>Guardar</button>
                    <button style={S.btn} onClick={()=>setEditId(null)}>✕</button>
                  </div>
                )}
                </div>
              </div>
            ))}
            {activas.length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin tareas activas</div>}
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              <input style={{...S.input,flex:"3 1 200px"}} placeholder="Nueva tarea..." value={nt.texto} onChange={e=>setNtaMap(p=>({...p,[a.id]:{...nt,texto:e.target.value}}))} onKeyDown={e=>e.key==="Enter"&&agregarTareaAsunto(a.id,tipoLabel)}/>
              <input type="date" style={{...S.input,flex:"1 1 140px"}} value={nt.fecha} onChange={e=>setNtaMap(p=>({...p,[a.id]:{...nt,fecha:e.target.value}}))}/>
              <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer",whiteSpace:"nowrap"}}><input type="checkbox" checked={nt.urgente} onChange={e=>setNtaMap(p=>({...p,[a.id]:{...nt,urgente:e.target.checked}}))}/> Urgente</label>
              <button style={S.btnPrimary} onClick={()=>agregarTareaAsunto(a.id,tipoLabel)}>+ Agregar</button>
            </div>
            {a.otraInfo&&<div style={{marginTop:12,paddingTop:12,borderTop:"0.5px solid #ebebeb"}}><div style={S.fieldLabel}>Información</div><div style={{fontSize:13}}>{a.otraInfo}</div></div>}
            {concluidas.length>0&&(
              <div style={{marginTop:10}}>
                <div style={{fontSize:12,color:"#888",cursor:"pointer",userSelect:"none",padding:"4px 0"}} onClick={()=>setMostrarConc(p=>({...p,[a.id]:!mostrarConc[a.id]}))}>
                  {mostrarConc[a.id]?"▾":"▸"} Tareas concluidas ({concluidas.length})
                </div>
                {mostrarConc[a.id]&&concluidas.map(t=>(
                  <div key={t.id} style={{...S.card,opacity:0.6,marginBottom:4}}>
                    <div style={S.cardHeader}>
                      <div style={{...S.check,...S.checkDone}} onClick={()=>toggleDone(t)}>✓</div>
                      <div style={{flex:1,marginLeft:8,fontSize:13,textDecoration:"line-through",color:"#aaa"}}>{t.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── STATS JUICIOS ────────────────────────────────────────────────────────────
  const statsPorEstado = TODOS_ESTADOS_JUICIO.map(e=>({
    estado: e,
    count: juicios.filter(j=>j.estado===e).length
  })).filter(s=>s.count>0)

  // ─── FORM HELPERS ─────────────────────────────────────────────────────────────
  const fldJ = (k:keyof JuicioForm) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setFormJuicio(p=>({...p,[k]:e.target.value}))
  const fldA = (k:keyof AsuntoForm) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setFormAsunto(p=>({...p,[k]:e.target.value}))

  const asuntosProbono     = asuntos.filter(a=>a.tipo==="probono"   &&(filtroAsuntos===""||a.estado===filtroAsuntos))
  const asuntosDocencia    = asuntos.filter(a=>a.tipo==="docencia"  &&(filtroAsuntos===""||a.estado===filtroAsuntos))
  const asuntosConsultoria = asuntos.filter(a=>a.tipo==="consultoria"&&(filtroAsuntos===""||a.estado===filtroAsuntos))
  const tareasPersonales   = vistaActual.filter(t=>t.tipo==="Personales"&&!t.done)
  const categoriasJuicios  = Array.from(new Set(juicios.map(j=>j.categoria).filter(Boolean))) as string[]

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* ── Modal Juicio ── */}
      {modalJuicioOpen&&(
        <div style={S.overlay} onClick={()=>setModalJuicioOpen(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:15}}>{editandoJuicio?"Editar caso":"Nuevo caso / juicio"}</div>
              <button style={S.btnMini} onClick={()=>setModalJuicioOpen(false)}>✕</button>
            </div>
            <div style={S.modalGrid}>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Nombre / Carátula *</div><input style={S.inputM} value={formJuicio.autos} onChange={fldJ("autos")} placeholder="García c/ Pérez s/ Daños"/></div>
              <div><div style={S.fieldLabel}>Estado</div><select style={S.inputM} value={formJuicio.estado} onChange={fldJ("estado")}>{TODOS_ESTADOS_JUICIO.map(e=><option key={e}>{e}</option>)}</select></div>
              <div><div style={S.fieldLabel}>Nº Expediente</div><input style={S.inputM} value={formJuicio.nro} onChange={fldJ("nro")} placeholder="12345/2024"/></div>
              <div><div style={S.fieldLabel}>Fuero</div><input style={S.inputM} value={formJuicio.fuero} onChange={fldJ("fuero")} placeholder="Civil, Laboral..."/></div>
              <div><div style={S.fieldLabel}>Juzgado</div><input style={S.inputM} value={formJuicio.juzgado} onChange={fldJ("juzgado")}/></div>
              <div><div style={S.fieldLabel}>Secretaría</div><input style={S.inputM} value={formJuicio.secretaria} onChange={fldJ("secretaria")}/></div>
              <div><div style={S.fieldLabel}>Sala</div><input style={S.inputM} value={formJuicio.sala} onChange={fldJ("sala")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Advertencia</div><input style={S.inputM} value={formJuicio.advertencia} onChange={fldJ("advertencia")} placeholder="Algo importante a destacar..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Datos del juzgado</div><input style={S.inputM} value={formJuicio.datosJuzgado} onChange={fldJ("datosJuzgado")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Otra información</div><textarea style={{...S.inputM,height:60,resize:"vertical"}} value={formJuicio.otraInfo} onChange={fldJ("otraInfo")}/></div>
              <div><div style={S.fieldLabel}>Compartido con</div><input style={S.inputM} value={formJuicio.compartidoCon} onChange={fldJ("compartidoCon")} placeholder="Nombre del colega..."/></div>
              <div><div style={S.fieldLabel}>Categoría</div><input style={S.inputM} value={formJuicio.categoria} onChange={fldJ("categoria")} placeholder="Ej: Familia, Laboral..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>📁 Link Drive</div><input style={S.inputM} value={formJuicio.driveUrl} onChange={fldJ("driveUrl")} placeholder="https://drive.google.com/..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>⚖ Link PJN (expediente)</div><input style={S.inputM} value={formJuicio.pjnUrl} onChange={fldJ("pjnUrl")} placeholder="https://scw.pjn.gov.ar/..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>🤖 Link Proyecto IA</div><input style={S.inputM} value={formJuicio.iaUrl} onChange={fldJ("iaUrl")} placeholder="https://..."/></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button style={S.btn} onClick={()=>setModalJuicioOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={guardarJuicio} disabled={saving}>{saving?"Guardando...":editandoJuicio?"Guardar cambios":"Crear caso"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Asunto ── */}
      {modalAsuntoOpen&&(
        <div style={S.overlay} onClick={()=>setModalAsuntoOpen(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:15}}>{editandoAsunto?"Editar asunto":"Nuevo asunto"}</div>
              <button style={S.btnMini} onClick={()=>setModalAsuntoOpen(false)}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={S.fieldLabel}>Tipo</div><select style={S.inputM} value={formAsunto.tipo} onChange={fldA("tipo")}><option value="probono">Pro Bono</option><option value="docencia">Docencia</option><option value="consultoria">Consultoría</option></select></div>
              <div><div style={S.fieldLabel}>Nombre / Carátula *</div><input style={S.inputM} value={formAsunto.nombre} onChange={fldA("nombre")} placeholder="Nombre del asunto..."/></div>
              <div><div style={S.fieldLabel}>Estado</div><select style={S.inputM} value={formAsunto.estado} onChange={fldA("estado")}><option>Abierta</option><option>Cerrada</option></select></div>
              <div><div style={S.fieldLabel}>Advertencia</div><input style={S.inputM} value={formAsunto.advertencia} onChange={fldA("advertencia")} placeholder="Algo importante..."/></div>
              <div><div style={S.fieldLabel}>Otra información</div><textarea style={{...S.inputM,height:60,resize:"vertical"}} value={formAsunto.otraInfo} onChange={fldA("otraInfo")}/></div>
              <div><div style={S.fieldLabel}>📁 Link Drive</div><input style={S.inputM} value={formAsunto.driveUrl} onChange={fldA("driveUrl")} placeholder="https://drive.google.com/..."/></div>
              <div><div style={S.fieldLabel}>🌐 Link web</div><input style={S.inputM} value={formAsunto.webUrl} onChange={fldA("webUrl")} placeholder="https://..."/></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button style={S.btn} onClick={()=>setModalAsuntoOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={guardarAsunto} disabled={saving}>{saving?"Guardando...":editandoAsunto?"Guardar cambios":"Crear asunto"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <div style={S.sidebar}>
        <div style={{padding:"16px",background:"#185FA5",borderBottom:"0.5px solid #0c447c",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500,fontSize:14,color:"#fff",flexShrink:0}}>
            {session.user?.name?.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()||"AL"}
          </div>
          <div>
            <div style={{fontWeight:500,fontSize:15,color:"#fff",lineHeight:1.2}}>Agenda Legal</div>
            <div style={{fontSize:12,color:"#B5D4F4",marginTop:2}}>{session.user?.name}</div>
          </div>
        </div>

        {/* Tareas — destacado en azul */}
        <div
          style={{padding:"8px 14px",cursor:"pointer",fontSize:15,fontWeight:500,color: panel==="tareas"?"#185FA5":"#378ADD",borderLeft: panel==="tareas"?"2px solid #378ADD":"2px solid transparent",background: panel==="tareas"?"#fff":"transparent",display:"flex",justifyContent:"space-between",alignItems:"center"}}
          onClick={()=>setPanel("tareas")}
        >
          Tareas
          {tareasActivas.length>0&&<span style={S.navBadge}>{tareasActivas.length}</span>}
        </div>
        <div style={{height:8}}/>

        {/* Menús principales — negrita negra */}
        {[
          {id:"juicios",      label:"Casos y Juicios",    badge:juiciosFiltrados.length},
          {id:"probono",      label:"Pro Bono",            badge:asuntosProbono.length||null},
          {id:"docencia",     label:"Docencia",            badge:asuntosDocencia.length||null},
          {id:"consultoria",  label:"Consultoría",         badge:asuntosConsultoria.length||null},
          {id:"personales",   label:"Asuntos Personales",  badge:tareasPersonales.length||null},
        ].map(item=>(
          <div key={item.id} style={{...S.navItem,...(panel===item.id?S.navItemActive:{})}} onClick={()=>setPanel(item.id)}>
            {item.label}
            {item.badge!=null&&item.badge>0?<span style={S.navBadge}>{item.badge}</span>:null}
          </div>
        ))}

        <div style={{height:1,background:"#e5e7eb",margin:"6px 14px"}}/>

        {[
          {id:"honorarios", label:"Honorarios", badge:honorariosPendientes.length||null},
          {id:"clientes",   label:"Clientes",   badge:todosClientes.length||null},
        ].map(item=>(
          <div key={item.id} style={{padding:"7px 14px",cursor:"pointer",fontSize:13,color:panel===item.id?"#111":"#666",fontWeight:panel===item.id?500:400,borderLeft:panel===item.id?"2px solid #378ADD":"2px solid transparent",background:panel===item.id?"#fff":"transparent",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>setPanel(item.id)}>
            {item.label}
            {item.badge!=null&&item.badge>0?<span style={S.navBadge}>{item.badge}</span>:null}
          </div>
        ))}

        <div style={{flex:1}}/>
        <div style={{padding:"10px 14px",borderTop:"0.5px solid #e5e7eb",display:"flex",flexDirection:"column",gap:6}}>
          <button style={{...S.btn,fontSize:12,width:"100%"}} onClick={descargarBackup}>⬇ Backup</button>
          {juicios.length===0&&<button style={{...S.btnPrimary,fontSize:12,width:"100%"}} onClick={async()=>{const r=await fetch('/api/seed',{method:'POST'});const d=await r.json();if(d.ok)window.location.reload();else alert(d.msg||'Error')}}>Importar datos</button>}
          <button style={{...S.btn,fontSize:12,width:"100%"}} onClick={()=>signOut()}>Cerrar sesión</button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={S.main}>
        {/* Topbar */}
        <div style={{...S.topbar,background:TOPBAR_BG[panel]||"#fff",borderBottom:`0.5px solid #e5e7eb`}}>
          <div style={{fontWeight:500,fontSize:20,marginRight:12,color:TOPBAR_TX[panel]||"#111"}}>
            {{tareas:"Tareas",juicios:"Casos y Juicios",probono:"Pro Bono",docencia:"Docencia",consultoria:"Consultoría",personales:"Asuntos Personales",honorarios:"Honorarios",clientes:"Clientes"}[panel]}
          </div>

          {panel==="tareas"&&<>
            {hayPendientes&&<button style={S.btnActualizar} onClick={actualizarVista}>Actualizar vista ({Object.keys(cambios).length})</button>}
            <div style={S.sepDot}>·</div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              {TIPOS_TAREA.map(tipo=>(
                <button key={tipo} style={{...S.filterBtn,...(filtroTipos.includes(tipo)?S.filterBtnActive:{})}}
                  onClick={()=>setFiltroTipos(p=>p.includes(tipo)?p.filter(x=>x!==tipo):[...p,tipo])}>{tipo}</button>
              ))}
              {filtroTipos.length>0&&<button style={{...S.filterBtn,color:"#888"}} onClick={()=>setFiltroTipos([])}>✕</button>}
            </div>
            <div style={{marginLeft:"auto"}}>
              <button style={S.filterBtn} onClick={()=>setPanelDerechoVisible(v=>!v)}>{panelDerechoVisible?"▶ Panel":"◀ Panel"}</button>
            </div>
          </>}

          {panel==="juicios"&&<div style={{display:"flex",gap:6,alignItems:"center",marginLeft:4,flexWrap:"wrap"}}>
            {TODOS_ESTADOS_JUICIO.map(e=>(
              <button key={e} style={{...S.filterBtn,...(filtroEstados.includes(e)?{background:ESTADOS_BG[e]||"#f0f0f0",color:ESTADOS_TX[e]||"#333",borderColor:ESTADOS_TX[e]||"#ccc"}:{})}}
                onClick={()=>setFiltroEstados(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e])}>{e}</button>
            ))}
            {categoriasJuicios.length>0&&<>
              <span style={{color:"#d0d0d0"}}>·</span>
              <select style={{...S.filterBtn,cursor:"pointer"}} value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categoriasJuicios.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </>}
            {(filtroEstados.length>0||filtroCategoria)&&<button style={{...S.filterBtn,color:"#888"}} onClick={()=>{setFiltroEstados([]);setFiltroCategoria("")}}>✕</button>}
            <button style={S.btnPrimary} onClick={abrirNuevoJuicio}>+ Nuevo</button>
          </div>}

          {(panel==="probono"||panel==="docencia"||panel==="consultoria")&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
            {["Abierta","Cerrada"].map(e=>(
              <button key={e} style={{...S.filterBtn,...(filtroAsuntos===e?S.filterBtnActive:{})}} onClick={()=>setFiltroAsuntos(filtroAsuntos===e?"":e)}>{e}</button>
            ))}
            {filtroAsuntos&&<button style={{...S.filterBtn,color:"#888"}} onClick={()=>setFiltroAsuntos("")}>✕</button>}
            <button style={S.btnPrimary} onClick={()=>abrirNuevoAsunto(panel)}>+ Nuevo asunto</button>
          </div>}
        </div>

        {/* Contenido */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={S.content}>
            {loading&&<div style={{color:"#888",fontSize:14}}>Cargando datos...</div>}

            {/* Panel Tareas */}
            {!loading&&panel==="tareas"&&(
              <div>
                {filtroTipos.length>0?(
                  tareasFiltradas.length===0&&recienCompletadas.filter(t=>filtroTipos.includes(t.tipo==="Juicio"?"Casos y Juicios":t.tipo||"Casos y Juicios")).length===0
                    ?<div style={{color:"#aaa",fontSize:14}}>No hay tareas.</div>
                    :[...tareasFiltradas,...recienCompletadas.filter(t=>filtroTipos.includes(t.tipo==="Juicio"?"Casos y Juicios":t.tipo||"Casos y Juicios"))].map(t=>renderTarea(t))
                ):<>
                  {seccion("URGENTES",urgentesArriba,urgentesCompletadas,"#E24B4A")}
                  {seccion("ATRASADAS",atrasadas,atrasadasCompletadas,"#9B59B6")}
                  {seccion("HOY",vencenHoy,vencenHoyCompletadas,"#378ADD")}
                  {seccion("PRÓXIMAS TAREAS",proximas,proximasCompletadas,"#555")}
                  {vistaActual.filter(t=>!t.done).length===0&&recienCompletadas.length===0&&<div style={{color:"#aaa",fontSize:14}}>No hay tareas activas.</div>}
                </>}
              </div>
            )}

            {/* Panel Juicios */}
            {!loading&&panel==="juicios"&&(
              <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  {juiciosFiltrados.length===0
                    ?<div style={{color:"#aaa",fontSize:14}}>No hay casos con ese filtro.</div>
                    :juiciosFiltrados.map(renderJuicio)}
                </div>
                {/* Barra lateral de stats */}
                {statsVisible&&(
                  <div style={{width:180,flexShrink:0,background:"#f9f9f8",border:"0.5px solid #e5e7eb",borderRadius:12,padding:"14px 16px",position:"sticky",top:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:"0.06em"}}>POR ESTADO</div>
                      <button style={{...S.btnMini,fontSize:10}} onClick={()=>setStatsVisible(false)}>✕</button>
                    </div>
                    {statsPorEstado.map(s=>(
                      <div key={s.estado} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #ebebeb"}}>
                        <span style={{fontSize:12,color:"#555"}}>{s.estado}</span>
                        <span style={{fontSize:13,fontWeight:600,color:ESTADOS_TX[s.estado]||"#111",background:ESTADOS_BG[s.estado]||"#f0f0f0",padding:"1px 8px",borderRadius:8}}>{s.count}</span>
                      </div>
                    ))}
                    <div style={{marginTop:10,paddingTop:8,borderTop:"0.5px solid #e5e7eb",display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:12,color:"#888"}}>Total</span>
                      <span style={{fontSize:13,fontWeight:600}}>{juicios.length}</span>
                    </div>
                  </div>
                )}
                {!statsVisible&&(
                  <button style={{...S.filterBtn,writingMode:"vertical-rl",fontSize:11,padding:"8px 4px"}} onClick={()=>setStatsVisible(true)}>▶ Stats</button>
                )}
              </div>
            )}

            {/* Panel Pro Bono */}
            {!loading&&panel==="probono"&&(
              <div>{asuntosProbono.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay asuntos de Pro Bono{filtroAsuntos?` (${filtroAsuntos}s)`:""} .</div>:asuntosProbono.map(renderAsunto)}</div>
            )}

            {/* Panel Docencia */}
            {!loading&&panel==="docencia"&&(
              <div>{asuntosDocencia.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay asuntos de Docencia{filtroAsuntos?` (${filtroAsuntos}s)`:""} .</div>:asuntosDocencia.map(renderAsunto)}</div>
            )}

            {/* Panel Consultoría */}
            {!loading&&panel==="consultoria"&&(
              <div>{asuntosConsultoria.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay asuntos de Consultoría{filtroAsuntos?` (${filtroAsuntos}s)`:""} .</div>:asuntosConsultoria.map(renderAsunto)}</div>
            )}

            {/* Panel Personales */}
            {!loading&&panel==="personales"&&(
              <div>
                <div style={{marginBottom:14,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <input style={{...S.input,flex:"3 1 200px"}} placeholder="Nueva actividad personal..." value={ntPersonal.texto} onChange={e=>setNtPersonal(p=>({...p,texto:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&agregarTareaPersonal()}/>
                  <input type="date" style={{...S.input,flex:"1 1 140px"}} value={ntPersonal.fecha} onChange={e=>setNtPersonal(p=>({...p,fecha:e.target.value}))}/>
                  <input style={{...S.input,flex:"3 1 200px"}} placeholder="Información adicional..." value={ntPersonal.info} onChange={e=>setNtPersonal(p=>({...p,info:e.target.value}))}/>
                  <input style={{...S.input,flex:"2 1 160px"}} placeholder="Link web (https://...)" value={ntPersonal.webUrl} onChange={e=>setNtPersonal(p=>({...p,webUrl:e.target.value}))}/>
                  <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer",whiteSpace:"nowrap"}}><input type="checkbox" checked={ntPersonal.urgente} onChange={e=>setNtPersonal(p=>({...p,urgente:e.target.checked}))}/> Urgente</label>
                  <button style={S.btnPrimary} onClick={agregarTareaPersonal}>+ Agregar</button>
                </div>
                {tareasPersonales.length===0&&<div style={{color:"#aaa",fontSize:14}}>No hay actividades personales activas.</div>}
                {tareasPersonales.map(t=>(
                  <div key={t.id}>
                    {renderTarea(t)}
                    {(t.info||t.webUrl)&&(
                      <div style={{marginTop:-4,marginBottom:6,padding:"6px 12px 8px 18px",background:"#fafafa",border:"0.5px solid #e5e7eb",borderTop:"none",borderRadius:"0 0 10px 10px",fontSize:12,color:"#555",display:"flex",gap:12,flexWrap:"wrap" as const}}>
                        {t.info&&<span>{t.info}</span>}
                        {t.webUrl&&<a href={t.webUrl} target="_blank" rel="noopener noreferrer" style={{color:"#378ADD",textDecoration:"none"}}>🌐 {t.webUrl}</a>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Panel Honorarios */}
            {!loading&&panel==="honorarios"&&(
              <div>
                {honorariosPendientes.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay honorarios pendientes.</div>:honorariosPendientes.map((h,i)=>{
                  const hc = h.estado==="Pago Parcial"?"#185FA5":"#633806"
                  const hb = h.estado==="Pago Parcial"?"#E6F1FB":"#FAEEDA"
                  return (
                    <div key={i} style={{display:"flex",overflow:"hidden",border:"0.5px solid #e5e7eb",borderRadius:12,marginBottom:8,background:"#fff"}}>
                      <div style={{width:5,flexShrink:0,background:hc,borderRadius:"12px 0 0 12px"}}/>
                      <div style={{flex:1,padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <div style={{fontSize:14,fontWeight:500,color:FRANJA["Casos y Juicios"]}}>{(h as any).autos}</div>
                          <span style={{...S.badge,background:hb,color:hc,flexShrink:0}}>{h.estado}</span>
                        </div>
                        <div style={{fontSize:13,color:"#333",marginTop:4}}>{h.clienteContraparte}</div>
                        <div style={{fontSize:12,color:"#888",marginTop:3}}>{h.total?`Total: ${h.total}`:""}{h.pagado?` · Pagado: ${h.pagado}`:""}</div>
                        {h.observaciones&&<div style={{fontSize:11,color:"#aaa",marginTop:2}}>{h.observaciones}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Panel Clientes */}
            {!loading&&panel==="clientes"&&(
              <div>
                {todosClientes.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay clientes cargados.</div>:
                [...todosClientes].sort((a,b)=>a.apellido.localeCompare(b.apellido,"es")).map((c,i)=>(
                  <div key={i} style={{display:"flex",overflow:"hidden",border:"0.5px solid #e5e7eb",borderRadius:12,marginBottom:8,background:"#fff"}}>
                    <div style={{width:5,flexShrink:0,background:"#8B5E3C",borderRadius:"12px 0 0 12px"}}/>
                    <div style={{flex:1,padding:"12px 14px"}}>
                      <div style={{fontSize:14,fontWeight:500,color:"#6B4226",marginBottom:4}}>{c.apellido}, {c.nombre}</div>
                      <div style={{display:"flex",gap:16,flexWrap:"wrap" as const}}>
                        {c.dni&&<span style={{fontSize:12,color:"#555"}}>DNI: {c.dni}</span>}
                        {c.correo&&<span style={{fontSize:12,color:"#555"}}>✉ {c.correo}</span>}
                        {c.telefono&&<span style={{fontSize:12,color:"#555"}}>📞 {c.telefono}</span>}
                        {c.domicilio&&<span style={{fontSize:12,color:"#555"}}>📍 {c.domicilio}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel derecho (solo en Tareas) */}
          {panel==="tareas"&&panelDerechoVisible&&(
            <div style={S.panelDerecho}>{renderPanelDerecho()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const S: Record<string,React.CSSProperties> = {
  app:         {display:"flex",height:"100vh",fontFamily:"system-ui, sans-serif",fontSize:14,color:"#111"},
  sidebar:     {width:220,background:"#f9f9f8",borderRight:"0.5px solid #e5e7eb",display:"flex",flexDirection:"column",flexShrink:0},
  sidebarHeader:{padding:"14px 14px 10px",borderBottom:"0.5px solid #e5e7eb"},
  navItem:     {padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:500,color:"#111",borderLeft:"2px solid transparent",display:"flex",justifyContent:"space-between",alignItems:"center"},
  navItemActive:{background:"#fff",color:"#185FA5",borderLeft:"2px solid #378ADD",fontWeight:500},
  navBadge:    {background:"#E6F1FB",color:"#185FA5",fontSize:11,padding:"1px 6px",borderRadius:10},
  main:        {flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0},
  topbar:      {padding:"12px 20px",borderBottom:"0.5px solid #e5e7eb",background:"#fff",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",flexShrink:0},
  sepDot:      {fontSize:16,color:"#d0d0d0",flexShrink:0,lineHeight:"1"},
  filterBtn:   {fontSize:12,padding:"4px 12px",border:"0.5px solid #d0d0d0",borderRadius:8,cursor:"pointer",background:"transparent",color:"#555"},
  filterBtnActive:{background:"#378ADD",color:"#fff",borderColor:"#378ADD"},
  btnActualizar:{fontSize:12,padding:"5px 14px",border:"none",borderRadius:8,cursor:"pointer",background:"#378ADD",color:"#fff",fontWeight:500},
  content:     {flex:1,overflowY:"auto",padding:"14px 18px"},
  panelDerecho:{width:240,borderLeft:"0.5px solid #e5e7eb",background:"#f9f9f8",flexShrink:0,overflowY:"auto"},
  card:        {background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:12,marginBottom:8,overflow:"hidden"},
  cardHeader:  {padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"},
  cardTitle:   {fontSize:13,fontWeight:500,lineHeight:1.35},
  cardMeta:    {fontSize:11,color:"#888",marginTop:2},
  badge:       {fontSize:11,padding:"2px 8px",borderRadius:10,whiteSpace:"nowrap",flexShrink:0},
  tabs:        {display:"flex",borderBottom:"0.5px solid #e5e7eb",marginBottom:12,marginTop:10,overflowX:"auto"},
  tab:         {fontSize:12,padding:"6px 12px",cursor:"pointer",color:"#888",borderBottom:"2px solid transparent",marginBottom:-0.5,whiteSpace:"nowrap"},
  tabActive:   {color:"#378ADD",borderBottom:"2px solid #378ADD",fontWeight:500},
  pruebaRow:   {display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",borderBottom:"0.5px solid #f0f0f0"},
  check:       {width:15,height:15,border:"0.5px solid #ccc",borderRadius:3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0},
  checkDone:   {background:"#EAF3DE",borderColor:"#639922",color:"#3B6D11"},
  btnEdit:     {fontSize:15,padding:"4px 8px",border:"0.5px solid #e5e7eb",borderRadius:6,cursor:"pointer",background:"transparent",color:"#aaa",flexShrink:0},
  btnPosponer: {fontSize:12,padding:"4px 10px",border:"0.5px solid #b5d4f4",borderRadius:6,cursor:"pointer",background:"#E6F1FB",color:"#185FA5",whiteSpace:"nowrap"},
  btnUrgente:  {fontSize:12,padding:"4px 10px",border:"0.5px solid #E24B4A",borderRadius:6,cursor:"pointer",background:"transparent",color:"#E24B4A",whiteSpace:"nowrap"},
  linkDrive:   {fontSize:12,padding:"4px 10px",border:"0.5px solid #c5d8fb",borderRadius:6,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,color:"#4285F4",background:"#f0f5ff",whiteSpace:"nowrap"},
  linkPjn:     {fontSize:12,padding:"4px 10px",border:"0.5px solid #b5d4f4",borderRadius:6,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,color:"#185FA5",background:"#E6F1FB",whiteSpace:"nowrap"},
  pjLink:      {fontSize:12,padding:"7px 12px",border:"0.5px solid #e5e7eb",borderRadius:8,textDecoration:"none",display:"flex",alignItems:"center",gap:6,color:"#555",background:"#fff"},
  input:       {fontSize:12,padding:"4px 8px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",flex:1},
  btn:         {fontSize:12,padding:"5px 12px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"transparent",color:"#111"},
  btnPrimary:  {fontSize:12,padding:"5px 12px",border:"none",borderRadius:8,cursor:"pointer",background:"#378ADD",color:"#fff",whiteSpace:"nowrap"},
  btnMini:     {fontSize:12,padding:"2px 6px",border:"0.5px solid #e5e7eb",borderRadius:6,cursor:"pointer",background:"transparent",color:"#888"},
  btnGoogle:   {fontSize:14,padding:"10px 24px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"#fff",color:"#111"},
  sectionLabel:{fontSize:11,fontWeight:600,letterSpacing:"0.06em",marginTop:14,marginBottom:6,paddingBottom:4,borderBottom:"0.5px solid #e5e7eb"},
  fieldRow:    {display:"flex",gap:16,flexWrap:"wrap",marginBottom:8},
  field:       {flex:1,minWidth:100},
  fieldLabel:  {fontSize:10,color:"#888",marginBottom:2,fontWeight:500,letterSpacing:"0.04em"},
  login:       {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f8"},
  loginCard:   {background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:12,padding:40,textAlign:"center"},
  loading:     {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#888"},
  overlay:     {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:       {background:"#fff",borderRadius:14,padding:24,width:"min(640px, 95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"},
  modalGrid:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"},
  inputM:      {fontSize:13,padding:"6px 10px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",width:"100%",boxSizing:"border-box"},
}
