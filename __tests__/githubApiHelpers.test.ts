import {
  getBranchFromRef,
  getBranchRef,
  isRunActive,
  getLockInfo,
  lockCommitMessagePrefix
} from "../src/githubApiHelpers";

jest.mock("@actions/core", () => ({ warning: jest.fn(), info: jest.fn() }));

describe("githubHelpers", () => {
  it("getBranchFromRef returns last segment of ref", () => {
    expect(getBranchFromRef("foo/bar")).toBe("bar");
  });
  it("getBranchFromRef returns ref when no separators", () => {
    expect(getBranchFromRef("foo")).toBe("foo");
  });
  it("getBranchRef calls getRef as expected", async () => {
    const expectedResult = {};
    const githubClient = {
      git: {
        getRef: jest.fn().mockResolvedValue(expectedResult)
      }
    };
    const owner = "owner";
    const repo = "repo";
    const branch = "branch";
    const result = await getBranchRef(githubClient as any, owner, repo, branch);
    expect(githubClient.git.getRef).toBeCalledTimes(1);
    expect(githubClient.git.getRef).lastCalledWith({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    expect(result).toBe(expectedResult);
  });
  it("getBranchRef does not throw 404s", async () => {
    const expectedResult = { status: 404 };
    const githubClient = {
      git: {
        getRef: jest.fn().mockRejectedValue(expectedResult)
      }
    };
    const owner = "owner";
    const repo = "repo";
    const branch = "branch";
    const result = await getBranchRef(githubClient as any, owner, repo, branch);
    expect(githubClient.git.getRef).toBeCalledTimes(1);
    expect(githubClient.git.getRef).lastCalledWith({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    expect(result).toEqual(expectedResult);
  });

  describe("isRunActive", () => {
    const makeClient = (request: jest.Mock) => ({ request } as any);
    it("returns true when the run has not completed", async () => {
      const client = makeClient(jest.fn().mockResolvedValue({ data: { status: "in_progress" } }));
      expect(await isRunActive(client, "o", "r", 1)).toBe(true);
    });
    it("returns false when the run has completed", async () => {
      const client = makeClient(jest.fn().mockResolvedValue({ data: { status: "completed" } }));
      expect(await isRunActive(client, "o", "r", 1)).toBe(false);
    });
    it("returns false when the run no longer exists (404)", async () => {
      const client = makeClient(jest.fn().mockRejectedValue({ status: 404 }));
      expect(await isRunActive(client, "o", "r", 1)).toBe(false);
    });
    it("treats the run as active when status cannot be determined (e.g. 403)", async () => {
      const client = makeClient(jest.fn().mockRejectedValue({ status: 403 }));
      expect(await isRunActive(client, "o", "r", 1)).toBe(true);
    });
  });

  describe("getLockInfo", () => {
    const makeClient = (refSha: string | undefined, message: string) =>
      (({
        git: {
          getRef:
            refSha === undefined
              ? jest.fn().mockRejectedValue({ status: 404 })
              : jest.fn().mockResolvedValue({ status: 200, data: { object: { sha: refSha } } }),
          getCommit: jest.fn().mockResolvedValue({ data: { message } })
        }
      } as unknown) as any);
    it("returns the sha and parsed run id from the lock commit message", async () => {
      const client = makeClient("sha1", `${lockCommitMessagePrefix}4242`);
      expect(await getLockInfo(client, "o", "r", "lock")).toEqual({ sha: "sha1", runId: 4242 });
    });
    it("returns the sha with undefined runId for a legacy lock without the marker", async () => {
      const client = makeClient("sha1", "some unrelated commit");
      expect(await getLockInfo(client, "o", "r", "lock")).toEqual({ sha: "sha1", runId: undefined });
    });
    it("returns undefined when the lock branch is missing", async () => {
      const client = makeClient(undefined, "");
      expect(await getLockInfo(client, "o", "r", "lock")).toBeUndefined();
    });
    it("returns undefined (waits) on a transient read error", async () => {
      const client = ({
        git: {
          getRef: jest.fn().mockResolvedValue({ status: 200, data: { object: { sha: "sha1" } } }),
          getCommit: jest.fn().mockRejectedValue({ status: 502 })
        }
      } as unknown) as any;
      expect(await getLockInfo(client, "o", "r", "lock")).toBeUndefined();
    });
  });
});
