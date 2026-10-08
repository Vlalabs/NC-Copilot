# NC Copilot

An English-language interactive prototype for aerospace non-conformance management, inspired by the user-provided **Initial mock-up**. Each stage keeps the conversation and provides a distinct workspace: consolidated capture, multi-criteria assessment, then resolution execution.

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
3. **Assess the case**. The criterion matrix compares configuration, documentation, acceptance measurements, repair/rework eligibility and the verification plan against the simulated DAC, process instruction, inspection plan and quality procedure. Open a source citation to inspect its scope, revision and relevant extract. Switch to **Source documents** or **Disposition options** to explore the evidence and supported next steps.
4. Use **Demo document set**, or report a missing instruction or DAC revision conflict in the chat, to simulate a documentation gap. These gaps, unknown configurations and missing measurements route to engineering. A request for an opinion is tracked separately from a final disposition. A message such as `Measured depth: 0.03 mm` refreshes the assessment with a newly recorded measurement.
5. **Review disposition**, enter a rationale and confirm the simulated review. Repair, rework, exchange, reject, scrap and accept as-is have distinct meanings. The execution workspace tracks sequential actions, responsible teams, local work-order references, verification evidence and recent activity. Reject holds or returns an item; scrap records permanent withdrawal.
6. Mark actions complete. For repair/rework, record final measurements that satisfy the original acceptance criteria. A non-conforming final inspection prevents completion.
7. For an engineering referral, record a fictional opinion and a replacement, exchange, rejection or scrap disposition, then carry out the new resolution plan.
8. Close the case and **Export record** to download the JSON record, decisions, references and audit trail. **Case record** opens the captured facts and full history from the assessment and execution workspaces.

## Open the demo on the web

The published demo is available at **https://vlalabs.github.io/NC-Copilot/**. The cloud environment onboarding screen does not display interactive app previews. To configure publishing in a new repository:

1. In this repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
2. Open **Actions → Publish interactive demo → Run workflow**, select `main`, and start the workflow.
3. When deployment completes, open the URL provided by the `github-pages` environment or the workflow deployment summary.

The workflow runs on pushes to `main` and can also be started manually. It builds for the `/NC-Copilot/` subdirectory and publishes the compiled frontend. Browser case data remains local to each visitor.

## Simulation boundaries

- The assistant uses deterministic English/French keyword extraction and guided responses. It is not connected to an LLM.
- MES, PLM and QMS records, historical examples, design criteria, repair instructions, reviewers and work orders are fictional fixtures. Nothing is sent to external systems.
- The two requirements apply only to the specific A320 aluminium parts specified in `src/domain.ts`. They are not real aerospace engineering limits.
- One case is saved in browser local storage. Starting a new case or loading a scenario replaces it; export first to keep a copy. No cross-user or cross-device persistence is implemented.
- JPG, PNG, WebP, PDF and TXT evidence up to 10 MB per file can be attached. Image previews and annotations are available during the current session. After reload, metadata and markers remain but original files must be reattached. Exports contain metadata and annotations, not attachment binaries; document contents are not analysed.
- Editing the declared facts through **Case record** invalidates the previous declaration and assessment. New measurements explicitly reported during the assessment refresh that review and remain in the audit history. After a disposition or referral is recorded, the facts are locked. Time displays use Europe/Paris.

## Validation

```sh
npm run build      # TypeScript validation and production bundle
npm test           # 16 domain tests: extraction, criteria, documents, boundaries, inspection, persistence
npm run test:e2e   # 11 Chromium browser tests: workflows, referrals, documents, evidence, export, mobile
```

Browser tests use `/usr/bin/chromium` when available. Otherwise install the matching browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to your Chromium executable. The test runner starts the dev server automatically if it is not already running.

`npm run preview -- --port 4173 --strictPort` serves the production bundle after building.

`npm run export:demo` builds and regenerates `demo/NC-Copilot.html`, a self-contained version that can be opened locally without a server.

## Structure

- `src/App.tsx`: conversation, consolidated panel, dialogs and resolution interactions.
- `src/Workspaces.tsx`: dedicated assessment and execution screens.
- `src/domain.ts`: fictional scenarios, scoped rules, parsing and workflow validation.
- `src/styles.css`: responsive desktop/mobile presentation and reduced-motion support.
- `src/workspaces.css`: criterion matrix, document review and execution workspace presentation.
- `tests/`: domain and end-to-end regression tests.

For cloud tasks, use the existing checkout at `/workspace/NC-Copilot`. Each task is already isolated; do not create a Git worktree unless explicitly requested.
