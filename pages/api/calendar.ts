// pages/api/calendar.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../lib/authOptions"
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "No autenticado" })

  const accessToken = (session as any).accessToken
  if (!accessToken) return res.status(403).json({ error: "Sin token de Calendar. Cerrá sesión y volvé a entrar." })

  // Calcular rango: hoy 00:00 → mañana 23:59 (hora Argentina UTC-3)
  const ahora = new Date()
  // Inicio: hoy a las 00:00:00 hora local
  const inicio = new Date(ahora)
  inicio.setHours(0, 0, 0, 0)
  // Fin: mañana a las 23:59:59 hora local
  const fin = new Date(ahora)
  fin.setDate(fin.getDate() + 1)
  fin.setHours(23, 59, 59, 999)

  const timeMin = inicio.toISOString()
  const timeMax = fin.toISOString()

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`
    const gcalRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!gcalRes.ok) {
      const err = await gcalRes.text()
      return res.status(gcalRes.status).json({ error: err })
    }

    const data = await gcalRes.json()
    const eventos = (data.items || []).map((e: any) => ({
      id: e.id,
      titulo: e.summary || "(Sin título)",
      inicio: e.start?.dateTime || e.start?.date,
      fin: e.end?.dateTime || e.end?.date,
      todoElDia: !e.start?.dateTime,
      color: e.colorId || null,
      link: e.htmlLink || null,
    }))

    res.json({ eventos })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
