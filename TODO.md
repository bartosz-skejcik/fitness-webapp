# Android App — Development Todo List

> **Last updated: 2026-02-19**
> Screens built so far (Login, Dashboard, Workout History, Start Workout, Active Workout Session) were created before DATA_OPERATIONS_V2 existed. They need their data layer retrofitted to match the architecture in the doc. New screens should be built to spec from the start.

---

## Phase 1 — Foundation (Do Before Touching Any Screen)

These don't belong to any single screen — they're the shared infrastructure everything else depends on. Without this in place first, retrofitting screens will be inconsistent and require rework.

- [ ] **Hilt DI modules** — `DatabaseModule`, `NetworkModule`, `RepositoryModule` (Section 4)
- [ ] **Room database** (`FitnessDatabase`) with all entities and DAOs (Section 6)
  - `WorkoutSessionEntity`, `ExerciseLogEntity`, `SetLogEntity`
  - `ExerciseEntity`, `ExerciseBodyPartEntity`
  - `WorkoutTemplateEntity`, `WorkoutTemplateExerciseEntity`
  - `FriendshipEntity`, `UserProfileEntity`, `BodyPartGoalEntity`
- [ ] **Supabase client** configured with Auth + Postgrest + Realtime (Section 5)
- [ ] **`NetworkMonitor`** utility (Section 4)
- [ ] **Base repository sync pattern** — Room as source of truth, background Supabase sync (Section 5)
- [ ] **Domain models** — Kotlin data classes in `domain/model/` (Section 4)
- [ ] **Mappers** — entity to domain model in `data/mapper/`

---

## Phase 2 — Retrofit Existing Screens

These screens already exist visually but were likely built with direct Supabase calls and no local cache. Each needs its data layer replaced per the doc — the UI can stay as-is.

### 1. Auth / Login (Section 7)
- [ ] `AuthRepository` — `observeAuthState()` as `Flow<AuthState>`, `signInWithGoogle()`, `signOut()`
- [ ] `AuthViewModel` — `authState: StateFlow<AuthState>`
- [ ] `AppNavGraph` observes `authState` and drives navigation (no manual nav in screen)
- [ ] Replace any direct Supabase auth calls in the screen with ViewModel calls

### 2. Home Dashboard (Section 8)
Currently: probably multiple direct Supabase queries. Target: 1 RPC + 2 queries, Room-cached.

- [ ] `DashboardRepository` — calls RPC `get_dashboard_stats(userId)` (1 call, not 9)
- [ ] `WorkoutSessionRepository.getRecentSessions()` — Room Flow + background sync, limit 5 rows
- [ ] `WorkoutTemplateRepository.getTemplates()` — Room Flow + background sync
- [ ] `DashboardViewModel` — parallel `async {}` for all 3, single `DashboardUiState` StateFlow
- [ ] Wire Dashboard screen to ViewModel — remove any direct Supabase calls from screen/composable
- [ ] Verify: navigating away and back shows instant data (Room cache), no re-fetch spinner

### 3. Workout History (Section 8 / 13)
Currently: probably fetches all sessions. Target: paginated, Room-cached.

- [ ] `WorkoutSessionRepository` — Room Flow as source of truth, date-windowed query, background sync
- [ ] History screen observes `sessionRepo.getRecentSessions()` Flow
- [ ] Paginate or date-filter — don't fetch ALL sessions (web mistake)
- [ ] Verify: history loads instantly on revisit

### 4. Start New Workout (Section 12)
Currently: probably fetches templates + exercises from Supabase on load. Target: 0 network calls on load.

- [ ] Screen loads templates and exercises from Room (instant, already cached by Phase 1 sync)
- [ ] Exercise recommendations computed locally from Room — no Supabase call
- [ ] `startWorkout()`: batch INSERT to Supabase (session + exercise_logs + set_logs) AND Room simultaneously
- [ ] Verify: screen loads with no network spinner when Room is warm

### 5. Active Workout Session (Section 13)
This is the highest-risk screen for data loss. Most important to get right.

- [ ] Full workout tree loaded from Room `@Transaction` query — zero network on load (`SessionWithExercisesAndSets`)
- [ ] `get_previous_workout_sets()` RPC called once for all exercises in parallel with Room load (not N calls)
- [ ] Per-set save: Room FIRST (instant, survives process death), then Supabase fire-and-forget
- [ ] `pending_sync` flag on `SetLogEntity` — set when Supabase write fails or device is offline
- [ ] Exercise navigation is purely local `StateFlow<Int>` — zero queries on swipe
- [ ] Workout completion: Room UPDATE then Supabase UPDATE (DB trigger auto-refreshes materialized view) then refresh local analytics cache
- [ ] Workout cancellation: Room cascade delete + Supabase manual cascade (3 queries)
- [ ] Historical workout view: same Room `@Transaction` query, sets are read-only

---

## Phase 3 — New Screens (Build Fresh to Spec)

These don't exist yet. Build them following the doc from the start.

