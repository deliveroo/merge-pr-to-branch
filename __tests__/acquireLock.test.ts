import { acquireLock, removeLock } from "../src/acquireLock";
import { createMockGithubApiManager } from "./testHelpers";

const ourRunId = 123;

describe("acquireLock", () => {
  it("returns true when the lock is acquired", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createLock.mockResolvedValue({} as any);
    const result = await acquireLock(githubApiManager, "test", "foo", ourRunId);
    expect(result).toBe(true);
    expect(githubApiManager.createLock).toHaveBeenCalledWith("test", "foo", ourRunId);
  });

  it("throws when an unexpected error occurs", async () => {
    const error = {} as any;
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createLock.mockRejectedValue(error);
    await expect(acquireLock(githubApiManager, "test", "foo", ourRunId)).rejects.toEqual(error);
  });

  it("waits (does not break the lock) when the holding run is still active", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createLock.mockRejectedValue({ status: 422 });
    githubApiManager.getLockOwnerRunId.mockResolvedValue(999);
    githubApiManager.isRunActive.mockResolvedValue(true);

    const result = await acquireLock(githubApiManager, "test", "foo", ourRunId);

    expect(result).toBe(false);
    expect(githubApiManager.isRunActive).toHaveBeenCalledWith(999);
    expect(githubApiManager.deleteBranch).not.toHaveBeenCalled();
  });

  it("breaks the stale lock when the holding run is no longer active", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createLock.mockRejectedValue({ status: 422 });
    githubApiManager.getLockOwnerRunId.mockResolvedValue(999);
    githubApiManager.isRunActive.mockResolvedValue(false);
    githubApiManager.deleteBranch.mockResolvedValue({} as any);

    const result = await acquireLock(githubApiManager, "test", "foo", ourRunId);

    expect(result).toBe(false);
    expect(githubApiManager.deleteBranch).toHaveBeenCalledTimes(1);
  });

  it("waits when the lock owner cannot be determined", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.createLock.mockRejectedValue({ status: 422 });
    githubApiManager.getLockOwnerRunId.mockResolvedValue(undefined);

    const result = await acquireLock(githubApiManager, "test", "foo", ourRunId);

    expect(result).toBe(false);
    expect(githubApiManager.isRunActive).not.toHaveBeenCalled();
    expect(githubApiManager.deleteBranch).not.toHaveBeenCalled();
  });
});

describe("removeLock", () => {
  it("does not throw when ref doesnt exist", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockRejectedValue({
      status: 422
    });
    await removeLock(githubApiManager, "test");
    expect(true).toBe(true);
  });
  it("does not throw when successful", async () => {
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockResolvedValue({} as any);
    await removeLock(githubApiManager, "test");
    expect(true).toBe(true);
  });
  it("throws when an unexpected error occurs", async () => {
    const error = {} as any;
    const githubApiManager = await createMockGithubApiManager();
    githubApiManager.deleteBranch.mockRejectedValue(error);
    await expect(removeLock(githubApiManager, "test")).rejects.toEqual(error);
  });
});
