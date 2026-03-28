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
    const asuntos = await prisma.asunto.findMany({
      where: { userId: user.id },
      include: { tareas: true },
      orderBy: { nombre: "asc" }
    })
    return res.json(asuntos)
  }

  if (req.method === "POST") {
    const { nombre, tipo, estado, advertencia, otraInfo, driveUrl, webUrl } = req.body
    const a = await prisma.asunto.create({
      data: { nombre, tipo, estado: estado||"Abierta", advertencia, otraInfo, driveUrl, webUrl, userId: user.id },
      include: { tareas: true }
    })
    return res.json(a)
  }

  if (req.method === "PUT") {
    const { id, nombre, tipo, estado, advertencia, otraInfo, driveUrl, webUrl } = req.body
    const a = await prisma.asunto.update({
      where: { id },
      data: { nombre, tipo, estado, advertencia, otraInfo, driveUrl, webUrl },
      include: { tareas: true }
    })
    return res.json(a)
  }

  if (req.method === "DELETE") {
    await prisma.asunto.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }

  res.status(405).end()
}
