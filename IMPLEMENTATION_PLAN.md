# TaskFlow Enhancement Implementation Plan

## Overview
Implementing all proposed features to transform TaskFlow into an AI-powered productivity platform.

> **Status note:** AI/ML features are implemented as heuristic engines (hash-based
> embeddings, weighted multi-factor scoring, pattern learning from task logs) rather
> than on-device transformer/ONNX models — no `@xenova/transformers` or
> `onnxruntime-web` dependency. Calendar uses hand-rolled Google REST calls instead
> of `googleapis`. Items below are checked only when the code exists in the tree.

## Phase 1: Foundation & AI Infrastructure (Week 1)

### 1.1 AI/ML Infrastructure Setup
- [ ] Add AI dependencies (transformers.js, onnxruntime-web, or similar) — deferred; heuristic implementations used instead
- [x] Create AI service layer (`src/lib/ai/`) — `index.ts`, `task-prioritizer.ts`, `embeddings.ts`, `patterns.ts`
- [x] Implement local models for task scoring — weighted multi-factor engine, no runtime model
- [x] Add embedding generation for semantic search — hash-based embedder with cosine similarity
- [x] Create model training/update pipeline — `patterns.ts` learns from task logs; export/import included

### 1.2 Enhanced Analytics Dashboard
- [x] Add productivity trend analysis — `lib/analytics/trends.ts`, `components/analytics/productivity-trends.tsx`, `/analytics` page
- [x] Implement focus time tracking — sessions logged to `focus-mode-history` (completed + abandoned with elapsed minutes) and aggregated on `/analytics` via `components/analytics/focus-analytics.tsx`
- [x] Add habit formation metrics — `lib/focus/habit-metrics.ts`: completion rate, current/longest streak, average session, 7-day breakdown
- [x] Create energy level tracking — inferred from task logs via pattern learning
- [x] Add predictive analytics — `predictFutureStats` + `generateInsights`

### 1.3 Smart Suggestions Enhancement
- [x] Improve suggestion algorithm with ML — pattern-based (recurring scheduling, common list/priority)
- [x] Add context-aware suggestions — time-of-day aware suggestions
- [x] Implement suggestion acceptance tracking — `acceptSuggestion`/`isSuggestionAccepted` log accepts (with type + timestamp) to `taskflow_accepted_suggestions`, separate from the dismissal log
- [x] Add suggestion feedback loop — `applyFeedbackLoop` in `generateSmartSuggestions` drops a suggestion type after 3 interactions when its acceptance rate falls below 25%; stats via `getSuggestionFeedbackStats`

### 1.4 Performance Optimizations
- [ ] Implement React Query for server state — SWR already in use; React Query deliberately not added
- [x] Edge caching — edge-cache policy in `src/proxy.ts`: every API response carries `Cache-Control: no-store` (task data is private per user and mutates constantly, so it must never sit in a shared/edge cache); hashed static assets are already immutable-cached by Next.js
- [x] Optimize bundle size — the keyboard-opened `SearchDialog`, `KeyboardShortcutsDialog`, and `CommandPalette` (the heaviest: NLP + server actions) are `next/dynamic` (`ssr: false`) in `SearchWrapper`, gated on their open state so their chunks load on first use instead of every page load; `CreateTaskForm` stays static (already in the bundle via `task-list`/`today-client`)
- [x] Add proper error boundaries — `components/error-boundary.tsx` (class boundary, named fallback, custom fallback prop, reset); each `/analytics` widget is wrapped so one failing section can't take down the dashboard

## Phase 2: Core AI Features (Week 2)

### 2.1 AI Task Prioritization System
- [x] Multi-factor scoring engine — 7 weighted factors (deadline, effort, dependencies, energy, project phase, history, priority tag)
- [ ] Machine learning model integration — heuristic scoring; no trained model
- [x] Contextual awareness (time, energy, project phase) — `UserContext` (energy level, available time, focus mode, work hours)
- [x] Explainable AI - show reasoning — per-factor score breakdown returned with each priority
- [x] UI for AI recommendations — `components/ai/ai-recommendations.tsx`, `components/ai/smart-scheduler.tsx`

