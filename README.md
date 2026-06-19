# About

`merge-pr-to-branch` is a Github action that will manage your deployment branches via pull requests. This removes the need to manually reset/merge/push your deployment branch for testing.

See [Gap Analysis](gap-analysis.md).

## Installation

To enable this github action, run the following in your repo:

```bash
curl -s https://raw.githubusercontent.com/deliveroo/merge-pr-to-branch/master/install/install.sh | bash -s
```

Which will add `.github/workflows/merge-pr-to-branch.yml` to your repo, based on the contents of [this template file](./install/workflow.yml). This will use [the defaults](./action.yml), which will merges any PRs to the `main` branch, that have the `stage` label to the `staging` branch (and then add the `staged` label).

## Use the action

1. To merge a pull request to the `target-branch`, add the `stage` label.
2. `merge-pr-to-branch` will run and attempt to merge the pull request
    * If successful, the `staged` label will be added along with a comment
    * If unsuccessful, a comment with the error will be added and the `stage` label will be removed

## Triggering downstream workflows after merge

Pushes made by `GITHUB_TOKEN` do not trigger other workflows
([GitHub docs](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow)),
so a CI workflow listening on `push` will not run when this action updates `target-branch`.

Set the optional `trigger-workflows` input to a newline-separated list of workflow filenames to
dispatch against `target-branch` after a successful merge:

```yaml
- uses: deliveroo/merge-pr-to-branch@v8
  with:
    target-branch: sandbox
    request-label-name: sandbox
    deployed-label-name: sandboxed
    trigger-workflows: |
      ci-workflows.yml
      integration-tests.yml
```

A single workflow is also fine:

```yaml
    trigger-workflows: ci-workflows.yml
```

Dispatch only fires when the merge actually changes `target-branch` — no-op runs are skipped.

> [!IMPORTANT]
> Each named workflow must declare `workflow_dispatch:` under its `on:` triggers.
> If a `permissions` block is used in the workflow that calls this action, you must include `actions: write` in that list.

## Locking

To stop concurrent runs from racing each other, the action serialises execution
with a **lock branch** (default name: `lock`). Acquiring the lock means creating
that branch; whoever creates it first holds the lock, and everyone else waits.
The lock commit records the `GITHUB_RUN_ID` of the run that holds it.

The lock is released in a `finally` block, so a run that fails part-way still
cleans up after itself. If a run is hard-killed (cancelled, timed out, OOM) it
can leave the branch behind. To recover from that automatically, when a run finds
the lock already held it checks whether the **owning run is still active** — if
that run has finished, the lock is treated as orphaned and broken so work can
continue.

This staleness check calls the Actions API, so the token needs `actions: read`
(the default `GITHUB_TOKEN` has it unless your repo restricts default
permissions). If the status can't be read, the action errs on the safe side and
keeps waiting rather than breaking the lock.

**Break-glass:** to clear a stuck lock manually, delete the branch:

```bash
gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/lock
```
