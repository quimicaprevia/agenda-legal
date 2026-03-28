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
    const juicios = await prisma.juicio.findMany({
      where: { userId: user.id },
      include: { tareas: true, pruebas: true, honorarios: true, clientes: true },
      orderBy: { createdAt: "desc" },
    })
    return res.json(juicios)
  }

  if (req.method === "POST") {
    const { autos, estado, nro, fuero, juzgado, secretaria, sala, advertencia, datosJuzgado, otraInfo, driveUrl, iaUrl, pjnUrl } = req.body
    const juicio = await prisma.juicio.create({
      data: {
        autos, estado, nro, fuero, juzgado, secretaria, sala, advertencia,
        datosJuzgado, otraInfo, driveUrl, iaUrl, pjnUrl,
        tipo: "Juicio",
        userId: user.id
      },
      include: { tareas: true, pruebas: true, honorarios: true, clientes: true }
    })
    return res.json(juicio)
  }

  if (req.method === "PUT") {
    const { id, autos, estado, nro, fuero, juzgado, secretaria, sala, advertencia, datosJuzgado, otraInfo, driveUrl, iaUrl, pjnUrl } = req.body
    const data: any = {}
    if (autos !== undefined) data.autos = autos
    if (estado !== undefined) data.estado = estado
    if (nro !== undefined) data.nro = nro
    if (fuero !== undefined) data.fuero = fuero
    if (juzgado !== undefined) data.juzgado = juzgado
    if (secretaria !== undefined) data.secretaria = secretaria
    if (sala !== undefined) data.sala = sala
    if (advertencia !== undefined) data.advertencia = advertencia
    if (datosJuzgado !== undefined) data.datosJuzgado = datosJuzgado
    if (otraInfo !== undefined) data.otraInfo = otraInfo
    if (driveUrl !== undefined) data.driveUrl = driveUrl
    if (iaUrl !== undefined) data.iaUrl = iaUrl
    if (pjnUrl !== undefined) data.pjnUrl = pjnUrl
    const juicio = await prisma.juicio.update({
      where: { id },
      data,
      include: { tareas: true, pruebas: true, honorarios: true, clientes: true }
    })
    return res.json(juicio)
  }

  if (req.method === "DELETE") {
    await prisma.juicio.delete({ where: { id: req.body.id } })
    return res.json({ ok: true })
  }
}
