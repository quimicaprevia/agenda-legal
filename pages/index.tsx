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
const TIPOS_TAREA = ["Juicio","Pro Bono","Docencia","Personales"]
const FRANJA_COLOR: Record<string,string> = { "Juicio":"#378ADD","Pro Bono":"#3B6D11","Docencia":"#BA7517","Personales":"#9B59B6" }

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
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoJuicio, setEditandoJuicio] = useState<Juicio|null>(null)
  const [form, setForm] = useState<JuicioForm>(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [vistaCongelada, setVistaCongelada] = useState<Tarea[]>([])
  const [cambios, setCambios] = useState<Record<string,Partial<Tarea>>>({})
  const [panelDerechoVisible, setPanelDerechoVisible] = useState(true)
  const [juicioSeleccionado, setJuicioSeleccionado] = useState<string|null>(null)
  const [posponerOpen, setPosponerOpen] = useState<string|null>(null)
  const [posponerFecha, setPosponerFecha] = useState("")

  useEffect(() => {
    if (expandido) {
      setTimeout(() => {
        const el = document.getElementById(`juicio-${expandido}`)
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 80)
    }
  }, [expandido])

  useEffect(() => {
    if (session && loading) {
      Promise.all([fetch("/api/juicios").then(r=>r.json()), fetch("/api/tareas").then(r=>r.json())])
        .then(([j,t]) => {
          setJuicios(Array.isArray(j)?j:[])
          const ts = Array.isArray(t)?t:[]
          setTareas(ts)
          setVistaCongelada(ts.filter(x=>!x.done))
          setLoading(false)
        })
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
  const tareasActivas = tareas.filter(t=>!t.done && !(t.juicioId&&inactivosSet.has(t.juicioId)))
  const esAtrasada = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha)<hoy }
  const esHoy = (t:Tarea) => { if(!t.fecha)return false; return parseFecha(t.fecha).getTime()===hoy.getTime() }
  const esProxima = (t:Tarea) => !esAtrasada(t)&&!esHoy(t)

  const vistaActual = vistaCongelada
    .filter(t=>!(t.juicioId&&inactivosSet.has(t.juicioId)))
    .map(t=>({...t,...(cambios[t.id]||{})}))
  const urgentesArriba = vistaActual.filter(t=>t.urgente&&(esAtrasada(t)||esHoy(t)))
  const atrasadas = vistaActual.filter(t=>esAtrasada(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const vencenHoy = vistaActual.filter(t=>esHoy(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const proximas = vistaActual.filter(t=>esProxima(t)&&!urgentesArriba.find(u=>u.id===t.id))
  const hayPendientes = Object.keys(cambios).length > 0

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
    setTareas(ts=>ts.map(x=>x.id===t.id?{...x,done:nuevoDone}:x))
    setVistaCongelada(vs=>vs.map(x=>x.id===t.id?{...x,done:nuevoDone}:x))
    setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(x=>x.id===t.id?{...x,done:nuevoDone}:x)})))
    setCambios(p=>({...p,[t.id]:{...p[t.id],done:nuevoDone}}))
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,done:nuevoDone})})
  }

  const guardarEdicion = async (t:Tarea) => {
    await fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,texto:editTexto,urgente:editUrgente,fecha:editFecha||null})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],texto:editTexto,urgente:editUrgente,fecha:editFecha||undefined}}))
    setVistaCongelada(vs=>vs.map(x=>x.id===t.id?{...x,texto:editTexto,urgente:editUrgente,fecha:editFecha||x.fecha}:x))
    setEditId(null)
  }

  const posponer = async (t:Tarea) => {
    if (!posponerFecha) return
    await fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,fecha:posponerFecha})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],fecha:posponerFecha}}))
    setVistaCongelada(vs=>vs.map(x=>x.id===t.id?{...x,fecha:posponerFecha}:x))
    setPosponerOpen(null)
    setPosponerFecha("")
  }

  const toggleUrgente = (t:Tarea) => {
    const nuevoUrgente = !(cambios[t.id]?.urgente ?? t.urgente)
    fetch("/api/tareas",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,urgente:nuevoUrgente})})
    setCambios(p=>({...p,[t.id]:{...p[t.id],urgente:nuevoUrgente}}))
  }

  const actualizarVista = () => {
    const nuevasTareas = tareas.map(t=>cambios[t.id]?{...t,...cambios[t.id]}:t)
    setTareas(nuevasTareas)
    setJuicios(js=>js.map(j=>({...j,tareas:j.tareas.map(t=>cambios[t.id]?{...t,...cambios[t.id]}:t)})))
    const nuevaVista = nuevasTareas
      .filter(t=>!t.done && !(t.juicioId&&inactivosSet.has(t.juicioId)))
      .sort((a,b)=>{
        if(a.urgente&&!b.urgente)return -1; if(!a.urgente&&b.urgente)return 1
        if(!a.fecha&&!b.fecha)return 0; if(!a.fecha)return 1; if(!b.fecha)return -1
        return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()
      })
    setVistaCongelada(nuevaVista)
    setCambios({})
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

  const juicioPanel = juicioSeleccionado ? juicios.find(j=>j.id===juicioSeleccionado) : null

  const renderTareaNuevo = (t:Tarea) => {
    const isDone = cambios[t.id]?.done ?? t.done
    const urgente = cambios[t.id]?.urgente ?? t.urgente
    const fecha = cambios[t.id]?.fecha ?? t.fecha
    const texto = cambios[t.id]?.texto ?? t.texto
    const isEdit = editId===t.id
    const tipo = t.tipo||"Juicio"
    const franjaColor = FRANJA_COLOR[tipo]||"#378ADD"
    const bgColor = isDone?"#f9f9f8":urgente?"#FFF0F0":esAtrasada({...t,fecha})?"#F5F0FF":"#fff"
    const borderColor = isDone?"#e5e7eb":urgente?"#E24B4A":esAtrasada({...t,fecha})?"#C9A8F0":"#e5e7eb"
    const juicioInfo = t.juicioId ? juicios.find(j=>j.id===t.juicioId) : null
    const driveUrl = juicioInfo?.driveUrl
    const nroExpte = juicioInfo?.nro && juicioInfo.nro!=="Iniciar" ? juicioInfo.nro : null

    return (
      <div key={t.id}
        style={{display:"flex",width:"100%",background:bgColor,border:`0.5px solid ${borderColor}`,borderRadius:10,marginBottom:6,overflow:"hidden",opacity:isDone?0.65:1,cursor:"default"}}
        onClick={e=>{
          const target = e.target as HTMLElement
          if(target.closest("button")||target.closest("a")||target.closest(".check-box")||target.closest(".caratula")) return
          if(t.juicioId){ setJuicioSeleccionado(t.juicioId); if(!panelDerechoVisible) setPanelDerechoVisible(true) }
        }}
      >
        <div style={{width:5,flexShrink:0,background:franjaColor}}/>
        <div style={{flex:1,padding:"11px 13px",minWidth:0}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
            <div className="check-box"
              style={{...S.check,...(isDone?S.checkDone:{})}}
              onClick={e=>{e.stopPropagation();toggleDone(t)}}
            >{isDone?"✓":""}</div>
            <div style={{flex:1,minWidth:0}}>
              <span className="caratula"
                style={{fontSize:14,fontWeight:600,color:isDone?"#aaa":"#185FA5",cursor:"pointer",lineHeight:1.4,textDecoration:isDone?"line-through":"none"}}
                onClick={e=>{e.stopPropagation();if(t.juicioId){setPanel("juicios");setExpandido(t.juicioId);setTabActiva(p=>({...p,[t.juicioId!]:"tareas"}))}}}
              >{t.juicio?.autos||t.tema||tipo}</span>
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
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:9,paddingTop:8,borderTop:"0.5px solid #e5e7eb",flexWrap:"wrap"}}>
              {driveUrl&&<a href={driveUrl} target="_blank" rel="noopener noreferrer" style={S.linkDrive} onClick={e=>e.stopPropagation()}>📁 Drive</a>}
              {nroExpte&&<a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" rel="noopener noreferrer" style={S.linkPjn} onClick={e=>e.stopPropagation()}>⚖ PJN</a>}
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
              {!isDone&&<button style={S.btnUrgente} onClick={e=>{e.stopPropagation();toggleUrgente(t)}}>! urgente</button>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const seccion = (label:string, items:Tarea[], color?:string) => {
    if(items.length===0) return null
    return (
      <div key={label}>
        <div style={{...S.sectionLabel,color:color||"#888"}}>{label}</div>
        {items.map(t=>renderTareaNuevo(t))}
      </div>
    )
  }

  const renderPanelDerecho = () => {
    if (!juicioPanel) return (
      <div style={{padding:"18px 16px"}}>
        <div style={{fontSize:11,fontWeight:600,color:"#888",letterSpacing:"0.06em",marginBottom:14}}>RESUMEN</div>
        {[
          {num:tareasActivas.filter(t=>esHoy(t)).length,label:"Vencen hoy",color:"#378ADD"},
          {num:tareasActivas.filter(t=>t.urgente).length,label:"Urgentes",color:"#E24B4A"},
          {num:tareasActivas.filter(t=>esAtrasada(t)).length,label:"Atrasadas",color:"#9B59B6"},
          {num:tareasActivas.length,label:"Total activas",color:"#111"},
        ].map(m=>(
          <div key={m.label} style={{background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:10,padding:"14px 16px",marginBottom:8}}>
            <div style={{fontSize:28,fontWeight:500,color:m.color}}>{m.num}</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>{m.label}</div>
          </div>
        ))}
      </div>
    )
    const otrasTareas = juicioPanel.tareas.filter(t=>!t.done)
    return (
      <div style={{padding:"18px 16px"}}>
        <span style={{fontSize:11,color:"#aaa",cursor:"pointer",marginBottom:12,display:"inline-block"}} onClick={()=>setJuicioSeleccionado(null)}>← volver al resumen</span>
        <div style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:ESTADOS[juicioPanel.estado]||"#F1EFE8",color:ESTADOS_TEXT[juicioPanel.estado]||"#444",display:"inline-block",marginBottom:12,marginLeft:8}}>{juicioPanel.estado}</div>
        <div style={{fontSize:14,fontWeight:600,color:"#111",marginBottom:10,lineHeight:1.4}}>{juicioPanel.autos}</div>
        {juicioPanel.advertencia&&<div style={{fontSize:12,color:"#A32D2D",background:"#fff5f5",border:"0.5px solid #f5c5c5",borderRadius:6,padding:"6px 10px",marginBottom:12}}>⚠ {juicioPanel.advertencia}</div>}
        {juicioPanel.nro&&<div style={{marginBottom:10}}><div style={S.fieldLabel}>EXPEDIENTE</div><div style={{fontSize:13}}>{juicioPanel.nro}</div></div>}
        {juicioPanel.fuero&&<div style={{marginBottom:10}}><div style={S.fieldLabel}>FUERO</div><div style={{fontSize:13}}>{juicioPanel.fuero}</div></div>}
        {juicioPanel.juzgado&&<div style={{marginBottom:10}}><div style={S.fieldLabel}>JUZGADO / SECRETARÍA</div><div style={{fontSize:13}}>Juz. {parseInt(juicioPanel.juzgado)||juicioPanel.juzgado}{juicioPanel.secretaria?` · Sec. ${juicioPanel.secretaria}`:""}</div></div>}
        {juicioPanel.cosasRelevantes&&<div style={{marginBottom:10}}><div style={S.fieldLabel}>NOTAS</div><div style={{fontSize:12,color:"#444"}}>{juicioPanel.cosasRelevantes}</div></div>}
        <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:14}}>
          {juicioPanel.driveUrl&&<a href={juicioPanel.driveUrl} target="_blank" rel="noopener noreferrer" style={S.pjLink}>📁 Abrir carpeta en Drive</a>}
          {juicioPanel.nro&&juicioPanel.nro!=="Iniciar"&&<a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" rel="noopener noreferrer" style={{...S.pjLink,color:"#185FA5",borderColor:"#b5d4f4",background:"#E6F1FB"}}>⚖ Ver expediente en PJN</a>}
          {juicioPanel.iaUrl&&<a href={juicioPanel.iaUrl} target="_blank" rel="noopener noreferrer" style={{...S.pjLink,color:"#7B3F9E",borderColor:"#d5b5f5",background:"#f5eeff"}}>🤖 Proyecto IA</a>}
        </div>
        {otrasTareas.length>0&&(
          <div style={{marginTop:18,paddingTop:14,borderTop:"0.5px solid #e5e7eb"}}>
            <div style={S.fieldLabel}>OTRAS TAREAS PENDIENTES</div>
            {otrasTareas.map(t=>(
              <div key={t.id} style={{fontSize:12,color:"#333",lineHeight:1.4,padding:"6px 0",borderBottom:"0.5px solid #f0f0f0"}}>{t.texto}{t.fecha?` · ${formatFecha(t.fecha)}`:""}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderJuicio = (j:Juicio) => {
    const exp = expandido===j.id
    const tab = tabActiva[j.id]||"tareas"
    const nt = ntMap[j.id]||{texto:"",fecha:"",urgente:false}
    const np = npMap[j.id]||{tipo:"",contenido:"",detalle:"",estado:"Ofrecida"}
    const nh = nhMap[j.id]||{clienteContraparte:"",total:"",pagado:"",estado:"Pendiente",observaciones:""}
    const activas = j.tareas.filter(t=>!t.done).sort((a,b)=>{if(a.urgente&&!b.urgente)return -1;if(!a.urgente&&b.urgente)return 1;if(!a.fecha)return 1;if(!b.fecha)return -1;return parseFecha(a.fecha).getTime()-parseFecha(b.fecha).getTime()})
    const concluidas = j.tareas.filter(t=>t.done).slice(-5)
    return (
      <div key={j.id} id={`juicio-${j.id}`} style={{...S.card,borderColor:exp?"#378ADD":"#e5e7eb"}}>
        <div style={S.cardHeader} onClick={()=>{setExpandido(exp?null:j.id);if(!tabActiva[j.id])setTabActiva(p=>({...p,[j.id]:"tareas"}))}}>
          <div style={{flex:1}}>
            <div style={S.cardTitle}>{j.autos}</div>
            <div style={S.cardMeta}>{j.nro&&j.nro!=="Iniciar"?`Expte. ${j.nro} · `:""}{j.fuero}{j.juzgado?` · Juz. ${parseInt(j.juzgado)||j.juzgado}`:""}</div>
            {j.advertencia&&<div style={{fontSize:11,color:"#A32D2D",marginTop:3,fontWeight:500}}>⚠ {j.advertencia}</div>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            <span style={{...S.badge,background:ESTADOS[j.estado]||"#F1EFE8",color:ESTADOS_TEXT[j.estado]||"#444"}}>{j.estado}</span>
            <button style={{...S.btnMini,fontSize:11}} onClick={e=>abrirEditar(j,e)}>✎</button>
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
                {activas.map(t=>(
                  <div key={t.id} style={{...S.card,background:t.urgente?"#FFF0F0":"#fff",borderColor:t.urgente?"#E24B4A":"#e5e7eb",marginBottom:6}}>
                    <div style={S.cardHeader}>
                      <div style={{...S.check,...(t.done?S.checkDone:{})}} onClick={()=>toggleDone(t)}>{t.done?"✓":""}</div>
                      <div style={{flex:1,marginLeft:8,fontSize:13}}>{t.texto}</div>
                      {t.urgente&&<span style={{fontSize:10,color:"#A32D2D",fontWeight:600,background:"#FCEBEB",padding:"1px 6px",borderRadius:8}}>URGENTE</span>}
                      {t.fecha&&<span style={{fontSize:11,color:"#888",whiteSpace:"nowrap"}}>{formatFecha(t.fecha)}</span>}
                      <button style={{...S.btnMini,color:t.urgente?"#A32D2D":"#aaa",fontWeight:700}} onClick={()=>toggleUrgente(t)}>!</button>
                      <button style={S.btnMini} onClick={()=>{setEditId(t.id);setEditTexto(t.texto);setEditFecha(t.fecha?t.fecha.split("T")[0]:"");setEditUrgente(t.urgente)}}>✎</button>
                    </div>
                  </div>
                ))}
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

  const juiciosFiltrados = juicios.filter(j=>filtroEstados.length===0?!INACTIVOS.includes(j.estado):filtroEstados.includes(j.estado)).sort((a,b)=>a.autos.localeCompare(b.autos,"es"))
  const honorariosPendientes = juicios.flatMap(j=>(j.honorarios||[]).filter(h=>h.estado!=="Pago total").map(h=>({...h,autos:j.autos})))
  const tareasFiltradas = vistaActual.filter(t=>filtroTipos.length===0||filtroTipos.includes(t.tipo||"Juicio"))
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
        {[{id:"tareas",label:"Tareas",badge:tareasActivas.length},{id:"juicios",label:"Juicios",badge:juiciosFiltrados.length},{id:"probono",label:"Pro Bono",badge:null},{id:"docencia",label:"Docencia",badge:null},{id:"personales",label:"Personales",badge:null},{id:"honorarios",label:"Honorarios",badge:honorariosPendientes.length||null}].map(item=>(
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
          <div style={{fontWeight:500,fontSize:20}}>
            {{tareas:"Tareas",juicios:"Juicios",probono:"Pro Bono",docencia:"Docencia",personales:"Personales",honorarios:"Honorarios"}[panel]}
          </div>
          {panel==="tareas"&&<>
            <div style={S.sepPipe}/>
            {hayPendientes&&<button style={S.btnActualizar} onClick={actualizarVista}>Actualizar vista ({Object.keys(cambios).length})</button>}
            <div style={S.sepDot}>·</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
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
          {panel==="juicios"&&<div style={{display:"flex",gap:6,alignItems:"center",marginLeft:8,flexWrap:"wrap"}}>
            {TODOS_ESTADOS.map(e=>(
              <button key={e} style={{...S.filterBtn,...(filtroEstados.includes(e)?{background:ESTADOS[e]||"#f0f0f0",color:ESTADOS_TEXT[e]||"#333",borderColor:ESTADOS_TEXT[e]||"#ccc"}:{})}}
                onClick={()=>setFiltroEstados(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e])}>{e}</button>
            ))}
            {filtroEstados.length>0&&<button style={{...S.filterBtn,color:"#888"}} onClick={()=>setFiltroEstados([])}>✕</button>}
            <button style={S.btnPrimary} onClick={abrirNuevo}>+ Nuevo juicio</button>
          </div>}
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={S.content}>
            {loading&&<div style={{color:"#888",fontSize:14}}>Cargando datos...</div>}
            {!loading&&panel==="tareas"&&(
              filtroTipos.length>0?(
                tareasFiltradas.length===0?<div style={{color:"#aaa",fontSize:14}}>No hay tareas.</div>:tareasFiltradas.map(t=>renderTareaNuevo(t))
              ):<>
                {seccion("URGENTES",urgentesArriba,"#E24B4A")}
                {seccion("ATRASADAS",atrasadas,"#9B59B6")}
                {seccion("HOY",vencenHoy,"#378ADD")}
                {seccion("PRÓXIMAS TAREAS",proximas,"#555")}
                {vistaActual.filter(t=>!t.done).length===0&&<div style={{color:"#aaa",fontSize:14}}>No hay tareas activas.</div>}
              </>
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
          {panel==="tareas"&&panelDerechoVisible&&(
            <div style={S.panelDerecho}>{renderPanelDerecho()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

const S: Record<string,React.CSSProperties> = {
  app:{display:"flex",height:"100vh",fontFamily:"system-ui, sans-serif",fontSize:14,color:"#111"},
  sidebar:{width:220,background:"#f9f9f8",borderRight:"0.5px solid #e5e7eb",display:"flex",flexDirection:"column",flexShrink:0},
  sidebarHeader:{padding:"14px 14px 10px",borderBottom:"0.5px solid #e5e7eb"},
  navItem:{padding:"7px 14px",cursor:"pointer",fontSize:13,color:"#666",borderLeft:"2px solid transparent",display:"flex",justifyContent:"space-between",alignItems:"center"},
  navItemActive:{background:"#fff",color:"#111",borderLeft:"2px solid #378ADD",fontWeight:500},
  navBadge:{background:"#E6F1FB",color:"#185FA5",fontSize:11,padding:"1px 6px",borderRadius:10},
  main:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0},
  topbar:{padding:"16px 20px",borderBottom:"0.5px solid #e5e7eb",background:"#fff",display:"flex",alignItems:"center",gap:0,flexShrink:0},
  sepPipe:{width:1,height:18,background:"#e0e0e0",margin:"0 16px",flexShrink:0},
  sepDot:{fontSize:16,color:"#d0d0d0",margin:"0 12px",flexShrink:0,lineHeight:"1"},
  filterBtn:{fontSize:12,padding:"4px 12px",border:"0.5px solid #d0d0d0",borderRadius:8,cursor:"pointer",background:"transparent",color:"#555"},
  filterBtnActive:{background:"#378ADD",color:"#fff",borderColor:"#378ADD"},
  btnActualizar:{fontSize:12,padding:"5px 14px",border:"none",borderRadius:8,cursor:"pointer",background:"#378ADD",color:"#fff",fontWeight:500},
  content:{flex:1,overflowY:"auto",padding:"14px 18px"},
  panelDerecho:{width:260,borderLeft:"0.5px solid #e5e7eb",background:"#f9f9f8",flexShrink:0,overflowY:"auto"},
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
  btnEdit:{fontSize:15,padding:"4px 8px",border:"0.5px solid #e5e7eb",borderRadius:6,cursor:"pointer",background:"transparent",color:"#aaa",flexShrink:0},
  btnPosponer:{fontSize:12,padding:"4px 10px",border:"0.5px solid #b5d4f4",borderRadius:6,cursor:"pointer",background:"#E6F1FB",color:"#185FA5",whiteSpace:"nowrap"},
  btnUrgente:{fontSize:12,padding:"4px 10px",border:"0.5px solid #E24B4A",borderRadius:6,cursor:"pointer",background:"transparent",color:"#E24B4A",whiteSpace:"nowrap"},
  linkDrive:{fontSize:12,padding:"4px 10px",border:"0.5px solid #c5d8fb",borderRadius:6,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,color:"#4285F4",background:"#f0f5ff",whiteSpace:"nowrap"},
  linkPjn:{fontSize:12,padding:"4px 10px",border:"0.5px solid #b5d4f4",borderRadius:6,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,color:"#185FA5",background:"#E6F1FB",whiteSpace:"nowrap"},
  pjLink:{fontSize:12,padding:"7px 12px",border:"0.5px solid #e5e7eb",borderRadius:8,textDecoration:"none",display:"flex",alignItems:"center",gap:6,color:"#555",background:"#fff"},
  input:{fontSize:12,padding:"4px 8px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",flex:1},
  btn:{fontSize:12,padding:"5px 12px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"transparent",color:"#111"},
  btnPrimary:{fontSize:12,padding:"5px 12px",border:"none",borderRadius:8,cursor:"pointer",background:"#378ADD",color:"#fff",whiteSpace:"nowrap"},
  btnMini:{fontSize:12,padding:"2px 6px",border:"0.5px solid #e5e7eb",borderRadius:6,cursor:"pointer",background:"transparent",color:"#888"},
  btnGoogle:{fontSize:14,padding:"10px 24px",border:"0.5px solid #ccc",borderRadius:8,cursor:"pointer",background:"#fff",color:"#111"},
  sectionLabel:{fontSize:11,fontWeight:600,letterSpacing:"0.06em",marginTop:14,marginBottom:6,paddingBottom:4,borderBottom:"0.5px solid #e5e7eb"},
  fieldRow:{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8},
  field:{flex:1,minWidth:100},
  fieldLabel:{fontSize:10,color:"#888",marginBottom:2,fontWeight:500,letterSpacing:"0.04em"},
  login:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f8"},
  loginCard:{background:"#fff",border:"0.5px solid #e5e7eb",borderRadius:12,padding:40,textAlign:"center"},
  loading:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#888"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:{background:"#fff",borderRadius:14,padding:24,width:"min(640px, 95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"},
  modalGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"},
  inputM:{fontSize:13,padding:"6px 10px",border:"0.5px solid #ccc",borderRadius:8,background:"#f9f9f8",color:"#111",width:"100%",boxSizing:"border-box"},
}
