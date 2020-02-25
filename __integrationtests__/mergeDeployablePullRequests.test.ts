import { mergeDeployablePullRequests } from "../src/mergeDeployablePullRequests";
import { GitCommandManager } from "../src/GitCommandManager";
import { mkdtempSync } from "fs";
import { GithubApiManager } from "../src/GithubApiManager";

describe("mergeDeployablePullRequests", () => {
  it("intergration test", async () => {
    const targetBranch = "integration-tests";
    const { github, git } = setup();
    await mergeDeployablePullRequests(github, git, targetBranch, "master");
    expect(true).toBe(true);
  }, 100000);
});

const setup = () => {
  const { GITHUB_PAT, GITHUB_USER } = process.env;
  if (!GITHUB_PAT || !GITHUB_USER) {
    throw new Error(`Missing GITHUB_* environment variables.`);
  }
  const auth = {
    username: GITHUB_USER,
    password: GITHUB_PAT,
    on2fa: () => Promise.reject("2fa is unsupported")
  };

  const github = new GithubApiManager(auth, "deliveroo", "dev-glue");
  const workingDirectory = mkdtempSync("git-workspace");
  const git = new GitCommandManager(workingDirectory, GITHUB_USER, GITHUB_PAT);
  // TODO: should we create PRs and such?
  return { git, github };
};
