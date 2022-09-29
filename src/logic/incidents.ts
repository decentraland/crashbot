import SQL from "sql-template-strings"
import { AppComponents, IncidentRow } from "../types"

export async function getIncidents(components: Pick<AppComponents, "pg">) {

    const { pg } = components

   // Get all incidents
   const queryResult = await pg.query<IncidentRow>(
    SQL`SELECT 
          m.id,
          m.update_number,
          m.reported_at,
          m.closed_at,
          m.status, 
          m.severity,
          m.title,
          m.description,
          m.point,
          m.contact,
          m.rca_link
        FROM (
          SELECT id, MAX(update_number) AS last
          FROM incidents
          GROUP BY id
        ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number;
    `
  )

  // Separate open incidents from closed ones
  const response = {
    open: [] as IncidentRow[],
    closed: [] as IncidentRow[]
  }
  queryResult.rows.forEach((incident) => {
    if (incident.status == 'open')
      response.open.push(incident)
    else
      response.closed.push(incident)
  })

  return response
}