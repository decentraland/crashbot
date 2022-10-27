import { App } from "@slack/bolt"
import { StringIndexed } from "@slack/bolt/dist/types/helpers"
import { IDatabase } from "@well-known-components/interfaces"
import { DatabaseError } from "pg"
import { GET_LAST_UPDATE_OF_OPEN_INCIDENTS } from "../queries"
import { AppComponents, BoltComponent, IncidentRow } from "../types"

const severityEmojis = {
  'sev-1': '1️⃣',
  'sev-2': '2️⃣',
  'sev-3': '3️⃣',
  'sev-4': '4️⃣',
  'sev-5': '5️⃣'
}

export async function getRealNameFromAPI(bolt: BoltComponent, userId: string | null | undefined) {
  let username = 'Not assigned'

  if (userId) {
    const response = await bolt.getProfile(userId)

    if (response.profile?.real_name)
      username = response.profile?.real_name as string
  }
  return username
}

export function getusername(userId: string | null | undefined) {
  if(userId)
    return `<@${userId}>`
  
  return 'Not assigned'
}

export async function updateChannelTopic(components: Pick<AppComponents, "pg" | "config" | "logs" >, app: App<StringIndexed>) {
  const { pg, logs, config } = components

  try {
    // Get open incidents
    const queryResult = await pg.query<IncidentRow>(GET_LAST_UPDATE_OF_OPEN_INCIDENTS)
    
    // Build channel topic
    let topic = buildTopic(queryResult)

    // Get bot token
    const botToken = await config.getString('SLACK_BOT_TOKEN') ?? ''

    // Get channel's id
    const channelId = await config.getString('CRASH_CHANNEL_ID') ?? ''

    // Set topic to channel
    await app.client.conversations.setTopic({
      token: botToken,
      channel: channelId,
      topic: topic
    })

  } catch(error) {
    logs.getLogger('slack').error("Error while trying to update the channel's topic")
    console.error(error)
  }
}

function buildTopic(queryResult: IDatabase.IQueryResult<IncidentRow>) {
  let topic = ''
  if (queryResult.rowCount > 0) {
    queryResult.rows.forEach((incident) => {
      const incidentInfo = `${severityEmojis[incident.severity]} DCL-${incident.id} ${incident.title} ~ ${incident.description}`
      topic += `${sliceIncidentInfo(incidentInfo, queryResult.rowCount)}\n`
    })
  } else {
    topic = ':white_check_mark: All systems operational. Please use one thread per incident'
  }
  return topic
}

/* 
 * Slack channel's topics has a 250 characters limit. In order to be sure that limit is not reach,
 * this methods slices the incident data acording to the amount of on going incidents.
 */
function sliceIncidentInfo(incidentInfo: string, incidentsAmount: number) {
  const maxLenghtPerIncident = Math.floor(250 / incidentsAmount) - 2 // Keep in mind the additional `\n` character
  if (incidentInfo.length > maxLenghtPerIncident) {
    return incidentInfo.slice(0, maxLenghtPerIncident - 4) + ' ...'
  }
  return incidentInfo
}