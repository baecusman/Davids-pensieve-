import ContentProcessor from "@/lib/content-processor"
import DatabaseService from "@/lib/database/database-service"

// Mock the DatabaseService
jest.mock("@/lib/database/database-service")

describe("ContentProcessor", () => {
  it("should process content correctly", async () => {
    // Mock the DatabaseService's getPageContent method
    ;(DatabaseService as jest.Mock<DatabaseService>).mockImplementation(() => {
      return {
        getPageContent: jest.fn().mockResolvedValue({
          title: "Test Page",
          content: "This is a test page content.",
        }),
      } as any
    })

    const databaseService = new DatabaseService()
    const contentProcessor = new ContentProcessor(databaseService)

    const pageContent = await contentProcessor.getPageContent("test-page")

    expect(pageContent).toEqual({
      title: "Test Page",
      content: "This is a test page content.",
    })
    expect(databaseService.getPageContent).toHaveBeenCalledWith("test-page")
  })

  it("should handle errors when fetching content", async () => {
    // Mock the DatabaseService's getPageContent method to reject
    ;(DatabaseService as jest.Mock<DatabaseService>).mockImplementation(() => {
      return {
        getPageContent: jest.fn().mockRejectedValue(new Error("Failed to fetch content")),
      } as any
    })

    const databaseService = new DatabaseService()
    const contentProcessor = new ContentProcessor(databaseService)

    await expect(contentProcessor.getPageContent("test-page")).rejects.toThrow("Failed to fetch content")
  })
})
