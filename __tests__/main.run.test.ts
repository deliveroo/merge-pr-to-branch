import { createMock } from "./testHelpers";
import fs from "fs";

describe("main", () => {
  beforeEach(jest.resetModules);
  afterEach(() => {
    delete process.env.GITHUB_ACTOR;
  });

  it("merges deployable pull requests and reports no failure", async () => {
    // arrange
    const { getInput, info, setFailed } = await createMock<typeof import("@actions/core")>(
      "@actions/core"
    );
    const actions_github = await createMock<typeof import("@actions/github")>("@actions/github");
    const { GithubApiManager } = await createMock<typeof import("../src/GithubApiManager")>(
      "../src/GithubApiManager"
    );
    const { mergeDeployablePullRequests, getBaseBranch } = await createMock<
      typeof import("../src/mergeDeployablePullRequests")
    >("../src/mergeDeployablePullRequests");
    const { GitCommandManager } = await createMock<typeof import("../src/GitCommandManager")>(
      "../src/GitCommandManager"
    );

    const inputValues = new Map([
      ["target-branch", "target-branch-value"],
      ["repo-token", "repo-token-value"],
      ["request-label-name", "request-label"],
      ["deployed-label-name", "deployed-label"]
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
    expect(mergeDeployablePullRequests).toHaveBeenCalledTimes(1);
    expect(getInput.mock.calls.map(call => call[0])).toEqual([
      "target-branch",
      "request-label-name",
      "deployed-label-name",
      "repo-token",
      "trigger-workflows"
    ]);
    expect(info.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Using baseBranch: 'base_branch'.",
        ],
      ]
    `);
  });

  it.each([
    {
      name: "dispatches single workflow when input set and merge pushed",
      triggerWorkflowsInput: "ci-workflows.yml",
      pushed: true,
      expectedDispatched: ["ci-workflows.yml"]
    },
    {
      name: "dispatches each workflow on a newline-separated list",
      triggerWorkflowsInput: "ci-workflows.yml\nintegration.yml\n  e2e.yml  ",
      pushed: true,
      expectedDispatched: ["ci-workflows.yml", "integration.yml", "e2e.yml"]
    },
    {
      name: "skips dispatch when merge did not push",
      triggerWorkflowsInput: "ci-workflows.yml",
      pushed: false,
      expectedDispatched: []
    },
    {
      name: "skips dispatch when input is empty",
      triggerWorkflowsInput: "",
      pushed: true,
      expectedDispatched: []
    },
    {
      name: "skips dispatch when input is whitespace-only",
      triggerWorkflowsInput: "  \n\n  ",
      pushed: true,
      expectedDispatched: []
    }
  ])("$name", async ({ triggerWorkflowsInput, pushed, expectedDispatched }) => {
    // arrange
    const { getInput } = await createMock<typeof import("@actions/core")>("@actions/core");
    const actions_github = await createMock<typeof import("@actions/github")>("@actions/github");
    const { GithubApiManager } = await createMock<typeof import("../src/GithubApiManager")>(
      "../src/GithubApiManager"
    );
    const { mergeDeployablePullRequests, getBaseBranch } = await createMock<
      typeof import("../src/mergeDeployablePullRequests")
    >("../src/mergeDeployablePullRequests");
    await createMock<typeof import("../src/GitCommandManager")>("../src/GitCommandManager");

    const inputValues = new Map([
      ["target-branch", "target-branch-value"],
      ["repo-token", "repo-token-value"],
      ["request-label-name", "request-label"],
      ["deployed-label-name", "deployed-label"],
      ["trigger-workflows", triggerWorkflowsInput]
    ]);
    getInput.mockImplementation(key => inputValues.get(key) || "");
    const mockContext = {
      payload: {
        repository: { owner: { login: "owner_login" }, name: "repo_name" }
      }
    } as any;
    Object.defineProperty(actions_github, "context", { get: () => mockContext });
    getBaseBranch.mockReturnValue("base_branch");
    jest.spyOn(fs.promises, "mkdtemp").mockResolvedValue("temp_dir");
    process.env.GITHUB_ACTOR = "github_actor";
    mergeDeployablePullRequests.mockResolvedValue(pushed);

    // act
    const { run } = await import("../src/main.run");
    await run();

    // assert
    const githubInstance = GithubApiManager.mock.instances[0] as jest.Mocked<
      import("../src/GithubApiManager").GithubApiManager
    >;
    expect(githubInstance.dispatchWorkflow).toHaveBeenCalledTimes(expectedDispatched.length);
    expectedDispatched.forEach(workflow => {
      expect(githubInstance.dispatchWorkflow).toHaveBeenCalledWith(workflow, "target-branch-value");
    });
  });

  it("reports the error when merging throws", async () => {
    // arrange
    const { getInput, setFailed } = await createMock<typeof import("@actions/core")>(
      "@actions/core"
    );
    const actions_github = await createMock<typeof import("@actions/github")>("@actions/github");
    await createMock<typeof import("../src/GithubApiManager")>("../src/GithubApiManager");
    const { mergeDeployablePullRequests, getBaseBranch } = await createMock<
      typeof import("../src/mergeDeployablePullRequests")
    >("../src/mergeDeployablePullRequests");
    await createMock<typeof import("../src/GitCommandManager")>("../src/GitCommandManager");

    const inputValues = new Map([
      ["target-branch", "target-branch-value"],
      ["repo-token", "repo-token-value"],
      ["request-label-name", "request-label"],
      ["deployed-label-name", "deployed-label"]
    ]);
    getInput.mockImplementation(key => inputValues.get(key) || "");
    const mockContext = {
      payload: { repository: { owner: { login: "owner_login" }, name: "repo_name" } }
    } as any;
    Object.defineProperty(actions_github, "context", { get: () => mockContext });
    getBaseBranch.mockReturnValue("base_branch");
    jest.spyOn(fs.promises, "mkdtemp").mockResolvedValue("temp_dir");
    process.env.GITHUB_ACTOR = "github_actor";
    mergeDeployablePullRequests.mockRejectedValue(new Error("boom"));

    // act
    const { run } = await import("../src/main.run");
    await run();

    // assert
    expect(setFailed).toHaveBeenCalledTimes(1);
    expect(setFailed.mock.calls[0][0]).toContain("boom");
  });
});
