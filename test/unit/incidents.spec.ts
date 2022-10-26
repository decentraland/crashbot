import { createTestMetricsComponent } from "@well-known-components/metrics"
import { pingHandler } from "../../src/controllers/handlers/ping-handler"
import { getEmoji, getIncidents } from "../../src/logic/incidents"
import { metricDeclarations } from "../../src/metrics"
import { IncidentRow } from "../../src/types"

describe("incidents-unit", () => {
  describe("getEmoji", () => {
    it("must return ✅ if incident is closed", async () => {
      const incident: IncidentRow = {
        id: 0,
        update_number: 0,
        modified_by: "",
        modified_at: undefined,
        reported_at: undefined,
        closed_at: undefined,
        status: "closed",
        severity: "sev-1",
        title: "",
        description: "",
        point: "",
        contact: "",
        rca_link: ""
      }
      expect((getEmoji(incident))).toEqual('✅')
    })

    it("must return 🚨 if incident is open", async () => {
      const incident: IncidentRow = {
        id: 0,
        update_number: 0,
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
      expect((getEmoji(incident))).toEqual('🚨')
    })

    it("must return 🚫 if incident is invalid", async () => {
      const incident: IncidentRow = {
        id: 0,
        update_number: 0,
        modified_by: "",
        modified_at: undefined,
        reported_at: undefined,
        closed_at: undefined,
        status: "invalid",
        severity: "sev-1",
        title: "",
        description: "",
        point: "",
        contact: "",
        rca_link: ""
      }
      expect((getEmoji(incident))).toEqual('🚫')
    })
  })
})
