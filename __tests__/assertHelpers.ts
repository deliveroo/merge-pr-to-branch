import {
  createMockGithubClient,
  createGitCommandsMocks,
  createGithubApiMocks
} from "./testHelpers";
import Github from "@octokit/rest";

function assertBranchCreated(
  mockCreateBranch: jest.Mock<any, any>,
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  targetBranch: string,
  baseBranch: string
) {
  expect(mockCreateBranch).toHaveBeenCalledTimes(1);
  expect(mockCreateBranch).toHaveBeenCalledWith(
    githubClient,
    owner,
    repo,
    targetBranch,
    baseBranch
  );
}
function assertGitStatus(mockStatus: jest.Mock<any, any>) {
  expect(mockStatus).toHaveBeenCalledTimes(1);
}
function assertCommitsMerged(mockMergeCommit: jest.Mock<any, any>, commits: string[]) {
  expect(mockMergeCommit).toHaveBeenCalledTimes(commits.length);
  commits.forEach(commit =>
    expect(mockMergeCommit).toHaveBeenCalledWith(commit, "merged by merge-pr-to-branch")
  );
}
function assertHardReset(mockResetHard: jest.Mock<any, any>, commit: string) {
  expect(mockResetHard).toHaveBeenNthCalledWith(1, commit);
}
function assertForcePushed(mockForcePush: jest.Mock<any, any>, timesCalled = 1) {
  expect(mockForcePush).toHaveBeenCalledTimes(timesCalled);
}
function assertLabelRemoved(
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  issue_number: number,
  label: string
) {
  expect(githubClient.issues.removeLabel).toHaveBeenCalledTimes(1);
  expect(githubClient.issues.removeLabel).toHaveBeenCalledWith(
    expect.objectContaining({
      owner,
      repo,
      issue_number,
      name: label
    })
  );
}
function assertListPullRequests(
  mockGetAllPaginatedItems: jest.Mock<any, any>,
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  baseBranch: string
) {
  expect(mockGetAllPaginatedItems).toHaveBeenCalledTimes(1);
  expect(mockGetAllPaginatedItems).toHaveBeenCalledWith(
    githubClient,
    githubClient.pulls.list,
    expect.objectContaining({
      owner,
      repo,
      base: baseBranch,
      sort: "created",
      direction: "asc",
      state: "open"
    })
  );
}
export function createAssertions(
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  gitCommandsMocks: ReturnType<typeof createGitCommandsMocks>,
  targetBranch: string,
  githubApiMocks: ReturnType<typeof createGithubApiMocks>,
  baseBranch: string,
  mockPullRequests: Github.PullsGetResponse[]
) {
  const remoteName = "origin";
  const prRefs = mockPullRequests.filter(p => p.mergeable).map(p => p.head.ref);
  return {
    noLabelsAdded: () => assertNoLabelsAdded(githubClient),
    noLabelsRemoved: () => assertNoLabelsRemoved(githubClient),
    labelAdded: (issue_number: number, label: string) =>
      assertLabelAdded(githubClient, owner, repo, issue_number, label),
    labelRemoved: (issue_number: number, label: string) =>
      assertLabelRemoved(githubClient, owner, repo, issue_number, label),
    gitStatus: () => assertGitStatus(gitCommandsMocks.mockStatus),
    commitsMerged: (...commits: string[]) =>
      assertCommitsMerged(gitCommandsMocks.mockMergeCommit, commits),
    hardResetToBase: () =>
      assertHardReset(gitCommandsMocks.mockResetHard, `${remoteName}/${baseBranch}`),
    noForcePushed: () => assertForcePushed(gitCommandsMocks.mockForcePush, 0),
    forcePushed: () => assertForcePushed(gitCommandsMocks.mockForcePush),
    targetBranchCreated: () =>
      assertBranchCreated(
        githubApiMocks.mockCreateBranch,
        githubClient,
        owner,
        repo,
        targetBranch,
        baseBranch
      ),
    getTargetBranch: () => assertGetBranch(githubApiMocks, githubClient, owner, repo, targetBranch),
    listPullRequests: () =>
      assertListPullRequests(
        githubApiMocks.mockGetAllPaginatedItems,
        githubClient,
        owner,
        repo,
        baseBranch
      ),
    noCommentsAdded: () => assertNoCommentsAdded(githubClient),
    commentsAdded: (issue_number: number, comments: any[]) =>
      assertCommentsAdded(githubClient, owner, repo, issue_number, comments),
    gitWorkspace: () => {
      expect(gitCommandsMocks.mockRemoteAdd).toHaveBeenCalledWith(
        remoteName,
        `https://github.com/${owner}/${repo}.git`
      );
      expect(gitCommandsMocks.mockFetch).toHaveBeenCalledWith(
        0,
        remoteName,
        baseBranch,
        targetBranch,
        ...prRefs
      );
      expect(gitCommandsMocks.mockCheckout).toHaveBeenCalledWith(targetBranch);
    }
  };
}
function assertCommentsAdded(
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  issue_number: number,
  comments: string[]
) {
  expect(githubClient.issues.createComment).toHaveBeenCalledTimes(comments.length);
  comments.forEach(body =>
    expect(githubClient.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner,
        repo,
        issue_number,
        body
      })
    )
  );
}
function assertLabelAdded(
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  issue_number: number,
  label: string
) {
  expect(githubClient.issues.addLabels).toHaveBeenCalledTimes(1);
  expect(githubClient.issues.addLabels).toHaveBeenCalledWith(
    expect.objectContaining({
      owner,
      repo,
      issue_number,
      labels: [label]
    })
  );
}
function assertNoCommentsAdded(githubClient: ReturnType<typeof createMockGithubClient>) {
  expect(githubClient.issues.createComment).toHaveBeenCalledTimes(0);
}
function assertNoLabelsAdded(githubClient: ReturnType<typeof createMockGithubClient>) {
  expect(githubClient.issues.addLabels).toHaveBeenCalledTimes(0);
}
function assertNoLabelsRemoved(githubClient: ReturnType<typeof createMockGithubClient>) {
  expect(githubClient.issues.removeLabel).toHaveBeenCalledTimes(0);
}
function assertGetBranch(
  githubApiMocks: {
    mockGetAllPaginatedItems: jest.Mock<any, any>;
    mockGetBranchRef: jest.Mock<any, any>;
    mockGetBranchCommit: jest.Mock<any, any>;
    mockCreateBranch: jest.Mock<any, any>;
  },
  githubClient: ReturnType<typeof createMockGithubClient>,
  owner: string,
  repo: string,
  targetBranch: string
) {
  expect(githubApiMocks.mockGetBranchRef).toHaveBeenCalledTimes(1);
  expect(githubApiMocks.mockGetBranchRef).toHaveBeenCalledWith(
    githubClient,
    owner,
    repo,
    targetBranch
  );
}
