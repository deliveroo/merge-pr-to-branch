import { createGithubClient, mergeDeployablePullRequests } from "../src/githubHelpers";

describe("main", () => {
  it("mergeDeployablePullRequests intergration test", async () => {
    const client = createGithubClient();
    await mergeDeployablePullRequests(client, "deliveroo", "dev-glue", "sandbox", "master");
  }, 100000);
});
