import { createGithubClient, mergeDeployablePullRequests, execCmd } from "../src/githubHelpers";

describe("main", () => {
  it("mergeDeployablePullRequests intergration test", async () => {
    const targetBranch = "sandbox";
    await execCmd("git fetch");
    await execCmd(`git checkout ${targetBranch}`);
    const client = createGithubClient();
    await mergeDeployablePullRequests(client, "deliveroo", "dev-glue", targetBranch, "master");
  }, 100000);
});
