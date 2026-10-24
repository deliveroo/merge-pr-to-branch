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
- uses: deliveroo/merge-pr-to-branch@v9
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
> If `trigger-workflows` is configured and the caller has an explicit `permissions` block, include `actions: write` alongside the permissions shown in the template.

## Concurrency

This action force-pushes the `target-branch`, so two runs targeting the same
branch must never run at once. Mutual exclusion is handled by the GitHub Actions
[`concurrency`](https://docs.github.com/en/actions/using-jobs/using-concurrency)
group in the calling workflow — **not** by the action itself:

For example, when `target-branch` is `staging`, use:

```yaml
concurrency:
  group: merge-pr-to-branch-staging
  cancel-in-progress: false
```

Use the same literal group in **every workflow that targets the same
`target-branch`**, even when those workflows have different names or triggers.
For another target branch, choose a different stable literal, such as
`merge-pr-to-branch-production`. Do not derive the key from `github.workflow`,
`github.ref`, or `github.head_ref`; those values can differ for workflows that
mutate the same branch.

GitHub runs at most one member of a concurrency group at a time. It keeps at
most one pending run, and a newer pending run can replace an older pending run.
Because each surviving run reconciles the current set of labelled PRs, this
provides **eventual reconciliation of current state**; it does not promise that
every invocation runs or that runs execute in FIFO order.


## Upgrade to v9 (breaking change)

Version 9 removes the action-managed lock. Callers must add branch-scoped
concurrency at the same time they upgrade the action; updating only the action
version leaves runs unprotected.

For each target branch, use one stable group value shared by every workflow
that can update that branch. For the default `staging` target, use
`merge-pr-to-branch-staging`. If `trigger-workflows` is configured, include
`actions: write` in the caller's explicit permissions.

Use this coordinated cutover:

1. Pause the workflow triggers that invoke the action.
2. Let all old lock-based and ungrouped runs finish; cancel stuck runs and wait
   until no old run remains active or pending.
3. Update each caller's action reference to `@v9` and add the branch-specific
   concurrency group in the same change. Every workflow targeting the same
   branch must use exactly the same group.
4. Verify no old-version or ungrouped run remains active or pending.
5. Delete a stale legacy lock branch if one exists.
6. Resume the triggers and run one reconciliation.

Do not roll out the new action reference separately from the concurrency
configuration. Old lock-based runs and new concurrency-controlled runs do not
exclude one another during cutover.