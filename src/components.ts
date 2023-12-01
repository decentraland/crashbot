import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createServerComponent, createStatusCheckComponent } from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent, instrumentHttpServerWithMetrics } from '@well-known-components/metrics'
import { AppComponents, GlobalContext } from './types'
import { metricDeclarations } from './metrics'
import { createBoltComponent } from './adapters/bolt'
import { createPgComponent } from '@well-known-components/pg-component'
import path from 'path'

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: ['.env.default', '.env'] })

  const logs = await createLogComponent({})
  const server = await createServerComponent<GlobalContext>({ config, logs }, { cors: { maxAge: 36000 } })
  const statusChecks = await createStatusCheckComponent({ server, config })
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const pg = await createPgComponent(
    { logs, config, metrics },
    {
      migration: {
        databaseUrl: await config.requireString('PG_COMPONENT_PSQL_CONNECTION_STRING'),
        dir: path.resolve(__dirname, 'migrations'),
        migrationsTable: 'pgmigrations',
        ignorePattern: '.*\\.map',
        direction: 'up'
      }
    }
  )
  const bolt = await createBoltComponent({ pg, config, logs })

  await instrumentHttpServerWithMetrics({ metrics, server, config })

  return {
    config,
    logs,
    server,
    statusChecks,
    metrics,
    bolt,
    pg
  }
}
