import { GithubApiManager } from "./GithubApiManager";
import { info } from "@actions/core";
export const acquireLock = async (
  github: GithubApiManager,
  lockBranchName: string,
  baseBranch: string
) => {
  info("Acquiring lock...");
  const result = await github.createBranch(lockBranchName, baseBranch).then(
    () => true,
    error => (error && error.status === 422 ? false : Promise.reject(error))
  );
  if (result) {
    info("Acquired lock.");
  } else {
    info("Failed to acquire lock. Waiting...");
  }
  return result;
};
export const removeLock = async (github: GithubApiManager, lockBranchName: string) => {
  info("Removing lock...");
  await github.deleteBranch(lockBranchName).then(
    () => undefined,
    error => (error && error.status === 422 ? undefined : Promise.reject(error))
  );
  info("Removed lock.");
};
