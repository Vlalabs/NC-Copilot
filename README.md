# NC Copilot

An English-language interactive prototype for aerospace non-conformance management, inspired by the user-provided **Initial mock-up**. The conversation captures observations; the right-hand panel consolidates facts, provenance, engineering references and the case history.

## Run

Requires Node.js **22.12 or later** (validated with Node.js 24.19) and npm. No API keys, backend or external services are needed.

```sh
npm ci
npm run dev
```

In the cloud environment, use `npm ci --cache /workspace/.cache/npm` because the default home-directory npm cache is not writable. The dev server uses port 5173; pass `-- --port 5173 --strictPort` to reserve that port explicitly.

## Demo walkthrough

1. Choose **Try a sample case**: a bracket scratch, an out-of-tolerance bore or a suspected crack. Alternatively, describe an issue in the conversation, import an A320 manufacturing context through **Source systems**, and edit the fields on the right.
2. Confirm the suggested defect type, review the essential facts and **Declare NC**.
3. **Assess the case**. Open the referenced design requirement to see its applicability, revision, acceptance limits and repair envelope. Unknown part/material/program combinations and missing measurements route to engineering.
4. **Review disposition**, enter a rationale and confirm the simulated review. The resolution plan assigns sequential actions to the responsible teams.
5. Mark actions complete. For repair/rework, record final measurements that satisfy the original acceptance criteria. A non-conforming final inspection prevents completion.
6. For an engineering referral, record a fictional opinion and a replacement or rejection disposition, then carry out the new resolution plan.
7. Close the case and **Export record** to download the JSON record, decisions, references and audit trail.

## Open the demo on the web

The cloud environment onboarding screen does not display interactive app previews. To get a shareable web link, publish the static prototype through GitHub Pages:

1. In this repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
2. Open **Actions → Publish interactive demo → Run workflow**, select `main`, and start the workflow.
3. When deployment completes, open the URL provided by the `github-pages` environment or the workflow deployment summary.

The workflow is manual: code pushes do not automatically publish a site. It builds for the `/NC-Copilot/` subdirectory and publishes the compiled frontend. Browser case data remains local to each visitor.

## Simulation boundaries

- The assistant uses deterministic English/French keyword extraction and guided responses. It is not connected to an LLM.
- MES, PLM and QMS records, historical examples, design criteria, repair instructions, reviewers and work orders are fictional fixtures. Nothing is sent to external systems.
- The two requirements apply only to the specific A320 aluminium parts specified in `src/domain.ts`. They are not real aerospace engineering limits.
- One case is saved in browser local storage. Starting a new case or loading a scenario replaces it; export first to keep a copy. No cross-user or cross-device persistence is implemented.
- JPG, PNG, WebP, PDF and TXT evidence up to 10 MB per file can be attached. Image previews and annotations are available during the current session. After reload, metadata and markers remain but original files must be reattached. Exports contain metadata and annotations, not attachment binaries; document contents are not analysed.
- Changes to a declared record invalidate the previous declaration and assessment. After a disposition is approved, the facts are locked. Time displays use Europe/Paris.

## Validation

```sh
npm run build      # TypeScript validation and production bundle
npm test           # 12 domain tests: extraction, rule boundaries, applicability, inspection, persistence
npm run test:e2e   # 7 Chromium browser tests: complete workflows, evidence, export, mobile layout
```

Browser tests use `/usr/bin/chromium` when available. Otherwise install the matching browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to your Chromium executable. The test runner starts the dev server automatically if it is not already running.

`npm run preview -- --port 4173 --strictPort` serves the production bundle after building.

## Structure

- `src/App.tsx`: conversation, consolidated panel, dialogs and resolution interactions.
- `src/domain.ts`: fictional scenarios, scoped rules, parsing and workflow validation.
- `src/styles.css`: responsive desktop/mobile presentation and reduced-motion support.
- `tests/`: domain and end-to-end regression tests.

For cloud tasks, use the existing checkout at `/workspace/NC-Copilot`. Each task is already isolated; do not create a Git worktree unless explicitly requested.
