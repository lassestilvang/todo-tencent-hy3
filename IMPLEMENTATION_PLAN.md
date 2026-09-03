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
- [ ] Add edge caching
- [ ] Optimize bundle size
- [x] Add proper error boundaries — `components/error-boundary.tsx` (class boundary, named fallback, custom fallback prop, reset); each `/analytics` widget is wrapped so one failing section can't take down the dashboard

## Phase 2: Core AI Features (Week 2)

### 2.1 AI Task Prioritization System
- [x] Multi-factor scoring engine — 7 weighted factors (deadline, effort, dependencies, energy, project phase, history, priority tag)
- [ ] Machine learning model integration — heuristic scoring; no trained model
- [x] Contextual awareness (time, energy, project phase) — `UserContext` (energy level, available time, focus mode, work hours)
- [x] Explainable AI - show reasoning — per-factor score breakdown returned with each priority
- [x] UI for AI recommendations — `components/ai/ai-recommendations.tsx`, `components/ai/smart-scheduler.tsx`

### 2.2 Enhanced Command Palette
- [ ] AI-powered command suggestions
- [ ] Command history with learning
- [ ] Shortcut customization
- [ ] Natural language commands

### 2.3 Quick Actions Panel
- [ ] Common task operations
- [ ] Bulk action buttons
- [ ] Context-aware suggestions
- [ ] Keyboard shortcuts

### 2.4 Advanced Filters
- [ ] AI-powered filtering
- [ ] Saved filter presets
- [ ] Filter sharing capabilities
- [ ] Natural language filter queries

## Phase 3: Advanced Features (Week 3)

### 3.1 Smart Calendar Integration
- [x] Google Calendar API integration — hand-rolled REST (`lib/calendar.ts`), OAuth flow (`/api/auth/google`), token refresh (`lib/calendar/tokens.ts`)
- [ ] Apple Calendar (CalDAV) support
- [x] Bidirectional sync — push (TaskFlow → Calendar) plus optional pull (`?pull=true`): imports unlinked Google events as tasks linked via `source_event_id`, so the next sync updates the source event instead of duplicating it; orchestration in `src/lib/calendar/sync.ts`
- [ ] Automatic task creation from events — helper exists, not wired
- [ ] Conflict detection and resolution
- [ ] Calendar event search

### 3.2 Workflow Automation Builder
- [x] Visual workflow editor — `components/workflows/workflow-builder.tsx`, `/workflows` page
- [x] Trigger system (time, event, condition) — schedule, task_created/completed/updated, deadline_approaching, webhook
- [x] Action library (create task, notify, webhook, etc.) — create/update task, notification, webhook, email, list, label, priority, deadline, activity log
- [x] Condition logic (if/then/else) — `ConditionType` branching in the engine
- [ ] Integration connectors (GitHub, Slack, Email) — generic webhook action only
- [ ] Workflow templates

### 3.3 Enhanced Collaboration
- [ ] Real-time collaborative editing — requires socket.io; not implemented
- [ ] Presence indicators
- [x] Inline threaded comments — task comments via `/api/workspaces/[workspaceId]/comments?taskId=` (create/read/update/delete, author-only edits, @mention extraction)
- [ ] Task assignment with notifications — workspace roles/invitations exist; no per-task assignment
- [x] Activity feed improvements — workspace activity log (27 event types, trimmed to 1000 per workspace, `/api/workspaces/[workspaceId]/activity`)

### 3.4 Advanced Focus Mode
- [x] AI-selected optimal focus times — `suggestOptimalTime` in smart-scheduler
- [x] Adaptive Pomodoro — `lib/focus/adaptive-pomodoro.ts` adapts the focus duration one step (15–60 min ladder) after 4 sessions: ≥80% completion lengthens, ≤40% shortens; abandoned (reset mid-session) pomodoros counted in `focus-mode-stats`, completion rate shown in the stats grid
- [ ] Background task management
- [x] Focus session analytics — `FocusAnalytics` card on `/analytics` (streak, completion rate, focus time, avg session, 7-day bar chart); session history in `lib/focus/session-log.ts`
- [x] Energy pattern learning — peak/low energy hours inferred in `patterns.ts`

## Phase 4: Polish & Integration (Week 4)

