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
      include: { juicio: { select: { autos: true } } },
      orderBy: [{ urgente: "desc" }, { fecha: "asc" }],
    })
    return res.json(tareas)
  }

  if (req.method === "POST") {
    const tarea = await prisma.tarea.create({ data: { ...req.body, userId: user.id } })
    return res.json(tarea)
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body
    const tarea = await prisma.tarea.update({ where: { id }, data })
    return res.json(tarea)
  }

  if (req.method === "DELETE") {
    await prisma.tarea.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
