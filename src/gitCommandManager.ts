import { execCmd } from "./githubActionHelpers";

export class gitCommandManager {
  public constructor(
    private readonly workingDirectory: string,
    private readonly user: string,
    private readonly token: string
  ) {}
  public mergeCommit = async (commit: string, message: string) =>
    await this.execGit(`git merge ${commit} --commit -m "${message}"`);
  public resetHard = (sha: string) => this.execGit(`git reset --hard ${sha}`);
  public status = () => this.execGit("git status");
  public forcePush = () => this.execGit(`git push -f`);
  public fetch = (depth = 0, ...refs: string[]) =>
    this.execGit(
      `git fetch ${depth ? `--depth=${depth}` : ""} --no-tags --prune ${refs.join(" ")}`
    );
  public checkout = (branch: string) => this.execGit(`git checkout ${branch}`);
  public shortStatDiff = (branch1: string, branch2: string) =>
    this.execGit(`git diff ${branch1} ${branch2} --shortstat`, { includeStdOut: true });
  public init = () => this.execGit("git init");
  public remoteAdd = async (remote: string, url: string) => {
    const remoteUrl = new URL(url);
    remoteUrl.username = this.user;
    remoteUrl.password = this.token;
    return this.execGit(`git remote add ${remote} ${remoteUrl.toJSON()}`);
  };
  execGit = (
    command: string,
    options: Omit<Parameters<typeof execCmd>[1], "cwd"> = { includeStdOut: false }
  ) => execCmd(command, { ...options, cwd: this.workingDirectory });
}
