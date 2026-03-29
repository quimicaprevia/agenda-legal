import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../lib/authOptions"
import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import path from "path"
import fs from "fs"

const prisma = new PrismaClient()

function normalizarEstado(estado: string | null | undefined): string {
  if (!estado) return "Judicializado"
  const mapa: Record<string, string> = {
    "Finalizado":    "Finalizado",
    "Renunciado":    "Renunciado",
    "Judicializado": "Judicializado",
    "Preparación":   "En preparación",
    "Preparacion":   "En preparación",
    "Mediacion":     "Mediación",
    "Mediación":     "Mediación",
    "Inicio":        "Inicio",
    "Suspendido":    "Renunciado",
  }
  return mapa[estado.trim()] || "Judicializado"
}

function toStr(val: any): string {
  if (val === null || val === undefined) return ""
  const s = String(val).trim()
  return s === "nan" || s === "NaN" || s === "NaT" ? "" : s
}

function toFecha(val: any): Date {
  const hoy = new Date()
  if (!val || val === "NaT" || val === "NaN") return hoy
  try {
    if (typeof val === "number") {
      const d = XLSX.SSF.parse_date_code(val)
      return new Date(d.y, d.m - 1, d.d)
    }
    const d = new Date(val)
    return isNaN(d.getTime()) ? hoy : d
  } catch {
    return hoy
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).json({ error: "Usuario no encontrado" })
  const userId = user.id

  try {
    const xlsxPath = path.join(process.cwd(), "public", "import.xlsx")
    if (!fs.existsSync(xlsxPath)) {
      return res.status(400).json({ error: "No se encontró public/import.xlsx" })
    }

    const workbook = XLSX.readFile(xlsxPath)
    const sheetDocencia = XLSX.utils.sheet_to_json(workbook.Sheets["Docencia"] || {})
    const sheetPersonal = XLSX.utils.sheet_to_json(workbook.Sheets["Personales"] || {})
    const sheetJuicios  = XLSX.utils.sheet_to_json(workbook.Sheets["Juicios"] || {})
    const sheetProBono  = XLSX.utils.sheet_to_json(workbook.Sheets["Pro Bono"] || {})

    await prisma.tarea.deleteMany({ where: { userId } })
    await prisma.prueba.deleteMany({ where: { juicio: { userId } } })
    await prisma.honorario.deleteMany({ where: { juicio: { userId } } })
    await prisma.clienteJuicio.deleteMany({ where: { userId } })
    await prisma.juicio.deleteMany({ where: { userId } })
    await prisma.asunto.deleteMany({ where: { userId } })

    let countJuicios = 0, countAsuntos = 0, countTareas = 0

    for (const row of sheetJuicios as any[]) {
      const autos = toStr(row["AUTOS"])
      if (!autos) continue
      const estado   = normalizarEstado(toStr(row["ESTADO"]))
      const nro      = toStr(row["Nro Expte."])
      const fuero    = toStr(row["Fuero"])
      const juzgado  = toStr(row["Juz"])
      const sec      = toStr(row["Sec"])
      const sala     = toStr(row["Sala"])
      const otraInfo = toStr(row["OTRA INFORMACION"])
      const tarea    = toStr(row["TAREAS"])
      const fecha    = toFecha(row["FECHA"])

      const juicio = await prisma.juicio.create({
        data: {
          userId, tipo: "Propio", autos, estado,
          nro: nro || undefined,
          fuero: fuero || undefined,
          juzgado: juzgado || undefined,
          secretaria: sec || undefined,
          sala: sala || undefined,
          otraInfo: otraInfo || undefined,
        }
      })
      countJuicios++

      if (tarea) {
        await prisma.tarea.create({
          data: { userId, texto: tarea, fecha, urgente: false, done: false, tipo: "Juicio", juicioId: juicio.id }
        })
        countTareas++
      }
    }

    const docenciaMap: Record<string, any[]> = {}
    for (const row of sheetDocencia as any[]) {
      const tipo = toStr(row["TIPO"])
      if (!tipo) continue
      if (!docenciaMap[tipo]) docenciaMap[tipo] = []
      docenciaMap[tipo].push(row)
    }
    for (const [nombre, rows] of Object.entries(docenciaMap)) {
      const otraInfo = rows.map(r => toStr(r["OTRA INFORMACION"])).find(v => v) || undefined
      const driveUrl = rows.map(r => toStr(r["Link Drive"])).find(v => v) || undefined
      const asunto = await prisma.asunto.create({
        data: { userId, nombre, tipo: "docencia", estado: "Abierta", otraInfo, driveUrl }
      })
      countAsuntos++
      for (const row of rows) {
        const tarea = toStr(row["TAREA"])
        if (!tarea) continue
        await prisma.tarea.create({
          data: { userId, texto: tarea, fecha: toFecha(row["FECHA"]), urgente: false, done: false, tipo: "Docencia", asuntoId: asunto.id }
        })
        countTareas++
      }
    }

    const proBonoMap: Record<string, any[]> = {}
    for (const row of sheetProBono as any[]) {
      const tipo = toStr(row["TIPO"])
      if (!tipo) continue
      if (!proBonoMap[tipo]) proBonoMap[tipo] = []
      proBonoMap[tipo].push(row)
    }
    for (const [nombre, rows] of Object.entries(proBonoMap)) {
      const advertencia = rows.map(r => toStr(r["ADVERTENCIA"])).find(v => v) || undefined
      const otraInfo    = rows.map(r => toStr(r["OTRA INFORMACION"])).find(v => v) || undefined
      const asunto = await prisma.asunto.create({
        data: { userId, nombre, tipo: "probono", estado: "Abierta", advertencia, otraInfo }
      })
      countAsuntos++
      for (const row of rows) {
        const tarea = toStr(row["TAREA"])
        if (!tarea) continue
        await prisma.tarea.create({
          data: { userId, texto: tarea, fecha: toFecha(row["FECHA"]), urgente: false, done: false, tipo: "Pro Bono", asuntoId: asunto.id }
        })
        countTareas++
      }
    }

    for (const row of sheetPersonal as any[]) {
      const tarea = toStr(row["TAREA"])
      if (!tarea) continue
      const detalle  = toStr(row["DETALLE"])
      const urlMatch = detalle.match(/https?:\/\/\S+/)
      const webUrl   = urlMatch ? urlMatch[0] : undefined
      const info     = detalle ? detalle.replace(urlMatch?.[0] || "", "").replace(/\\n/g, " ").trim() || undefined : undefined
      await prisma.tarea.create({
        data: { userId, texto: tarea, fecha: toFecha(row["FECHA"]), urgente: false, done: false, tipo: "Personales", info, webUrl }
      })
      countTareas++
    }

    return res.status(200).json({ ok: true, juicios: countJuicios, asuntos: countAsuntos, tareas: countTareas })

  } catch (err: any) {
    console.error("Import error:", err)
    return res.status(500).json({ error: err.message || "Error desconocido" })
  } finally {
    await prisma.$disconnect()
  }
}
