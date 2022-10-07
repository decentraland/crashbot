import { GET_LAST_UPDATE_OF_ALL_INCIDENTS } from "../queries"
import { AppComponents, IncidentRow } from "../types"
import { getRealNameFromAPI } from "./slack"



export async function getIncidents(components: Pick<AppComponents, "pg" | "bolt" | "config">) {

  const { pg, bolt, config } = components

  // Get all incidents
  const queryResult = await pg.query<IncidentRow>(GET_LAST_UPDATE_OF_ALL_INCIDENTS)

  // Separate open incidents from closed ones
  const response = {
    open: [] as IncidentRow[],
    closed: [] as IncidentRow[]
  }

  const userToken = await config.getString('SLACK_USER_TOKEN') ?? ''

  const incidents = queryResult.rows.map(async (incident) => {
    incident.contact = await getRealNameFromAPI(bolt.app, userToken, incident.contact)
    incident.point = await getRealNameFromAPI(bolt.app, userToken, incident.point)
    incident.modified_by = await getRealNameFromAPI(bolt.app, userToken, incident.modified_by)
    if (incident.status == 'open')
      response.open.push(incident)
    else
      response.closed.push(incident)
  })
  await Promise.all(incidents)

  return response
}

export function getEmoji(incident: IncidentRow): string {
  if (incident.status == 'closed')
    return '✅'
    
  if (incident.status == 'open')
    return '🚨'

  // Emoji for invalid incidents
  return '🚫'
}