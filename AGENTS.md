# Push verification

After each push, check GitHub Actions and deployment results for the pushed commit.
Report remote check status separately from local test/build results. If checks are
still running, say so; do not describe a successful push as successful CI or deployment.
Investigate relevant failing checks and fix regressions without disabling tests or
weakening access controls to make checks pass.
