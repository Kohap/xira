# XIRA Contracts

Foundry project for the XIRA attestation contract.

## Setup

```bash
git submodule update --init --recursive
forge build
forge test
```

`forge-std` is tracked as a git submodule under `contracts/lib/forge-std`.
Repository archives do not include submodule contents, so run the submodule
command before local contract tests.

## Mainnet deploy

```bash
set -a && source .env.deploy && set +a
XIRA_CONFIRM_MAINNET_DEPLOY=deploy-mainnet ../scripts/deploy-contract.sh
```

The deploy script targets X Layer Mainnet by default and refuses to broadcast
without the explicit confirmation variable.
