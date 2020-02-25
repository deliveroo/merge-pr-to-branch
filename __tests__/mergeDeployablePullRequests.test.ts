import { createPullRequest, createTestHelpers } from "./testHelpers";
import { hasLabel } from "../src/mergeDeployablePullRequests";

const mergeablePR = createPullRequest(1, true, ["stage"]);
const unmergeablePR = createPullRequest(2, false, ["stage"]);
const mergeableDeployedPR = createPullRequest(3, true, ["stage", "staged"]);
const invalidDeployedPR = createPullRequest(5, false, ["staged"]);

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
  it("adds staged label and a comment when merged and staged label isnt present", async () => {
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
    assert.labelAdded(mergeablePR.number, "staged");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeablePR.head.sha)]);
  });
  it("removes stage label and adds a comment when merge fails and staged label isnt present", async () => {
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
    assert.labelRemoved(mergeablePR.number, "stage");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeFailureReason)]);
  });
  it("removes staged label and adds a comment stage label isnt present", async () => {
    const { assert, runTest } = await createTestHelpers(invalidDeployedPR);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(invalidDeployedPR.number, "staged");
    assert.commentsAdded(invalidDeployedPR.number, [expect.stringContaining("label is missing")]);
  });
  it("doesnt add staged label or a comment when staged label is present", async () => {
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
