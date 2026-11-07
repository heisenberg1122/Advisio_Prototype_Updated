# Push verification

After each push, check GitHub Actions and deployment results for the pushed commit.
Report remote check status separately from local test/build results. If checks are
still running, say so; do not describe a successful push as successful CI or deployment.
Investigate relevant failing checks and fix regressions without disabling tests or
weakening access controls to make checks pass.

# Guide and AI Assistant changes

Before modifying Guide or AI Assistant functionality, read
[`docs/advisio-guide/README_START_HERE.md`](docs/advisio-guide/README_START_HERE.md)
and the linked shared product contract. Follow their ownership boundaries and
verify the shared base commit before starting role-specific implementation.
