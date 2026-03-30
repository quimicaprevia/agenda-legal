import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../lib/authOptions"
import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).json({ error: "Usuario no encontrado" })

  try {
    const [juicios, tareas, asuntos] = await Promise.all([
      prisma.juicio.findMany({
        where: { userId: user.id },
        include: { tareas: true, pruebas: true, honorarios: true, clientes: true },
        orderBy: { autos: "asc" }
      }),
      prisma.tarea.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" }
      }),
      prisma.asunto.findMany({
        where: { userId: user.id },
        include: { tareas: true },
        orderBy: { nombre: "asc" }
      }),
    ])

    const wb = XLSX.utils.book_new()

    // ── Hoja Juicios ──────────────────────────────────────────────────────────
    const juiciosData = juicios.map(j => ({
      Carátula: j.autos,
      Estado: j.estado,
      Expediente: j.nro || "",
      Fuero: j.fuero || "",
      Juzgado: j.juzgado || "",
      Secretaría: j.secretaria || "",
      Sala: j.sala || "",
      Categoría: j.categoria || "",
      "Compartido con": j.compartidoCon || "",
      Advertencia: j.advertencia || "",
      "Otra info": j.otraInfo || "",
      Drive: j.driveUrl || "",
      PJN: j.pjnUrl || "",
      IA: j.iaUrl || "",
      Clientes: (j.clientes||[]).map(c=>`${c.apellido}, ${c.nombre}`).join(" | "),
      "Tareas activas": j.tareas.filter(t=>!t.done).length,
      "Tareas totales": j.tareas.length,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(juiciosData), "Juicios")

    // ── Hoja Tareas de Juicios ────────────────────────────────────────────────
    const tareasJuicioData = tareas
      .filter(t => t.juicioId)
      .map(t => {
        const j = juicios.find(j => j.id === t.juicioId)
        return {
          Juicio: j?.autos || "",
          Tarea: t.texto,
          Fecha: t.fecha ? new Date(t.fecha).toLocaleDateString("es-AR") : "",
          Urgente: t.urgente ? "Sí" : "No",
          Completada: t.done ? "Sí" : "No",
        }
      })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tareasJuicioData), "Tareas Juicios")

    // ── Hoja Asuntos (Pro Bono, Docencia, Consultoría) ────────────────────────
    const asuntosData = asuntos.map(a => ({
      Nombre: a.nombre,
      Tipo: a.tipo === "probono" ? "Pro Bono" : a.tipo === "docencia" ? "Docencia" : "Consultoría",
      Estado: a.estado,
      Advertencia: a.advertencia || "",
      "Otra info": a.otraInfo || "",
      Drive: a.driveUrl || "",
      Web: a.webUrl || "",
      "Tareas activas": a.tareas.filter(t=>!t.done).length,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asuntosData), "Asuntos")

    // ── Hoja Tareas de Asuntos ────────────────────────────────────────────────
    const tareasAsuntoData = tareas
      .filter(t => t.asuntoId)
      .map(t => {
        const a = asuntos.find(a => a.id === t.asuntoId)
        return {
          Asunto: a?.nombre || "",
          Tipo: a?.tipo === "probono" ? "Pro Bono" : a?.tipo === "docencia" ? "Docencia" : "Consultoría",
          Tarea: t.texto,
          Fecha: t.fecha ? new Date(t.fecha).toLocaleDateString("es-AR") : "",
          Urgente: t.urgente ? "Sí" : "No",
          Completada: t.done ? "Sí" : "No",
        }
      })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tareasAsuntoData), "Tareas Asuntos")

    // ── Hoja Personales ───────────────────────────────────────────────────────
    const personalesData = tareas
      .filter(t => t.tipo === "Personales")
      .map(t => ({
        Tarea: t.texto,
        Fecha: t.fecha ? new Date(t.fecha).toLocaleDateString("es-AR") : "",
        Info: (t as any).info || "",
        Web: (t as any).webUrl || "",
        Urgente: t.urgente ? "Sí" : "No",
        Completada: t.done ? "Sí" : "No",
      }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personalesData), "Personales")

    // ── Hoja Honorarios ───────────────────────────────────────────────────────
    const honorariosData = juicios.flatMap(j =>
      (j.honorarios||[]).map(h => ({
        Juicio: j.autos,
        "Cliente/Contraparte": h.clienteContraparte || "",
        Total: h.total || "",
        Pagado: h.pagado || "",
        Estado: h.estado,
        Observaciones: h.observaciones || "",
      }))
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(honorariosData), "Honorarios")

    // ── Hoja Clientes ─────────────────────────────────────────────────────────
    const clientesData = juicios.flatMap(j =>
      (j.clientes||[]).map(c => ({
        Juicio: j.autos,
        Apellido: c.apellido,
        Nombre: c.nombre,
        DNI: c.dni || "",
        Correo: c.correo || "",
        Teléfono: c.telefono || "",
        Domicilio: c.domicilio || "",
      }))
    ).sort((a,b) => a.Apellido.localeCompare(b.Apellido, "es"))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesData), "Clientes")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="backup-agenda-legal-${new Date().toISOString().split("T")[0]}.xlsx"`)
    res.send(buffer)

  } catch (err: any) {
    console.error("Backup error:", err)
    res.status(500).json({ error: err.message || "Error al generar backup" })
  } finally {
    await prisma.$disconnect()
  }
}
