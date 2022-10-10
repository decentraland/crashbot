import { RoutedContext } from "@well-known-components/http-server"
import { IHttpServerComponent } from "@well-known-components/interfaces"
import { GlobalContext } from "../types"

export function validateAPIKey(globalContext: GlobalContext): IHttpServerComponent.IRequestHandler<RoutedContext<GlobalContext, "/list">> {
  return async function (context: IHttpServerComponent.DefaultContext, next: () => Promise<IHttpServerComponent.IResponse>): Promise<IHttpServerComponent.IResponse> {

    const apiKeyFromEnv = await globalContext.components.config.getString('API_KEY') ?? ''
    const originFromEnv = await globalContext.components.config.getString('URL_ORIGIN') ?? ''
    const apiKeyFromHeader = context.request.headers.get('crashbot')
    // const logger = globalContext.components.logs.getLogger('Validate API Key')
    console.log('URL data:')
    console.log(context.url)

    if (!apiKeyFromHeader) {
      console.log('403 Missing API Key')
      // return {
      //   status: 403,
      //   statusText: 'Not allowed. Missing API key.',
      //   body: 'Not allowed. Missing API key.\n'
      // }
    }

    if (apiKeyFromHeader != apiKeyFromEnv) {
      console.log('403 Invalid API Key')
      // return {
      //   status: 403,
      //   statusText: 'Not allowed. Invalid API key.',
      //   body: 'Not allowed. Invalid API key.\n'
      // }
    }

    if (context.url.origin != originFromEnv) {
      console.log('403 Invalid origin')
      // return {
      //   status: 403,
      //   statusText: 'Origin is not allowed.',
      //   body: 'Origin is not allowed.\n'
      // }
    }

    
    return next()    
  }
}