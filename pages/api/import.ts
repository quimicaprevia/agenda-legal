// pages/api/import.ts
// Importa datos desde el Excel de Facundo a la base de datos
// Borra TODO primero y reimporta. Usar solo una vez.

import type { NextApiRequest, NextApiResponse } from "next"
import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import path from "path"
import fs from "fs"

const prisma = new PrismaClient()

// Normaliza estados del Excel al formato de la app
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
    "Suspendido":    "Renunciado",  // mapear Suspendido a Renunciado
  }
  return mapa[estado.trim()] || "Judicializado"
}

function toStr(val: any): string {
  if (val === null || val === undefined) return ""
  return String(val).trim()
}

function toFecha(val: any): string {
  // Hoy como fallback
  const hoy = new Date().toISOString().split("T")[0]
  if (!val || val === "NaT" || val === "NaN") return hoy
  try {
    // Excel puede devolver un número serial o un string
    if (typeof val === "number") {
      // número serial de Excel
      const d = XLSX.SSF.parse_date_code(val)
      return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`
    }
    const d = new Date(val)
    if (isNaN(d.getTime())) return hoy
    return d.toISOString().split("T")[0]
  } catch {
    return hoy
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  try {
    // Buscar el Excel subido — debe estar en public/import.xlsx
    const xlsxPath = path.join(process.cwd(), "public", "import.xlsx")
    if (!fs.existsSync(xlsxPath)) {
      return res.status(400).json({ error: "No se encontró public/import.xlsx" })
    }

    const workbook = XLSX.readFile(xlsxPath)

    const sheetDocencia  = XLSX.utils.sheet_to_json(workbook.Sheets["Docencia"]  || workbook.Sheets[workbook.SheetNames[0]])
    const sheetPersonal  = XLSX.utils.sheet_to_json(workbook.Sheets["Personales"] || workbook.Sheets[workbook.SheetNames[1]])
    const sheetJuicios   = XLSX.utils.sheet_to_json(workbook.Sheets["Juicios"]   || workbook.Sheets[workbook.SheetNames[2]])
    const sheetProBono   = XLSX.utils.sheet_to_json(workbook.Sheets["Pro Bono"]  || workbook.Sheets[workbook.SheetNames[3]])

    // ── Borrar todo en orden correcto (FK) ──────────────────────────────────
    await prisma.tarea.deleteMany()
    await prisma.prueba.deleteMany().catch(()=>{})
    await prisma.honorario.deleteMany().catch(()=>{})
    await prisma.clienteJuicio.deleteMany().catch(()=>{})
    await prisma.juicio.deleteMany()
    await prisma.asunto.deleteMany()

    let countJuicios = 0, countAsuntos = 0, countTareas = 0

    // ── JUICIOS ─────────────────────────────────────────────────────────────
    for (const row of sheetJuicios as any[]) {
      const autos = toStr(row["AUTOS"])
      if (!autos || autos === "nan") continue  // saltar fila vacía

      const estado = normalizarEstado(toStr(row["ESTADO"]))
      const nro    = toStr(row["Nro Expte."])
      const fuero  = toStr(row["Fuero"])
      const juzgado = toStr(row["Juz"])
      const secretaria = toStr(row["Sec"])
      const sala   = toStr(row["Sala"])
      const otraInfo = toStr(row["OTRA INFORMACION"])
      const tarea  = toStr(row["TAREAS"])
      const fecha  = toFecha(row["FECHA"])

      const juicio = await prisma.juicio.create({
        data: {
          autos,
          estado,
          nro: nro || undefined,
          fuero: fuero || undefined,
          juzgado: juzgado && juzgado !== "nan" ? juzgado : undefined,
          secretaria: secretaria && secretaria !== "nan" ? secretaria : undefined,
          sala: sala && sala !== "nan" ? sala : undefined,
          otraInfo: otraInfo || undefined,
        }
      })
      countJuicios++

      // Crear tarea si hay texto
      if (tarea && tarea !== "nan") {
        await prisma.tarea.create({
          data: {
            texto: tarea,
            fecha: new Date(fecha),
            urgente: false,
            done: false,
            tipo: "Juicio",
            juicioId: juicio.id,
          }
        })
        countTareas++
      }
    }

    // ── DOCENCIA ────────────────────────────────────────────────────────────
    // Agrupar tareas por TIPO (= nombre del asunto)
    const docenciaMap: Record<string, any[]> = {}
    for (const row of sheetDocencia as any[]) {
      const tipo = toStr(row["TIPO"])
      if (!tipo) continue
      if (!docenciaMap[tipo]) docenciaMap[tipo] = []
      docenciaMap[tipo].push(row)
    }

    for (const [nombre, rows] of Object.entries(docenciaMap)) {
      const asunto = await prisma.asunto.create({
        data: { nombre, tipo: "docencia", estado: "Abierta" }
      })
      countAsuntos++

      for (const row of rows) {
        const tarea = toStr(row["TAREA"])
        if (!tarea || tarea === "nan") continue
        const otraInfo = toStr(row["OTRA INFORMACION"])
        const driveUrl = toStr(row["Link Drive"])
        await prisma.tarea.create({
          data: {
            texto: tarea,
            fecha: new Date(toFecha(row["FECHA"])),
            urgente: false,
            done: false,
            tipo: "Docencia",
            asuntoId: asunto.id,
            // otraInfo y driveUrl van al asunto, no a la tarea — los ignoramos aquí
          }
        })
        countTareas++

        // Si el asunto no tiene otraInfo aún, lo actualizamos
        if (otraInfo && otraInfo !== "nan") {
          await prisma.asunto.update({
            where: { id: asunto.id },
            data: { otraInfo, driveUrl: driveUrl && driveUrl !== "nan" ? driveUrl : undefined }
          })
        }
      }
    }

    // ── PRO BONO ────────────────────────────────────────────────────────────
    const proBonoMap: Record<string, any[]> = {}
    for (const row of sheetProBono as any[]) {
      const tipo = toStr(row["TIPO"])
      if (!tipo) continue
      if (!proBonoMap[tipo]) proBonoMap[tipo] = []
      proBonoMap[tipo].push(row)
    }

    for (const [nombre, rows] of Object.entries(proBonoMap)) {
      // Advertencia: tomar la primera no vacía
      const advertencia = rows.map(r => toStr(r["ADVERTENCIA"])).find(a => a && a !== "nan") || undefined

      const asunto = await prisma.asunto.create({
        data: {
          nombre,
          tipo: "probono",
          estado: "Abierta",
          advertencia: advertencia || undefined,
        }
      })
      countAsuntos++

      for (const row of rows) {
        const tarea = toStr(row["TAREA"])
        if (!tarea || tarea === "nan") continue
        const otraInfo = toStr(row["OTRA INFORMACION"])
        await prisma.tarea.create({
          data: {
            texto: tarea,
            fecha: new Date(toFecha(row["FECHA"])),
            urgente: false,
            done: false,
            tipo: "Pro Bono",
            asuntoId: asunto.id,
          }
        })
        countTareas++

        if (otraInfo && otraInfo !== "nan") {
          await prisma.asunto.update({
            where: { id: asunto.id },
            data: { otraInfo }
          })
        }
      }
    }

    // ── PERSONALES ──────────────────────────────────────────────────────────
    for (const row of sheetPersonal as any[]) {
      const tarea = toStr(row["TAREA"])
      if (!tarea || tarea === "nan") continue
      const detalle = toStr(row["DETALLE"])
      // Separar si detalle tiene una URL
      const urlMatch = detalle.match(/https?:\/\/\S+/)
      const webUrl = urlMatch ? urlMatch[0] : undefined
      const info   = detalle && detalle !== "nan" ? detalle.replace(urlMatch?.[0] || "", "").trim() : undefined

      await prisma.tarea.create({
        data: {
          texto: tarea,
          fecha: new Date(toFecha(row["FECHA"])),
          urgente: false,
          done: false,
          tipo: "Personales",
          info: info || undefined,
          webUrl: webUrl || undefined,
        }
      })
      countTareas++
    }

    return res.status(200).json({
      ok: true,
      juicios: countJuicios,
      asuntos: countAsuntos,
      tareas: countTareas,
    })

  } catch (err: any) {
    console.error("Import error:", err)
    return res.status(500).json({ error: err.message || "Error desconocido" })
  } finally {
    await prisma.$disconnect()
  }
}