### 6. Exercises Management (Section 14)
Unblocks Templates screens below.

- [ ] `ExercisesViewModel` + `ExercisesScreen`
- [ ] List from `exerciseDao.getExercisesWithBodyParts(userId)` Room Flow (instant)
- [ ] In-memory search/filter from Flow — no query per keystroke
- [ ] Create: INSERT Supabase + Room
- [ ] Edit: differential update on `exercise_body_parts` (targeted INSERT/DELETE, not DELETE ALL)
- [ ] Delete: Room first (instant UI via Flow) + Supabase background

### 7. Workout Templates List (Section 9)
Depends on: #6 Exercises

- [ ] `TemplatesViewModel` observes `templateDao` Room Flow + background sync
- [ ] Delete: Room delete (instant) + background Supabase delete
- [ ] Navigate to Template Detail on tap

### 8. Workout Template Detail / Edit (Section 10)
Depends on: #6 Exercises, #7 Templates List

- [ ] Load template + exercises via Room `@Relation` (`@Transaction` query)
- [ ] Load exercise picker from Room
- [ ] Check shared status: single Supabase query
- [ ] Edit save — differential update (not DELETE ALL + INSERT ALL):
  - Compute `toDelete`, `toInsert`, `toUpdate`
  - Targeted Supabase operations
  - Update Room locally, no re-fetch
- [ ] Share/unshare toggle: INSERT/DELETE `shared_workout_templates`

### 9. Create New Workout Template (Section 11)
Depends on: #6 Exercises

- [ ] All data from Room (0 network on load)
- [ ] Exercise suggestions: local Room SQL query (frequency by workout type)
- [ ] Build template in local ViewModel state
- [ ] Save: INSERT template, get ID, batch INSERT exercises, update Room, navigate back

---

## Phase 4 — Social Features

### 10. Friends Screen (Section 15)
- [ ] 2 queries on load (not 4): single `friendships` query with `.or()` + one `user_profiles` batch query
- [ ] Client-side partition: accepted / pendingReceived / pendingSent
- [ ] Optimistic mutations — update local StateFlow immediately, no re-fetch after each action
- [ ] Supabase Realtime channel for incoming friend request push updates

### 11. Friend Progress Comparison (Section 16)
Depends on: #10 Friends

- [ ] 2 parallel calls: `user_profiles` for friend + RPC `get_comparison_stats()`
- [ ] Period selector re-calls RPC with new `p_days` — no full page reload

### 12. Shared Workout Templates (Section 17)
- [ ] Query `shared_templates_with_details` VIEW
- [ ] Copy: RPC `copy_shared_workout_template()`, upsert to Room, navigate to Template Detail

---

## Phase 5 — Analytics

### 13. Analytics Infrastructure (Section 18)
Must be done before any analytics tab.

- [ ] `AnalyticsRepository.getAnalyticsBaseData()` — 3 parallel queries, cached in Room
- [ ] `AnalyticsViewModel` with shared `baseData` MutableStateFlow and lazy per-tab StateFlows (`SharingStarted.Lazily`)
- [ ] `domain/util/` utilities: `VolumeCalculator`, `ImbalanceDetector`, `EpleyOneRepMax`, `StreakCalculator` (offline fallback only)
- [ ] `AnalyticsScreen` shell with `ScrollableTabRow` + `rememberSaveable` tab index

### 14-21. Analytics Tabs (Section 18)
Each depends on #13 infrastructure. Can be done in any order.

- [ ] General Stats tab
- [ ] Strength Stats tab
- [ ] Trends tab
- [ ] Goals tab — RPC `calculate_all_goal_progress()` + CRUD for `body_part_goals`
- [ ] Body Parts tab
- [ ] Symmetry tab
- [ ] Injury Risk tab
- [ ] Periodization tab

---

## Phase 6 — Offline Hardening & Polish

- [ ] `WorkManager` `SyncWorker`: sync `pending_sync` sets + refresh stale analytics cache on network reconnect (Section 6)
- [ ] Enqueue `SyncWorker` on app start and connectivity change
- [ ] Stale data indicators ("last synced X min ago")
- [ ] Global error handling — ViewModel `SharedFlow<UiError>` to snackbar
- [ ] Retry logic with exponential backoff in repositories
- [ ] Loading skeletons / shimmer on cold first load
- [ ] Empty states on all list screens
- [ ] Animations and transitions
- [ ] ProGuard / R8 rules, Crashlytics, Play Store prep

---

## Dependency Map

```
Phase 1 (Foundation) — must come first
    └── Phase 2 (Retrofit existing screens)
    └── Phase 3 (New screens)

Exercises (#6)
    ├── Templates List (#7)
    │       └── Template Detail/Edit (#8)
    └── Create Template (#9)

Friends (#10)
    ├── Comparison (#11)
    └── Shared Templates (#12)

Analytics Infrastructure (#13)
    └── All tabs (#14-21) — any order
```
