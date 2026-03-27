import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "../../lib/authOptions"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" })

  if (req.method === "POST") {
    const honorario = await prisma.honorario.create({ data: req.body })
    return res.json(honorario)
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body
    const honorario = await prisma.honorario.update({ where: { id }, data })
    return res.json(honorario)
  }

  if (req.method === "DELETE") {
    await prisma.honorario.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
