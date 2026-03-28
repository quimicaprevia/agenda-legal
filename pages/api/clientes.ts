import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).end()
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(401).end()

  if (req.method === "POST") {
    const { juicioId, apellido, nombre, dni, correo, telefono, domicilio } = req.body
    if (!apellido?.trim()) return res.status(400).json({ error: "Apellido requerido" })
    const c = await prisma.clienteJuicio.create({
      data: { juicioId, apellido, nombre: nombre||"", dni, correo, telefono, domicilio, userId: user.id }
    })
    return res.json(c)
  }

  if (req.method === "DELETE") {
    await prisma.clienteJuicio.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }

  res.status(405).end()
}
