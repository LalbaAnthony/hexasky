# Release

Publication is fully automated by semantic-release. Nothing is ever published by
hand, and `package.json` keeps the placeholder version `0.0.0-development` on
disk: the real version is computed at release time from the commit history.

## Trigger

A push to `main` runs `.github/workflows/release.yml`. Merging `develop` into
`main` is therefore the only action needed to cut a release.

Pushes and pull requests targeting `develop` run `.github/workflows/ci.yml`,
which lints, typechecks, tests and builds but never publishes.

## What happens on a merge to `main`

1. Checkout with `fetch-depth: 0` (semantic-release needs the full history to
   read the previous tags) and `persist-credentials: false`.
2. Node 22 with `registry-url: https://registry.npmjs.org`.
3. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
4. `npx semantic-release`.

semantic-release then runs its plugin chain:

| Plugin                                      | Effect                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@semantic-release/commit-analyzer`         | Derives the next version from the Conventional Commits since the last tag.                         |
| `@semantic-release/release-notes-generator` | Renders the release notes.                                                                         |
| `@semantic-release/changelog`               | Writes those notes into `CHANGELOG.md`.                                                            |
| `@semantic-release/npm`                     | Sets the version in `package.json` and publishes to npm.                                           |
| `@semantic-release/git`                     | Commits `CHANGELOG.md` and `package.json` back to `main` as `chore(release): <version> [skip ci]`. |
| `@semantic-release/github`                  | Creates the GitHub release and tag, and comments on the related issues and pull requests.          |

All six are required. Without `changelog` there is no `CHANGELOG.md`; without
`npm` nothing is published; without `git` the changelog is never committed back;
without `github` no release is created.

If no commit since the last tag carries a releasing prefix, semantic-release
exits successfully without publishing.

## Required secrets

| Secret         | Purpose                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN` | Provided automatically by Actions. The workflow grants it `contents: write`, `issues: write` and `pull-requests: write`. |
| `NPM_TOKEN`    | An npm automation token with publish rights on the `@lalba-anthony` scope. Set it in the repository secrets.             |

The workflow also requests `id-token: write` and sets `NPM_CONFIG_PROVENANCE:
true`, which makes npm attach a signed provenance statement to the published
tarball. `publishConfig.provenance` in `package.json` requests the same thing.

`publishConfig.access` is `public`. Scoped packages default to `restricted`, and
the publish step fails without it.

### Why the token is exported twice

The release step exports the same secret as both `NPM_TOKEN` and
`NODE_AUTH_TOKEN`. Both are required, for different consumers.

`actions/setup-node` with `registry-url` writes a temporary npmrc and points
`NPM_CONFIG_USERCONFIG` at it:

```
//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
registry=https://registry.npmjs.org/
always-auth=true
```

`@semantic-release/npm` reads that file with `rc`, which parses INI but does not
expand environment variables. It therefore sees the literal string
`${NODE_AUTH_TOKEN}` as an already-configured auth token, takes its early return
in `set-npmrc-auth.js`, copies the file as-is, and never writes `NPM_TOKEN`.
`npm whoami` then expands the placeholder against the real environment. If
`NODE_AUTH_TOKEN` is unset, it expands to nothing, authentication fails, and
semantic-release reports `EINVALIDNPMTOKEN` even though `NPM_TOKEN` is set
correctly.

The tell in the log is that `Wrote NPM_TOKEN to <path>` never appears; instead
there is a `Reading npm config from /home/runner/work/_temp/.npmrc` line
followed by the failure.

### Trusted publishing

`@semantic-release/npm` attempts OIDC trusted publishing before falling back to
token auth: it exchanges the GitHub Actions ID token for a short-lived registry
token and skips `NPM_TOKEN` entirely. That path only works once the package
exists on npm and a trusted publisher is configured for it, so the first release
must go through `NPM_TOKEN`.

After the first successful publish, configure this repository and the
`.github/workflows/release.yml` workflow as a trusted publisher on the package
settings page on npmjs.com. Both token variables can then be removed from the
workflow; `id-token: write` is already granted.

## Verifying a published version

```sh
npm view @lalba-anthony/hexasky version
npm view @lalba-anthony/hexasky dist-tags
npx @lalba-anthony/hexasky@latest --version
npx @lalba-anthony/hexasky@latest Toulouse
```

The provenance attestation is visible on the package page on npmjs.com and via:

```sh
npm audit signatures
```

Cross-check the GitHub release notes and the `CHANGELOG.md` entry that
semantic-release committed back to `main`.

## Local dry run

```sh
npx semantic-release --dry-run --no-ci
```

This reports the version that would be released and the notes that would be
generated, without publishing or tagging. It needs read access to the repository
history and a `GITHUB_TOKEN` in the environment.

## Recovering from a failed release

The npm publish is the only irreversible step. If a later plugin fails after the
package is published, do not force a re-publish of the same version: npm rejects
it. Land a `fix:` commit on `main` instead and let the next run produce a new
patch version.
