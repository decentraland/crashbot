import { RoutedContext } from "@well-known-components/http-server"
import { IHttpServerComponent } from "@well-known-components/interfaces"
import { GlobalContext } from "../types"

export function validateAPIKey(globalContext: GlobalContext): IHttpServerComponent.IRequestHandler<RoutedContext<GlobalContext, "/list">> {
  return async function (context: IHttpServerComponent.DefaultContext, next: () => Promise<IHttpServerComponent.IResponse>): Promise<IHttpServerComponent.IResponse> {

    const apiKeyFromEnv = await globalContext.components.config.getString('API_KEY') ?? ''
    const apiKeyFromHeader = context.request.headers.get('crashbot')
    console.log('URL data:')
    console.log(context.url)

    if (apiKeyFromHeader && apiKeyFromHeader == apiKeyFromEnv)
      return next()
    else
      return {
        status: 403,
        statusText: "Not allowed. Invalid API key.",
        body: 'Not allowed. Invalid API key.\n'
      }
  }
}