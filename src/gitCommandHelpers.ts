import { execCmd, createCommitMessage } from "./actionHelpers";
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
