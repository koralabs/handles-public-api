# api.handle.me canonical contract

**Status: proposal (ecosystem-ownership-plan row 5.1). Operator review pending.**

Wallets, marketplaces and our own apps trust this API to say where a handle lives. The rules below
must never break. The code that holds them is listed in [`.enclave`](./.enclave); K.O.R.A.'s
`merge_pr` asks the operator before a change to it merges into `mainnet` or `preprod`.

## Source requirements

- Ecosystem `AGENTS.md`, "Critical Correctness": addresses correct 100% of the time, never
  double-mint, properties chain-accurate. "Merging": double-mint risk, contract-settings edits and
  automated burns are higher-risk and need operator approval.
- kora-bot `v3/docs/ecosystem-ownership-plan.md`, operator decision 2: what an enclave must contain
  (key/security material, prompt files, and every file that defines, supports or enforces this
  contract).
- kora-bot `v3/docs/tool-surface.md` (`merge_pr`): the gate cards enclave paths merged into
  `master`/`main`/`mainnet`/`preprod`, reading a root `.enclave`.

## Must never be violated

1. **Handle addresses are correct 100% of the time.** `resolved_addresses.ada` (and holder/stake
   data built from it) is the address that holds the handle on chain now. A stale address sends
   someone's funds to the wrong place.
2. **Properties are chain-accurate.** Every field we serve comes from the chain (datum, policy,
   label), not from a guess or a default.
3. **One handle, one record.** The index never shows a handle twice or under the wrong policy.
4. **Rollbacks are honoured.** A rolled-back block's changes are undone; the index follows the chain.
5. **Scanning stays in order** (UTxO order matters). No parallel block processing.
6. **A restored snapshot is verified** against the chain before it is served.

## Where it is enforced today

| # | Code | Test gate |
|---|---|---|
| 1-3 | `repositories/handlesRepository.ts`, `stores/redis/` | `yarn test:critical` coverage floor |
| 4-5 | `services/ogmios/`, `lambdas/scanner*.ts` | `yarn test:critical` |
| 6 | `utils/snapshotVerification.ts` | unit tests |

## Refactor needed for enforcement

- **The scanner file is large** (`lambdas/scanner.app.ts`) and mixes address derivation with
  plumbing. Pulling "chain output → stored handle" into one pure function would let rules 1-3 be
  tested directly instead of through coverage floors.
- **`test:critical` is not run on PRs to `mainnet`** (PR tests only trigger for `preview`). The
  gate should run on every PR that touches an enclaved path.
- Address parsing comes from `@koralabs/kora-labs-common`; a bump there bypasses this enclave
  (row 5.3).
