import { App } from "@slack/bolt"
import { StringIndexed } from "@slack/bolt/dist/types/helpers"

export async function getUsername(app: App<StringIndexed>, userToken: string, userId: string | null | undefined) {
  let username = 'Not assigned'

  if (userId) {
    const response = await app.client.users.identity({
      user: userId,
      token: userToken
    })

    if (response.user)
      username = response.user?.name as string
  }
  return username
}
