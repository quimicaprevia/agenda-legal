import { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "../../lib/authOptions"

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: "No autorizado" })

  if (req.method === "POST") {
    const { tipo, contenido, detalle, estado, vencimiento, juicioId } = req.body
    if (!tipo || !juicioId) return res.status(400).json({ error: "Faltan campos obligatorios" })
    const prueba = await prisma.prueba.create({
      data: {
        tipo,
        descripcion: contenido || null,
        detalle: detalle || null,
        estado: estado || "Ofrecida",
        vencimiento: vencimiento ? new Date(vencimiento) : null,
        juicioId,
      },
    })
    return res.json(prueba)
  }

  if (req.method === "PUT") {
    const { id, tipo, contenido, detalle, estado, vencimiento } = req.body
    const data: any = {}
    if (tipo !== undefined) data.tipo = tipo
    if (contenido !== undefined) data.descripcion = contenido
    if (detalle !== undefined) data.detalle = detalle
    if (estado !== undefined) data.estado = estado
    if (vencimiento !== undefined) data.vencimiento = vencimiento ? new Date(vencimiento) : null
    const prueba = await prisma.prueba.update({ where: { id }, data })
    return res.json(prueba)
  }

  if (req.method === "DELETE") {
    await prisma.prueba.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
