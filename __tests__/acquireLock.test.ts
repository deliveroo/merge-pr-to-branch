import { acquireLock, removeLock } from "../src/acquireLock";
import { createMockGithubApiManager } from "./testHelpers";
describe("acquireLock", () => {
  it("returns false when ref already exists", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createBranch.mockRejectedValue({
      status: 422
    });
    const result = await acquireLock(githubApiManager, "test", "foo");
    expect(result).toBe(false);
  });
  it("returns true when successful", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createBranch.mockResolvedValue({} as any);
    const result = await acquireLock(githubApiManager, "test", "foo");
    expect(result).toBe(true);
  });
  it("throws when an unexpected error occurs", async () => {
    const error = {} as any;
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createBranch.mockRejectedValue(error);
    await expect(acquireLock(githubApiManager, "test", "foo")).rejects.toEqual(error);
  });
});
describe("removeLock", () => {
  it("does not throw when ref doesnt exist", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockRejectedValue({
      status: 422
    });
    await removeLock(githubApiManager, "test");
  });
  it("does not throw when successful", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockResolvedValue({} as any);
    await removeLock(githubApiManager, "test");
  });
  it("throws when an unexpected error occurs", async () => {
    const error = {} as any;
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockRejectedValue(error);
    await expect(removeLock(githubApiManager, "test")).rejects.toEqual(error);
  });
});
