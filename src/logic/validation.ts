import { RoutedContext } from '@well-known-components/http-server'
import { IHttpServerComponent } from '@well-known-components/interfaces'
import { GlobalContext } from '../types'

export function validate(
  globalContext: GlobalContext
): IHttpServerComponent.IRequestHandler<RoutedContext<GlobalContext, '/list'>> {
  const logger = globalContext.components.logs.getLogger('request validation')

  function notAllowedResponse(errorMessage: string) {
    logger.error(errorMessage)
    return {
      status: 403,
      statusText: errorMessage,
      body: {
        message: errorMessage
      }
    }
  }

  return async function (
    context: IHttpServerComponent.DefaultContext,
    next: () => Promise<IHttpServerComponent.IResponse>
  ): Promise<IHttpServerComponent.IResponse> {
    const apiKeyFromEnv = (await globalContext.components.config.getString('API_KEY')) ?? ''
    const allowedOrigin = (await globalContext.components.config.getString('ALLOWED_ORIGIN')) ?? ''
    const apiKeyFromHeader = context.request.headers.get('crashbot')
    const originFromHeader = context.request.headers.get('origin')

    if (!apiKeyFromHeader) {
      return notAllowedResponse('Not allowed. Missing API key.')
    }

    if (apiKeyFromHeader !== apiKeyFromEnv) {
      return notAllowedResponse(`Not allowed. Invalid API key: ${apiKeyFromHeader}.`)
    }

    if (originFromHeader !== allowedOrigin) {
      return notAllowedResponse(`Origin not allowed: ${originFromHeader}.`)
    }

    return next()
  }
}
