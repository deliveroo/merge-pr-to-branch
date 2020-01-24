import * as core from "@actions/core";
import * as github from "@actions/github";
import { serializeError } from "serialize-error";
import { createGithubClient, mergeDeployablePullRequests, getBaseBranch } from "./githubHelpers";

const targetBranchInputName = "target-branch";
async function run() {
  try {
    const targetBranch = core.getInput(targetBranchInputName);
    if (!targetBranch) {
      throw new Error(`Missing input '${targetBranchInputName}'.`);
    }

    const { context } = github;
    const { payload } = context;
    const { repository } = payload;

    if (!repository) {
      throw new Error("Missing repository from payload.");
    }

    const githubClient = createGithubClient();
    const owner = repository.owner.login;
    const repo = repository.name;
    const baseBranch = getBaseBranch(context, payload);

    if (!baseBranch) {
      core.info(`Skipping eventName: '${context.eventName}'.`);
      return;
    }

    core.info(`Using baseBranch: '${baseBranch}'.`);

    await mergeDeployablePullRequests(githubClient, owner, repo, targetBranch, baseBranch);
  } catch (error) {
    core.setFailed(JSON.stringify(serializeError(error)));
  }
}

run();
