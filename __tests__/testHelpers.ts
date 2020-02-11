import Github from "@octokit/rest";
import _ from "lodash";
import { createAssertions } from "./assertHelpers";
import { gitCommandManager } from "../src/gitCommandManager";

export const createMockGithubClient = () => ({
  issues: {
    addLabels: jest.fn(),
    removeLabel: jest.fn(),
    createComment: jest.fn()
  },
  pulls: {
    get: jest.fn(),
    list: {}
  }
});
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
export function createGithubApiMocks() {
  const mockGetBranchRef = jest.fn();
  const mockCreateBranch = jest.fn();
  const mockGetBranchCommit = jest.fn();
  const mockGetAllPaginatedItems = jest.fn();
  jest.mock("../src/githubApiHelpers", () => ({
    getBranchRef: mockGetBranchRef,
    createBranch: mockCreateBranch,
    getBranchCommit: mockGetBranchCommit,
    getAllPaginatedItems: mockGetAllPaginatedItems
  }));
  return { mockGetAllPaginatedItems, mockGetBranchRef, mockGetBranchCommit, mockCreateBranch };
}
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
  const githubApiMocks = createGithubApiMocks();
  const gitCommandsMocks = await createGitCommandsMocks();
  githubApiMocks.mockGetAllPaginatedItems.mockResolvedValue(mockPullRequests);
  const githubClient = createMockGithubClient();
  githubClient.pulls.get.mockImplementation(({ pull_number }) => ({
    data: _.find(mockPullRequests, x => x.number === pull_number)
  }));
  mockFs(workingDirectory);
  githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 200 });
  githubApiMocks.mockGetBranchCommit.mockResolvedValue(baseBranchCommit);
  githubClient.issues.addLabels.mockResolvedValue({});
  githubClient.issues.removeLabel.mockResolvedValue({});
  githubClient.issues.createComment.mockResolvedValue({});
  return {
    testData: {
      owner,
      repo,
      baseBranch,
      baseBranchCommit,
      targetBranch,
      workingDirectory
    },
    githubClient,
    githubApiMocks,
    gitCommandsMocks,
    assert: createAssertions(
      githubClient,
      owner,
      repo,
      gitCommandsMocks,
      targetBranch,
      githubApiMocks,
      baseBranch,
      mockPullRequests
    ),
    runTest: async () => {
      const target = await import("../src/mergeDeployablePullRequests");
      await target.mergeDeployablePullRequests(
        githubClient as any,
        gitCommandsMocks,
        owner,
        repo,
        targetBranch,
        baseBranch
      );
    }
  };
};