### 4.1 Knowledge Base & Learning
- [x] User pattern learning — `getUserPatterns`/`updatePatterns`/`getPatternInsights`
- [x] Template suggestions from history — `lib/template-suggestions.ts` flags one-off tasks created ≥3 times (recurring and already-templated names excluded), surfaced on `/today` with create-template and dismiss actions via `/api/templates`
- [x] Optimal categorization prediction — `analyzeTaskNaming` suggests categories from naming patterns
- [x] Completion time prediction — `predictCompletionTime` (category average → calibrated estimate → raw estimate → default), used by the smart scheduler to plan against learned durations

### 4.2 Offline Capabilities
- [ ] IndexedDB fallback
- [ ] Offline queue for mutations
- [ ] Conflict resolution on sync
- [ ] Progressive enhancement

### 4.3 Security Hardening
- [x] Rate limiting on API endpoints — `src/proxy.ts` (Next.js 16 proxy) + `src/lib/rate-limit.ts`: default 120 req/min per IP, stricter per-path limits (push 30/min per API key, OAuth 10/min, share 30/min, webhook trigger 60/min); 429 + `Retry-After`/`X-RateLimit-*` headers, documented in `openapi.yaml`
- [ ] CSRF protection
- [ ] Request validation middleware — routes validate input individually (400 responses); no centralized middleware
- [x] Audit logging — workspace activity feed + task logs API (`/api/task-logs`)

### 4.4 Testing & Documentation
- [x] Comprehensive test coverage — 314 tests across 22 suites (tasks, templates, export/import, security, share, webhooks, workspaces, push, rate-limit, completion-time, calendar-sync, adaptive-pomodoro, focus-analytics, suggestion-feedback, template-suggestions, error-boundary)
- [x] API documentation updates — `openapi.yaml`: 52 schemas, 34 paths, validated against the filesystem
- [x] User guide updates — README added
- [ ] Performance benchmarks

## File Structure Changes

```
src/
├── lib/
│   ├── ai/
│   │   ├── index.ts              # Main AI service
│   │   ├── task-prioritizer.ts   # Multi-factor scoring engine
│   │   ├── embeddings.ts         # Hash-based semantic embeddings
│   │   └── patterns.ts           # User pattern learning
│   ├── analytics/
│   │   └── trends.ts             # Stats, trends, predictions, insights
│   ├── calendar/
│   │   └── tokens.ts             # Google OAuth token storage/refresh
│   ├── focus/
│   │   ├── adaptive-pomodoro.ts  # Duration adaptation from completion rate
│   │   ├── session-log.ts        # localStorage focus-session history
│   │   └── habit-metrics.ts      # Streaks, completion rate, 7-day breakdown
│   ├── workflows/
│   │   └── engine.ts             # Triggers, actions, conditions
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (17 tables)
│   │   ├── instance.ts           # Store DB instance + test hook
│   │   └── migrations/           # Hand-written SQL + journal
│   ├── *-store.ts                # Server-only Drizzle-backed stores:
│   │                             # workspace-store, push-store, share-store,
│   │                             # webhook-store, task-store
│   ├── calendar.ts               # Google Calendar REST client
│   ├── smart-suggestions.ts      # Pattern-based suggestions + NLP date parsing
│   ├── share.ts / webhooks.ts / workspaces.ts  # Pure helpers + generators
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
├── app/
│   ├── analytics/page.tsx
│   ├── workflows/page.tsx
│   ├── workspace/invite/[token]/page.tsx
│   └── api/                      # 34 routes: tasks, lists, labels, search,
│                                 # templates, task-logs, export/import, share,
│                                 # webhooks, workspaces (+members/activity/
│                                 # comments/invitations), invitations, push,
│                                 # calendar (status/sync/disconnect),
│                                 # auth/google (+callback), workflows
└── test/                         # 13 suites, db-test in-memory harness
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
`socket.io-client`, `idb`, `date-fns-tz`, `zod-to-json-schema`.

## Success Criteria

- [x] All tests pass — 314/314 (100% coverage for new code not yet measured)
- [ ] Performance benchmarks meet targets
- [ ] AI predictions > 80% accuracy
- [ ] Calendar sync bidirectional with < 5s latency
- [ ] Workflow execution < 100ms overhead
- [ ] Offline mode fully functional
- [ ] Real-time collaboration < 100ms latency
- [ ] Bundle size increase < 100KB gzipped
