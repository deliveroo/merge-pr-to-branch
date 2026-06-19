import { getInput, info, warning, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { GithubApiManager } from "./GithubApiManager";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";
import { GitCommandManager } from "./GitCommandManager";
import { promises } from "fs";
import { retry } from "./retry";
import { acquireLock, removeLock } from "./acquireLock";
const { mkdtemp } = promises;

const targetBranchInputName = "target-branch";
const lockBranchNameInputName = "lock-branch-name";
const lockCheckIntervalInputName = "lock-check-interval-ms";
const requestLabelNameInputName = "request-label-name";
const deployedLabelNameInputName = "deployed-label-name";
const triggerWorkflowsInputName = "trigger-workflows";

export async function run() {
  try {
    const targetBranch = getInputValue(targetBranchInputName);
    const requestLabelName = getInputValue(requestLabelNameInputName);
    const deployedLabelName = getInputValue(deployedLabelNameInputName);

    const { payload } = context;
    const { repository } = payload;

    if (!repository) {
      throw new Error("Missing repository from payload.");
    }

    const owner = repository.owner.login;
    const repo = repository.name;
    const baseBranch = getBaseBranch(context, payload);

    if (!baseBranch) {
      info(`Skipping eventName: '${context.eventName}'.`);
      return;
    }

    info(`Using baseBranch: '${baseBranch}'.`);

    const token = getInput("repo-token");
    const user = process.env.GITHUB_ACTOR;

    if (!user) {
      throw new Error("Missing GITHUB_ACTOR environment variable");
    }
    const runId = Number(process.env.GITHUB_RUN_ID);
    if (!Number.isInteger(runId)) {
      throw new Error("Missing or invalid GITHUB_RUN_ID environment variable");
    }
    const github = new GithubApiManager(token, owner, repo);
    const lockBranchName = getInput(lockBranchNameInputName);
    const lockCheckIntervalInMs = Number(getInput(lockCheckIntervalInputName));
    const acquireThisLock = () => acquireLock(github, lockBranchName, baseBranch, runId);
    await retry(acquireThisLock, 5, "Could not acquire lock", lockCheckIntervalInMs);
    // The lock is a remote-branch mutex with no auto-expiry. Once acquired it
    // MUST always be released — otherwise a failure mid-run (e.g. a transient
    // GitHub 5xx) leaks the lock branch and deadlocks every subsequent run.
    try {
      const workingDirectory = await mkdtemp("git-workspace");
      const git = new GitCommandManager(workingDirectory, user, token);
      const pushed = await mergeDeployablePullRequests(
        github,
        git,
        targetBranch,
        baseBranch,
        requestLabelName,
        deployedLabelName
      );
      const triggerWorkflows = getInput(triggerWorkflowsInputName)
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      if (pushed && triggerWorkflows.length > 0) {
        for (const workflow of triggerWorkflows) {
          info(`Dispatching workflow '${workflow}' against '${targetBranch}'.`);
          await github.dispatchWorkflow(workflow, targetBranch);
        }
      }
    } finally {
      // Release the lock, but don't let a release failure mask the original
      // error from the try body: with a bare `await` here, JS finally semantics
      // would replace a pending exception with the release error, hiding the
      // real cause (e.g. the 502 that aborted the run). Report it separately.
      try {
        await removeLock(github, lockBranchName);
      } catch (lockError) {
        warning(`Failed to release lock: ${JSON.stringify(serializeError(lockError))}`);
      }
    }
  } catch (error) {
    setFailed(JSON.stringify(serializeError(error)));
  }
}
function getInputValue(inputName: string) {
  const value = getInput(inputName);
  if (!value) {
    throw new Error(`Missing input '${inputName}'.`);
  }
  return value;
}
