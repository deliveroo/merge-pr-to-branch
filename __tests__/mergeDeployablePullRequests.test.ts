import _ from "lodash";
import { createPullRequest, createTestHelpers } from "./testHelpers";
import { hasLabel } from "../src/mergeDeployablePullRequests";

const mergeablePR = createPullRequest(1, true, ["deploy"]);
const unmergeablePR = createPullRequest(2, false, ["deploy"]);
const mergeableDeployedPR = createPullRequest(3, true, ["deploy", "deployed"]);
const invalidDeployedPR = createPullRequest(5, false, ["deployed"]);

describe("mergeDeployablePullRequests", () => {
  beforeEach(jest.resetModules);
  it("creates targetBranch if missing", async () => {
    const { assert, runTest, githubApiMocks } = createTestHelpers();

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.forcePushed();
  });
  it("throws when baseBranch is missing", async () => {
    const {
      assert,
      runTest,
      githubApiMocks,
      testData: { baseBranch }
    } = createTestHelpers();

    githubApiMocks.mockGetBranchCommit.mockResolvedValue(undefined);

    await expect(runTest()).rejects.toEqual(new Error(`baseBranch: '${baseBranch}' not found.`));
  });
  it("adds deployed label and a comment when merged and deployed label isnt present", async () => {
    const { assert, runTest, githubApiMocks, gitCommandsMocks } = createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    const mergeResultMessage = "foo";
    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    gitCommandsMocks.mockMergeCommit.mockResolvedValue(mergeResultMessage);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.forcePushed();
    assert.labelAdded(mergeablePR.number, "deployed");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeResultMessage)]);
  });
  it("removes deploy label and adds a comment when merge fails and deployed label isnt present", async () => {
    const { assert, runTest, githubApiMocks, gitCommandsMocks } = createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    const mergeFailureReason = "merge failed";
    gitCommandsMocks.mockMergeCommit.mockRejectedValue(mergeFailureReason);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(mergeablePR.number, "deploy");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeFailureReason)]);
  });
  it("removes deployed label and adds a comment deploy label isnt present", async () => {
    const { assert, runTest } = createTestHelpers(invalidDeployedPR);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(invalidDeployedPR.number, "deployed");
    assert.commentsAdded(invalidDeployedPR.number, [expect.stringContaining("label is missing")]);
  });
  it("doesnt add deployed label or a comment when deployed label is present", async () => {
    const { assert, runTest, gitCommandsMocks } = createTestHelpers(mergeableDeployedPR);

    const mergeResultMessage = "foo";
    gitCommandsMocks.mockMergeCommit.mockResolvedValue(mergeResultMessage);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeableDeployedPR.head.sha);
    assert.forcePushed();
    assert.noLabelsAdded();
    assert.noCommentsAdded();
  });
  it("doesnt push the local branch if it is equivalent with the remote", async () => {
    const { assert, runTest, githubApiMocks, gitCommandsMocks } = createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    const mergeResultMessage = "foo";
    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    gitCommandsMocks.mockMergeCommit.mockResolvedValue(mergeResultMessage);
    gitCommandsMocks.mockShortStatDiff.mockResolvedValue({
      stdOutLines: []
    });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.noForcePushed();
  });
});
describe("hasLabel", () => {
  it("returns true when exists in array of strings", () => {
    expect(hasLabel(["bar"], "bar")).toBeTruthy();
  });
  it("returns true when exists in array of objects", () => {
    expect(hasLabel([{ name: "a" }], "a")).toBeTruthy();
  });
  it("returns false when not exists in array of strings", () => {
    expect(hasLabel(["bar"], "foo")).toBeFalsy();
  });
  it("returns false when not exists in array of objects", () => {
    expect(hasLabel([{ name: "foo" }], "a")).toBeFalsy();
  });
});
