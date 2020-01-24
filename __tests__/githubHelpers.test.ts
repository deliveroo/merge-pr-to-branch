import * as githubHelpers from "../src/githubHelpers";

describe("githubHelpers", () => {
  it("getBranchFromRef returns last segment of ref", () => {
    expect(githubHelpers.getBranchFromRef("foo/bar")).toBe("bar");
  });
  it("getBranchFromRef returns ref when no separators", () => {
    expect(githubHelpers.getBranchFromRef("foo")).toBe("foo");
  });
  it("hasLabel returns true when exists in array of strings", () => {
    expect(githubHelpers.hasLabel(["bar"], "bar")).toBeTruthy();
  });
  it("hasLabel returns true when exists in array of objects", () => {
    expect(githubHelpers.hasLabel([{ name: "a" }], "a")).toBeTruthy();
  });
  it("hasLabel returns false when not exists in array of strings", () => {
    expect(githubHelpers.hasLabel(["bar"], "foo")).toBeFalsy();
  });
  it("hasLabel returns false when not exists in array of objects", () => {
    expect(githubHelpers.hasLabel([{ name: "foo" }], "a")).toBeFalsy();
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
    const result = await githubHelpers.getBranchRef(githubClient as any, owner, repo, branch);
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
    const result = await githubHelpers.getBranchRef(githubClient as any, owner, repo, branch);
    expect(githubClient.git.getRef).toBeCalledTimes(1);
    expect(githubClient.git.getRef).lastCalledWith({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    expect(result).toEqual(expectedResult);
  });
});
