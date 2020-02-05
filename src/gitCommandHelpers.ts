import { execCmd, createCommitMessage } from "./githubActionHelpers";
import { serializeError } from "serialize-error";

export const mergeCommit = async (targetBranch: string, prSha: string) => {
  const mergeMessage = createCommitMessage("merged");
  return await execCmd(`git merge ${prSha} --commit -m "${mergeMessage}"`).then(
    () => `Successfully merged '${prSha}' to '${targetBranch}'.`,
    error => {
      throw new Error(
        `Merge '${prSha}' to '${targetBranch}' failed: \n${JSON.stringify(serializeError(error))}`
      );
    }
  );
};

export const resetHard = (sha: string) => execCmd(`git reset --hard ${sha}`);
export const status = () => execCmd("git status");
export const forcePush = () => execCmd(`git push -f`);
export const fetch = () => execCmd(`git fetch`);
export const checkout = (branch: string) => execCmd(`git checkout ${branch}`);
export const shortStatDiff = (branch1: string, branch2: string) =>
  execCmd(`git diff ${branch1} ${branch2} --shortstat`, { includeStdOut: true });
