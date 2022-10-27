import { createDotEnvConfigComponent } from "@well-known-components/env-config-provider"
import { createLogComponent } from "@well-known-components/logger"
import sinon from "sinon"
import { getRealNameFromAPI, getusername, updateChannelTopic } from "../../src/logic/slack"
import { buildTemplateIncident, createMockBoltComponent, createMockPgComponent } from "../components"

describe("slack-unit", () => {
  describe("getRealNameFromAPI", () => {
    it("must return 'Not assigned' if userId is null or undefined", async () => {
      const bolt = createMockBoltComponent()
      expect(await getRealNameFromAPI(bolt, null)).toBe("Not assigned")
      expect(await getRealNameFromAPI(bolt, undefined)).toBe("Not assigned")
    })

    it("must return 'Not assigned' if response from bolt.getProfile is invalid", async () => {
      const bolt = createMockBoltComponent()
      bolt.getProfile = sinon.stub()
        .withArgs("userId").resolves({ notAValidObjectField: {} })

      expect(await getRealNameFromAPI(bolt, "userId")).toBe("Not assigned")
    })

    it("must translate the userid correctly", async () => {
      const bolt = createMockBoltComponent()
      bolt.getProfile = sinon.stub()
        .withArgs("userId").resolves({ profile: { real_name: "username" } })

      expect(await getRealNameFromAPI(bolt, "userId")).toBe("username")
    })
  })
  
  describe("getUsername", () => {
    it("must return 'Not assigned' if userId is null or undefined", async () => {
      expect(getusername(null)).toBe("Not assigned")
      expect(getusername(undefined)).toBe("Not assigned")
    })

    it("must return format the userId correctly", async () => {
      expect(getusername("a_user_id")).toBe("<@a_user_id>")
    })
  })

  describe("updateChannelTopic", () => {
    it("must set the channel topic to 'All systems operational' if there are no open incidents",async () => {
      const components = {
        config: await createDotEnvConfigComponent({ path: [] }),
        logs: await createLogComponent({}),
        pg: createMockPgComponent(),
        bolt: createMockBoltComponent()
      }

      const query = sinon.stub().resolves({
        rows: [],
        rowCount: 0
      })
      components.pg.query = query

      await updateChannelTopic(components)

      expect(query.calledOnce).toBe(true)
      expect(components.bolt.setTopic).toHaveBeenCalledWith('', ':white_check_mark: All systems operational. Please use one thread per incident')
    })

    it("must set the channel topic to explain incident details",async () => {
      const components = {
        config: await createDotEnvConfigComponent({ path: [] }),
        logs: await createLogComponent({}),
        pg: createMockPgComponent(),
        bolt: createMockBoltComponent()
      }

      const query = sinon.stub().resolves({
        rows: [
          {
            ...buildTemplateIncident(),
            severity: "sev-2",
            title: 'Incident title',
            description: 'Incident description'
          }
        ],
        rowCount: 1
      })
      components.pg.query = query

      await updateChannelTopic(components)

      expect(query.calledOnce).toBe(true)
      expect(components.bolt.setTopic).toHaveBeenCalledWith('', '2️⃣ DCL-0 Incident title ~ Incident description\n')
    })

    it("must set the channel topic to explain every incident details",async () => {
      const components = {
        config: await createDotEnvConfigComponent({ path: [] }),
        logs: await createLogComponent({}),
        pg: createMockPgComponent(),
        bolt: createMockBoltComponent()
      }

      const query = sinon.stub().resolves({
        rows: [
          {
            ...buildTemplateIncident(),
            severity: "sev-2",
            title: 'Incident title',
            description: 'Incident description'
          },
          {
            ...buildTemplateIncident(),
            severity: "sev-1",
            title: 'Another incident title',
            description: 'Another incident description',
            id:1
          }
        ],
        rowCount: 1
      })
      components.pg.query = query

      await updateChannelTopic(components)

      expect(query.calledOnce).toBe(true)
      expect(components.bolt.setTopic).toHaveBeenCalledWith('', '2️⃣ DCL-0 Incident title ~ Incident description\n1️⃣ DCL-1 Another incident title ~ Another incident description\n')
    })

    it("must crop each incident details with ' ...' if necessary when topic surpass the 250 chars",async () => {
      const components = {
        config: await createDotEnvConfigComponent({ path: [] }),
        logs: await createLogComponent({}),
        pg: createMockPgComponent(),
        bolt: createMockBoltComponent()
      }

      const query = sinon.stub().resolves({
        rows: [
          {
            ...buildTemplateIncident(),
            severity: "sev-2",
            title: 'Incident title',
            description: 'Incident description'
          },
          {
            ...buildTemplateIncident(),
            severity: "sev-1",
            title: 'Another incident title',
            description: 'Another incident description',
            id:1
          },
          {
            ...buildTemplateIncident(),
            severity: "sev-3",
            title: 'Yet another incident title',
            description: 'A loooooooooooooooooooooooong description',
            id:2
          },
          {
            ...buildTemplateIncident(),
            severity: "sev-5",
            title: 'More incident title',
            description: 'Another description',
            id:3
          }
        ],
        rowCount: 4
      })
      components.pg.query = query

      await updateChannelTopic(components)

      expect(query.calledOnce).toBe(true)
      expect(components.bolt.setTopic).toHaveBeenCalledWith('', '2️⃣ DCL-0 Incident title ~ Incident description\n1️⃣ DCL-1 Another incident title ~ Another incident desc ...\n3️⃣ DCL-2 Yet another incident title ~ A loooooooooooooo ...\n5️⃣ DCL-3 More incident title ~ Another description\n')
    })
  })
})
