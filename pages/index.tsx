import { useSession, signIn, signOut } from "next-auth/react"
import { useEffect, useState } from "react"

type Prueba = { id: string; tipo: string; contenido?: string; detalle?: string; estado: string }
type Tarea = { id: string; texto: string; fecha?: string; urgente: boolean; done: boolean; tipo?: string; tema?: string; juicioId?: string; juicio?: { autos: string; id: string } }
type Honorario = { id: string; clienteContraparte?: string; total?: string; pagado?: string; estado: string; observaciones?: string }
type Juicio = { id: string; nro?: string; autos: string; estado: string; fuero?: string; juzgado?: string; secretaria?: string; sala?: string; cosasRelevantes?: string; advertencia?: string; driveUrl?: string; iaUrl?: string; datosJuzgado?: string; datosContacto?: string; otraInfo?: string; tareas: Tarea[]; pruebas: Prueba[]; honorarios?: Honorario[] }
type JuicioForm = { autos: string; estado: string; nro: string; fuero: string; juzgado: string; secretaria: string; sala: string; advertencia: string; cosasRelevantes: string; datosJuzgado: string; datosContacto: string; otraInfo: string; driveUrl: string; iaUrl: string }

const FORM_VACIO: JuicioForm = { autos:"", estado:"Judicializado", nro:"", fuero:"", juzgado:"", secretaria:"", sala:"", advertencia:"", cosasRelevantes:"", datosJuzgado:"", datosContacto:"", otraInfo:"", driveUrl:"", iaUrl:"" }
const ESTADOS: Record<string,string> = { "Judicializado":"#E6F1FB","Preparación":"#FAEEDA","Mediacion":"#FAEEDA","Inicio":"#FAEEDA","Finalizado":"#EAF3DE","Renunciado":"#F1EFE8","En Trámite":"#E6F1FB" }
const ESTADOS_TEXT: Record<string,string> = { "Judicializado":"#185FA5","Preparación":"#633806","Mediacion":"#633806","Inicio":"#633806","Finalizado":"#3B6D11","Renunciado":"#444441","En Trámite":"#185FA5" }
const TODOS_ESTADOS = ["Judicializado","Preparación","Mediacion","Inicio","Finalizado","Renunciado","En Trámite"]
const TIPOS_PRUEBA = ["Confesional","Informativa","Testimonial","Reconocimiento","Pericial contable","Pericial informática","Pericial médica","Pericial técnica","Pericial (otra)"]
const ESTADOS_PRUEBA = ["Ofrecida","En curso","Desistida","Finalizada"]
const ESTADOS_HONORARIO = ["Pendiente","Pago Parcial","Pago total"]
const INACTIVOS = ["Finalizado","Renunciado"]

function parseFecha(s: string): Date { const [y,m,d]=s.split("T")[0].split("-").map(Number); return new Date(y,m-1,d) }
function formatFecha(s: string): string { return parseFecha(s).toLocaleDateString("es-AR") }

