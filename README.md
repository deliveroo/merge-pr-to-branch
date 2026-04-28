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

## Triggering a downstream workflow after merge

Pushes made by `GITHUB_TOKEN` do not trigger other workflows
([GitHub docs](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow)),
so a CI workflow listening on `push` will not run when this action updates `target-branch`.

Set the optional `trigger-workflow` input to dispatch a workflow against `target-branch` after a
successful merge:

```yaml
- uses: deliveroo/merge-pr-to-branch@v8
  with:
    target-branch: sandbox
    request-label-name: sandbox
    deployed-label-name: sandboxed
    trigger-workflow: ci-workflows.yml
```

The named workflow must declare `workflow_dispatch:` under its `on:` triggers. Dispatch only fires
when the merge actually changes `target-branch` — no-op runs are skipped.
