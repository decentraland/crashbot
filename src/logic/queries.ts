import SQL, { SQLStatement } from 'sql-template-strings'

export function CREATE_INCIDENT(
  user: string,
  severity: string | undefined,
  title: string | undefined | null,
  description: string | undefined | null,
  point: string | undefined | null,
  contact: string | undefined | null,
  reportedAt: string | null
): SQLStatement {
  return SQL`INSERT INTO incidents(
    update_number,
    modified_by,
    severity,
    title,
    description,
    status,
    point,
    contact,
    reported_at
  ) VALUES (
    0,
    ${user},
    ${severity},
    ${title},
    ${description},
    'open',
    ${point},
    ${contact},
    ${reportedAt}
  )
  RETURNING id`
}

export const GET_LAST_UPDATE_OF_ALL_INCIDENTS_FEW_COLUMNS = SQL`SELECT 
    m.id,
    m.update_number,
    m.status, 
    m.title,
    m.reported_at,
    m.severity
  FROM (
    SELECT id, MAX(update_number) AS last
    FROM incidents
    GROUP BY id
  ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number;
`

export const GET_LAST_UPDATE_OF_ALL_INCIDENTS = SQL`SELECT 
    m.id,
    m.update_number,
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
  ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number
  WHERE status != 'invalid';
`

export function GET_LAST_UPDATE_OF_SELECTED_INCIDENT(selectedIncidentId: string) {
  return SQL`SELECT * FROM incidents WHERE id = ${selectedIncidentId} ORDER BY update_number DESC LIMIT 1;`
}

export const GET_LAST_UPDATE_OF_OPEN_INCIDENTS = SQL`SELECT 
    m.id,
    m.update_number,
    m.title,
    m.severity,
    m.description,
    m.reported_at
  FROM (
    SELECT id, MAX(update_number) AS last
    FROM incidents
    GROUP BY id
  ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number
  WHERE status = 'open'
`

export function UPDATE_INCIDENT(
  id: number,
  update_number: number,
  user: string,
  severity: string | undefined,
  title: string | undefined | null,
  description: string | undefined | null,
  point: string | undefined | null,
  contact: string | undefined | null,
  reportedAt: string | null,
  status: string | undefined,
  closedAt: string | null,
  rcaLink: string | null | undefined
) {
  return SQL`INSERT INTO incidents(
    id,
    update_number,
    modified_by,
    severity,
    title,
    description,
    status,
    point,
    contact,
    reported_at,
    closed_at,
    rca_link
  ) VALUES (
    ${id},
    ${update_number},
    ${user},
    ${severity},
    ${title},
    ${description},
    ${status},
    ${point},
    ${contact},
    ${reportedAt},
    ${closedAt},
    ${rcaLink}
  )`
}
