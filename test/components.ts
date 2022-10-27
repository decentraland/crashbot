// This file is the "test-environment" analogous for src/components.ts
// Here we define the test components to be used in the testing environment

import { createRunner, createLocalFetchCompoment } from "@well-known-components/test-helpers"

import { main } from "../src/service"
import { BoltComponent, TestComponents } from "../src/types"
import { initComponents as originalInitComponents } from "../src/components"
import { IPgComponent } from "@well-known-components/pg-component"

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

export function createMockPgComponent(): IPgComponent {
  return {
    ...createMockComponent(),
    getPool: jest.fn(),
    query: jest.fn(),
    streamQuery: jest.fn()
  }
}

export function createMockBoltComponent(): BoltComponent {
  return {
    ...createMockComponent(),
    getProfile: jest.fn(),
    setTopic: jest.fn()
  }
}

async function initComponents(): Promise<TestComponents> {
  const components = await originalInitComponents()
  const { config } = components
  return {
    ...components,
    pg: createMockPgComponent(),
    bolt: createMockBoltComponent(),
    localFetch: await createLocalFetchCompoment(config)
  }
}

export function buildTemplateIncident() {
  return {
    id: 0,
    update_number: 3,
    modified_by: "",
    modified_at: undefined,
    reported_at: undefined,
    closed_at: undefined,
    status: "open",
    severity: "sev-1",
    title: "",
    description: "",
    point: "",
    contact: "",
    rca_link: ""
  }
}
