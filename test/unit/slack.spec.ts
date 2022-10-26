import sinon from "sinon"
import { getRealNameFromAPI, getusername } from "../../src/logic/slack"
import { createMockBoltComponent } from "../components"

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
    it("must set ")
  })
})
