import { GET_LAST_UPDATE_OF_ALL_INCIDENTS } from '../logic/queries'
import { AppComponents, IncidentRow } from '../types'
import { getRealNameFromAPI } from './slack'

export async function getIncidents(components: Pick<AppComponents, 'pg' | 'bolt'>) {
  const { pg, bolt } = components

  // Get all incidents
  const queryResult = await pg.query<IncidentRow>(GET_LAST_UPDATE_OF_ALL_INCIDENTS)

  // Separate open incidents from closed ones
  const response = {
    open: [] as IncidentRow[],
    closed: [] as IncidentRow[]
  }

  const incidents = queryResult.rows.map(async (incident) => {
    incident.contact = await getRealNameFromAPI(bolt, incident.contact)
    incident.point = await getRealNameFromAPI(bolt, incident.point)
    incident.modified_by = await getRealNameFromAPI(bolt, incident.modified_by)
    if (incident.status === 'open') {
      response.open.push(incident)
    } else {
      response.closed.push(incident)
    }
  })
  await Promise.all(incidents)

  // Sort open incidents by severity, ascending
  response.open.sort(compareBySeverity)

  // Sort closed incidents by report date, descending
  response.closed.sort(compareByDate)

  return response
}

// Descending date comparison
export function compareByDate(incident1: IncidentRow, incident2: IncidentRow) {
  return incident2.reported_at.getTime() - incident1.reported_at.getTime()
}

// Ascending severity comparison
export function compareBySeverity(incident1: IncidentRow, incident2: IncidentRow): number {
  const severity1 = parseInt(incident1.severity.at(-1) ?? '0', 10)
  const severity2 = parseInt(incident2.severity.at(-1) ?? '0', 10)

  // If the severity is matched, order by reported date, ascending
  if (severity1 - severity2 === 0) {
    return incident1.reported_at.getTime() - incident2.reported_at.getTime()
  }

  return severity1 - severity2
}

export function getEmoji(incident: IncidentRow): string {
  if (incident.status === 'closed') return '✅'

  if (incident.status === 'open') return '🚨'

  // Emoji for invalid incidents
  return '🚫'
}
