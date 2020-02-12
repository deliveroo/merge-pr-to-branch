import { createMock } from "./testHelpers";
import fs from "fs";

describe("main", () => {
  beforeEach(jest.resetModules);
  afterEach(() => {
    process.env.GITHUB_ACTOR = undefined;
  });
  it("waits to acquire lock before execution and removes lock after", async () => {
    // arrange
    const { getInput, info, setFailed } = await createMock<typeof import("@actions/core")>(
      "@actions/core"
    );
    const actions_github = await createMock<typeof import("@actions/github")>("@actions/github");
    const { GithubApiManager } = await createMock<typeof import("../src/githubApiManager")>(
      "../src/githubApiManager"
    );
    const { mergeDeployablePullRequests, getBaseBranch } = await createMock<
      typeof import("../src/mergeDeployablePullRequests")
    >("../src/mergeDeployablePullRequests");
    const { GitCommandManager } = await createMock<typeof import("../src/gitCommandManager")>(
      "../src/gitCommandManager"
    );
    const { acquireLock, removeLock } = await createMock<typeof import("../src/acquireLock")>(
      "../src/acquireLock"
    );

    const inputValues = new Map([
      ["target-branch", "target-branch-value"],
      ["lock-branch-name", "lock-branch-name-value"],
      ["lock-check-interval-ms", "1"],
      ["repo-token", "repo-token-value"]
    ]);
    getInput.mockImplementation(key => inputValues.get(key) || "");
    const mockContext = {
      payload: {
        repository: {
          owner: {
            login: "owner_login"
          },
          name: "repo_name"
        }
      }
    } as any;
    Object.defineProperty(actions_github, "context", { get: () => mockContext });
    getBaseBranch.mockReturnValue("base_branch");

    jest.spyOn(fs.promises, "mkdtemp").mockResolvedValue("temp_dir");
    process.env.GITHUB_ACTOR = "github_actor";

    acquireLock.mockResolvedValueOnce(false);
    acquireLock.mockResolvedValueOnce(false);
    acquireLock.mockResolvedValue(true);

    // act
    const { run } = await import("../src/main.run");
    await run();

    // assert
    expect(GithubApiManager).toHaveBeenCalledTimes(1);
    expect(GithubApiManager.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "repo-token-value",
          "owner_login",
          "repo_name",
        ],
      ]
    `);
    expect(GitCommandManager).toHaveBeenCalledTimes(1);
    expect(GitCommandManager.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "temp_dir",
          "github_actor",
          "repo-token-value",
        ],
      ]
    `);
    expect(setFailed).toHaveBeenCalledTimes(0);
    expect(acquireLock).toHaveBeenCalledTimes(3);
    expect(mergeDeployablePullRequests).toHaveBeenCalledTimes(1);
    expect(removeLock).toHaveBeenCalledTimes(1);
    expect(getInput.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "target-branch",
        ],
        Array [
          "repo-token",
        ],
        Array [
          "lock-branch-name",
        ],
        Array [
          "lock-check-interval-ms",
        ],
      ]
    `);
    expect(info.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Using baseBranch: 'base_branch'.",
        ],
      ]
    `);
  });
});
