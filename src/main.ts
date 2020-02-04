import { getInput, info, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { serializeError } from "serialize-error";
import { createGithubClient } from "./githubApiHelpers";
import { mergeDeployablePullRequests, getBaseBranch } from "./mergeDeployablePullRequests";

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

    const auth = getInput("repo-token");
    const githubClient = createGithubClient(auth);
    await mergeDeployablePullRequests(githubClient, owner, repo, targetBranch, baseBranch);
  } catch (error) {
    setFailed(JSON.stringify(serializeError(error)));
  }
}

run();
