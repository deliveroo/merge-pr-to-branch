import { createGithubClient } from "../src/githubApiHelpers";
import * as git from "../src/gitCommandHelpers";
import { mergeDeployablePullRequests } from "../src/mergeDeployablePullRequests";

describe("mergeDeployablePullRequests", () => {
  it("intergration test", async () => {
    const targetBranch = "sandbox";
    await git.fetch();
    await git.checkout(targetBranch);
    const { GITHUB_PAT, GITHUB_USER } = process.env;
    if (!GITHUB_PAT || !GITHUB_USER) {
      throw new Error(`Missing GITHUB_* environment variables.`);
    }
    const auth = {
      username: GITHUB_USER,
      password: GITHUB_PAT,
      on2fa: () => Promise.reject("2fa is unsupported")
    };

    const client = createGithubClient(auth);
    await mergeDeployablePullRequests(client, "deliveroo", "dev-glue", targetBranch, "master");
  }, 100000);
});
