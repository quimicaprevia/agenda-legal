// pages/api/calendar.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../lib/authOptions"
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "No autenticado" })

  const accessToken = (session as any).accessToken
  if (!accessToken) return res.status(403).json({ error: "Sin token de Calendar. Cerrá sesión y volvé a entrar." })

  // Rango: hoy 00:00 → mañana 23:59 hora local
  const ahora = new Date()
  const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0)
  const fin = new Date(ahora); fin.setDate(fin.getDate() + 1); fin.setHours(23, 59, 59, 999)
  const timeMin = inicio.toISOString()
  const timeMax = fin.toISOString()

  const headers = { Authorization: `Bearer ${accessToken}` }

  try {
    // 1. Listar todos los calendarios del usuario
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers })
    if (!listRes.ok) {
      const err = await listRes.text()
      return res.status(listRes.status).json({ error: err })
    }
    const listData = await listRes.json()
    const calendarios: { id: string; summary: string }[] = (listData.items || [])

    // 2. Traer eventos de cada calendario en paralelo
    const resultados = await Promise.allSettled(
      calendarios.map(cal =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`,
          { headers }
        ).then(r => r.json())
      )
    )

    // 3. Combinar y ordenar todos los eventos
    const todosEventos: any[] = []
    resultados.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value?.items) {
        r.value.items.forEach((e: any) => {
          todosEventos.push({
            id: e.id,
            titulo: e.summary || "(Sin título)",
            inicio: e.start?.dateTime || e.start?.date,
            fin: e.end?.dateTime || e.end?.date,
            todoElDia: !e.start?.dateTime,
            calendario: calendarios[i]?.summary || "",
            link: e.htmlLink || null,
          })
        })
      }
    })

    // Ordenar por hora de inicio
    todosEventos.sort((a, b) => {
      if (!a.inicio) return 1
      if (!b.inicio) return -1
      return new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    })

    res.json({ eventos: todosEventos })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
