import { getInput, info, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { GithubApiManager } from "./GithubApiManager";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";
import { GitCommandManager } from "./GitCommandManager";
import { promises } from "fs";
const { mkdtemp } = promises;

const targetBranchInputName = "target-branch";
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
    // Mutual exclusion between concurrent runs is handled by the GitHub Actions
    // `concurrency` group in the calling workflow (see README), not by this
    // action — so there is no in-process lock to acquire or release here.
    const github = new GithubApiManager(token, owner, repo);
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
