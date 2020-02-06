import { getInput, info, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { createGithubClient } from "./githubApiHelpers";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";
import { gitCommandManager } from "./gitCommandManager";
import { promises } from "fs";
const { mkdtemp } = promises;

const targetBranchInputName = "target-branch";
async function run() {
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
    const githubClient = createGithubClient(token);
    const workingDirectory = await mkdtemp("git-workspace");
    const git = new gitCommandManager(workingDirectory, user, token);
    git.init();
    git.config("user.email", "action@github.com");
    git.config("user.name", "GitHub Action");
    await mergeDeployablePullRequests(githubClient, git, owner, repo, targetBranch, baseBranch);
  } catch (error) {
    setFailed(JSON.stringify(serializeError(error)));
  }
}

run();
