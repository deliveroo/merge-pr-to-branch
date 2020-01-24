# About

`merge-pr-to-branch` is a Github action that will reset the `target-branch` (defaults to `staging`) to the base branch (eg. `master`) and merge every pull request with the `deploy` label. This is triggered as defined in the Github workflow.

# Getting started

## Add Github Workflow
To enable this github action, add the following workflow to your repo:

`.github/workflows/merge-pr-to-branch.yml`:

```yaml
on:
    pull_request:
      branches:
        - master
      types: [labeled, unlabeled, closed, reopened]
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
        - uses: deliveroo/merge-pr-to-branch@v1
```

## Use the action

1. To merge a pull request to the `target-branch`, add the `deploy` label. 
2. `merge-pr-to-branch` will run and attempt to merge the pull request
    * If successful, the `deployed` label will be added along with a comment
    * If unsuccessful, a comment with the error will be added and the `deploy` label will be removed

# Contributing

Before commiting your change, ensure you build the distributed js file. Github Actions require bundled output in the repo.

```
npm run build
```