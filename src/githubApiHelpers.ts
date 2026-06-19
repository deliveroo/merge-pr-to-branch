import Github from "@octokit/rest";
import _ from "lodash";
import { warning } from "@actions/core";

export const getBranchFromRef = (ref: string) => _.last(_.split(ref, "/"));
export const formatHeadFromBranch = (branch: string) => `heads/${branch}`;
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
  return githubClient.git.createRef({
    owner,
    repo,
    ref: formatRefFromBranch(branch),
    sha
  });
};

// The lock branch records which workflow run holds it, so a later run can tell
// whether the lock is genuinely held or was orphaned by a run that died before
// releasing it. We point the branch at a commit whose message embeds the run id.
export const lockCommitMessagePrefix = "merge-pr-to-branch lock acquired by run ";

export const createLockBranch = async (
  githubClient: Github,
  owner: string,
  repo: string,
  branch: string,
  sourceBranch: string,
  runId: number
) => {
  const sourceRef = await getBranchRef(githubClient, owner, repo, sourceBranch);
  if (!("data" in sourceRef)) {
    throw new Error(`sourceBranch: '${sourceBranch}' not found.`);
  }
  const baseSha = sourceRef.data.object.sha;
  const baseCommit = await githubClient.git.getCommit({ owner, repo, commit_sha: baseSha });
  const lockCommit = await githubClient.git.createCommit({
    owner,
    repo,
    message: `${lockCommitMessagePrefix}${runId}`,
    tree: baseCommit.data.tree.sha,
    parents: [baseSha]
  });
  // createRef fails with 422 if the branch already exists — that is how lock
  // contention is detected by the caller.
  return githubClient.git.createRef({
    owner,
    repo,
    ref: formatRefFromBranch(branch),
    sha: lockCommit.data.sha
  });
};

// Returns the workflow run id recorded on the lock branch, or undefined if the
// branch is missing or wasn't created by this action (e.g. a legacy lock).
export const getLockOwnerRunId = async (
  githubClient: Github,
  owner: string,
  repo: string,
  branch: string
) => {
  const branchRef = await getBranchRef(githubClient, owner, repo, branch);
  if (!("data" in branchRef)) {
    return undefined;
  }
  const commit = await githubClient.git.getCommit({
    owner,
    repo,
    commit_sha: branchRef.data.object.sha
  });
  const message = commit.data.message || "";
  if (!message.startsWith(lockCommitMessagePrefix)) {
    return undefined;
  }
  const runId = Number(message.slice(lockCommitMessagePrefix.length).trim());
  return Number.isInteger(runId) ? runId : undefined;
};

// A run is active unless it has completed. A 404 means the run no longer exists,
// so the lock it left behind is safe to break. Any other failure (e.g. the token
// lacks `actions: read`) is treated conservatively as "still active" so we never
// break a lock we can't actually prove is orphaned — degrading to plain waiting.
export const isRunActive = async (
  githubClient: Github,
  owner: string,
  repo: string,
  runId: number
) => {
  try {
    const response = await githubClient.request(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
      { owner, repo, run_id: runId }
    );
    return response.data.status !== "completed";
  } catch (error) {
    if (error && (error as { status?: number }).status === 404) {
      return false;
    }
    warning(
      `Could not determine status of run ${runId}; treating the lock as held. ` +
        `Ensure the token has 'actions: read' permission.`
    );
    return true;
  }
};

type ExtractGithubResponseDataType<T> = T extends {
  (): Promise<Github.Response<(infer U)[]>>;
}
  ? U
  : never;
type GithubCommand<D, O extends Github.RequestOptions> = {
  (params?: O): Promise<Github.Response<D>>;
  endpoint: Github.Endpoint;
};

export const getAllPaginatedItems = async <
  T extends GithubCommand<D, O>,
  R extends Github.Response<D>,
  I = ExtractGithubResponseDataType<T>,
  D = I[],
  O = Parameters<T>[0]
>(
  githubClient: Github,
  command: T,
  options: O
) => {
  const iterator = githubClient.paginate.iterator(
    command.endpoint.merge(options)
  ) as AsyncIterableIterator<R>;
  const pages: D[] = [];
  for await (const page of iterator) {
    if (page.status !== 200) {
      throw new Error(`paginate iterator didn't return status 200: '${page.status}'.`);
    }
    pages.push(page.data);
  }
  return (_.flatMap(pages) as unknown) as I[];
};

export const getBranchCommit = async (
  githubClient: Github,
  owner: string,
  repo: string,
  branch: string
) => {
  const branchRef = await getBranchRef(githubClient, owner, repo, branch);
  if (!("data" in branchRef)) {
    return undefined;
  }
  const {
    object: { sha }
  } = branchRef.data;
  return sha;
};
