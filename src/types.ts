import { App, PlainTextOption } from '@slack/bolt'
import type { IFetchComponent } from '@well-known-components/http-server'
import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent
} from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { metricDeclarations } from './metrics'
import { UsersProfileGetResponse } from '@slack/web-api'

export type GlobalContext = {
  components: BaseComponents
}

// components used in every environment
export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  server: IHttpServerComponent<GlobalContext>
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  bolt: BoltComponent
  pg: IPgComponent
}

// components used in runtime
export type AppComponents = BaseComponents & {
  statusChecks: IBaseComponent
}

// components used in tests
export type TestComponents = BaseComponents & {
  // A fetch component that only hits the test server
  localFetch: IFetchComponent
}

// this type simplifies the typings of http handlers
export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<Path extends string = any> = IHttpServerComponent.PathAwareContext<GlobalContext, Path>

export type Severity = 'sev-1' | 'sev-2' | 'sev-3' | 'sev-4' | 'sev-5'
export type Status = 'open' | 'closed' | 'invalid'

export type IncidentRow = {
  id: number
  update_number: number
  modified_by: string
  modified_at: Date
  reported_at: Date
  closed_at: Date
  status: Status
  severity: Severity
  title: string
  description: string
  point: string
  contact: string
  rca_link: string
}

export type IncidentViewOptions = {
  callbackId: string
  modalTitle: string
  reportDate: Date
  resolutionDate?: Date
  status?: Status
  severityOption: PlainTextOption
  title: string
  description: string
  point: string
  contact: string
  rcaLink?: string
  submitButtonText: string
}

export type BoltComponent = IBaseComponent & {
  getProfile(userId: string): Promise<UsersProfileGetResponse>
  setTopic(channelId: string, topic: string): Promise<void>
}
