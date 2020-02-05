import { createMockGithubClient } from "./testHelpers";

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
function assertCommitsMerged(
  mockMergeCommit: jest.Mock<any, any>,
  targetBranch: string,
  commits: string[]
) {
  expect(mockMergeCommit).toHaveBeenCalledTimes(commits.length);
  commits.forEach(commit => expect(mockMergeCommit).toHaveBeenCalledWith(targetBranch, commit));
}
function assertHardReset(mockResetHard: jest.Mock<any, any>, commit: string) {
  expect(mockResetHard).toHaveBeenCalledTimes(1);
  expect(mockResetHard).toHaveBeenCalledWith(commit);
}
function assertForcePushed(mockForcePush: jest.Mock<any, any>) {
  expect(mockForcePush).toHaveBeenCalledTimes(1);
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
  githubClient: {
    issues: {
      addLabels: jest.Mock<any, any>;
      removeLabel: jest.Mock<any, any>;
      createComment: jest.Mock<any, any>;
    };
    pulls: { get: jest.Mock<any, any>; list: {} };
  },
  owner: string,
  repo: string,
  gitCommandsMocks: {
    mockMergeCommit: jest.Mock<any, any>;
    mockStatus: jest.Mock<any, any>;
    mockResetHard: jest.Mock<any, any>;
    mockForcePush: jest.Mock<any, any>;
  },
  targetBranch: string,
  githubApiMocks: {
    mockGetAllPaginatedItems: jest.Mock<any, any>;
    mockGetBranchRef: jest.Mock<any, any>;
    mockGetBranchCommit: jest.Mock<any, any>;
    mockCreateBranch: jest.Mock<any, any>;
  },
  baseBranch: string
) {
  return {
    labelAdded: (issue_number: number, label: string) =>
      assertLabelAdded(githubClient, owner, repo, issue_number, label),
    labelRemoved: (issue_number: number, label: string) =>
      assertLabelRemoved(githubClient, owner, repo, issue_number, label),
    gitStatus: () => assertGitStatus(gitCommandsMocks.mockStatus),
    commitsMerged: (...commits: string[]) =>
      assertCommitsMerged(gitCommandsMocks.mockMergeCommit, targetBranch, commits),
    hardReset: (commit: string) => assertHardReset(gitCommandsMocks.mockResetHard, commit),
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
    commentsAdded: (issue_number: number, comments: any[]) =>
      assertCommentsAdded(githubClient, owner, repo, issue_number, comments)
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
