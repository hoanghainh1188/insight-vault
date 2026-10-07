---
name: Feature (maintainers)
about: Start a new spec-driven feature — this issue number becomes the feature ID (branch NNN-<slug>)
title: "[feature] <short slug>"
labels: feature
---

<!--
This issue number = FEATURE ID. After creating it, name the working branch:
    <NNN>-<slug>    where NNN = issue number zero-padded to at least 3 digits
    e.g. issue #42 → branch 042-user-reservation
See docs/TEAM-WORKFLOW.md.
-->

## Proposed slug

<!-- kebab-case, short; check docs/00-glossary.md for consistent domain terms. e.g. user-reservation
     → branch 042-user-reservation; design folders docs/01-03/user-reservation/ (same slug). -->

## Source design documents

- Basic design: `docs/01-basic-design/<slug>/...`
- Detail design: `docs/02-detail-design/<slug>/...`
- UI reference (prototype / Figma link + node): `docs/03-ui/<slug>/`

## Owner / Assignee

<!-- One person owns this feature END-TO-END (see TEAM-WORKFLOW section 3). Set the GitHub Assignee too. -->

## Claim the feature (after creating the branch)

<!-- Right after `git checkout -b NNN-<slug>`:
     1. Confirm Assignee = owner above
     2. Add the in-progress label to this issue (remove it when the PR merges / the issue closes) -->

## Blocked by

<!-- Issues that must land FIRST (e.g. "#12 auth module"). Leave empty if independent. -->

## Affected domains / shared surface

<!-- Which modules does this touch? Any SHARED surface (src/shared/, config, docs/00-glossary.md, constitution…)?
     The more features touch one surface, the more conflicts/drift (TEAM-WORKFLOW sections 4–5). -->

## Acceptance summary

<!-- What it does, for whom, and the main "done" criteria -->

## Notes

<!-- Constraints? Contradictions already spotted in the documents? -->
<!-- Full process: docs/TEAM-WORKFLOW.md -->
