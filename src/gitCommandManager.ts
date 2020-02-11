import { execCmd } from "./githubActionHelpers";

export class gitCommandManager {
  public constructor(
    private readonly workingDirectory: string,
    private readonly user: string,
    private readonly token: string
  ) {}
  public mergeCommit(commit: string, message: string) {
    return this.execGit(`git merge ${commit} --commit -m "${message}"`);
  }
  public resetHard(sha: string) {
    return this.execGit(`git reset --hard ${sha}`);
  }
  public status() {
    return this.execGit("git status");
  }
  public forcePush() {
    return this.execGit(`git push -f`);
  }
  public fetch(depth = 0, ...refs: string[]) {
    return this.execGit(
      `git fetch ${depth ? `--depth=${depth}` : ""} --no-tags --prune ${refs.join(" ")}`
    );
  }
  public checkout(branch: string) {
    return this.execGit(`git checkout ${branch}`);
  }
  public shortStatDiff(branch1: string, branch2: string) {
    return this.execGit(`git diff ${branch1} ${branch2} --shortstat`, { includeStdOut: true });
  }
  public init() {
    return this.execGit("git init");
  }
  public remoteAdd(remote: string, url: string) {
    const remoteUrl = new URL(url);
    remoteUrl.username = this.user;
    remoteUrl.password = this.token;
    return this.execGit(`git remote add ${remote} ${remoteUrl.toJSON()}`);
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
