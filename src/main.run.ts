import { getInput, info, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { GithubApiManager } from "./GithubApiManager";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";
import { GitCommandManager } from "./GitCommandManager";
import { promises } from "fs";
import { acquireLock, removeLock } from "./acquireLock";
const { mkdtemp } = promises;

const targetBranchInputName = "target-branch";
const lockBranchNameInputName = "lock-branch-name";
const lockCheckIntervalInputName = "lock-check-interval-ms";
const requestLabelNameInputName = "request-label-name";
const deployedLabelNameInputName = "deployed-label-name";

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
    const github = new GithubApiManager(token, owner, repo);
    const lockBranchName = getInput(lockBranchNameInputName);
    const lockCheckIntervalInMs = Number(getInput(lockCheckIntervalInputName));
    while (!(await acquireLock(github, lockBranchName, baseBranch))) {
      await new Promise(resolve => setTimeout(resolve, lockCheckIntervalInMs));
    }
    const workingDirectory = await mkdtemp("git-workspace");
    const git = new GitCommandManager(workingDirectory, user, token);
    await mergeDeployablePullRequests(
      github,
      git,
      targetBranch,
      baseBranch,
      requestLabelName,
      deployedLabelName
    );
    await removeLock(github, lockBranchName);
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
