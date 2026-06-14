# Changelog

All notable changes to BuildPanda are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions are kept in sync across all workspace packages (`@buildpanda/backend`,
`@buildpanda/frontend`, `@buildpanda/web`, `@buildpanda/admin`). Bump them with
`pnpm version:patch | version:minor | version:major`, then tag (see below).

## [Unreleased]

### Added

- **RFI module** — Procore-style Requests for Information with a numbered,
  ball-in-court workflow: create/respond/close/void/reopen lifecycle,
  per-project sequential numbering (concurrency-safe), official vs proposed
  responses, comment thread, immutable audit trail, due dates and a reminder
  sweep job, distribution lists with external email responders (single-use
  hashed reply tokens), and conversion of an RFI into a change event.
  Frontend: RFIs page, create/detail dialogs, sidebar entry.
- **BIM module** — IFC model viewer and coordination. Hybrid upload (presigned
  S3 PUT for small files, resumable multipart for large models), server-side
  IFC element extraction via `web-ifc` (GUID index), a lazy-loaded Three.js /
  ThatOpen web viewer with element selection, coordination issues anchored to
  element GUIDs, promote-issue-to-RFI, and 4D (schedule) / 5D (cost) element
  links. Frontend: BIM Models page, upload dialog, 3D viewer.
- **Owner / client portal** — RFIs and a read-only BIM viewer surfaced in the
  curated client portal; internal RFIs and proposed responses are scoped out at
  the data layer so they never reach clients.
- **Onboarding** — faction-aware sign-up routing (project owners land on
  `/my-build`), a designated BuildPanda Consulting org that owner-faction
  projects are auto-associated with (owner added as a client participant), and
  a project-wizard step to seed an existing IFC/BIM model on project creation.
- **Editable Project Chart (Gantt)** — drag/resize to reschedule activities,
  persisted via the activities API with a debounced save; edits cascade to
  recompute phase date ranges and the dashboard timeline. Custom bounded
  undo/redo (the SVAR built-in is PRO-only), gated on the `schedule:manage`
  permission, with dependency self-link interception.
- Release versioning: this CHANGELOG, a `scripts/version.mjs` bump script, and
  `version:*` package scripts.

### Changed

- Email sends now log through the shared application logger instead of
  `console`.
- Imported programme and BoQ files are attached to the project Documents folder.

## Release process

1. Update the **Unreleased** section above with the changes for the release.
2. Run `pnpm version:patch` (or `version:minor` / `version:major`). This bumps
   the version in every workspace package and prints the remaining steps.
3. Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and add a fresh empty
   Unreleased section.
4. `git commit -am "chore(release): vX.Y.Z"`
5. `git tag -a vX.Y.Z -m "vX.Y.Z"`
6. `git push && git push --tags`
