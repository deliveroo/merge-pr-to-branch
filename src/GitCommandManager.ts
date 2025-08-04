import { execCmd } from "./githubActionHelpers";

const _remoteName = "origin";

export class GitCommandManager {
  public constructor(
    private readonly workingDirectory: string,
    private readonly user: string,
    private readonly token: string
  ) {}
  public mergeCommit(commit: string, message: string) {
    return this.execGit(`git merge ${commit} --commit -m "${message}"`);
  }
  public resetHardToRemote(branchName: string) {
    return this.execGit(`git reset --hard ${_remoteName}/${branchName}`);
  }
  public status() {
    return this.execGit("git status");
  }
  public forcePush() {
    return this.execGit(`git push -f`);
  }
  public fetch(depth = 0, ...refs: string[]) {
    return this.execGit(
      `git fetch ${depth ? `--depth=${depth}` : ""} --no-tags --prune ${_remoteName} ${refs.join(
        " "
      )}`
    );
  }
  public checkout(branch: string) {
    return this.execGit(`git checkout ${branch} --`);
  }
  public shortStatDiffWithRemote(branch: string) {
    return this.execGit(`git diff ${branch} ${_remoteName}/${branch} --shortstat --`, {
      includeStdOut: true
    });
  }
  public init() {
    return this.execGit("git init");
  }
  public remoteAdd(url: string, remoteName = _remoteName) {
    const remoteUrl = new URL(url);
    remoteUrl.username = this.user;
    remoteUrl.password = this.token;
    return this.execGit(`git remote add ${remoteName} ${remoteUrl.toJSON()}`);
  }
  public config(key: string, value: string) {
    return this.execGit(`git config ${key} ${value}`);
  }
  execGit = (
    command: string,
    options: Omit<Parameters<typeof execCmd>[1], "cwd"> = { includeStdOut: false }
  ) => {
    return execCmd(command, { ...options, cwd: this.workingDirectory });
  };
}
