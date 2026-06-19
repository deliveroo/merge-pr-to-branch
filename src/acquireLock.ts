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
  // is still running, or we can't identify it (a legacy lock / transient read
  // failure), we wait.
  const lock = await github.getLockInfo(lockBranchName);
  if (
    lock &&
    lock.runId !== undefined &&
    lock.runId !== runId &&
    !(await github.isRunActive(lock.runId))
  ) {
    // The check above is not atomic with the delete below: the dead holder's
    // slot could be re-acquired by another live run in between, and deleting by
    // name would then clobber that run's valid lock — letting two runs merge
    // concurrently. GitHub refs have no conditional delete, so re-read the SHA
    // and only break the lock if it still points at the commit we judged stale.
    const currentSha = await github.getBranchCommit(lockBranchName);
    if (currentSha === lock.sha) {
      info(`Lock held by run ${lock.runId} which is no longer active; breaking stale lock.`);
      await removeLock(github, lockBranchName);
    } else {
      info("Lock changed during the staleness check; another run now holds it. Waiting...");
    }
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
