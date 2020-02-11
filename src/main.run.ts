import { getInput, info, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { githubApiManager } from "./githubApiManager";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";
import { gitCommandManager } from "./gitCommandManager";
import { promises } from "fs";
import { acquireLock, removeLock } from "./acquireLock";
const { mkdtemp } = promises;

const targetBranchInputName = "target-branch";
const lockBranchNameInputName = "lock-branch-name";
const lockCheckIntervalInputName = "lock-check-interval-ms";
export async function run() {
  try {
    const targetBranch = getInput(targetBranchInputName);
    if (!targetBranch) {
      throw new Error(`Missing input '${targetBranchInputName}'.`);
    }

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
    const github = new githubApiManager(token, owner, repo);
    const lockBranchName = getInput(lockBranchNameInputName);
    const lockCheckIntervalInMs = Number(getInput(lockCheckIntervalInputName));
    while (!(await acquireLock(github, lockBranchName, baseBranch))) {
      await new Promise(resolve => setTimeout(resolve, lockCheckIntervalInMs));
    }
    const workingDirectory = await mkdtemp("git-workspace");
    const git = new gitCommandManager(workingDirectory, user, token);
    await mergeDeployablePullRequests(github, git, targetBranch, baseBranch);
    await removeLock(github, lockBranchName);
  } catch (error) {
    setFailed(JSON.stringify(serializeError(error)));
  }
}
