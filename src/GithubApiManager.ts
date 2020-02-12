import Github from "@octokit/rest";
import {
  getBranchCommit,
  createBranch,
  getBranchRef,
  formatHeadFromBranch,
  getAllPaginatedItems,
  createGithubClient
} from "./githubApiHelpers";
export class GithubApiManager {
  constructor(
    auth: Parameters<typeof createGithubClient>[0],
    private readonly owner: string,
    private readonly repo: string,
    private readonly client: Github = createGithubClient(auth)
  ) {}
  private readonly options = {
    owner: this.owner,
    repo: this.repo
  };
  public getBranchCommit(branch: string) {
    return getBranchCommit(this.client, this.owner, this.repo, branch);
  }
  public createBranch(branch: string, baseBranch: string) {
    return createBranch(this.client, this.owner, this.repo, branch, baseBranch);
  }
  public getBranchRef(branch: string) {
    return getBranchRef(this.client, this.owner, this.repo, branch);
  }
  public deleteBranch(branch: string) {
    return this.client.git.deleteRef({
      ...this.options,
      ref: formatHeadFromBranch(branch)
    });
  }
  public getRemoteUrl() {
    return `https://github.com/${this.owner}/${this.repo}.git`;
  }
  public getAllPullRequests(params: Omit<Github.PullsListParams, "owner" | "repo">) {
    return getAllPaginatedItems(this.client, this.client.pulls.list, {
      ...this.options,
      ...params
    });
  }
  public getPullRequest(pull_number: number) {
    return this.client.pulls.get({ ...this.options, pull_number });
  }
  public removeIssueLabel(issue_number: number, name: string) {
    return this.client.issues.removeLabel({ ...this.options, issue_number, name });
  }
  public addIssueLabels(issue_number: number, ...labels: string[]) {
    return this.client.issues.addLabels({ ...this.options, issue_number, labels });
  }
  public createIssueComment(issue_number: number, body: string) {
    return this.client.issues.createComment({ ...this.options, issue_number, body });
  }
}
