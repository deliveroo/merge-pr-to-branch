import Github from "@octokit/rest";
import _ from "lodash";
import { createAssertions } from "./assertHelpers";

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
      sha: `commit-${number}`
    }
  } as unknown) as Github.PullsListResponseItem);
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
export function createGitCommandsMocks() {
  const mockStatus = jest.fn();
  const mockResetHard = jest.fn();
  const mockForcePush = jest.fn();
  const mockMergeCommit = jest.fn();
  jest.mock("../src/gitCommandHelpers", () => ({
    status: mockStatus,
    resetHard: mockResetHard,
    forcePush: mockForcePush,
    mergeCommit: mockMergeCommit
  }));
  return { mockMergeCommit, mockStatus, mockResetHard, mockForcePush };
}
export const createTestHelpers = (...mockPullRequests: Github.PullsListResponseItem[]) => {
  const owner = "owner";
  const repo = "repo";
  const targetBranch = "target-branch";
  const baseBranch = "base-branch";
  const baseBranchCommit = "base-branch-commit";
  const githubApiMocks = createGithubApiMocks();
  const gitCommandsMocks = createGitCommandsMocks();
  githubApiMocks.mockGetAllPaginatedItems.mockResolvedValue(mockPullRequests);
  const githubClient = createMockGithubClient();
  githubClient.pulls.get.mockImplementation(({ pull_number }) => ({
    data: _.find(mockPullRequests, x => x.number === pull_number)
  }));
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
      targetBranch
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
      baseBranchCommit
    ),
    runTest: async () => {
      const target = await import("../src/mergeDeployablePullRequests");
      await target.mergeDeployablePullRequests(
        githubClient as any,
        owner,
        repo,
        targetBranch,
        baseBranch
      );
    }
  };
};
