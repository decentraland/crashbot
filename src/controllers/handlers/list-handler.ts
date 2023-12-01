import { getIncidents } from '../../logic/incidents'
import { HandlerContextWithPath } from '../../types'

// handlers arguments only type what they need, to make unit testing easier
export async function listHandler(
  context: Pick<HandlerContextWithPath<'metrics' | 'pg' | 'bolt' | 'config', '/list'>, 'url' | 'components'>
) {
  const {
    url,
    components: { metrics }
  } = context

  metrics.increment('list_counter', {
    pathname: url.pathname
  })

  const incidents = await getIncidents(context.components)
  return {
    status: 200,
    body: incidents
  }
}
