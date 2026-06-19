import { GithubApiManager } from "./GithubApiManager";
import { info } from "@actions/core";
export const acquireLock = async (
  github: GithubApiManager,
  lockBranchName: string,
  baseBranch: string,
  runId: number
) => {
  info("Acquiring lock...");
  const acquired = await github.createLock(lockBranchName, baseBranch, runId).then(
    () => true,
    error => (error && error.status === 422 ? false : Promise.reject(error))
  );
  if (acquired) {
    info("Acquired lock.");
    return true;
  }
  // The lock branch already exists. Break it only if the run that holds it is
  // no longer active — that means the holder died before releasing the lock
  // (e.g. a cancelled or timed-out run), so the lock is orphaned. If the owner
  // is still running, or we can't identify it (a legacy lock), we wait.
  const ownerRunId = await github.getLockOwnerRunId(lockBranchName);
  if (ownerRunId !== undefined && ownerRunId !== runId && !(await github.isRunActive(ownerRunId))) {
    info(`Lock held by run ${ownerRunId} which is no longer active; breaking stale lock.`);
    await removeLock(github, lockBranchName);
    return false;
  }
  info("Failed to acquire lock. Waiting...");
  return false;
};
export const removeLock = async (github: GithubApiManager, lockBranchName: string) => {
  info("Removing lock...");
  await github.deleteBranch(lockBranchName).then(
    () => undefined,
    error => (error && error.status === 422 ? undefined : Promise.reject(error))
  );
  info("Removed lock.");
};
