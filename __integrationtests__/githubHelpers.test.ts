import { createGithubClient, mergeDeployablePullRequests } from "../src/githubHelpers";

describe("main", () => {
  it("mergeDeployablePullRequests intergration test", async () => {
    const client = createGithubClient();
    await mergeDeployablePullRequests(client, "deliveroo", "orderweb", "staging-test", "master");
  }, 100000);
});
