import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { WebhookPayloadPullRequest, WebhookPayloadPush } from "@octokit/webhooks";

const githubActionName = "merge-pr-to-branch";
const githubWorkspaceEnvVarName = "GITHUB_WORKSPACE";

export const execCmd = async (...commands: string[]) => {
  const cwd = process.env[githubWorkspaceEnvVarName];
  if (!cwd) {
    throw new Error(`Missing environment variable: '${githubWorkspaceEnvVarName}'.`);
  }
  return await exec.exec(commands.join("/n"), undefined, { cwd });
};

export const createCommitMessage = (message: string) => `${message} by ${githubActionName}`;
export const createCommentMessage = (message: string) => `${githubActionName}:\n${message}`;

export const isPullRequestEvent = (
  context: typeof github.context,
  payload: typeof github.context.payload
): payload is WebhookPayloadPullRequest =>
  context.eventName === "pull_request" && !!payload.pull_request;

export const isPushEvent = (
  context: typeof github.context,
  payload: typeof github.context.payload
): payload is WebhookPayloadPush => context.eventName === "push" && !!payload.repository;