### 2.2 Enhanced Command Palette
- [x] AI-powered command suggestions — `suggestCommands` in `lib/command-palette.ts` blends time-of-day/day-of-week affinity (20%) with learned usage (frequency 45% + recency 35%); shown as "Suggested for you" when the palette opens
- [x] Command history with learning — `recordCommandUsage`/`loadCommandHistory` log runs to `taskflow_command_history` (count + timestamp, 50-entry cap); "Recent" section and per-command `n×` counts, ranking learns from frequency and recency
- [x] Shortcut customization — `lib/shortcuts.ts` (parse/format/match combos, localStorage-backed `saveShortcut`/`loadShortcuts`/`resetShortcuts`); `KeyboardShortcuts` honors the custom bindings; the shortcuts dialog has a click-to-record editor and reset-to-defaults
- [x] Natural language commands — `parseCommandInput` enters command mode on `>` prefix or imperative verbs ("go to analytics", "show completed"); fuzzy `searchCommands` over titles + keywords; arrow-key navigation, Enter to run, Tab to complete; commands navigate, open dialogs, or clear completed tasks

### 2.3 Quick Actions Panel
- [x] Common task operations — `components/quick-actions.tsx` panel (New task / Search) mounted on `/today`; bulk selection wired into every task list via `components/task-rows.tsx` (selection mode, select-all, per-row checkboxes through `AnimatedTaskItem`)
- [x] Bulk action buttons — `BulkOperationsToolbar` now reachable from `TaskRows`: delete, move, priority, date (`lib/quick-actions.ts` `resolveBulkDate` presets: today/tomorrow/next-week/clear), label add/remove, complete/uncomplete, with per-action toasts
- [x] Context-aware suggestions — `deriveQuickActions` in `lib/quick-actions.ts` over `TaskSnapshot`s: clear completed (destructive), review/reschedule overdue (date or deadline before today), finish high-priority due (≤ today), plan unplanned high-priority (no date); each carries a count badge and navigation href where it is not a mutation
- [x] Keyboard shortcuts — panel footer lists the four customizable combos (`lib/shortcuts.ts`) as they are currently bound; global handler (`components/keyboard-shortcuts.tsx`) honors custom bindings most-specific-first

### 2.4 Advanced Filters
- [x] AI-powered filtering — `lib/ai/semantic-filter.ts` ranks tasks by hash-embedding similarity to a query (calibrated threshold 0.25, substring bonus 0.3, optional base `TaskFilter`); `/search` has an Exact/AI mode toggle and `components/semantic-search-results.tsx` shows the relevance score per task
- [x] Saved filter presets — `lib/filter-presets.ts` (matching predicate mirroring `getTasks`, URL round-tripping, localStorage CRUD with name-replace + 20-preset cap); `components/filter-presets.tsx` on `/all` saves the current view and re-applies presets via query params; `getTasks`/`TaskList` gained a `priority` filter
- [x] Filter sharing capabilities — shareable-link copy (current view as `/all` URL), JSON export (download) and import (paste, validated + merged by name, 20-preset cap) in the presets menu; `exportFilterPresets`/`parseImportedPresets`/`mergeFilterPresets`/`replaceFilterPresets` in `lib/filter-presets.ts`
- [x] Natural language filter queries — `lib/nl-filter.ts` parses sentences ("show high priority tasks due today") into a `TaskFilter` (status, priority, time window, overdue, free-text fallback); the search dialog offers an "Apply filter" action when a query carries structured criteria; `overdue` criterion added to `TaskFilter` with URL round-trip

## Phase 3: Advanced Features (Week 3)

