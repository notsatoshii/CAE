---
name: deploy
description: Deploy the application to production
version: 1.0.0
author: vercel-labs
disable-model-invocation: true
allowed-tools:
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(npm run build)
  - Bash(npm test)
tags:
  - deploy
  - git
  - ci
---
Deploy $ARGUMENTS to production.

## Steps
1. Run tests
2. Build
3. Push

## Usage

```
/deploy main
```

This skill performs a full production deploy of the specified branch.
It runs the test suite, builds the project, and pushes to the remote.

All Bash invocations are scoped to git and npm commands only.
