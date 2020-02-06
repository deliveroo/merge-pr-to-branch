import { exec } from "@actions/exec";
import github from "@actions/github";
import { WebhookPayloadPullRequest, WebhookPayloadPush } from "@octokit/webhooks";

const githubActionName = "merge-pr-to-branch";

export const execCmd = async (
  command: string,
  options: { cwd: string; includeStdOut: boolean }
) => {
  const stdOutLines: string[] = [];
  const { cwd, includeStdOut } = options;
  const returnCode = await exec(command, undefined, {
    cwd,
    listeners: {
      stdout: includeStdOut ? data => stdOutLines.push(data.toString()) : undefined
    }
  });
  return { returnCode, stdOutLines };
};

export const createCommitMessage = (message: string) => `${message} by ${githubActionName}`;
export const createCommentMessage = (message: string) => `${githubActionName}:\n${message}`;

export type githubContext = typeof github.context;
export type githubPayload = githubContext["payload"];

export const isPullRequestEvent = (
  context: githubContext,
  payload: githubPayload
): payload is WebhookPayloadPullRequest =>
  context.eventName === "pull_request" && !!payload.pull_request;

export const isPushEvent = (
  context: githubContext,
  payload: githubPayload
): payload is WebhookPayloadPush => context.eventName === "push" && !!payload.repository;
