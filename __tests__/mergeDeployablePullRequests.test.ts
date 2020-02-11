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
    const { assert, runTest, githubApiMocks } = await createTestHelpers();

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
  });
  it("adds deployed label and a comment when merged and deployed label isnt present", async () => {
    const { assert, runTest, githubApiMocks } = await createTestHelpers(mergeablePR, unmergeablePR);

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.targetBranchCreated();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.commitsMerged(mergeablePR.head.sha);
    assert.forcePushed();
    assert.labelAdded(mergeablePR.number, "deployed");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeablePR.head.sha)]);
  });
  it("removes deploy label and adds a comment when merge fails and deployed label isnt present", async () => {
    const { assert, runTest, githubApiMocks, gitCommandsMocks } = await createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
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
    assert.labelRemoved(mergeablePR.number, "deploy");
    assert.commentsAdded(mergeablePR.number, [expect.stringContaining(mergeFailureReason)]);
  });
  it("removes deployed label and adds a comment deploy label isnt present", async () => {
    const { assert, runTest } = await createTestHelpers(invalidDeployedPR);

    await runTest();

    assert.listPullRequests();
    assert.getTargetBranch();
    assert.gitWorkspace();
    assert.gitStatus();
    assert.hardResetToBase();
    assert.forcePushed();
    assert.labelRemoved(invalidDeployedPR.number, "deployed");
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
    const { assert, runTest, githubApiMocks, gitCommandsMocks } = await createTestHelpers(
      mergeablePR,
      unmergeablePR
    );

    githubApiMocks.mockGetBranchRef.mockResolvedValue({ status: 404 });
    gitCommandsMocks.mergeCommit.mockResolvedValue({} as any);
    gitCommandsMocks.shortStatDiff.mockResolvedValue({
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
