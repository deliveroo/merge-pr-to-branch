import Github from "@octokit/rest";
import _ from "lodash";
import { createAssertions } from "./assertHelpers";
import { githubApiManager } from "../src/githubApiManager";
import { gitCommandManager } from "../src/gitCommandManager";

export const createMockGithubApiManager = async () => {
  const { githubApiManager } = await createMock<typeof import("../src/githubApiManager")>(
    "../src/githubApiManager"
  );
  return new githubApiManager({} as any, "", "") as jest.Mocked<githubApiManager>;
};
export const createPullRequest = (number: number, mergeable: boolean, labels: string[]) =>
  (({
    number,
    labels: labels.map(name => ({
      name
    })) as any[],
    mergeable,
    head: {
      ref: `ref-pr-${number}`,
      sha: `commit-${number}`
    }
  } as unknown) as Github.PullsGetResponse);
export const createMock = async <T>(importPath: string) => {
  jest.mock(importPath);
  return (await import(importPath)) as jest.Mocked<T>;
};
export async function createGitCommandsMocks() {
  const { gitCommandManager } = await createMock<typeof import("../src/gitCommandManager")>(
    "../src/gitCommandManager"
  );
  const mock = new gitCommandManager("", "", "") as jest.Mocked<gitCommandManager>;
  mock.shortStatDiff.mockResolvedValue({
    returnCode: 0,
    stdOutLines: [" 1 file changed, 1 insertion(+), 1 deletion(-)"]
  });
  mock.mergeCommit.mockResolvedValue({} as any);

  return mock;
}
const mockFs = (workingDirectory: string) => {
  jest.mock("fs", () => ({
    promises: { mkdtemp: jest.fn().mockResolvedValue(workingDirectory) }
  }));
};
export const createTestHelpers = async (...mockPullRequests: Github.PullsGetResponse[]) => {
  const owner = "owner";
  const repo = "repo";
  const targetBranch = "target-branch";
  const baseBranch = "base-branch";
  const baseBranchCommit = "base-branch-commit";
  const workingDirectory = "working-dir";
  const gitCommandsMocks = await createGitCommandsMocks();
  const github = await createMockGithubApiManager();
  github.getAllPullRequests.mockResolvedValue(mockPullRequests);
  github.getPullRequest.mockImplementation(pull_number =>
    Promise.resolve({
      data: _.find(mockPullRequests, x => x.number === pull_number)
    } as any)
  );
  mockFs(workingDirectory);
  github.getBranchRef.mockResolvedValue({ status: 200 });
  github.getBranchCommit.mockResolvedValue(baseBranchCommit);
  github.addIssueLabels.mockResolvedValue({} as any);
  github.removeIssueLabel.mockResolvedValue({} as any);
  github.createIssueComment.mockResolvedValue({} as any);
  return {
    testData: {
      owner,
      repo,
      baseBranch,
      baseBranchCommit,
      targetBranch,
      workingDirectory
    },
    github,
    gitCommandsMocks,
    assert: createAssertions(github, gitCommandsMocks, targetBranch, baseBranch, mockPullRequests),
    runTest: async () => {
      const target = await import("../src/mergeDeployablePullRequests");
      await target.mergeDeployablePullRequests(github, gitCommandsMocks, targetBranch, baseBranch);
    }
  };
};
