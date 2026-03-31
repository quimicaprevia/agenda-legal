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

  if (req.method === "POST") {
    const { juicioId, apellido, nombre, dni, correo, telefono, domicilio } = req.body
    if (!apellido?.trim()) return res.status(400).json({ error: "Apellido requerido" })
    const c = await prisma.clienteJuicio.create({
      data: { juicioId, apellido, nombre: nombre||"", dni, correo, telefono, domicilio, userId: user.id }
    })
    return res.json(c)
  }

  if (req.method === "PUT") {
    const { id, apellido, nombre, dni, correo, telefono, domicilio } = req.body
    const c = await prisma.clienteJuicio.update({ where: { id }, data: { apellido, nombre, dni, correo, telefono, domicilio } })
    return res.json(c)
  }

  if (req.method === "DELETE") {
    await prisma.clienteJuicio.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }

  res.status(405).end()
}
