import { createPullRequest, createTestHelpers as _createTestHelpers } from "./testHelpers";
import { hasLabel } from "../src/mergeDeployablePullRequests";
import Octokit = require("@octokit/rest");

const requestLabelName = "request";
const deployedLabelName = "merged";
const mergeablePR = createPullRequest(1, true, [requestLabelName]);
const unmergeablePR = createPullRequest(2, false, [requestLabelName]);
const mergeableDeployedPR = createPullRequest(3, true, [requestLabelName, deployedLabelName]);
const invalidDeployedPR = createPullRequest(5, false, [deployedLabelName]);

const createTestHelpers = (...prs: Octokit.PullsGetResponse[]) =>
  _createTestHelpers(requestLabelName, deployedLabelName, ...prs);

describe("mergeDeployablePullRequests", () => {
  beforeEach(jest.resetModules);
  it("creates targetBranch if missing", async () => {
    const { assert, runTest, github } = await createTestHelpers();

    github.getBranchRef.mockResolvedValue({ status: 404 });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
  });
  it("adds deployed label and a comment when merged and deployed label isnt present", async () => {
    const { assert, runTest, github } = await createTestHelpers(mergeablePR, unmergeablePR);

    github.getBranchRef.mockResolvedValue({ status: 404 });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.forcePushed();
    assert.labelAdded(mergeablePR.number, deployedLabelName);
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeablePR.head.sha)]);
  });
  it("removes request label and adds a comment when merge fails and deployed label isnt present", async () => {
    const { assert, runTest, github, gitCommandsMocks } = await createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    github.getBranchRef.mockResolvedValue({ status: 404 });
    const mergeFailureReason = "merge failed";
    gitCommandsMocks.mergeCommit.mockRejectedValue(mergeFailureReason);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(mergeablePR.number, requestLabelName);
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeFailureReason)]);
  });
  it("removes deployed label and adds a comment request label isnt present", async () => {
    const { assert, runTest } = await createTestHelpers(invalidDeployedPR);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(invalidDeployedPR.number, deployedLabelName);
    assert.commentsAdded(invalidDeployedPR.number, [expect.stringContaining("label is missing")]);
  });
  it("doesnt add deployed label or a comment when deployed label is present", async () => {
    const { assert, runTest, gitCommandsMocks } = await createTestHelpers(mergeableDeployedPR);

    gitCommandsMocks.mergeCommit.mockResolvedValue({} as any);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeableDeployedPR.head.sha);
    assert.forcePushed();
    assert.noLabelsAdded();
    assert.noCommentsAdded();
  });
  it("doesnt push the local branch if it is equivalent with the remote", async () => {
    const { assert, runTest, github, gitCommandsMocks } = await createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    github.getBranchRef.mockResolvedValue({ status: 404 });
    gitCommandsMocks.mergeCommit.mockResolvedValue({} as any);
    gitCommandsMocks.shortStatDiffWithRemote.mockResolvedValue({
      returnCode: 0,
      stdOutLines: []
    });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitWorkspace();
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