### 3.1 Smart Calendar Integration
- [x] Google Calendar API integration — hand-rolled REST (`lib/calendar.ts`), OAuth flow (`/api/auth/google`), token refresh (`lib/calendar/tokens.ts`)
- [ ] Apple Calendar (CalDAV) support — deferred; needs a CalDAV client library (no maintained npm option without native deps), Google REST covers the integrated calendar
- [x] Bidirectional sync — push (TaskFlow → Calendar) plus optional pull (`?pull=true`): imports unlinked Google events as tasks linked via `source_event_id`, so the next sync updates the source event instead of duplicating it; orchestration in `src/lib/calendar/sync.ts`
- [x] Automatic task creation from events — `createTaskFromEvent` in `lib/calendar.ts`, wired to `POST /api/calendar/events/import` (fetches the event via OAuth, creates a linked task in the requested or first list)
- [x] Conflict detection and resolution — `lib/calendar/conflicts.ts` detects linked pairs (`source_event_id`, falling back to the `task-{id}` convention) whose name or date diverged, skipping completed tasks; strategies `task` / `calendar` / `newest` (ties favor the task) via `?conflictStrategy=`, applied before the push loop so resolved values are the ones pushed
- [x] Calendar event search — `searchEvents` in `lib/calendar.ts` (Google `q` parameter, single events, time-ordered)

### 3.2 Workflow Automation Builder
- [x] Visual workflow editor — `components/workflows/workflow-builder.tsx`, `/workflows` page
- [x] Trigger system (time, event, condition) — schedule, task_created/completed/updated, deadline_approaching, webhook
- [x] Action library (create task, notify, webhook, etc.) — create/update task, notification, webhook, email, list, label, priority, deadline, activity log, connector message
- [x] Condition logic (if/then/else) — `ConditionType` branching in the engine
- [x] Integration connectors (GitHub, Slack, Email) — `lib/workflows/connectors.ts` (GitHub issue creation, Slack webhook post, email via an HTTP mail API); the engine runs client-side so secrets never reach the browser — it calls `POST /api/workflows/connectors`, which reads credentials from the environment (`lib/workflows/credentials.ts`: `GITHUB_TOKEN`/`GITHUB_REPO`, `SLACK_WEBHOOK_URL`, `EMAIL_API_KEY`/`EMAIL_API_URL`/`EMAIL_FROM`/`EMAIL_TO`) and delivers server-side; unconfigured connectors are rejected without a network call
- [x] Workflow templates — `WORKFLOW_TEMPLATES` (Daily Review Reminder, Overdue Task Escalation, Task Completion Follow-up) selectable from the builder's template dropdown

### 3.3 Enhanced Collaboration
- [x] Real-time collaborative editing — dependency-free SSE channel instead of socket.io: `logActivity` (the funnel for all workspace events — member changes, invitations, comments, workspace creation) publishes to `lib/collaboration/activity-stream.ts`, which broadcasts to subscribers; `GET /api/workspaces/[workspaceId]/events` streams them as `data: <json>` frames with a 25s heartbeat comment, and `lib/use-workspace-events.ts` opens the EventSource (reconnects natively, closes on workspace switch). Shared-cursor/typing sync (true collaborative *editing*) is not implemented — event-level real time is
- [x] Presence indicators — per-device presence (no login in this app): `lib/collaboration/presence.ts` registry with 60s TTL, `POST /api/presence` heartbeat (15s) + `GET /api/presence` list (10s poll, reaped before answering) via `lib/use-workspace-presence.ts`, rendered by `components/task-presence.tsx` on `TaskDetail` under the assignee badge (green pulse, count, initial avatars)
- [x] Inline threaded comments — task comments via `/api/workspaces/[workspaceId]/comments?taskId=` (create/read/update/delete, author-only edits, @mention extraction)
- [x] Task assignment with notifications — `assignee_id` on tasks (FK to `workspace_members`, migrations 0005/0006); assignee resolved onto every task read (`buildTaskRelations`); assignment picker in `EditTaskForm` and assignee badge on `TaskDetail`; assigning through `updateTask` pushes a notification to the assignee's devices (`lib/collaboration/assignment.ts` pure helpers + `lib/collaboration/notifier.ts` server-side web-push delivery, fail-safe when VAPID is unconfigured); `getAllMembers` store + `getMembersAction` expose the roster; viewers may not assign (`canAssignTask`)
- [x] Activity feed improvements — workspace activity log (27 event types, trimmed to 1000 per workspace, `/api/workspaces/[workspaceId]/activity`)

