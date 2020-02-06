import { info, warning } from "@actions/core";
import Github from "@octokit/rest";
import { gitCommandManager } from "./gitCommandManager";
import { serializeError } from "serialize-error";
import {
  getAllPaginatedItems,
  getBranchFromRef,
  getBranchRef,
  createBranch
} from "./githubApiHelpers";
import {
  createCommentMessage,
  isPullRequestEvent,
  isPushEvent,
  githubPayload,
  githubContext,
  createCommitMessage
} from "./githubActionHelpers";

const requestDeploymentLabel = "deploy";
const deployedLabel = "deployed";

export const mergeDeployablePullRequests = async (
  githubClient: Github,
  git: gitCommandManager,
  owner: string,
  repo: string,
  targetBranch: string,
  baseBranch: string
) => {
  const mergeablePullRequests = await getMergablePullRequests(
    githubClient,
    owner,
    repo,
    baseBranch,
    targetBranch
  );
  const prRefs = mergeablePullRequests.map(p => p.data.head.ref);
  const remoteName = "origin";
  const remoteBaseBranch = `${remoteName}/${baseBranch}`;
  const remoteTargetBranch = `${remoteName}/${targetBranch}`;
  const targetRef = await getBranchRef(githubClient, owner, repo, targetBranch);
  if (!("data" in targetRef)) {
    await createBranch(githubClient, owner, repo, targetBranch, baseBranch);
  }
  await git.remoteAdd(remoteName, `https://github.com/${owner}/${repo}.git`);
  await git.fetch(0, remoteName, baseBranch, targetBranch, ...prRefs);
  await git.checkout(targetBranch);
  await git.status();
  await git.resetHard(remoteBaseBranch);
  const mergeResults = await mergePullRequests(git, mergeablePullRequests, targetBranch);
  const diffResults = await git.shortStatDiff(remoteTargetBranch, targetBranch);
  if (diffResults.stdOutLines.length === 0) {
    info(`No difference between ${targetBranch} and ${remoteTargetBranch}. Skipping push.`);
    git.resetHard(remoteTargetBranch);
    return;
  }
  info(
    `Pushing local branch as differences found between ${targetBranch} and ${remoteTargetBranch}:\n${diffResults.stdOutLines.join(
      "\n"
    )}`
  );
  await git.forcePush();
  await processMergeResults(mergeResults, githubClient, owner, repo);
};

type ExtractPromiseResolveValue<T> = T extends Promise<infer U> ? U : never;
export type mergePullRequestsResult = ExtractPromiseResolveValue<
  ReturnType<typeof mergePullRequests>
>;

const processMergeResults = async (
  mergeResults: mergePullRequestsResult,
  githubClient: Github,
  owner: string,
  repo: string
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
          await githubClient.issues.removeLabel({
            owner,
            repo,
            issue_number: number,
            name: requestDeploymentLabel
          });
          await createPullRequestComment(githubClient, owner, repo, number, errorMessage);
        }
        if (hasLabel(labels, deployedLabel)) {
          await githubClient.issues.removeLabel({
            owner,
            repo,
            issue_number: number,
            name: deployedLabel
          });
        } else if ("message" in rest) {
          if (!hasLabel(labels, deployedLabel)) {
            const { message } = rest;
            await createPullRequestComment(githubClient, owner, repo, number, message);
            await githubClient.issues.addLabels({
              owner,
              repo,
              issue_number: number,
              labels: [deployedLabel]
            });
          }
        }
      }
    )
  );
const getMergablePullRequests = async (
  githubClient: Github,
  owner: string,
  repo: string,
  baseBranch: string,
  targetBranch: string
) => {
  const listOptions: Github.PullsListParams = {
    owner,
    repo,
    base: baseBranch,
    sort: "created",
    direction: "asc",
    state: "open"
  };
  const pullRequestList = await getAllPaginatedItems(
    githubClient,
    githubClient.pulls.list,
    listOptions
  );
  info(
    `Found ${pullRequestList.length} ${listOptions.state} pull requests against '${listOptions.base}'.`
  );
  const prsToRemove: { reason: string; pull_number: number }[] = [];
  const labeledPullRequests = pullRequestList.filter(p => {
    const include = hasLabel(p.labels, requestDeploymentLabel);
    if (!include && hasLabel(p.labels, deployedLabel)) {
      const reason = `Removing '${deployedLabel}' label as '${requestDeploymentLabel}' label is missing.`;
      info(reason);
      prsToRemove.push({
        reason,
        pull_number: p.number
      });
    }
    return include;
  });
  info(
    `Found ${labeledPullRequests.length} pull requests labeled with '${requestDeploymentLabel}'.`
  );
  const mergeablePullRequests = (
    await Promise.all(
      labeledPullRequests.map(p =>
        githubClient.pulls.get({
          owner,
          repo,
          pull_number: p.number
        })
      )
    )
  ).filter(({ data: { labels, number, mergeable } }) => {
    if (mergeable) {
      info(`found mergeable pull request #${number}.`);
    } else {
      info(`skipping unmergeable pull request #${number}.`);
      if (hasLabel(labels, deployedLabel)) {
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
        await githubClient.issues
          .removeLabel({
            owner,
            repo,
            issue_number: p.pull_number,
            name: deployedLabel
          })
          .then(async () => {
            await createPullRequestComment(githubClient, owner, repo, p.pull_number, p.reason);
          })
    )
  );
  return mergeablePullRequests;
};

async function mergePullRequests(
  git: gitCommandManager,
  pullRequests: Github.Response<Github.PullsGetResponse>[],
  targetBranch: string
) {
  return await Promise.all(
    pullRequests.map(async pullRequest =>
      mergeCommit(git, targetBranch, pullRequest.data.head.sha).then(
        async message => {
          return { pullRequest, message };
        },
        async error => {
          const errorMessage = `Skipped PR due to merge error: \n${JSON.stringify(
            serializeError(error)
          )}`;
          warning(errorMessage);
          return { pullRequest, errorMessage };
        }
      )
    )
  );
}

const createPullRequestComment = async (
  githubClient: Github,
  owner: string,
  repo: string,
  pull_number: number,
  comment: string
) =>
  githubClient.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: createCommentMessage(comment)
  });

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
export const mergeCommit = async (git: gitCommandManager, targetBranch: string, ref: string) => {
  const mergeMessage = createCommitMessage("merged");
  return await git.mergeCommit(ref, mergeMessage).then(
    () => `Successfully merged '${ref}' to '${targetBranch}'.`,
    error => {
      throw new Error(
        `Merge '${ref}' to '${targetBranch}' failed: \n${JSON.stringify(serializeError(error))}`
      );
    }
  );
};
