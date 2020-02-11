import { mergeDeployablePullRequests } from "../src/mergeDeployablePullRequests";
import { gitCommandManager } from "../src/gitCommandManager";
import { mkdtempSync } from "fs";
import { githubApiManager } from "../src/githubApiManager";

describe("mergeDeployablePullRequests", () => {
  it("intergration test", async () => {
    const targetBranch = "integration-tests";
    const { github, git } = setup();
    await mergeDeployablePullRequests(github, git, targetBranch, "master");
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

  const github = new githubApiManager(auth, "deliveroo", "dev-glue");
  const workingDirectory = mkdtempSync("git-workspace");
  const git = new gitCommandManager(workingDirectory, GITHUB_USER, GITHUB_PAT);
  return { git, github };
};
