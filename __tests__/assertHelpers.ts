import Github from "@octokit/rest";
import { GithubApiManager } from "../src/githubApiManager";
import { GitCommandManager } from "../src/gitCommandManager";

function assertBranchCreated(
  githubClient: jest.Mocked<GithubApiManager>,
  targetBranch: string,
  baseBranch: string
) {
  expect(githubClient.createBranch).toHaveBeenCalledTimes(1);
  expect(githubClient.createBranch).toHaveBeenCalledWith(targetBranch, baseBranch);
}
function assertCommitsMerged(mockMergeCommit: jest.MockInstance<any, any>, commits: string[]) {
  expect(mockMergeCommit).toHaveBeenCalledTimes(commits.length);
  commits.forEach(commit =>
    expect(mockMergeCommit).toHaveBeenCalledWith(commit, "merged by merge-pr-to-branch")
  );
}
function assertHardReset(mockResetHard: jest.MockInstance<any, any>, commit: string) {
  expect(mockResetHard).toHaveBeenNthCalledWith(1, commit);
}
function assertForcePushed(mockForcePush: jest.MockInstance<any, any>, timesCalled = 1) {
  expect(mockForcePush).toHaveBeenCalledTimes(timesCalled);
}
function assertLabelRemoved(
  githubClient: jest.Mocked<GithubApiManager>,
  issue_number: number,
  label: string
) {
  expect(githubClient.removeIssueLabel).toHaveBeenCalledTimes(1);
  expect(githubClient.removeIssueLabel).toHaveBeenCalledWith(issue_number, label);
}
function assertListPullRequests(githubClient: jest.Mocked<GithubApiManager>, baseBranch: string) {
  expect(githubClient.getAllPullRequests).toHaveBeenCalledTimes(1);
  expect(githubClient.getAllPullRequests).toHaveBeenCalledWith({
    base: baseBranch,
    sort: "created",
    direction: "asc",
    state: "open"
  });
}
export function createAssertions(
  githubClient: jest.Mocked<GithubApiManager>,
  gitCommandsMocks: jest.Mocked<GitCommandManager>,
  targetBranch: string,
  baseBranch: string,
  mockPullRequests: Github.PullsGetResponse[]
) {
  const prRefs = mockPullRequests.filter(p => p.mergeable).map(p => p.head.ref);
  return {
    noLabelsAdded: () => assertNoLabelsAdded(githubClient),
    noLabelsRemoved: () => assertNoLabelsRemoved(githubClient),
    labelAdded: (issue_number: number, label: string) =>
      assertLabelAdded(githubClient, issue_number, label),
    labelRemoved: (issue_number: number, label: string) =>
      assertLabelRemoved(githubClient, issue_number, label),
    gitStatus: () => expect(gitCommandsMocks.status).toHaveBeenCalledTimes(1),
    commitsMerged: (...commits: string[]) =>
      assertCommitsMerged(gitCommandsMocks.mergeCommit, commits),
    hardResetToBase: () => assertHardReset(gitCommandsMocks.resetHardToRemote, baseBranch),
    noForcePushed: () => assertForcePushed(gitCommandsMocks.forcePush, 0),
    forcePushed: () => assertForcePushed(gitCommandsMocks.forcePush),
    targetBranchCreated: () => assertBranchCreated(githubClient, targetBranch, baseBranch),
    getTargetBranch: () => assertGetBranch(githubClient, targetBranch),
    listPullRequests: () => assertListPullRequests(githubClient, baseBranch),
    noCommentsAdded: () => assertNoCommentsAdded(githubClient),
    commentsAdded: (issue_number: number, comments: any[]) =>
      assertCommentsAdded(githubClient, issue_number, comments),
    gitWorkspace: () => {
      expect(gitCommandsMocks.init).toBeCalledTimes(1);
      expect(gitCommandsMocks.config).toBeCalledTimes(2);
      expect(gitCommandsMocks.config.mock.calls[0]).toEqual(["user.email", "action@github.com"]);
      expect(gitCommandsMocks.config.mock.calls[1]).toEqual(["user.name", "GitHub Action"]);
      expect(gitCommandsMocks.remoteAdd).toHaveBeenCalledWith(githubClient.getRemoteUrl());
      expect(gitCommandsMocks.fetch).toHaveBeenCalledWith(0, baseBranch, targetBranch, ...prRefs);
      expect(gitCommandsMocks.checkout).toHaveBeenCalledWith(targetBranch);
    }
  };
}
function assertCommentsAdded(
  githubClient: jest.Mocked<GithubApiManager>,
  issue_number: number,
  comments: string[]
) {
  expect(githubClient.createIssueComment).toHaveBeenCalledTimes(comments.length);
  comments.forEach(body =>
    expect(githubClient.createIssueComment).toHaveBeenCalledWith(issue_number, body)
  );
}
function assertLabelAdded(
  githubClient: jest.Mocked<GithubApiManager>,
  issue_number: number,
  label: string
) {
  expect(githubClient.addIssueLabels).toHaveBeenCalledTimes(1);
  expect(githubClient.addIssueLabels).toHaveBeenCalledWith(issue_number, label);
}
function assertNoCommentsAdded(githubClient: jest.Mocked<GithubApiManager>) {
  expect(githubClient.createIssueComment).toHaveBeenCalledTimes(0);
}
function assertNoLabelsAdded(githubClient: jest.Mocked<GithubApiManager>) {
  expect(githubClient.addIssueLabels).toHaveBeenCalledTimes(0);
}
function assertNoLabelsRemoved(githubClient: jest.Mocked<GithubApiManager>) {
  expect(githubClient.removeIssueLabel).toHaveBeenCalledTimes(0);
}
function assertGetBranch(githubClient: jest.Mocked<GithubApiManager>, targetBranch: string) {
  expect(githubClient.getBranchRef).toHaveBeenCalledTimes(1);
  expect(githubClient.getBranchRef).toHaveBeenCalledWith(targetBranch);
}