export default function Home() {
  const { data: session, status } = useSession()
  const [panel, setPanel] = useState("tareas")
  const [juicios, setJuicios] = useState<Juicio[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [expandido, setExpandido] = useState<string|null>(null)
  const [tabActiva, setTabActiva] = useState<Record<string,string>>({})
  const [ntMap, setNtMap] = useState<Record<string,{texto:string;fecha:string;urgente:boolean}>>({})
  const [npMap, setNpMap] = useState<Record<string,{tipo:string;contenido:string;detalle:string;estado:string}>>({})
  const [nhMap, setNhMap] = useState<Record<string,{clienteContraparte:string;total:string;pagado:string;estado:string;observaciones:string}>>({})
  const [loading, setLoading] = useState(true)
  const [filtroTipos, setFiltroTipos] = useState<string[]>([])
  const [filtroEstados, setFiltroEstados] = useState<string[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [editTexto, setEditTexto] = useState("")
  const [editFecha, setEditFecha] = useState("")
  const [editUrgente, setEditUrgente] = useState(false)
  const [mostrarConc, setMostrarConc] = useState<Record<string,boolean>>({})
  const [completadasLocal, setCompletadasLocal] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoJuicio, setEditandoJuicio] = useState<Juicio|null>(null)
  const [form, setForm] = useState<JuicioForm>(FORM_VACIO)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) {
      Promise.all([fetch("/api/juicios").then(r=>r.json()), fetch("/api/tareas").then(r=>r.json())])
        .then(([j,t]) => { setJuicios(Array.isArray(j)?j:[]); setTareas(Array.isArray(t)?t:[]); setLoading(false) })
        .catch(()=>setLoading(false))
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

  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const inactivosSet = new Set(juicios.filter(j=>INACTIVOS.includes(j.estado)).map(j=>j.id))
  const tareasActivas = tareas.filter(t=>!t.done && !(t.juicioId && inactivosSet.has(t.juicioId)))
  const esAtrasada = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha)<hoy }
  const esHoy = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha).getTime()===hoy.getTime() }
  const esProxima = (t:Tarea) => !esAtrasada(t)&&!esHoy(t)
  const urgentesArriba = tareasActivas.filter(t=>t.urgente&&(esAtrasada(t)||esHoy(t)))
  const atrasadas = tareasActivas.filter(t=>esAtrasada(t)&&!urgentesArriba.includes(t))
  const vencenHoy = tareasActivas.filter(t=>esHoy(t)&&!urgentesArriba.includes(t))
  const proximas = tareasActivas.filter(t=>esProxima(t)&&!urgentesArriba.includes(t))
    .sort((a,b)=>{ if(a.urgente&&!b.urgente)return -1; if(!a.urgente&&b.urgente)return 1; if(!a.fecha&&!b.fecha)return 0; if(!a.fecha)return 1; if(!b.fecha)return -1; return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime() })

  const abrirNuevo = () => { setEditandoJuicio(null); setForm(FORM_VACIO); setModalOpen(true) }
  const abrirEditar = (j:Juicio, e:React.MouseEvent) => {
    e.stopPropagation()
    setEditandoJuicio(j)
    setForm({ autos:j.autos||"", estado:j.estado||"Judicializado", nro:j.nro||"", fuero:j.fuero||"", juzgado:j.juzgado||"", secretaria:j.secretaria||"", sala:j.sala||"", advertencia:j.advertencia||"", cosasRelevantes:j.cosasRelevantes||"", datosJuzgado:j.datosJuzgado||"", datosContacto:j.datosContacto||"", otraInfo:j.otraInfo||"", driveUrl:j.driveUrl||"", iaUrl:j.iaUrl||"" })
    setModalOpen(true)
  }

  const guardarJuicio = async () => {
    if (!form.autos.trim()) { alert("El nombre del juicio es obligatorio"); return }
    setSaving(true)
    try {
      if (editandoJuicio) {
        await fetch("/api/juicios",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editandoJuicio.id,...form})})
        setJuicios(js=>js.map(j=>j.id===editandoJuicio.id?{...j,...form}:j))
      } else {
        const res = await fetch("/api/juicios",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)})
        const nuevo = await res.json()
        setJuicios(js=>[{...nuevo,tareas:[],pruebas:[],honorarios:[]},...js])
      }
      setModalOpen(false)
    } catch { alert("Error al guardar") }
    setSaving(false)
  }

  const toggleDone = async (t:Tarea) => {
    if (!t.done && t.juicioId) {
      const j = juicios.find(j=>j.id===t.juicioId)
      if (j && !INACTIVOS.includes(j.estado) && j.tareas.filter(x=>!x.done).length===1) {
        alert("No puede eliminarse la última tarea de un juicio activo.")
        return
      }
    }
    const done = !t.done
    await fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,done})})
    if (done) setCompletadasLocal(p=>new Set([...p,t.id]))
    else setCompletadasLocal(p=>{const n=new Set(p);n.delete(t.id);return n})
    setTareas(ts=>ts.map(x=>x.id===t.id?{...x,done}:x))
    setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(x=>x.id===t.id?{...x,done}:x)})))
  }

  const guardarEdicion = async (t:Tarea) => {
    await fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,texto:editTexto,urgente:editUrgente,fecha:editFecha||null})})
    const fecha = editFecha||undefined
    setTareas(ts=>ts.map(x=>x.id===t.id?{...x,texto:editTexto,fecha,urgente:editUrgente}:x))
    setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(x=>x.id===t.id?{...x,texto:editTexto,fecha,urgente:editUrgente}:x)})))
    setEditId(null)
  }

  const agregarTarea = async (juicioId:string) => {
    const nt = ntMap[juicioId]||{texto:"",fecha:"",urgente:false}
    if (!nt.texto.trim()) return
    const body:any={texto:nt.texto,juicioId,urgente:nt.urgente,tipo:"Juicio"}
    if(nt.fecha) body.fecha=nt.fecha
    const res = await fetch("/api/tareas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    if(!res.ok){alert("Error al agregar tarea");return}
    const t = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,tareas:[...j.tareas,t]}:j))
    setTareas(ts=>[...ts,t])
    setNtMap(p=>({...p,[juicioId]:{texto:"",fecha:"",urgente:false}}))
  }

  const agregarPrueba = async (juicioId:string) => {
    const np = npMap[juicioId]||{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}
    if(!np.tipo) return
    const res = await fetch("/api/pruebas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tipo:np.tipo,contenido:np.contenido,detalle:np.detalle,estado:np.estado,juicioId})})
    if(!res.ok){alert("Error al agregar prueba");return}
    const p = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,pruebas:[...j.pruebas,p]}:j))
    setNpMap(p2=>({...p2,[juicioId]:{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}}))
  }

  const agregarHonorario = async (juicioId:string) => {
    const nh = nhMap[juicioId]||{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}
    if(!nh.clienteContraparte.trim()) return
    const res = await fetch("/api/honorarios",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clienteContraparte:nh.clienteContraparte,total:nh.total,pagado:nh.pagado,estado:nh.estado,observaciones:nh.observaciones,juicioId})})
    if(!res.ok){alert("Error al agregar honorario");return}
    const h = await res.json()
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,honorarios:[...(j.honorarios||[]),h]}:j))
    setNhMap(p=>({...p,[juicioId]:{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}}))
  }

  const borrarPrueba = async (juicioId:string,pruebaId:string) => {
    await fetch("/api/pruebas",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:pruebaId})})
    setJuicios(js=>js.map(j=>j.id===juicioId?{...j,pruebas:j.pruebas.filter(p=>p.id!==pruebaId)}:j))
  }

  const tareaColor = (t:Tarea) => t.urgente?"#FFF0F0":esAtrasada(t)?"#F5F0FF":"#fff"
  const tareaBorder = (t:Tarea) => t.urgente?"#E24B4A":esAtrasada(t)?"#9B59B6":"#e5e7eb"

  const renderTarea = (t:Tarea, showJuicio=true) => {
    const isEdit = editId===t.id
    const isDone = t.done||completadasLocal.has(t.id)
    const nombre = t.juicio?.autos||t.tema
    return (
      <div key={t.id} style={{...S.card,background:isDone?"#f9f9f9":tareaColor(t),borderColor:isDone?"#e5e7eb":tareaBorder(t),marginBottom:6,cursor:"default",opacity:isDone?0.7:1}}>
        <div style={S.cardHeader}>
          <div style={{...S.check,...(isDone?S.checkDone:{})}} onClick={()=>toggleDone(t)}>{isDone?"✓":""}</div>
          <div style={{flex:1,marginLeft:8}}>
            {showJuicio&&nombre&&<div style={{fontSize:12,fontWeight:600,marginBottom:2,color:isDone?"#aaa":"#111"}}>{nombre}</div>}
            {isEdit?(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <input style={{...S.input,fontSize:13}} value={editTexto} onChange={e=>setEditTexto(e.target.value)} autoFocus/>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="date" style={{...S.input,width:150}} value={editFecha} onChange={e=>setEditFecha(e.target.value)}/>
                  <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                    <input type="checkbox" checked={editUrgente} onChange={e=>setEditUrgente(e.target.checked)}/> Urgente
                  </label>
                  <button style={S.btnPrimary} onClick={()=>guardarEdicion(t)}>Actualizar</button>
                  <button style={S.btn} onClick={()=>setEditId(null)}>✕</button>
                </div>
              </div>
            ):(
              <div style={{fontSize:13,textDecoration:isDone?"line-through":"none",color:isDone?"#aaa":"#111"}}>{t.texto}</div>
            )}
            {!isEdit&&<div style={{display:"flex",gap:8,marginTop:3,alignItems:"center",flexWrap:"wrap"}}>
              {t.fecha&&<span style={{fontSize:11,color:"#888"}}>{formatFecha(t.fecha)}</span>}
              {t.tipo&&<span style={{fontSize:10,background:"#f0f0f0",color:"#666",padding:"1px 6px",borderRadius:8}}>{t.tipo}</span>}
            </div>}
          </div>
          {!isEdit&&!isDone&&<div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
            {t.urgente&&<span style={{fontSize:10,color:"#A32D2D",fontWeight:600,background:"#FCEBEB",padding:"1px 6px",borderRadius:8}}>URGENTE</span>}
            {t.juicio?.id&&<button style={{...S.btnMini,color:"#378ADD",fontSize:11}} title="Ir al juicio"
              onClick={()=>{setPanel("juicios");setExpandido(t.juicio!.id);setTabActiva(p=>({...p,[t.juicio!.id]:"tareas"}))}}>⚖</button>}
            <button style={{...S.btnMini,color:t.urgente?"#A32D2D":"#aaa",fontWeight:700}}
              onClick={()=>{fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,urgente:!t.urgente})});setTareas(ts=>ts.map(x=>x.id===t.id?{...x,urgente:!x.urgente}:x));setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(x=>x.id===t.id?{...x,urgente:!x.urgente}:x)})))}}
              title={t.urgente?"Quitar urgente":"Marcar urgente"}>!</button>
            <button style={S.btnMini} onClick={()=>{setEditId(t.id);setEditTexto(t.texto);setEditFecha(t.fecha?t.fecha.split("T")[0]:"");setEditUrgente(t.urgente)}}>✎</button>
          </div>}
        </div>
      </div>
    )
  }

  const seccion = (label:string,items:Tarea[],color?:string) => items.length===0?null:(
    <div key={label}>
      <div style={{...S.sectionLabel,color:color||"#888"}}>{label}</div>
      {items.map(t=>renderTarea(t))}
    </div>
  )

  const renderJuicio = (j:Juicio) => {
    const exp = expandido===j.id
    const tab = tabActiva[j.id]||"tareas"
    const nt = ntMap[j.id]||{texto:"",fecha:"",urgente:false}
    const np = npMap[j.id]||{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}
    const nh = nhMap[j.id]||{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}
    const activas = j.tareas.filter(t=>!t.done).sort((a,b)=>{if(a.urgente&&!b.urgente)return -1;if(!a.urgente&&b.urgente)return 1;if(!a.fecha)return 1;if(!b.fecha)return -1;return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()})
    const concluidas = j.tareas.filter(t=>t.done).slice(-5)
    return (
      <div key={j.id} style={{...S.card,borderColor:exp?"#378ADD":"#e5e7eb"}}>
        <div style={S.cardHeader} onClick={()=>{setExpandido(exp?null:j.id);if(!tabActiva[j.id])setTabActiva(p=>({...p,[j.id]:"tareas"}))}}>
          <div style={{flex:1}}>
            <div style={S.cardTitle}>{j.autos}</div>
            <div style={S.cardMeta}>{j.nro&&j.nro!=="Iniciar"?`Expte. ${j.nro} · `:""}{j.fuero}{j.juzgado?` · Juz. ${parseInt(j.juzgado)||j.juzgado}`:""}</div>
            {j.advertencia&&<div style={{fontSize:11,color:"#A32D2D",marginTop:3,fontWeight:500}}>⚠ {j.advertencia}</div>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            <span style={{...S.badge,background:ESTADOS[j.estado]||"#F1EFE8",color:ESTADOS_TEXT[j.estado]||"#444"}}>{j.estado}</span>
            <button style={{...S.btnMini,fontSize:11}} onClick={e=>abrirEditar(j,e)} title="Editar juicio">✎</button>
          </div>
        </div>
        {exp&&(
          <div style={{padding:"0 14px 14px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              {j.driveUrl&&<a href={j.driveUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#4285F4"}}>📁 Drive</a>}
              {j.nro&&j.nro!=="Iniciar"&&<a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#185FA5"}}>⚖ PJN</a>}
              {j.iaUrl&&<a href={j.iaUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnMini,textDecoration:"none",fontSize:11,color:"#7B3F9E"}}>🤖 IA</a>}
            </div>
            <div style={S.tabs}>
              {["tareas","pruebas","honorarios","info"].map(t=>(
                <div key={t} style={{...S.tab,...(tab===t?S.tabActive:{})}} onClick={()=>setTabActiva(p=>({...p,[j.id]:t}))}>
                  {t==="tareas"?`Tareas (${activas.length})`:t==="pruebas"?`Prueba (${j.pruebas.length})`:t==="honorarios"?`Honorarios (${(j.honorarios||[]).length})`:"Info"}
                </div>
              ))}
            </div>
            {tab==="tareas"&&(
              <div>
                {activas.map(t=>renderTarea(t,false))}
                {activas.length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin tareas activas</div>}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <input style={{...S.input,flex:"3 1 200px"}} placeholder="Nueva tarea..." value={nt.texto} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,texto:e.target.value}}))} onKeyDown={e=>e.key==="Enter"&&agregarTarea(j.id)}/>
                  <input type="date" style={{...S.input,flex:"1 1 140px"}} value={nt.fecha} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,fecha:e.target.value}}))}/>
                  <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4,cursor:"pointer",whiteSpace:"nowrap"}}>
                    <input type="checkbox" checked={nt.urgente} onChange={e=>setNtMap(p=>({...p,[j.id]:{...nt,urgente:e.target.checked}}))}/> Urgente
                  </label>
                  <button style={S.btnPrimary} onClick={()=>agregarTarea(j.id)}>+ Agregar</button>
                </div>
                {concluidas.length>0&&(
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:12,color:"#888",cursor:"pointer",userSelect:"none",padding:"4px 0"}} onClick={()=>setMostrarConc(p=>({...p,[j.id]:!mostrarConc[j.id]}))}>
                      {mostrarConc[j.id]?"▾":"▸"} Tareas concluidas ({concluidas.length})
                    </div>
                    {mostrarConc[j.id]&&concluidas.map(t=>renderTarea(t,false))}
                  </div>
                )}
              </div>
            )}
            {tab==="pruebas"&&(
              <div>
                {j.pruebas.length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin pruebas cargadas</div>}
                {j.pruebas.map(p=>(
                  <div key={p.id} style={S.pruebaRow}>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:500,fontSize:13}}>{p.tipo}</span>
                      {p.contenido&&<div style={{fontSize:12,color:"#555",marginTop:2}}>{p.contenido}</div>}
                      {p.detalle&&<div style={{fontSize:11,color:"#888"}}>{p.detalle}</div>}
                    </div>
                    <span style={{...S.badge,background:"#f0f0f0",color:"#555",fontSize:11}}>{p.estado}</span>
                    <button style={{...S.btnMini,color:"#E24B4A"}} onClick={()=>borrarPrueba(j.id,p.id)}>✕</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <select style={{...S.input,flex:"1 1 160px"}} value={np.tipo} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,tipo:e.target.value}}))}>
                    <option value="">Tipo de prueba...</option>
                    {TIPOS_PRUEBA.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Contenido..." value={np.contenido} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,contenido:e.target.value}}))}/>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Detalle..." value={np.detalle} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,detalle:e.target.value}}))}/>
                  <select style={{...S.input,flex:"1 1 120px"}} value={np.estado} onChange={e=>setNpMap(p=>({...p,[j.id]:{...np,estado:e.target.value}}))}>
                    {ESTADOS_PRUEBA.map(e=><option key={e}>{e}</option>)}
                  </select>
                  <button style={S.btnPrimary} onClick={()=>agregarPrueba(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}
            {tab==="honorarios"&&(
              <div>
                {(j.honorarios||[]).length===0&&<div style={{color:"#aaa",fontSize:13,padding:"4px 0"}}>Sin honorarios cargados</div>}
                {(j.honorarios||[]).map(h=>(
                  <div key={h.id} style={{...S.pruebaRow,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500,fontSize:13}}>{h.clienteContraparte}</div>
                      <div style={{fontSize:12,color:"#555"}}>{h.total&&`Total: ${h.total}`}{h.pagado?` · Pagado: ${h.pagado}`:""}</div>
                      {h.observaciones&&<div style={{fontSize:11,color:"#888"}}>{h.observaciones}</div>}
                    </div>
                    <span style={{...S.badge,background:h.estado==="Pago total"?"#EAF3DE":h.estado==="Pago Parcial"?"#E6F1FB":"#FAEEDA",color:h.estado==="Pago total"?"#3B6D11":h.estado==="Pago Parcial"?"#185FA5":"#633806",fontSize:11}}>{h.estado}</span>
                  </div>
                ))}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <input style={{...S.input,flex:"2 1 160px"}} placeholder="Cliente / Contraparte *" value={nh.clienteContraparte} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,clienteContraparte:e.target.value}}))}/>
                  <input style={{...S.input,flex:"1 1 100px"}} placeholder="Total" value={nh.total} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,total:e.target.value}}))}/>
                  <input style={{...S.input,flex:"1 1 100px"}} placeholder="Pagado" value={nh.pagado} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,pagado:e.target.value}}))}/>
                  <select style={{...S.input,flex:"1 1 120px"}} value={nh.estado} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,estado:e.target.value}}))}>
                    {ESTADOS_HONORARIO.map(e=><option key={e}>{e}</option>)}
                  </select>
                  <input style={{...S.input,flex:"2 1 180px"}} placeholder="Observaciones" value={nh.observaciones} onChange={e=>setNhMap(p=>({...p,[j.id]:{...nh,observaciones:e.target.value}}))}/>
                  <button style={S.btnPrimary} onClick={()=>agregarHonorario(j.id)}>+ Agregar</button>
                </div>
              </div>
            )}
            {tab==="info"&&(
              <div>
                <div style={S.fieldRow}>
                  <div style={S.field}><div style={S.fieldLabel}>Expediente</div><div>{j.nro||"—"}</div></div>
                  <div style={S.field}><div style={S.fieldLabel}>Fuero</div><div>{j.fuero||"—"}</div></div>
                  <div style={S.field}><div style={S.fieldLabel}>Juzgado</div><div>{j.juzgado?(parseInt(j.juzgado)||j.juzgado):"—"}</div></div>
                </div>
                <div style={S.fieldRow}>
                  <div style={S.field}><div style={S.fieldLabel}>Secretaría</div><div>{j.secretaria||"—"}</div></div>
                  <div style={S.field}><div style={S.fieldLabel}>Sala</div><div>{j.sala||"—"}</div></div>
                </div>
                {j.datosJuzgado&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>Datos del juzgado</div><div style={{fontSize:13}}>{j.datosJuzgado}</div></div>}
                {j.datosContacto&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>Datos de contacto</div><div style={{fontSize:13}}>{j.datosContacto}</div></div>}
                {j.cosasRelevantes&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>Cosas relevantes</div><div style={{fontSize:13}}>{j.cosasRelevantes}</div></div>}
                {j.otraInfo&&<div style={{marginBottom:8}}><div style={S.fieldLabel}>Otra información</div><div style={{fontSize:13}}>{j.otraInfo}</div></div>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const tiposTarea = ["Juicio","Pro Bono","Docencia","Personales","General","Honorarios"]
  const juiciosFiltrados = juicios.filter(j=>filtroEstados.length===0?!INACTIVOS.includes(j.estado):filtroEstados.includes(j.estado)).sort((a,b)=>a.autos.localeCompare(b.autos,"es"))
  const honorariosPendientes = juicios.flatMap(j=>(j.honorarios||[]).filter(h=>h.estado!=="Pago total").map(h=>({...h,autos:j.autos})))
  const tareasConLocal = tareas.filter(t=>{
    if(t.juicioId&&inactivosSet.has(t.juicioId))return false
    if(t.done&&!completadasLocal.has(t.id))return false
    return true
  })
  const tareasFiltradas = tareasConLocal.filter(t=>filtroTipos.length===0||filtroTipos.includes(t.tipo||"General"))
    .sort((a,b)=>{if(a.urgente&&!b.urgente)return -1;if(!a.urgente&&b.urgente)return 1;if(!a.fecha&&!b.fecha)return 0;if(!a.fecha)return 1;if(!b.fecha)return -1;return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()})

  const fld = (k:keyof JuicioForm) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p=>({...p,[k]:e.target.value}))

  return (
    <div style={S.app}>
      {modalOpen&&(
        <div style={S.overlay} onClick={()=>setModalOpen(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:15}}>{editandoJuicio?"Editar juicio":"Nuevo juicio"}</div>
              <button style={S.btnMini} onClick={()=>setModalOpen(false)}>✕</button>
            </div>
            <div style={S.modalGrid}>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Nombre / Carátula *</div><input style={S.inputM} value={form.autos} onChange={fld("autos")} placeholder="García c/ Pérez s/ Daños"/></div>
              <div><div style={S.fieldLabel}>Estado</div><select style={S.inputM} value={form.estado} onChange={fld("estado")}>{TODOS_ESTADOS.map(e=><option key={e}>{e}</option>)}</select></div>
              <div><div style={S.fieldLabel}>Nº Expediente</div><input style={S.inputM} value={form.nro} onChange={fld("nro")} placeholder="12345/2024"/></div>
              <div><div style={S.fieldLabel}>Fuero</div><input style={S.inputM} value={form.fuero} onChange={fld("fuero")} placeholder="Civil, Laboral..."/></div>
              <div><div style={S.fieldLabel}>Juzgado</div><input style={S.inputM} value={form.juzgado} onChange={fld("juzgado")}/></div>
              <div><div style={S.fieldLabel}>Secretaría</div><input style={S.inputM} value={form.secretaria} onChange={fld("secretaria")}/></div>
              <div><div style={S.fieldLabel}>Sala</div><input style={S.inputM} value={form.sala} onChange={fld("sala")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Advertencia</div><input style={S.inputM} value={form.advertencia} onChange={fld("advertencia")} placeholder="Algo importante..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Cosas relevantes</div><textarea style={{...S.inputM,height:60,resize:"vertical"}} value={form.cosasRelevantes} onChange={fld("cosasRelevantes")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Datos del juzgado</div><input style={S.inputM} value={form.datosJuzgado} onChange={fld("datosJuzgado")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Datos de contacto</div><input style={S.inputM} value={form.datosContacto} onChange={fld("datosContacto")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>Otra información</div><textarea style={{...S.inputM,height:60,resize:"vertical"}} value={form.otraInfo} onChange={fld("otraInfo")}/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>📁 Link Drive</div><input style={S.inputM} value={form.driveUrl} onChange={fld("driveUrl")} placeholder="https://drive.google.com/..."/></div>
              <div style={{gridColumn:"1 / -1"}}><div style={S.fieldLabel}>🤖 Link Proyecto IA</div><input style={S.inputM} value={form.iaUrl} onChange={fld("iaUrl")} placeholder="https://..."/></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button style={S.btn} onClick={()=>setModalOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={guardarJuicio} disabled={saving}>{saving?"Guardando...":editandoJuicio?"Guardar cambios":"Crear juicio"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={{fontWeight:500,fontSize:14}}>Agenda Legal</div>
          <div style={{fontSize:11,color:"#888"}}>{session.user?.name}</div>
        </div>
        {[{id:"tareas",label:"Tareas",badge:atrasadas.length+vencenHoy.length+urgentesArriba.length},{id:"juicios",label:"Juicios",badge:juiciosFiltrados.length},{id:"probono",label:"Pro Bono",badge:null},{id:"docencia",label:"Docencia",badge:null},{id:"personales",label:"Personales",badge:null},{id:"honorarios",label:"Honorarios",badge:honorariosPendientes.length||null}].map(item=>(
          <div key={item.id} style={{...S.navItem,...(panel===item.id?S.navItemActive:{})}} onClick={()=>setPanel(item.id)}>
            {item.label}
            {item.badge?<span style={S.navBadge}>{item.badge}</span>:null}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{padding:"10px 14px",borderTop:"0.5px solid #e5e7eb"}}>
          {juicios.length===0&&<button style={{...S.btnPrimary,fontSize:12,width:"100%",marginBottom:6}} onClick={async()=>{const r=await fetch('/api/seed',{method:'POST'});const d=await r.json();if(d.ok)window.location.reload();else alert(d.msg||'Error')}}>Importar mis datos</button>}
          <button style={{...S.btn,fontSize:12,width:"100%"}} onClick={()=>signOut()}>Cerrar sesión</button>
        </div>
      </div>

      <div style={S.main}>
        <div style={S.topbar}>
          <div style={{fontWeight:500,fontSize:15}}>{{tareas:"Tareas",juicios:"Juicios",probono:"Pro Bono",docencia:"Docencia",personales:"Personales",honorarios:"Honorarios"}[panel]}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {panel==="tareas"&&completadasLocal.size>0&&<button style={{...S.btnPrimary,fontSize:12}} onClick={()=>setCompletadasLocal(new Set())}>Actualizar vista ({completadasLocal.size})</button>}
            {panel==="tareas"&&tiposTarea.map(tipo=>(
              <button key={tipo} style={{...S.btn,fontSize:11,padding:"3px 8px",background:filtroTipos.includes(tipo)?"#378ADD":"transparent",color:filtroTipos.includes(tipo)?"#fff":"#888",borderColor:filtroTipos.includes(tipo)?"#378ADD":"#e5e7eb"}}
                onClick={()=>setFiltroTipos(p=>p.includes(tipo)?p.filter(x=>x!==tipo):[...p,tipo])}>{tipo}</button>
            ))}
            {panel==="tareas"&&filtroTipos.length>0&&<button style={{...S.btn,fontSize:11,color:"#888"}} onClick={()=>setFiltroTipos([])}>✕</button>}
            {panel==="juicios"&&<>
              {TODOS_ESTADOS.map(e=>(
                <button key={e} style={{...S.btn,fontSize:11,padding:"3px 8px",background:filtroEstados.includes(e)?ESTADOS[e]||"#f0f0f0":"transparent",color:filtroEstados.includes(e)?ESTADOS_TEXT[e]||"#333":"#888",borderColor:filtroEstados.includes(e)?ESTADOS_TEXT[e]||"#ccc":"#e5e7eb"}}
                  onClick={()=>setFiltroEstados(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e])}>{e}</button>
              ))}
              {filtroEstados.length>0&&<button style={{...S.btn,fontSize:11,color:"#888"}} onClick={()=>setFiltroEstados([])}>✕</button>}
              <button style={S.btnPrimary} onClick={abrirNuevo}>+ Nuevo juicio</button>
            </>}
          </div>
        </div>

        <div style={S.content}>
          {loading&&<div style={{color:"#888",fontSize:14}}>Cargando datos...</div>}
          {!loading&&panel==="tareas"&&(
            <div>
              <div style={S.metricsGrid}>
                <div style={S.metric}><div style={{fontSize:22,fontWeight:500,color:"#378ADD"}}>{vencenHoy.length}</div><div style={S.metricLabel}>Vencen hoy</div></div>
                <div style={S.metric}><div style={{fontSize:22,fontWeight:500,color:"#E24B4A"}}>{tareasActivas.filter(t=>t.urgente).length}</div><div style={S.metricLabel}>Urgentes</div></div>
                <div style={S.metric}><div style={{fontSize:22,fontWeight:500,color:"#9B59B6"}}>{atrasadas.length}</div><div style={S.metricLabel}>Atrasadas</div></div>
                <div style={S.metric}><div style={{fontSize:22,fontWeight:500}}>{tareasActivas.length}</div><div style={S.metricLabel}>Total activas</div></div>
              </div>
              {filtroTipos.length>0?(
                tareasFiltradas.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay tareas.</div>:tareasFiltradas.map(t=>renderTarea(t))
              ):<>
                {seccion("URGENTES",urgentesArriba,"#E24B4A")}
                {seccion("ATRASADAS",atrasadas,"#9B59B6")}
                {seccion("HOY",vencenHoy,"#378ADD")}
                {seccion("PRÓXIMAS TAREAS",proximas,"#555")}
                {urgentesArriba.length===0&&atrasadas.length===0&&vencenHoy.length===0&&proximas.length===0&&<div style={{color:"#aaa",fontSize:14}}>No hay tareas activas.</div>}
              </>}
            </div>
          )}
          {!loading&&panel==="juicios"&&(
            <div>{juiciosFiltrados.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay juicios con ese filtro.</div>:juiciosFiltrados.map(renderJuicio)}</div>
          )}
          {!loading&&panel==="honorarios"&&(
            <div>
              {honorariosPendientes.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay honorarios pendientes.</div>:honorariosPendientes.map((h,i)=>(
                <div key={i} style={S.card}>
                  <div style={S.cardHeader}>
                    <div style={{flex:1}}>
                      <div style={S.cardTitle}>{(h as any).autos}</div>
                      <div style={S.cardMeta}>{h.clienteContraparte}{h.total?` · Total: ${h.total}`:""}{h.pagado?` · Pagado: ${h.pagado}`:""}</div>
                      {h.observaciones&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{h.observaciones}</div>}
                    </div>
                    <span style={{...S.badge,background:h.estado==="Pago Parcial"?"#E6F1FB":"#FAEEDA",color:h.estado==="Pago Parcial"?"#185FA5":"#633806"}}>{h.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading&&(panel==="probono"||panel==="docencia"||panel==="personales")&&(
            <div style={{color:"#aaa",fontSize:14}}>Próximamente — gestión de asuntos de {panel==="probono"?"Pro Bono":panel==="docencia"?"Docencia":"Personales"}.</div>
          )}
        </div>
      </div>
    </div>
  )
}

const S: Record<string,React.CSSProperties> = {
  app:{display:"flex",height:"100vh",fontFamily:"system-ui, sans-serif",fontSize:14,color:"#111"},
  sidebar:{width:220,background:"#f9f9f8",borderRight:"0.5px solid #e5e7eb",display:"flex",flexDirection:"column"},
  sidebarHeader:{padding:"14px 14px 10px",borderBottom:"0.5px solid #e5e7eb"},
  navItem:{padding:"7px 14px",cursor:"pointer",fontSize:13,color:"#666",borderLeft:"2px solid transparent"},
  navItemActive:{background:"#fff",color:"#111",borderLeft:"2px solid #378ADD",fontWeight:500},
  navBadge:{float:"right",background:"#E6F1FB",color:"#185FA5",fontSize:11,padding:"1px 6px",borderRadius:10},
  main:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  topbar:{padding:"10px 16px",borderBottom:"0.5px solid #e5e7eb",background:"#fff",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  content:{flex:1,overflowY:"auto",padding:"14px 16px"},
  card:{background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:12,marginBottom:8,overflow:"hidden"},
  cardHeader:{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"},
  cardTitle:{fontSize:13,fontWeight:500,lineHeight:1.35},
  cardMeta:{fontSize:11,color:"#888",marginTop:2},
  badge:{fontSize:11,padding:"2px 8px",borderRadius:10,whiteSpace:"nowrap",flexShrink:0},
  tabs:{display:"flex",borderBottom:"0.5px solid #e5e7eb",marginBottom:12,marginTop:10},
  tab:{fontSize:12,padding:"6px 12px",cursor:"pointer",color:"#888",borderBottom:"2px solid transparent",marginBottom:-0.5},
  tabActive:{color:"#378ADD",borderBottom:"2px solid #378ADD",fontWeight:500},
  pruebaRow:{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",borderBottom:"0.5px solid #f0f0f0"},
  check:{width:15,height:15,border:"0.5px solid #ccc",borderRadius:3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0},
  checkDone:{background:"#EAF3DE",borderColor:"#639922",color:"#3B6D11"},
  input:{fontSize:12,padding:"4px 8px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",flex:1},
  btn:{fontSize:12,padding:"5px 12px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"transparent",color:"#111"},
  btnPrimary:{fontSize:12,padding:"5px 12px",border:"none",borderRadius:8,cursor:"pointer",background:"#378ADD",color:"#fff",whiteSpace:"nowrap"},
  btnMini:{fontSize:12,padding:"2px 6px",border:"0.5px solid #e5e7eb",borderRadius:6,cursor:"pointer",background:"transparent",color:"#888"},
  btnGoogle:{fontSize:14,padding:"10px 24px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"#fff",color:"#111"},
  metricsGrid:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:10,marginBottom:16},
  metric:{background:"#f9f9f8",borderRadius:8,padding:"10px 12px"},
  metricLabel:{fontSize:11,color:"#888",marginTop:2},
  sectionLabel:{fontSize:11,fontWeight:600,letterSpacing:"0.06em",marginTop:14,marginBottom:6,paddingBottom:4,borderBottom:"0.5px solid #e5e7eb"},
  fieldRow:{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8},
  field:{flex:1,minWidth:100},
  fieldLabel:{fontSize:11,color:"#888",marginBottom:2},
  login:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f8"},
  loginCard:{background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:12,padding:40,textAlign:"center"},
  loading:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#888"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:{background:"#fff",borderRadius:14,padding:24,width:"min(640px, 95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"},
  modalGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"},
  inputM:{fontSize:13,padding:"6px 10px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",width:"100%",boxSizing:"border-box"},
}
