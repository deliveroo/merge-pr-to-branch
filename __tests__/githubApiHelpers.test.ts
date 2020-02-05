import { getBranchFromRef, getBranchRef } from "../src/githubApiHelpers";

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
});
