# First-time user check

Ask someone who has not worked on CodeForge to use a running local instance. Do not explain the interface while they work. Record where they hesitate and their own words for what they expect next.

1. From the landing page, explain what CodeForge produces and what it does not produce.
2. Create a project and start a CRUD API run.
3. At each approval checkpoint, explain what is being approved and choose an action.
4. Follow the live run. If a review or test loop occurs, explain why the work returned to the Coder.
5. At the end, identify whether the API passed its tests, inspect the code and test evidence, then find Try API.
6. Explain how to recover if a provider fails or the live connection drops.

The Phase 7 criterion is met only when the viewer can describe the full run afterward without coaching. Save the date, device size, task notes, exact points of confusion, and changes made from the findings. Repeat the check after fixing blocking issues. This document is a test plan, not evidence that the criterion has passed.

## Repeatable interface checks

- Run the mocked browser suite in CI for account recovery, Projects retry/search, project history, Profile, and Try API.
- At 375px, verify search remains usable by keyboard and the page has no horizontal overflow.
- Inspect visible focus, error recovery, empty states, and long labels on desktop and mobile before a release.
- Record page weight and interaction delays from a production build when a real backend is available; do not treat a mocked route as a performance measurement.

## Workspace experience follow-up

After the 2026-10-02 additions, also observe whether the first-time user can:

1. Choose and customize a template, leave the project, and recover their draft.
2. Request a checkpoint change and recognize the revised plan before approving.
3. Find a pending approval in the header inbox while visiting another project.
4. Create a record in Try API, reuse its returned ID, and load a saved request.
5. Build an improved version, inspect its diff, and explain which version is published.
6. Rename/archive a project and restore it from the archived view.

Record actual observations here or in an attached test report. The existence of
these tasks and automated coverage is not a completed human usability study.
