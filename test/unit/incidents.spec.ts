import sinon from "sinon"
import { getEmoji, getIncidents } from "../../src/logic/incidents"
import { IncidentRow } from "../../src/types"
import { createMockBoltComponent, createMockPGComponent } from "../components"

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

  describe("getIncidents", () => {
    it("must return no incident if database is empty", async () => {
      const pg = createMockPGComponent()
      const bolt = createMockBoltComponent()
      pg.query = sinon.stub().resolves({
        rows: [],
        rowsCount: 0
      })
      const result = await getIncidents({ pg, bolt })
      expect(result).toEqual({open: [], closed: []})
    })

    it("must return closed incidents sorted by descending report date", async () => {
      const pg = createMockPGComponent()
      const bolt = createMockBoltComponent()
      const incident1 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-19"),
        status: "closed"
      }
      const incident2 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-10"),
        status: "closed"
      }
      const incident3 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-11-11"),
        status: "closed"
      }
      pg.query = sinon.stub().resolves({
        rows: [
          incident1,
          incident2,
          incident3
        ],
        rowsCount: 3
      })
      const result = await getIncidents({ pg, bolt })
      expect(result).toEqual({open: [], closed: [incident3, incident1, incident2]})
    })

    it("must return open incidents sorted by descending severity and ascending report date if severities match", async () => {
      const pg = createMockPGComponent()
      const bolt = createMockBoltComponent()
      const incident1 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-19"),
        severity: "sev-2"
      }
      const incident2 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-10"),
        severity: "sev-1"
      }
      const incident3 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-10"),
        severity: "sev-2"
      }

      pg.query = sinon.stub().resolves({
        rows: [
          incident1,
          incident2,
          incident3
        ],
        rowsCount: 3
      })
      const result = await getIncidents({ pg, bolt })
      expect(result).toEqual({open: [incident2, incident3, incident1], closed: []})
    })

    it("must fill point, contact and modified_by with real names", async () => {
      const pg = createMockPGComponent()
      const bolt = createMockBoltComponent()
      const incident1 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-19"),
        severity: "sev-2",
        modified_by: "userId1",
        point: "userId2",
        contact: "userId3"
      }
      const incident2 = {
        ...buildTemplateIncident(),
        reported_at: new Date("2022-07-10"),
        severity: "sev-1",
        modified_by: "userId3",
        point: "userId1",
        contact: "userId2",
        status: "closed"
      }

      pg.query = sinon.stub().resolves({
        rows: [
          incident1,
          incident2
        ],
        rowsCount: 3
      })
      bolt.getProfile = sinon.stub()
        .withArgs("userId1").resolves({ profile: { real_name: "username1" } })
        .withArgs("userId2").resolves({ profile: { real_name: "username3" } })
        .withArgs("userId3").resolves({ profile: { real_name: "username2" } })

      const result = await getIncidents({ pg, bolt })
      expect(result).toEqual({open: [incident1], closed: [incident2]})
    })
  })
})

function buildTemplateIncident() {
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

