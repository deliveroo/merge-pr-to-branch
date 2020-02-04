import * as github from "@actions/github";
import Github from "@octokit/rest";
import _ from "lodash";
import { createCommentMessage, isPullRequestEvent, isPushEvent } from "./actionHelpers";
import * as git from "./gitCommandHelpers";

export const hasLabel = (labels: (string | { name: string })[], label: string) =>
  labels.some(l => (l instanceof Object ? l.name === label : l === label));

export const getBranchFromRef = (ref: string) => _.last(_.split(ref, "/"));
const formatHeadFromBranch = (branch: string) => `heads/${branch}`;
const formatRefFromBranch = (branch: string) => `refs/${formatHeadFromBranch(branch)}`;

export const createGithubClient = (auth: Github.Options["auth"]) => {
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

export const getAllPaginatedItems = async <T>(githubClient: Github, options: {}) => {
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

export const createPullRequestComment = async (
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

export const resetBranchtoBase = async (
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
  return git.resetHard(sha);
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
