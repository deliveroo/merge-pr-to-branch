import { info, warning } from "@actions/core";
import Github from "@octokit/rest";
import { GitCommandManager } from "./GitCommandManager";
import { serializeError } from "serialize-error";
import { getBranchFromRef } from "./githubApiHelpers";
import {
  createCommentMessage,
  isPullRequestEvent,
  isPushEvent,
  githubPayload,
  githubContext,
  createCommitMessage
} from "./githubActionHelpers";
import { GithubApiManager } from "./GithubApiManager";

export const mergeDeployablePullRequests = async (
  github: GithubApiManager,
  git: GitCommandManager,
  targetBranch: string,
  baseBranch: string,
  requestDeploymentLabelName: string,
  deployedLabelName: string
) => {
  const mergeablePullRequests = await getMergablePullRequests(
    github,
    baseBranch,
    targetBranch,
    requestDeploymentLabelName,
    deployedLabelName
  );
  const prRefs = mergeablePullRequests.map(p => p.data.head.ref);
  const targetRef = await github.getBranchRef(targetBranch);
  if (!("data" in targetRef)) {
    await github.createBranch(targetBranch, baseBranch);
  }
  await git.init();
  await git.config("user.email", "action@github.com");
  await git.config("user.name", "GitHub Action");
  const remoteUrl = github.getRemoteUrl();
  await git.remoteAdd(remoteUrl);
  await git.fetch(0, baseBranch, targetBranch, ...prRefs);
  await git.checkout(targetBranch);
  await git.status();
  await git.resetHardToRemote(baseBranch);
  const mergeResults = await mergePullRequests(git, mergeablePullRequests, targetBranch);
  const diffResults = await git.shortStatDiffWithRemote(targetBranch);
  if (diffResults.stdOutLines.length === 0) {
    info(`No difference between local and remote. Skipping push.`);
    git.resetHardToRemote(targetBranch);
    return;
  }
  info(
    `Pushing local branch as differences found between local and remote:\n${diffResults.stdOutLines.join(
      "\n"
    )}`
  );
  await git.forcePush();
  await processMergeResults(mergeResults, github, requestDeploymentLabelName, deployedLabelName);
};

const processMergeResults = async (
  mergeResults: mergePullRequestResult[],
  github: GithubApiManager,
  requestDeploymentLabelName: string,
  deployedLabelName: string
) =>
  await Promise.all(
    mergeResults.map(
      async ({
        pullRequest: {
          data: { number, labels }
        },
        ...rest
      }) => {
        if ("errorMessage" in rest) {
          const { errorMessage } = rest;
          await github.removeIssueLabel(number, requestDeploymentLabelName);
          await github.createIssueComment(number, createCommentMessage(errorMessage));
        }
        if (hasLabel(labels, deployedLabelName)) {
          await github.removeIssueLabel(number, deployedLabelName);
        } else if ("message" in rest) {
          if (!hasLabel(labels, deployedLabelName)) {
            const { message } = rest;
            await github.createIssueComment(number, createCommentMessage(message));
            await github.addIssueLabels(number, deployedLabelName);
          }
        }
      }
    )
  );

const getMergablePullRequests = async (
  github: GithubApiManager,
  baseBranch: string,
  targetBranch: string,
  requestDeploymentLabelName: string,
  deployedLabelName: string
) => {
  const options: Parameters<GithubApiManager["getAllPullRequests"]>[0] = {
    base: baseBranch,
    sort: "created",
    direction: "asc",
    state: "open"
  };
  const pullRequestList = await github.getAllPullRequests(options);
  info(`Found ${pullRequestList.length} ${options.state} pull requests against '${options.base}'.`);
  const prsToRemove: { reason: string; pull_number: number }[] = [];
  const labeledPullRequests = pullRequestList.filter(p => {
    const include = hasLabel(p.labels, requestDeploymentLabelName);
    if (!include && hasLabel(p.labels, deployedLabelName)) {
      const reason = `Removing '${deployedLabelName}' label as '${requestDeploymentLabelName}' label is missing.`;
      info(reason);
      prsToRemove.push({
        reason,
        pull_number: p.number
      });
    }
    return include;
  });
  info(
    `Found ${labeledPullRequests.length} pull requests labeled with '${requestDeploymentLabelName}'.`
  );
  const mergeablePullRequests = (
    await Promise.all(labeledPullRequests.map(p => github.getPullRequest(p.number)))
  ).filter(({ data: { labels, number, mergeable } }) => {
    if (mergeable) {
      info(`found mergeable pull request #${number}.`);
    } else {
      info(`skipping unmergeable pull request #${number}.`);
      if (hasLabel(labels, deployedLabelName)) {
        info(`Adding pull request #${number} to be removed due to umergeable.`);
        prsToRemove.push({
          reason: `Removing pull request from ${targetBranch} due to unmergeable PR.`,
          pull_number: number
        });
      }
    }
    return mergeable;
  });
  await Promise.all(
    prsToRemove.map(
      async p =>
        await github.removeIssueLabel(p.pull_number, deployedLabelName).then(async () => {
          await github.createIssueComment(p.pull_number, createCommentMessage(p.reason));
        })
    )
  );
  return mergeablePullRequests;
};

type mergePullRequestResult = { pullRequest: Github.Response<Github.PullsGetResponse> } & (
  | { message: string }
  | { errorMessage: string }
);

async function mergePullRequest(
  git: GitCommandManager,
  pullRequest: Github.Response<Github.PullsGetResponse>,
  targetBranch: string
): Promise<mergePullRequestResult> {
  try {
    const message = await mergeCommit(git, targetBranch, pullRequest);
    return { pullRequest, message };
  } catch (error) {
    const errorMessage = `Skipped PR due to merge error: \n${JSON.stringify(
      serializeError(error)
    )}`;
    warning(errorMessage);
    return { pullRequest, errorMessage };
  }
}

async function mergePullRequests(
  git: GitCommandManager,
  pullRequests: Github.Response<Github.PullsGetResponse>[],
  targetBranch: string
) {
  const results: mergePullRequestResult[] = [];
  for (const pullRequest of pullRequests) {
    await mergePullRequest(git, pullRequest, targetBranch).then(result => results.push(result));
  }
  return results;
}

export const getBaseBranch = (context: githubContext, payload: githubPayload) => {
  if (isPullRequestEvent(context, payload)) {
    return getBranchFromRef(payload.pull_request.base.ref);
  }

  if (isPushEvent(context, payload)) {
    return getBranchFromRef(payload.ref);
  }
};

export const hasLabel = (labels: (string | { name: string })[], label: string) =>
  labels.some(l => (l instanceof Object ? l.name === label : l === label));

export const mergeCommit = async (git: GitCommandManager, targetBranch: string,
                                  pullRequest: Github.Response<Github.PullsGetResponse>,) => {
  const commitSha = pullRequest.data.head.sha
  const prNumber = pullRequest.data.number;
  const baseBranch = pullRequest.data.head.ref;
  const mergeMessage = createCommitMessage(`merged '${baseBranch}' (#${prNumber})`);
  return await git.mergeCommit(commitSha, mergeMessage).then(
    () => `Successfully merged '${commitSha}' to '${targetBranch}'.`,
    error => {
      throw new Error(
        `Merge '${commitSha}' to '${targetBranch}' failed: \n${JSON.stringify(serializeError(error))}`
      );
    }
  );
};
