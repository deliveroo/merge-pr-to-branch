import { createGithubClient } from "../src/githubApiHelpers";
import { mergeDeployablePullRequests } from "../src/mergeDeployablePullRequests";
import { gitCommandManager } from "../src/gitCommandManager";
import { mkdtempSync } from "fs";

describe("mergeDeployablePullRequests", () => {
  it("intergration test", async () => {
    const targetBranch = "sandbox";
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
    const workingDirectory = mkdtempSync("git-workspace");
    const git = new gitCommandManager(workingDirectory, GITHUB_PAT);
    await mergeDeployablePullRequests(client, git, "deliveroo", "dev-glue", targetBranch, "master");
  }, 100000);
});
