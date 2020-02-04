import { createGithubClient, mergeDeployablePullRequests } from "../src/githubHelpers";
import * as git from "../src/gitCommandHelpers";

describe("main", () => {
  it("mergeDeployablePullRequests intergration test", async () => {
    const targetBranch = "sandbox";
    await git.fetch();
    await git.checkout(targetBranch);
    const client = createGithubClient();
    await mergeDeployablePullRequests(client, "deliveroo", "dev-glue", targetBranch, "master");
  }, 100000);
});
