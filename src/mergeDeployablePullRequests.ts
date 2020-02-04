import * as core from "@actions/core";
import Github from "@octokit/rest";
import * as git from "./gitCommandHelpers";
import { serializeError } from "serialize-error";
import {
  getBranchRef,
  createBranch,
  resetBranchtoBase,
  createPullRequestComment,
  hasLabel,
  getAllPaginatedItems,
  createGithubClient
} from "./githubHelpers";

const requestDeploymentLabel = "deploy";
const deployedLabel = "deployed";

export const mergeDeployablePullRequests = async (
  owner: string,
  repo: string,
  targetBranch: string,
  baseBranch: string
) => {
  const githubClient = createGithubClient();
  const mergeablePullRequests = await getMergablePullRequests(
    githubClient,
    owner,
    repo,
    baseBranch,
    targetBranch
  );
  const targetRef = await getBranchRef(githubClient, owner, repo, targetBranch);
  if (targetRef.status === 404) {
    await createBranch(githubClient, owner, repo, targetBranch, baseBranch);
  }
  // Relies on the standard @actions/checkout action to be run first
  await git.status();
  await resetBranchtoBase(githubClient, owner, repo, baseBranch);
  const mergeResults = await mergePullRequests(mergeablePullRequests, targetBranch);
  await git.forcePush();
  await handleMergeResults(mergeResults, githubClient, owner, repo);
};

const handleMergeResults = async (
  mergeResults: (
    | { pullRequest: Github.Response<Github.PullsGetResponse>; message: string }
    | { pullRequest: Github.Response<Github.PullsGetResponse>; errorMessage: string }
  )[],
  githubClient: Github,
  owner: string,
  repo: string
) =>
  await Promise.all(
    mergeResults.map(async ({ pullRequest, ...rest }) => {
      if ("errorMessage" in rest) {
        const { errorMessage } = rest;
        await githubClient.issues.removeLabel({
          owner,
          repo,
          issue_number: pullRequest.data.number,
          name: requestDeploymentLabel
        });
        await createPullRequestComment(
          githubClient,
          owner,
          repo,
          pullRequest.data.number,
          errorMessage
        );
      }
      if (hasLabel(pullRequest.data.labels, deployedLabel)) {
        await githubClient.issues.removeLabel({
          owner,
          repo,
          issue_number: pullRequest.data.number,
          name: deployedLabel
        });
      } else if ("message" in rest) {
        if (!hasLabel(pullRequest.data.labels, deployedLabel)) {
          const { message } = rest;
          await createPullRequestComment(
            githubClient,
            owner,
            repo,
            pullRequest.data.number,
            message
          );
          await githubClient.issues.addLabels({
            owner,
            repo,
            issue_number: pullRequest.data.number,
            labels: [deployedLabel]
          });
        }
      }
    })
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
  const pullRequestList = await getAllPaginatedItems<Github.PullsListResponseItem>(
    githubClient,
    githubClient.pulls.list.endpoint.merge(listOptions)
  );
  core.info(
    `Found ${pullRequestList.length} ${listOptions.state} pull requests against '${listOptions.base}'.`
  );
  const prsToRemove: { reason: string; pull_number: number }[] = [];
  const labeledPullRequests = pullRequestList.filter(p => {
    const include = hasLabel(p.labels, requestDeploymentLabel);
    if (!include && hasLabel(p.labels, deployedLabel)) {
      const reason = `Removing pull request from ${targetBranch} due to missing '${requestDeploymentLabel}' label.`;
      core.info(reason);
      prsToRemove.push({
        reason,
        pull_number: p.number
      });
    }
    return include;
  });
  core.info(
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
      core.info(`found mergeable pull request #${number}.`);
    } else {
      core.info(`skipping unmergeable pull request #${number}.`);
      if (hasLabel(labels, deployedLabel)) {
        core.info(`Adding pull request #${number} to be removed due to umergeable.`);
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
  pullRequests: Github.Response<Github.PullsGetResponse>[],
  targetBranch: string
) {
  return await Promise.all(
    pullRequests.map(async pullRequest =>
      git.mergeCommit(targetBranch, pullRequest.data.head.sha).then(
        async message => {
          return { pullRequest, message };
        },
        async error => {
          const errorMessage = `Skipped PR due to merge error: \n${JSON.stringify(
            serializeError(error)
          )}`;
          core.warning(errorMessage);
          return { pullRequest, errorMessage };
        }
      )
    )
  );
}
