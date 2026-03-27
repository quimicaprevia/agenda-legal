import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "../../lib/authOptions"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" })

  if (req.method === "POST") {
    const prueba = await prisma.prueba.create({ data: req.body })
    return res.json(prueba)
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body
    const prueba = await prisma.prueba.update({ where: { id }, data })
    return res.json(prueba)
  }

  if (req.method === "DELETE") {
    await prisma.prueba.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
