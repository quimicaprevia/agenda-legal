import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { PrismaClient } from "@prisma/client"
import authOptions from "../auth/[...nextauth]"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).json({ error: "Usuario no encontrado" })

  if (req.method === "GET") {
    const juicios = await prisma.juicio.findMany({
      where: { userId: user.id },
      include: { tareas: true, pruebas: true },
      orderBy: { updatedAt: "desc" },
    })
    return res.json(juicios)
  }

  if (req.method === "POST") {
    const juicio = await prisma.juicio.create({
      data: { ...req.body, userId: user.id },
    })
    return res.json(juicio)
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body
    const juicio = await prisma.juicio.update({ where: { id }, data })
    return res.json(juicio)
  }

  if (req.method === "DELETE") {
    await prisma.juicio.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
