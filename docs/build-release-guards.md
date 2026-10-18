# Locked builds and release boundaries

## Failure and root cause

The API compiler and shipped runtime previously used different dependency graphs. `build:lambda` installed an unlocked `rollup.package.json` graph inside `dist`; that manifest also advertised version 1.14.6 while the root package/lock were 1.14.8. Registry changes could therefore change a release without changing the root lock. Upstream deployment tooling also invokes a shared sibling-source fallback before installing dependencies, so the checked-out source and root lock did not necessarily describe the compiler inputs.

The root-cause correction here is one dependency authority: the committed root `package.json` and npm v3 `package-lock.json`. The current lock resolves `@koralabs/kora-labs-common` to registry version 6.9.3 with integrity verification. No sibling source is accepted by the build lock guard. This does not prove that a separately fetched deployment helper is immutable or safe.

## Build contract

Run `npm run build:lambda` from a release checkout with absent or empty `dist`. The driver:

1. Refuses nonempty output before installing or writing anything. It never deletes existing artifacts; preserve them outside the output path before building again.
2. Rejects local/sibling links, non-registry package sources and missing integrity hashes in the root lock.
3. Runs `npm ci --include=dev` at the root, replacing the installed dependency graph with the locked compiler graph. This intentionally discards linked packages in `node_modules`.
4. Runs the locally installed Rollup binary, without an `npm exec` download fallback.
5. Copies the root manifest, root lock and Swagger document into `dist`, then runs `npm ci --prefix dist --omit=dev`. Runtime versions and overrides now come from the same lock as the build, rather than a second manifest.

Every stage fails closed; there is no floating install or sibling fallback in this driver. The legacy `rollup.package.json` is no longer consumed. Build output is not byte-for-byte reproducibility proof: platform-specific dependencies and deployment metadata still vary. Do not run this build over evidence-bearing ignored output or an actively used local dependency tree.

## Required sibling coordination — release remains blocked

These are outside this change's ownership and have NOT been changed:

- `adahandle-deployments/common/service-fn-push.sh` sources `build-koralabs-deps.sh` and invokes `build_koralabs_deps || true`. Remove the automatic source-rewriting sibling fallback for this API; use the committed root lock and propagate installation failures. The API workflow currently supplies `SERVICE_INSTALL_CMD: npm install` and fetches that helper; its owner must change this to locked installation and remove the unused fallback fetch. The legacy `adahandle-deployments/handles-api/build.sh` also uses `npm install` and needs equivalent provenance review if retained as a release path.
- `kora-self-hosted-apps/bootstrap/deploy/fn_push_apply.sh` unconditionally launches detached `scanner_sideload.sh "$KORA_ENV" auto` after scanner deployment, with `systemd-run` and a `nohup` fallback. Remove that launch for **preview, preprod and mainnet**, not just mainnet. Release health must not trigger REIMPORT/REINDEX, namespace clearing, or another mutating recovery operation. Test the real hook at its process boundary for all three environments, proving neither detached path executes. Keep any separately authorized recovery an explicit operator operation, not a deployment side effect.
- Shared helper fetches and box-side installation must also have reviewed provenance. The new local lock guard does not authorize changing sibling helpers, deploying the API, or invoking sideload even in detect mode.

The all-environment release/recovery separation is a root-cause fix to the deployment lifecycle, not a recovery mechanism. It does not make valid imports crash-atomic or resolve the separate snapshot admission/CAS work described by A5.2 in `kora-bot/tasks/app-alert-recovery/TASK_STATE.md`.

## Focused offline verification

`python3 shell/build-lambda.test.py` executes the real build driver and Node lock guard with a fake package-manager/process boundary in temporary fixture directories under `/tmp`. It verifies locked install commands, generated runtime metadata, empty-output handling, preservation/refusal for existing artifacts, sibling/unverified lock rejection, and propagation of compiler/runtime install failures. The test docstring describes negative controls. It does not install packages, build the actual application, access the network, touch Redis, or execute a deployment. `node shell/check-build-lock.mjs` additionally validates the actual checked-in lock without changing it.

The parent owns full-suite integration and the `docs/index.md` link to this document. Actual bundle/runtime validation and sibling release-hook tests remain required before promotion; the focused driver tests do not replace them.
