import { vi } from "vitest";

// Create a module-scoped mock state
const mockState = {
  currentUserId: "1;users",
};

// Set up the mock at the top level
vi.mock("@convex-dev/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@convex-dev/auth/server")>();
  return {
    ...actual,
    getAuthUserId: vi.fn().mockImplementation(() => mockState.currentUserId),
  };
});

// Export a function to manage the mock state
export function setupAuthMock(initialUserId: string = "1;users") {
  mockState.currentUserId = initialUserId;

  return {
    // Function to update the mock user ID
    setMockUserId: (userId: string) => {
      mockState.currentUserId = userId;
    },
    // Function to get the current mock user ID
    getMockUserId: () => mockState.currentUserId,
  };
}
