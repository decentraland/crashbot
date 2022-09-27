import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createServerComponent, createStatusCheckComponent } from "@well-known-components/http-server"
import { createLogComponent } from "@well-known-components/logger"
import { createFetchComponent } from "./adapters/fetch"
import { createMetricsComponent } from "@well-known-components/metrics"
import { AppComponents, GlobalContext } from "./types"
import { metricDeclarations } from "./metrics"
import { createBoltComponent } from "./ports/bolt"
import { createPgComponent } from '@well-known-components/pg-component'
import path from 'path'

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: [".env.default", ".env"] })

  const logs = await createLogComponent({})
  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const statusChecks = await createStatusCheckComponent({ server, config })
  const fetch = await createFetchComponent()
  const metrics = await createMetricsComponent(metricDeclarations, { server, config })
  const pg = await createPgComponent(
    { logs, config, metrics },
    {
      migration: {
        databaseUrl: await config.requireString('PG_COMPONENT_PSQL_CONNECTION_STRING'),
        dir: path.resolve(__dirname, 'migrations'),
        migrationsTable: 'pgmigrations',
        ignorePattern: '.*\\.map',
        direction: 'up',
      },
    }
  )
  const bolt = await createBoltComponent({ pg })

  return {
    config,
    logs,
    // server,
    statusChecks,
    fetch,
    metrics,
    bolt,
    pg
  }
}
