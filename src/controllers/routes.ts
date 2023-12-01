import { FullHttpServerComponent, RoutedContext, Router } from '@well-known-components/http-server'
import { IHttpServerComponent } from '@well-known-components/interfaces'
import { validate } from '../logic/validation'
import { GlobalContext } from '../types'
import { listHandler } from './handlers/list-handler'
import { pingHandler } from './handlers/ping-handler'

// We return the entire router because it will be easier to test than a whole server
export async function setupRouter(globalContext: GlobalContext): Promise<Router<GlobalContext>> {
  const router = new Router<GlobalContext>()

  router.get('/ping', pingHandler)
  router.get('/list', validate(globalContext), listHandler)

  return router
}