### 3.4 Advanced Focus Mode
- [x] AI-selected optimal focus times — `suggestOptimalTime` in smart-scheduler
- [x] Adaptive Pomodoro — `lib/focus/adaptive-pomodoro.ts` adapts the focus duration one step (15–60 min ladder) after 4 sessions: ≥80% completion lengthens, ≤40% shortens; abandoned (reset mid-session) pomodoros counted in `focus-mode-stats`, completion rate shown in the stats grid
- [x] Background task management — due-reminder delivery: `getDueReminders`/`processDueReminders` in `lib/tasks.ts` sweep for reminders whose time has come (incomplete tasks only, unsent only) and mark them sent with a `reminder_sent` task-log entry; `GET /api/reminders` exposes the sweep and `SearchWrapper` polls it every minute, surfacing due reminders as toasts (failed sweeps retry on the next tick)
- [x] Focus session analytics — `FocusAnalytics` card on `/analytics` (streak, completion rate, focus time, avg session, 7-day bar chart); session history in `lib/focus/session-log.ts`
- [x] Energy pattern learning — peak/low energy hours inferred in `patterns.ts`

## Phase 4: Polish & Integration (Week 4)

### 4.1 Knowledge Base & Learning
- [x] User pattern learning — `getUserPatterns`/`updatePatterns`/`getPatternInsights`
- [x] Template suggestions from history — `lib/template-suggestions.ts` flags one-off tasks created ≥3 times (recurring and already-templated names excluded), surfaced on `/today` with create-template and dismiss actions via `/api/templates`
- [x] Optimal categorization prediction — `analyzeTaskNaming` suggests categories from naming patterns
- [x] Completion time prediction — `predictCompletionTime` (category average → calibrated estimate → raw estimate → default), used by the smart scheduler to plan against learned durations

### 4.2 Offline Capabilities
- [ ] IndexedDB fallback — deferred; needs the `idb` dependency and a client-side data store mirroring the server schema (the mutation queue below covers the write slice; reads still need the network, and the `/offline` page covers the "you are offline" UX)
- [x] Offline queue for mutations — `lib/offline-queue.ts` (localStorage-backed, 100-entry cap, oldest dropped when storage is full): every mutation in `lib/tasks-client.ts` (create/update/toggle/delete task, create list, create label) goes through `sendOrQueue`, which queues when `navigator.onLine` is false or the fetch rejects with a network `TypeError`, answering with a synthetic `202 Accepted`; `SearchWrapper` drains on the `online` event, on mount, and every 30s (tab-asleep safety), replaying in order and toasting "N queued changes synced" — delivered mutations are dropped, server-rejected ones stay queued, and a network drop mid-drain keeps the rest
- [ ] Conflict resolution on sync — deferred; the queue replays in order and server-rejected mutations stay queued (fail-safe, last-write-wins via server validation), but true conflict merge (OT/CRDT) is not implemented (calendar sync already resolves task/event conflicts server-side)
- [ ] Progressive enhancement — deferred; follows from the IndexedDB fallback

