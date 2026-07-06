import { buildLoadedIncidentsOptions } from "../../src/adapters/bolt"
import { IncidentRow } from "../../src/types"
import { buildTemplateIncident } from "../components"

describe("bolt-unit", () => {
  describe("buildLoadedIncidentsOptions", () => {
    describe("when there are no incidents", () => {
      let incidents: IncidentRow[]

      beforeEach(() => {
        incidents = []
      })

      it("should return an empty list of options", () => {
        expect(buildLoadedIncidentsOptions(incidents)).toEqual([])
      })
    })

    describe("when there are open, closed and invalid incidents in an arbitrary order", () => {
      let incidents: IncidentRow[]

      beforeEach(() => {
        const openSev2 = {
          ...buildTemplateIncident(),
          id: 1,
          status: "open",
          severity: "sev-2",
          reported_at: new Date("2022-07-19")
        } as IncidentRow
        const openSev1Later = {
          ...buildTemplateIncident(),
          id: 2,
          status: "open",
          severity: "sev-1",
          reported_at: new Date("2022-07-10")
        } as IncidentRow
        const openSev1Earlier = {
          ...buildTemplateIncident(),
          id: 3,
          status: "open",
          severity: "sev-1",
          reported_at: new Date("2022-07-05")
        } as IncidentRow
        const closedOlder = {
          ...buildTemplateIncident(),
          id: 4,
          status: "closed",
          reported_at: new Date("2022-06-01")
        } as IncidentRow
        const closedNewer = {
          ...buildTemplateIncident(),
          id: 5,
          status: "closed",
          reported_at: new Date("2022-08-01")
        } as IncidentRow
        const invalidOlder = {
          ...buildTemplateIncident(),
          id: 6,
          status: "invalid",
          reported_at: new Date("2022-05-01")
        } as IncidentRow
        const invalidNewer = {
          ...buildTemplateIncident(),
          id: 7,
          status: "invalid",
          reported_at: new Date("2022-09-01")
        } as IncidentRow

        incidents = [invalidOlder, openSev2, closedOlder, openSev1Later, invalidNewer, openSev1Earlier, closedNewer]
      })

      it("should list open incidents first (ascending severity, then date), followed by closed then invalid ordered by descending date", () => {
        const values = buildLoadedIncidentsOptions(incidents).map((option) => option.value)
        expect(values).toEqual(["3", "2", "1", "5", "4", "7", "6"])
      })
    })

    describe("when an incident produces an option text longer than 75 characters", () => {
      let incidents: IncidentRow[]

      beforeEach(() => {
        incidents = [
          {
            ...buildTemplateIncident(),
            id: 8,
            status: "open",
            reported_at: new Date("2022-07-10"),
            title: "a".repeat(100)
          } as IncidentRow
        ]
      })

      it("should truncate the option text to 75 characters", () => {
        expect(buildLoadedIncidentsOptions(incidents)[0].text.text).toHaveLength(75)
      })
    })

    describe("when building the option for a single open incident", () => {
      let incidents: IncidentRow[]

      beforeEach(() => {
        incidents = [
          {
            ...buildTemplateIncident(),
            id: 42,
            status: "open",
            reported_at: new Date("2022-07-10"),
            title: "Database is down"
          } as IncidentRow
        ]
      })

      it("should use the incident id as the option value", () => {
        expect(buildLoadedIncidentsOptions(incidents)[0].value).toEqual("42")
      })

      it("should render the status emoji, DCL id and title as a plain_text element", () => {
        expect(buildLoadedIncidentsOptions(incidents)[0].text).toEqual({
          type: "plain_text",
          text: "🚨 DCL-42 Database is down",
          emoji: true
        })
      })
    })
  })
})
