import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { WebhookPayloadPullRequest, WebhookPayloadPush } from "@octokit/webhooks";
import Github from "@octokit/rest";
import { serializeError } from "serialize-error";
import _ from "lodash";

const requestDeploymentLabel = "deploy";
const deployedLabel = "deployed";
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
  const auth = getAuth();
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

const resetBranchtoBase = async (
  githubClient: Github,
  owner: string,
  repo: string,
  baseBranch: string
) => {
  const baseBranchRef = await getBranchRef(githubClient, owner, repo, baseBranch);
  if (!("data" in baseBranchRef)) {
    throw new Error(`baseBranch: '${baseBranch}' not found.`);
  }
  const {
    object: { sha }
  } = baseBranchRef.data;
  return execCmd(`git reset --hard ${sha}`);
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
  // Relies on the standard @actions/checkout action to be run first
  await execCmd("git status");
  await resetBranchtoBase(githubClient, owner, repo, baseBranch);
  const mergeResults = await mergePullRequests(mergeablePullRequests, targetBranch);
  await execCmd(`git push -f`);
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
};

const githubWorkspaceEnvVarName = "GITHUB_WORKSPACE";
export const execCmd = async (...commands: string[]) => {
  const cwd = process.env[githubWorkspaceEnvVarName];
  if (!cwd) {
    throw new Error(`Missing environment variable: '${githubWorkspaceEnvVarName}'.`);
  }
  return await exec.exec(commands.join("/n"), undefined, { cwd });
};

export const mergeCommit = async (targetBranch: string, prSha: string) => {
  return await execCmd(`git merge ${prSha} --commit -m "Merged by ${githubActionName}"`).then(
    () => `Successfully merged '${prSha}' to '${targetBranch}'.`,
    error => {
      throw new Error(
        `Merge '${prSha}' to '${targetBranch}' failed: \n${JSON.stringify(serializeError(error))}`
      );
    }
  );
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
function getAuth() {
  const { GITHUB_PAT, GITHUB_USER } = process.env;
  const auth =
    GITHUB_PAT && GITHUB_USER
      ? {
          username: GITHUB_USER,
          password: GITHUB_PAT,
          on2fa: () => Promise.reject("2fa is unsupported")
        }
      : core.getInput("repo-token");
  return auth;
}

async function mergePullRequests(
  pullRequests: Github.Response<Github.PullsGetResponse>[],
  targetBranch: string
) {
  return await Promise.all(
    pullRequests.map(async pullRequest =>
      mergeCommit(targetBranch, pullRequest.data.head.sha).then(
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