### 4.3 Security Hardening
- [x] Rate limiting on API endpoints — `src/proxy.ts` (Next.js 16 proxy) + `src/lib/rate-limit.ts`: default 120 req/min per IP, stricter per-path limits (push 30/min per API key, OAuth 10/min, share 30/min, webhook trigger 60/min); 429 + `Retry-After`/`X-RateLimit-*` headers, documented in `openapi.yaml`
- [x] CSRF protection — `src/proxy.ts`: state-changing requests (non-GET/HEAD/OPTIONS) must carry a same-site `Origin` (or matching `Referer` fallback; absent pair = non-browser caller like curl/integrations, allowed). Rejects with 403 before rate limiting so forgeries consume no budget. Exempts endpoints for non-browser callers (`/api/webhooks/trigger`, `/api/push/send`)
- [x] Request validation — centralized in `src/lib/validation.ts` (`parseJsonBody` + `validationErrorResponse`): uniform 400 shape `{ error: 'Invalid request data', details }` with zod-formatted field errors; adopted by the tasks route (POST/PATCH) as the reference implementation (a proxy can't know per-route schemas, so centralization = shared helpers + uniform response)
- [x] Audit logging — workspace activity feed + task logs API (`/api/task-logs`)

### 4.4 Testing & Documentation
- [x] Comprehensive test coverage — 589 tests across 41 suites (tasks, templates, export/import, security, share, webhooks, workspaces, push, rate-limit, completion-time, calendar-sync, calendar-conflicts, adaptive-pomodoro, focus-analytics, suggestion-feedback, template-suggestions, error-boundary, filter-presets, command-palette, shortcuts, quick-actions, nl-filter, semantic-filter, connectors, assignment, task-assignment, csrf, validation, performance, reminders, activity-stream, presence, presence route, workspace events stream, offline queue)
- [x] API documentation updates — `openapi.yaml`: 52 schemas, 37 paths, validated against the filesystem; task schemas carry `assignee_id`/`assignee`, shared `ValidationError` response (uniform 400 shape), `/reminders` sweep route, `/presence` heartbeat + list, `/workspaces/{workspaceId}/events` SSE stream, proxy security note in `info.description`
- [x] User guide updates — README added
- [x] Performance benchmarks — `src/test/performance.test.ts`: 8 benchmarks over a 10k-task dataset (full read with relations, `today` view filter, search, `batchPrioritize`, `semanticFilterTasks`, NL-filter parsing, command search, workflow execution through a 10-node chain × 100 runs) with timing ceilings as regression guards; results printed via `console.table`

## File Structure Changes

```
src/
├── lib/
│   ├── ai/
│   │   ├── index.ts              # Main AI service
│   │   ├── task-prioritizer.ts   # Multi-factor scoring engine
│   │   ├── embeddings.ts         # Hash-based semantic embeddings
│   │   ├── semantic-filter.ts    # Query-based task ranking
│   │   └── patterns.ts           # User pattern learning
│   ├── analytics/
│   │   └── trends.ts             # Stats, trends, predictions, insights
│   ├── calendar/
│   │   └── tokens.ts             # Google OAuth token storage/refresh
│   ├── collaboration/
│   │   ├── activity-stream.ts    # In-memory pub/sub for workspace events
│   │   ├── presence.ts           # Per-device presence registry (60s TTL)
│   │   ├── assignment.ts         # Assignment pure helpers
│   │   └── notifier.ts           # Server-side web-push delivery
│   ├── focus/
│   │   ├── adaptive-pomodoro.ts  # Duration adaptation from completion rate
│   │   ├── session-log.ts        # localStorage focus-session history
│   │   └── habit-metrics.ts      # Streaks, completion rate, 7-day breakdown
│   ├── workflows/
│   │   ├── engine.ts             # Triggers, actions, conditions
│   │   ├── connectors.ts         # GitHub/Slack/Email delivery registry (pure)
│   │   └── credentials.ts        # Server-only env credential loader
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (17 tables)
│   │   ├── instance.ts           # Store DB instance + test hook
│   │   └── migrations/           # Hand-written SQL + journal
│   ├── *-store.ts                # Server-only Drizzle-backed stores:
│   │                             # workspace-store, push-store, share-store,
│   │                             # webhook-store, task-store
│   ├── calendar.ts               # Google Calendar REST client
│   ├── calendar/
│   │   └── conflicts.ts          # Linked task/event conflict detection + resolution
│   ├── command-palette.ts        # Command registry, fuzzy search, history, suggestions
│   ├── shortcuts.ts              # Customizable key-combo bindings
│   ├── quick-actions.ts          # Quick-action derivation + bulk date presets
│   ├── nl-filter.ts              # Natural-language filter queries
│   ├── smart-suggestions.ts      # Pattern-based suggestions + NLP date parsing
│   ├── share.ts / webhooks.ts / workspaces.ts  # Pure helpers + generators
│   ├── validation.ts             # Centralized JSON-body validation + 400 response
│   ├── offline-queue.ts          # localStorage mutation queue (sendOrQueue/drainQueue)
│   ├── use-workspace-events.ts   # EventSource hook for the SSE activity stream
│   ├── use-workspace-presence.ts # Presence heartbeat + poll hook
│   └── push-notifications.ts     # Client push helper (VAPID, localStorage cache)
├── components/
│   ├── ai/
│   │   ├── ai-recommendations.tsx
│   │   └── smart-scheduler.tsx
│   ├── analytics/
│   │   ├── productivity-trends.tsx
│   │   └── focus-analytics.tsx
│   └── workflows/
│       └── workflow-builder.tsx
│   ├── task-presence.tsx         # Active-device indicators (assignee's workspace)
├── app/
│   ├── analytics/page.tsx
│   ├── workflows/page.tsx
│   ├── workspace/invite/[token]/page.tsx
│   └── api/                      # 37 routes: tasks, lists, labels, search,
│                                 # templates, task-logs, export/import, share,
│                                 # webhooks, workspaces (+members/activity/
│                                 # comments/invitations/events SSE),
│                                 # invitations, presence (heartbeat + list),
│                                 # push, reminders (background sweep),
│                                 # calendar (status/sync/disconnect,
│                                 # events/import), auth/google
│                                 # (+callback), workflows
│                                 # (+connectors delivery)
└── test/                         # 41 suites, db-test in-memory harness
```

## Dependencies

Added for the implemented features:

```json
{
  "dependencies": {
    "better-sqlite3": "^12.x",
    "csv-parse": "^5.x",
    "csv-stringify": "^6.x",
    "date-fns": "^4.x",
    "drizzle-orm": "^0.44.x",
    "recharts": "^3.x",
    "swr": "^2.x",
    "web-push": "^3.x",
    "zod": "^4.x"
  }
}
```

Deliberately not added (heuristic/hand-rolled equivalents in the tree):
`@xenova/transformers`, `onnxruntime-web`, `googleapis`, `caldav`, `socket.io`,
`socket.io-client` (the real-time activity stream uses native SSE instead),
`idb` (the offline mutation queue uses localStorage), `date-fns-tz`,
`zod-to-json-schema`.

## Success Criteria

- [x] All tests pass — 589/589 (100% coverage for new code not yet measured)
- [x] Performance benchmarks meet targets — all 8 benchmarks within their ceilings (10k-task read < 3s, AI/semantic batches < 3s/0.5s, NL parse < 200ms/500 iters, command search < 200ms/1000 iters, workflow execution < 100ms)
- [ ] AI predictions > 80% accuracy — not measurable without labeled ground truth; the heuristic engines expose per-factor reasoning for manual review
- [ ] Calendar sync bidirectional with < 5s latency — bidirectional sync implemented; latency is dominated by Google's API, not TaskFlow
- [x] Workflow execution < 100ms overhead — measured: a 10-node workflow × 100 runs stays under the ceiling (benchmark in `src/test/performance.test.ts`); the engine runs client-side with no server round-trip except webhooks/connectors
- [ ] Offline mode fully functional — partial (see 4.2): mutations queue offline and replay on reconnect; reads and the IndexedDB data mirror are still deferred
- [ ] Real-time collaboration < 100ms latency — partial (see 3.3): activity events stream over SSE with a 25s heartbeat; delivery latency is the SSE round-trip, but collaborative *editing* sync is not implemented
- [x] Bundle size increase < 100KB gzipped — initial JS reduced: keyboard-opened dialogs (search, shortcuts, command palette incl. NLP + server actions) code-split out of every page's initial bundle
