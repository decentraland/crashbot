// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { createRunner, createLocalFetchCompoment } from "@well-known-components/test-helpers"

import { main } from "../src/service"
import { BoltComponent, GlobalContext, TestComponents } from "../src/types"
import { initComponents as originalInitComponents } from "../src/components"
import { IPgComponent, metricDeclarations } from "@well-known-components/pg-component"
import { IBaseComponent } from "@well-known-components/interfaces"
import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createLogComponent } from "@well-known-components/logger"
import { createServerComponent } from "@well-known-components/http-server"
import { createMetricsComponent } from "@well-known-components/metrics"
import { createBoltComponent } from "../src/ports/bolt"
import { StringIndexed } from "@slack/bolt/dist/types/helpers"

/**
 * Behaves like Jest "describe" function, used to describe a test for a
 * use case, it creates a whole new program and components to run an
 * isolated test.
 *
 * State is persistent within the steps of the test.
 */
export const test = createRunner<TestComponents>({
  main,
  initComponents,
})

function createMockComponent() {
  return {
    start: jest.fn(),
    stop: jest.fn()
  }
}

function createMockPGComponent(): IPgComponent {
  return {
    ...createMockComponent(),
    getPool: jest.fn(),
    query: jest.fn(),
    streamQuery: jest.fn()
  }
}

function createMockBoltComponent(): BoltComponent {
  return {
    ...createMockComponent(),
    getProfile: jest.fn() 
  }
}

async function initComponents(): Promise<TestComponents> {
  const components = await originalInitComponents()
  const { config } = components
  return {
    ...components,
    pg: createMockPGComponent(),
    bolt: createMockBoltComponent(),
    localFetch: await createLocalFetchCompoment(config)
  }
}
