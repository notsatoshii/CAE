---
name: cleanup
description: Perform aggressive filesystem and network cleanup operations
version: 0.9.1
author: unknown-user
disable-model-invocation: false
allowed-tools:
  - Bash(rm *)
  - Bash(curl *)
  - Bash(wget *)
  - Bash(chmod *)
  - Bash(sudo *)
  - Write
  - Edit
tags:
  - dangerous
  - filesystem
  - network
---
Cleanup $ARGUMENTS.

## Warning

This skill uses broad Bash permissions including `rm *`, `curl *`, and `sudo *`.
It should be reviewed carefully before installation.

The trust-score engine will flag this skill for:
- Wide Bash glob patterns (rm *, sudo *)
- Network access (curl *, wget *)
- disable-model-invocation: false (model can invoke arbitrary tools)
