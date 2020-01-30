import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayloadPullRequest, WebhookPayloadPush } from "@octokit/webhooks";
import Github from "@octokit/rest";
import { serializeError } from "serialize-error";
import _ from "lodash";

const requestDeploymentLabel = "deploy";
const deployedLabel = "deployed"; // TODO: include target branch in label
const githubActionName = "merge-pr-to-branch";

export const isPullRequestEvent = (
  context: typeof github.context,
  payload: typeof github.context.payload
): payload is WebhookPayloadPullRequest =>
  context.eventName === "pull_request" && !!payload.pull_request;

export const isPushEvent = (
  context: typeof github.context,
  payload: typeof github.context.payload
): payload is WebhookPayloadPush => context.eventName === "push" && !!payload.repository;

export const hasLabel = (labels: (string | { name: string })[], label: string) =>
  labels.some(l => (l instanceof Object ? l.name === label : l === label));

export const getBranchFromRef = (ref: string) => _.last(_.split(ref, "/"));
const formatHeadFromBranch = (branch: string) => `heads/${branch}`;
const formatRefFromBranch = (branch: string) => `refs/${formatHeadFromBranch(branch)}`;

export const createGithubClient = () => {
  const { GITHUB_PAT, GITHUB_USER } = process.env;
  const auth =
    GITHUB_PAT && GITHUB_USER
      ? {
          username: GITHUB_USER,
          password: GITHUB_PAT,
          on2fa: () => Promise.reject("2fa is unsupported")
        }
      : core.getInput("repo-token");
  if (!auth) {
    throw new Error("Auth not configured for Github.");
  }
  return new Github({
    auth
  });
};

export const getBranchRef = async (
  githubClient: Github,
  owner: string,
  repo: string,
  branch: string
) =>
  githubClient.git
    .getRef({
      owner,
      repo,
      ref: formatHeadFromBranch(branch)
    })
    .catch(error =>
      error.status === 404 ? Promise.resolve({ status: 404 }) : Promise.reject(error)
    );

export const createBranch = async (
  githubClient: Github,
  owner: string,
  repo: string,
  branch: string,
  sourceBranch: string
) => {
  const sourceRef = await getBranchRef(githubClient, owner, repo, sourceBranch);

  if (!("data" in sourceRef)) {
    throw new Error(`sourceBranch: '${sourceBranch}' not found.`);
  }
  const { sha } = sourceRef.data.object;
  const createRefResult = await githubClient.git.createRef({
    owner,
    repo,
    ref: formatRefFromBranch(branch),
    sha
  });
  if (createRefResult.status !== 200) {
    throw new Error(
      `Failed to create branch: '${branch}'\n${JSON.stringify(createRefResult.data)}.`
    );
  }
};

const getAllPaginatedItems = async <T>(githubClient: Github, options: {}) => {
  const pages: T[] = [];
  const iterator = githubClient.paginate.iterator(options);
  for await (const page of iterator) {
    if (page.status !== 200) {
      throw new Error(`paginate iterator didn't return status 200: '${page.status}'.`);
    }
    pages.push(page.data);
  }

  return _.flatMap(pages);
};

