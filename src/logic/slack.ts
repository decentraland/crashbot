import { App } from "@slack/bolt"
import { StringIndexed } from "@slack/bolt/dist/types/helpers"

export async function getRealNameFromAPI(app: App<StringIndexed>, userToken: string, userId: string | null | undefined) {
  let username = 'Not assigned'

  if (userId) {
    const response = await app.client.users.profile.get({
      user: userId,
      token: userToken
    })

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
