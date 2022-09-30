import SQL from "sql-template-strings"
import { AppComponents, IncidentRow } from "../types"
import { getUsername } from "./slack"

export async function getIncidents(components: Pick<AppComponents, "pg" | "bolt" | "config">) {

    const { pg, bolt, config } = components

   // Get all incidents
   const queryResult = await pg.query<IncidentRow>(
    SQL`SELECT 
          m.id,
          m.update_number,
          m.modified_by,
          m.modified_at,
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

  const userToken = await config.getString('SLACK_USER_TOKEN') ?? ''

  const incidents = queryResult.rows.map(async (incident) => {
    incident.contact = await getUsername(bolt.app, userToken, incident.contact)
    incident.point = await getUsername(bolt.app, userToken, incident.point)
    incident.modified_by = await getUsername(bolt.app, userToken, incident.modified_by)
    if (incident.status == 'open')
      response.open.push(incident)
    else
      response.closed.push(incident)
  })
  await Promise.all(incidents)

  return response
}