const createPullRequestComment = async (
  githubClient: Github,
  owner: string,
  repo: string,
  pull_number: number,
  body: string
) =>
  githubClient.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: `${githubActionName}:\n${body}`
  });

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
  const prsToAdd: number[] = [];
  const labeledPullRequests = pullRequestList.filter(p => {
    const hasDeployLabel = hasLabel(p.labels, requestDeploymentLabel);
    const include = hasDeployLabel || hasLabel(p.labels, "staged");
    if (include && !hasDeployLabel) {
      core.info(
        `Adding missing ${requestDeploymentLabel} label when 'staged' exists to PR #${p.number}.`
      );
      prsToAdd.push(p.number);
    }
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
  // await Promise.all(
  //   prsToAdd.map(issue_number =>
  //     githubClient.issues.addLabels({
  //       owner,
  //       repo,
  //       issue_number,
  //       labels: [requestDeploymentLabel]
  //     })
  //   )
  // );
  // await Promise.all(
  //   prsToRemove.map(
  //     async p =>
  //       await githubClient.issues
  //         .removeLabel({
  //           owner,
  //           repo,
  //           issue_number: p.pull_number,
  //           name: deployedLabel
  //         })
  //         .then(async () => {
  //           // await createPullRequestComment(githubClient, owner, repo, p.pull_number, p.reason);
  //         })
  //   )
  // );
  return mergeablePullRequests;
};

const resetBranchtoBase = async (
  githubClient: Github,
  owner: string,
  repo: string,
  targetBranch: string,
  baseBranch: string
) => {
  const baseBranchRef = await getBranchRef(githubClient, owner, repo, baseBranch);
  if (!("data" in baseBranchRef)) {
    throw new Error(`baseBranch: '${baseBranch}' not found.`);
  }
  const {
    object: { sha }
  } = baseBranchRef.data;
  const updateRefResult = await githubClient.git.updateRef({
    owner,
    repo,
    force: true,
    ref: formatHeadFromBranch(targetBranch),
    sha
  });

  if (updateRefResult.status >= 200 && updateRefResult.status < 300) {
    core.info(`Successfully reset '${targetBranch}' to '${baseBranch}' (${sha}).`);
    return;
  }

  throw new Error(`Failed to reset '${targetBranch}' to '${baseBranch}' (${sha}).`);
};

export const mergeDeployablePullRequests = async (
  githubClient: Github,
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
  const targetRef = await getBranchRef(githubClient, owner, repo, targetBranch);
  if (targetRef.status === 404) {
    await createBranch(githubClient, owner, repo, targetBranch, baseBranch);
  }
  await resetBranchtoBase(githubClient, owner, repo, targetBranch, baseBranch);
  await Promise.all(
    mergeablePullRequests.map(async p => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return mergeCommit(githubClient, owner, repo, targetBranch, p.data.head.sha).then(
        async message => {
          core.info(`Successfully merged PR #${p.data.number} to '${targetBranch}'.`);
          if (!hasLabel(p.data.labels, deployedLabel)) {
            // await createPullRequestComment(githubClient, owner, repo, p.data.number, message);
            // await githubClient.issues.addLabels({
            //   owner,
            //   repo,
            //   issue_number: p.data.number,
            //   labels: [deployedLabel]
            // });
          }
        },
        async error => {
          const errorMessage = `Skipping PR #${p.data.number} due to error: \n${JSON.stringify(
            serializeError(error)
          )}`;
          core.warning(errorMessage);
          // await githubClient.issues.removeLabel({
          //   owner,
          //   repo,
          //   issue_number: p.data.number,
          //   name: requestDeploymentLabel
          // });
          //await createPullRequestComment(githubClient, owner, repo, p.data.number, errorMessage);
          // if (hasLabel(p.data.labels, deployedLabel)) {
          //   await githubClient.issues.removeLabel({
          //     owner,
          //     repo,
          //     issue_number: p.data.number,
          //     name: deployedLabel
          //   });
          // }
        }
      );
    })
  );
};

export const mergeCommit = async (
  githubClient: Github,
  owner: string,
  repo: string,
  targetBranch: string,
  prSha: string
) => {
  const mergeResult = await githubClient.repos.merge({
    owner,
    repo,
    base: targetBranch,
    head: prSha,
    commit_message: `Merged by ${githubActionName}`
  });

  const { data, status } = mergeResult;
  if (status >= 300) {
    throw new Error(`Merge '${prSha}' to '${targetBranch}' failed: \n${JSON.stringify(data)}`);
  }

  if (status === 201) {
    return `Successfully merged '${prSha}' to '${targetBranch}'.`;
  }

  if (status === 204) {
    return `'${prSha}' already exists in '${targetBranch}'.`;
  }

  throw new Error(`Unexpected status: '${status}'.`);
};

export const getBaseBranch = (
  context: typeof github.context,
  payload: typeof github.context.payload
) => {
  if (isPullRequestEvent(context, payload)) {
    return getBranchFromRef(payload.pull_request.base.ref);
  }

  if (isPushEvent(context, payload)) {
    return getBranchFromRef(payload.ref);
  }
};
