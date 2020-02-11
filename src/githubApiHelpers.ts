import Github from "@octokit/rest";
import _ from "lodash";

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
