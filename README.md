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

## Concurrency

This action force-pushes the `target-branch`, so two runs targeting the same
branch must never run at once. Mutual exclusion is handled by the GitHub Actions
[`concurrency`](https://docs.github.com/en/actions/using-jobs/using-concurrency)
group in the calling workflow — **not** by the action itself:

```yaml
concurrency:
  group: merge-pr-to-branch-${{ github.workflow }}
  cancel-in-progress: false
```

- GitHub guarantees only one run per group proceeds; others queue. No lock
  branch, nothing to leak, nothing to clean up.
- Keying the group on `${{ github.workflow }}` gives each workflow file its own
  lane. Since one workflow file maps to one `target-branch`, runs that merge into
  **different** branches proceed in parallel while runs into the **same** branch
  are serialised. Do **not** key on `github.ref`/`github.head_ref` — on a
  `pull_request` event those are the PR's ref, which would give every PR its own
  group and disable serialisation entirely.
- `cancel-in-progress: false` queues instead of cancelling. GitHub keeps only one
  pending run per group, but that's fine: each run reconciles **all** currently
  labelled PRs, so a dropped intermediate run never drops work — the surviving
  run picks everything up.
