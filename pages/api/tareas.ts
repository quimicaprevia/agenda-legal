import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "../../lib/authOptions"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).json({ error: "Usuario no encontrado" })

  if (req.method === "GET") {
    const tareas = await prisma.tarea.findMany({
      where: { userId: user.id },
      include: { juicio: { select: { autos: true, id: true } } },
      orderBy: [{ urgente: "desc" }, { fecha: "asc" }],
    })
    return res.json(tareas)
  }

  if (req.method === "POST") {
    const { texto, fecha, juicioId, asuntoId, urgente, tipo, tema } = req.body
    const tarea = await prisma.tarea.create({
      data: {
        texto,
        fecha: fecha ? new Date(fecha) : null,
        juicioId: juicioId || null,
        asuntoId: asuntoId || null,
        urgente: urgente || false,
        tipo: tipo || null,
        tema: tema || null,
        userId: user.id,
      },
      include: { juicio: { select: { autos: true, id: true } } },
    })
    return res.json(tarea)
  }

  if (req.method === "PUT") {
    const { id, texto, fecha, urgente, done, tipo, tema, historial, info, webUrl } = req.body
    const data: any = {}
    if (texto !== undefined) data.texto = texto
    if (fecha !== undefined) data.fecha = fecha ? new Date(fecha) : null
    if (urgente !== undefined) data.urgente = urgente
    if (done !== undefined) data.done = done
    if (tipo !== undefined) data.tipo = tipo
    if (tema !== undefined) data.tema = tema
    if (historial !== undefined) data.historial = historial
    if (info !== undefined) data.info = info
    if (webUrl !== undefined) data.webUrl = webUrl
    const tarea = await prisma.tarea.update({ where: { id }, data })
    return res.json(tarea)
  }

  if (req.method === "DELETE") {
    await prisma.tarea.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}

