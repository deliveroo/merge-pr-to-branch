# About

`merge-pr-to-branch` is a Github action that will manage your deployment branches via pull requests. This removes the need to manually reset/merge/push your deployment branch for testing.

See [Gap Analysis](gap-analysis.md).

# Getting started

## Installation
To enable this github action, run the following in your repo:

```bash
curl -s https://raw.githubusercontent.com/deliveroo/merge-pr-to-branch/master/install/install.sh | bash -s
```

Which will add the following workflow to your repo:

`.github/workflows/merge-pr-to-branch.yml`:

```yaml
on:
    pull_request:
      branches:
        - master
      types: [labeled, unlabeled, closed, reopened, synchronize]
    push:
      branches:
        - master

jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
          with:
            ref: master
        - uses: deliveroo/merge-pr-to-branch@v2
```

## Use the action

1. To merge a pull request to the `target-branch`, add the `stage` label. 
2. `merge-pr-to-branch` will run and attempt to merge the pull request
    * If successful, the `staged` label will be added along with a comment
    * If unsuccessful, a comment with the error will be added and the `stage` label will be removed
