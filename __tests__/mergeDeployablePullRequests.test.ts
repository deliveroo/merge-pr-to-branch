import _ from "lodash";
import { createPullRequest, createTestHelpers } from "./testHelpers";
import { hasLabel } from "../src/mergeDeployablePullRequests";

const mergeablePR = createPullRequest(1, true, ["deploy"], "commit1");
const unmergeablePR = createPullRequest(2, false, ["deploy"], "commit2");

describe("mergeDeployablePullRequests", () => {
  beforeEach(jest.resetModules);
  it("creates targetBranch if missing", async () => {
    const {
      assert,
      runTest,
      githubApiMocks,
      testData: { baseBranchCommit }
    } = createTestHelpers();

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    githubApiMocks.mockGetBranchCommit.mockResolvedValue(baseBranchCommit);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.hardReset(baseBranchCommit);
    assert.forcePushed();
  });
  it("throws when baseBranch is missing", async () => {
    const {
      assert,
      runTest,
      githubApiMocks,
      testData: { baseBranch }
    } = createTestHelpers();

    githubApiMocks.mockGetAllPaginatedItems.mockResolvedValue([]);
    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 200 });
    githubApiMocks.mockGetBranchCommit.mockResolvedValue(undefined);

    await expect(runTest()).rejects.toEqual(new Error(`baseBranch: '${baseBranch}' not found.`));

    assert.listPullRequests();
    assert.getTargetBranch();
  });
  it("adds deployed label and a comment when merged and deployed label isnt present", async () => {
    const {
      assert,
      runTest,
      githubApiMocks,
      gitCommandsMocks,
      testData: { baseBranchCommit },
      githubClient
    } = createTestHelpers(mergeablePR, unmergeablePR);

    const mergeResultMessage = "foo";
    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    githubApiMocks.mockGetBranchCommit.mockResolvedValue(baseBranchCommit);
    gitCommandsMocks.mockMergeCommit.mockResolvedValue(mergeResultMessage);
    githubClient.issues.createComment.mockResolvedValue({});
    githubClient.issues.addLabels.mockResolvedValue("");

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.hardReset(baseBranchCommit);
    assert.commitsMerged(mergeablePR.head.sha);
    assert.forcePushed();
    assert.labelAdded(mergeablePR.number, "deployed");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeResultMessage)]);
  });
  it("removes deploy label and adds a comment when merge fails and deployed label isnt present", async () => {
    const {
      assert,
      runTest,
      githubApiMocks,
      gitCommandsMocks,
      testData: { baseBranchCommit },
      githubClient
    } = createTestHelpers(mergeablePR, unmergeablePR);

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    githubApiMocks.mockGetBranchCommit.mockResolvedValue(baseBranchCommit);
    const mergeFailureReason = "merge failed";
    gitCommandsMocks.mockMergeCommit.mockRejectedValue(mergeFailureReason);
    githubClient.issues.createComment.mockResolvedValue({});
    githubClient.issues.removeLabel.mockResolvedValue("");

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.hardReset(baseBranchCommit);
    assert.forcePushed();
    assert.labelRemoved(mergeablePR.number, "deploy");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeFailureReason)]);
  });
  it("hasLabel returns true when exists in array of strings", () => {
    expect(hasLabel(["bar"], "bar")).toBeTruthy();
  });
  it("hasLabel returns true when exists in array of objects", () => {
    expect(hasLabel([{ name: "a" }], "a")).toBeTruthy();
  });
  it("hasLabel returns false when not exists in array of strings", () => {
    expect(hasLabel(["bar"], "foo")).toBeFalsy();
  });
  it("hasLabel returns false when not exists in array of objects", () => {
    expect(hasLabel([{ name: "foo" }], "a")).toBeFalsy();
  });
});
