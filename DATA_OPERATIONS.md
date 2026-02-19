# Fitness Webapp — Data Operations & Flow Document

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Layer & Backend](#2-data-layer--backend)
3. [State Management & Caching](#3-state-management--caching)
4. [Scenario: Home Page (Dashboard)](#4-scenario-home-page-dashboard)
5. [Scenario: Workout Templates List Page](#5-scenario-workout-templates-list-page)
6. [Scenario: Workout Template Detail/Edit Page](#6-scenario-workout-template-detailedit-page)
7. [Scenario: Creating a New Workout Template](#7-scenario-creating-a-new-workout-template)
8. [Scenario: Starting a New Workout](#8-scenario-starting-a-new-workout)
9. [Scenario: Active Workout Session](#9-scenario-active-workout-session-and-viewing-completed-workouts)
10. [Scenario: Exercises Management Page](#10-scenario-exercises-management-page)
11. [Scenario: Friends Page](#11-scenario-friends-page)
12. [Scenario: Friend Progress Comparison](#12-scenario-friend-progress-comparison)
13. [Scenario: Shared Workout Templates](#13-scenario-shared-workout-templates)
14. [Scenario: Analytics/Progress Page](#14-scenario-analyticsprogress-page)
15. [Navigation Between Exercises (Summary)](#15-navigation-between-exercises-summary)
16. [Optimizations Summary](#16-optimizations-summary)
17. [Appendix: Data Flow Diagrams](#appendix-data-flow-diagrams)

---

## 1. Architecture Overview

| Layer         | Technology                                                                            |
| ------------- | ------------------------------------------------------------------------------------- |
| Frontend      | Next.js (App Router), React, TypeScript                                               |
| UI            | Tailwind CSS, Lucide icons                                                            |
| State         | React `useState` / `useEffect`, custom hooks, React Context (auth via `AuthProvider`) |
| Backend / DB  | Supabase (PostgreSQL via `@supabase/supabase-js`)                                     |
| Auth          | Supabase Auth (OAuth — Google & Discord, cookie-based sessions via `@supabase/ssr`)   |
| Data Fetching | Direct Supabase browser-client calls inside `useEffect` (no SWR/React-Query)          |
| Charts        | Recharts                                                                              |

### Important: All pages are Client Components

The app uses `"use client"` on **every page**. There are **no Server Components** fetching data. Authentication and data fetching happen entirely on the client side via the `AuthProvider` context and `useEffect` hooks. The only server-side route is the OAuth callback (`/auth/callback/route.ts`).

### Supabase Client Variants

There are **three** Supabase client factories:

| Factory           | File                             | Usage                                                                                                                                                             |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createClient()`  | `src/lib/supabase/client.ts`     | Browser-side (`createBrowserClient`). Used by all client components and the `AuthProvider`. Primary data-fetching client.                                         |
| `createClient()`  | `src/lib/supabase/server.ts`     | Server-side, per-request (`createServerClient`). Reads/writes cookies from `next/headers`. **Only used in the OAuth callback route** (`/auth/callback/route.ts`). |
| `updateSession()` | `src/lib/supabase/middleware.ts` | Middleware-level. Refreshes auth session on every request, syncs cookies.                                                                                         |

### Middleware (`src/middleware.ts`)

Every request (excluding `_next/static`, `_next/image`, `favicon.ico`, and static assets like `.svg`, `.png`, etc.) passes through middleware that:

1. Creates a Supabase server client bound to the request/response cookies.
2. Calls `supabase.auth.getUser()` — this **refreshes the session token** if expired.
3. Forwards the (possibly updated) cookies in the response.

This is a **session-keep-alive optimization** — it guarantees that auth tokens stay fresh without explicit client-side refresh logic.

### Global Auth Context (`AuthProvider` in `src/contexts/AuthContext.tsx`)

Wraps the entire app via `layout.tsx`. On mount:

1. Calls `supabase.auth.getSession()` → sets `user` state, sets `loading = false`.
2. Subscribes to `supabase.auth.onAuthStateChange()` — reacts to sign-in, sign-out, token refresh events.
3. Provides `user`, `loading`, `signInWithGoogle`, `signInWithDiscord`, `signOut` to all children via context.

Every page consumes `useAuth()` to get the current user without re-querying Supabase auth. The `user` object (from Supabase `auth.users`) includes `user_metadata` with `full_name` and `avatar_url` from the OAuth provider.

---

## 2. Data Layer & Backend

### Database Tables (from TypeScript types and queries)

The database uses a **normalized relational schema** (not JSONB). Workout data is spread across multiple linked tables:

| Table                        | Key Columns                                                                                                                   | Purpose                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `auth.users`                 | `id`, `email`, `user_metadata (jsonb)`                                                                                        | Supabase-managed auth. `user_metadata` stores OAuth profile (full_name, avatar_url).                            |
| `exercises`                  | `id`, `user_id`, `name`, `description`, `muscle_group`, `target_body_part`, `is_unilateral`, `created_at`                     | Exercise catalog (user-scoped). Each user has their own exercises.                                              |
| `exercise_body_parts`        | `id`, `exercise_id`, `body_part`, `is_primary`                                                                                | Junction table: many-to-many between exercises and body parts.                                                  |
| `workout_templates`          | `id`, `user_id`, `name`, `workout_type`, `description`, `created_at`                                                          | Reusable workout plans/templates. Metadata only — no exercise data embedded.                                    |
| `workout_template_exercises` | `id`, `workout_template_id`, `exercise_id`, `order_index`, `sets_count`, `target_reps_min`, `target_reps_max`, `rest_seconds` | Links exercises to templates with order + set/rep configuration.                                                |
| `workout_sessions`           | `id`, `user_id`, `workout_template_id`, `name`, `workout_type`, `started_at`, `completed_at`, `notes`                         | A single completed (or in-progress) workout instance.                                                           |
| `exercise_logs`              | `id`, `workout_session_id`, `exercise_id`, `order_index`, `target_reps_min`, `target_reps_max`, `rest_seconds`, `notes`       | One row per exercise performed within a session.                                                                |
| `set_logs`                   | `id`, `exercise_log_id`, `set_number`, `reps`, `weight`, `rir`, `completed`, `side`                                           | One row per individual set. Tracks reps, weight, RIR, completion, and left/right side for unilateral exercises. |
| `friendships`                | `id`, `user_id`, `friend_id`, `status`                                                                                        | Friend connections (`pending`/`accepted`/`rejected`).                                                           |
| `shared_workout_templates`   | `id`, `workout_template_id`, `shared_by_user_id`, `is_public`                                                                 | Marks templates as shared/public.                                                                               |
| `body_part_goals`            | `id`, `user_id`, `body_part`, `goal_type`, `target_value`, `timeframe`                                                        | Per-body-part volume/frequency goals.                                                                           |
| `symmetry_records`           | _(inferred)_                                                                                                                  | Tracks left/right strength differences over time.                                                               |

### Key Relationships

```
workout_templates
  └── workout_template_exercises (1:N)
        └── exercises (N:1, FK exercise_id)

workout_sessions
  └── exercise_logs (1:N)
        └── set_logs (1:N)
        └── exercises (N:1, FK exercise_id)

exercises
  └── exercise_body_parts (1:N)
```

### No JSONB for workout data

Unlike many fitness apps, exercises/sets are **not stored as JSONB blobs**. They are fully normalized across `exercise_logs` and `set_logs`. This means:

- **Pro**: Easy to query individual sets, aggregate across sessions, build analytics per-exercise.
- **Con**: Fetching a full workout requires multiple queries or joins (sessions → exercise_logs → set_logs).

---

## 3. State Management & Caching

### No Client-Side Cache Layer

The app does **not** use SWR, React Query, or any global store (Redux, Zustand). Each page/component fetches data independently via `useEffect` on mount. This means:

- **No cross-page cache sharing** — navigating away and back re-fetches.
- **No stale-while-revalidate** — the user sees a loading state on each navigation.
- **No optimistic updates** — mutations wait for server confirmation.

### On-Device State

- `useState` holds fetched data locally within components.
- `localStorage` is used by the theme provider (`next-themes`) only.
- No IndexedDB, no service workers, no offline support.

---

## 4. Scenario: Home Page (Dashboard)

The "home page" is actually a **two-step client-side redirect**. The root `/` route is a thin router that pushes the user to either `/dashboard` or `/login`. The dashboard (`/dashboard`) is where all the real data loading happens.

### Route: `/` — Landing Redirect (Client Component)

**File:** `src/app/page.tsx`

```
1. Middleware runs → refreshes Supabase session cookie
2. Client Component mounts:
   a. Calls useAuth() → gets { user, loading } from AuthProvider context
   b. useEffect watches [user, loading]:
      - While loading: renders a spinner ("Ładowanie...")
      - If user exists → router.push("/dashboard")
      - If no user → router.push("/login")
   c. NO data fetching happens here at all
   d. NO server-side redirect — this is a client-side navigation
```

**Data operations:** ZERO. This is purely a client-side routing gate that consumes the already-loaded auth state from `AuthProvider`.

### Route: `/dashboard` — The Actual Home Page (Client Component)

**File:** `src/app/dashboard/page.tsx`

### Step-by-step Flow

```
1. Middleware runs → refreshes Supabase session cookie

2. AuthProvider (already mounted in layout.tsx, shared across all pages):
   a. On first app load: supabase.auth.getSession() → sets user
   b. Listens to onAuthStateChange for live updates
   c. Provides { user, loading } via context

3. Client Component <DashboardPage> mounts:
   a. Calls useAuth() → gets { user, loading: authLoading }
   b. useState initializations:
      - templates: WorkoutTemplate[] = []
      - recentSessions: WorkoutSession[] = []
      - loading: boolean = true
      - stats: { totalWorkouts, weeklyWorkouts, totalVolume, currentStreak }
   c. Calls useDashboardInsights() hook (fires its own independent data pipeline)

4. useEffect #1 — Auth guard:
   - If !authLoading && !user → router.push("/login")
   - Client-side redirect, no server involvement

5. useEffect #2 — Main data fetch (triggered when `user` becomes available):
   - Calls fetchData() — a single async function containing a SEQUENTIAL chain of queries
```

### `fetchData()` — The Dashboard's Main Data Pipeline

This is the critical function. It runs **sequentially** (not parallel), with later queries depending on results of earlier ones:

```
Step 1: Fetch workout templates
   supabase.from("workout_templates")
     .select("*")
     .eq("user_id", user.id)
     .order("created_at", { ascending: false })
   → setTemplates(result)

Step 2: Fetch ALL workout sessions (not paginated)
   supabase.from("workout_sessions")
     .select("*")
     .eq("user_id", user.id)
     .order("started_at", { ascending: false })
   → allSessions stored in local variable

Step 3: Slice recent sessions for display
   recentSessionsData = allSessions.slice(0, 5)
   → setRecentSessions(recentSessionsData)
   (Client-side slice — only top 5 shown, but ALL were fetched)

Step 4: Calculate weekly workouts (CLIENT-SIDE computation)
   weekAgo = now - 7 days
   weeklyWorkouts = allSessions.filter(s => s.started_at >= weekAgo).length

Step 5: Calculate current streak (CLIENT-SIDE computation)
   - Sorts sessions by started_at descending
   - Iterates day-by-day from today backwards
   - Counts consecutive days with at least one workout
   - Breaks on first gap

Step 6: Fetch exercise logs for volume (CONDITIONAL — only if sessions exist)
   IF sessionIds.length > 0:
     supabase.from("exercise_logs")
       .select("id")
       .in("workout_session_id", sessionIds)
     → Gets all exercise log IDs

Step 7: Fetch set logs for volume (CONDITIONAL — only if exercise logs exist)
   IF exerciseLogIds.length > 0:
     supabase.from("set_logs")
       .select("reps, weight")
       .in("exercise_log_id", exerciseLogIds)
       .eq("completed", true)
     → Only completed sets

Step 8: Calculate total volume (CLIENT-SIDE computation)
   totalVolume = sum of (set.reps × set.weight) for all completed sets
   → setStats({ totalWorkouts, weeklyWorkouts, totalVolume, currentStreak })
```

### `useDashboardInsights()` — Independent Parallel Pipeline

**File:** `src/hooks/useDashboardInsights.ts`

This hook fires **independently** from `fetchData()` and runs its own chain of queries. It produces body-part analysis insights (imbalance warnings, undertrained alerts, PRs, top-performing body parts).

```
Step 1: Get current user
   supabase.auth.getUser()
   (Redundant call — user is already in AuthContext, but the hook is self-contained)

Step 2: Fetch completed sessions from last 30 days
   supabase.from("workout_sessions")
     .select("id, started_at")
     .eq("user_id", user.id)
     .gte("started_at", thirtyDaysAgo)
     .not("completed_at", "is", null)
   → Only completed sessions, date-filtered

Step 3: Fetch user's exercise catalog
   supabase.from("exercises")
     .select("*")
     .eq("user_id", user.id)
   → Full exercise list (needed to look up target_body_part per exercise)

Step 4: Fetch exercise logs for those sessions
   supabase.from("exercise_logs")
     .select("*")
     .in("workout_session_id", sessionIds)

Step 5: Fetch set logs for those exercise logs
   supabase.from("set_logs")
     .select("*")
     .in("exercise_log_id", exerciseLogIds)

Step 6: CLIENT-SIDE analytics computation:
   a. Builds Map<BodyPart, totalVolume>
   b. Builds Map<BodyPart, lastTrainedDate>
   c. Builds Map<BodyPart, { maxWeight, exerciseName }> (PRs)

Step 7: Generate insights (all client-side):
   a. Imbalance detection: compares antagonist pairs
      (chest/back, quads/hamstrings, biceps/triceps, adductors/abductors)
      Flags if ratio > 1.25x. Severity: >1.5x = high, >1.35x = moderate, else low.
   b. Undertrained detection: finds body part with longest gap since training
      Flags if > 7 days. Severity: >30d = high, >14d = moderate, else low.
   c. PR highlight: body part with the highest single-set max weight.
   d. Top performer: body part with highest total volume in 30 days.

→ setInsights(allInsights) — up to 4 insight cards
```

### Total Supabase Queries on Dashboard Load

| #   | Query                   | Table               | Filter                                         | Pipeline             |
| --- | ----------------------- | ------------------- | ---------------------------------------------- | -------------------- |
| 1   | `SELECT *`              | `workout_templates` | `user_id = ?`, ordered by `created_at` desc    | fetchData            |
| 2   | `SELECT *`              | `workout_sessions`  | `user_id = ?`, ordered by `started_at` desc    | fetchData            |
| 3   | `SELECT id`             | `exercise_logs`     | `workout_session_id IN (...)`                  | fetchData            |
| 4   | `SELECT reps, weight`   | `set_logs`          | `exercise_log_id IN (...)`, `completed = true` | fetchData            |
| 5   | `auth.getUser()`        | `auth.users`        | current session                                | useDashboardInsights |
| 6   | `SELECT id, started_at` | `workout_sessions`  | `user_id = ?`, last 30 days, completed only    | useDashboardInsights |
| 7   | `SELECT *`              | `exercises`         | `user_id = ?`                                  | useDashboardInsights |
| 8   | `SELECT *`              | `exercise_logs`     | `workout_session_id IN (...)`                  | useDashboardInsights |
| 9   | `SELECT *`              | `set_logs`          | `exercise_log_id IN (...)`                     | useDashboardInsights |

**Total: up to 9 Supabase queries** on a single dashboard load (some conditional).

### What Gets Rendered

```
┌──────────────────────────────────────────┐
│ HEADER: "FITNESS TRACKER" + UserMenu     │
│   (UserMenu reads user from AuthContext, │
│    extracts full_name & avatar_url from  │
│    user.user_metadata — NO extra query)  │
├──────────────────────────────────────────┤
│ BODY PART INSIGHTS (from useDashboard-   │
│ Insights): 1-4 colored cards showing     │
│ imbalance, undertrained, PR, top part    │
│ Each card links to /progress?tab=body... │
├──────────────────────────────────────────┤
│ STATS TILES (2×2 or 4-col grid):        │
│   • Total workouts (allSessions.length)  │
│   • Weekly workouts (client-filtered)    │
│   • Total volume (kg×reps, from sets)    │
│   • Current streak (consecutive days)    │
├──────────────────────────────────────────┤
│ RECENT WORKOUTS (top 5 sessions):        │
│   Each is a <Link> to /workout/{id}      │
│   Shows: name, date (Polish locale),     │
│   workout_type badge, completion check   │
├──────────────────────────────────────────┤
│ WORKOUT TEMPLATES:                        │
│   Grid of template cards, each links     │
│   to /templates/{id}                     │
│   + "Od znajomych" → /templates/shared   │
│   + "Nowy" → /templates/new              │
├──────────────────────────────────────────┤
│ BOTTOM NAV (fixed):                       │
│   Templates | Start Workout | Progress   │
└──────────────────────────────────────────┘
```

### Data Operations Summary

| Operation                      | Type                    | Location                    | Trigger                          |
| ------------------------------ | ----------------------- | --------------------------- | -------------------------------- |
| Session refresh                | AUTH                    | Middleware (server)         | Every request                    |
| Get session                    | AUTH READ               | Client (AuthProvider, once) | App load                         |
| Auth state listener            | AUTH SUBSCRIBE          | Client (AuthProvider)       | App load, stays active           |
| Auth guard redirect            | NAVIGATION              | Client                      | `useEffect` on user/loading      |
| Fetch templates                | DB READ (all rows)      | Client                      | `useEffect` on user              |
| Fetch all sessions             | DB READ (all rows)      | Client                      | `useEffect` on user              |
| Fetch exercise logs            | DB READ (all for user)  | Client                      | Conditional, after sessions      |
| Fetch completed set logs       | DB READ (filtered)      | Client                      | Conditional, after exercise logs |
| Fetch user (insights)          | AUTH READ               | Client (redundant)          | Hook mount                       |
| Fetch sessions 30d (insights)  | DB READ (date-filtered) | Client                      | Hook mount                       |
| Fetch exercises (insights)     | DB READ (all for user)  | Client                      | Hook mount                       |
| Fetch exercise logs (insights) | DB READ                 | Client                      | After sessions                   |
| Fetch set logs (insights)      | DB READ                 | Client                      | After exercise logs              |
| Stats computation              | CLIENT COMPUTE          | Client (in-memory)          | After all fetches                |
| Insights computation           | CLIENT COMPUTE          | Client (in-memory)          | After all insight fetches        |

### Optimizations Present

- **Middleware session refresh**: Keeps tokens alive without client-side refresh logic.
- **AuthProvider singleton**: `getSession()` called once on app load, shared via context across all pages. No per-page auth query.
- **`onAuthStateChange` listener**: Reacts to token refreshes and sign-outs in real-time without polling.
- **Conditional volume queries**: `exercise_logs` and `set_logs` queries are skipped entirely if the user has zero sessions (early return).
- **Insights date filter at DB level**: `useDashboardInsights` uses `.gte("started_at", thirtyDaysAgo)` and `.not("completed_at", "is", null)` to limit data to relevant completed sessions from the last 30 days.
- **Client-side slice for recent**: Only 5 sessions displayed, sliced from already-fetched array (no extra query).
- **UserMenu extracts name/avatar from `user.user_metadata`**: No extra profile table query needed.

### Optimization Gaps

- **No parallel queries in `fetchData()`**: Templates and sessions could be fetched with `Promise.all()` but are awaited sequentially.
- **Duplicate session fetches**: `fetchData()` fetches ALL sessions, `useDashboardInsights` fetches sessions again (30d subset). These two pipelines don't share data.
- **Duplicate exercise_logs/set_logs fetches**: Both pipelines query the same tables independently.
- **No pagination**: ALL workout sessions ever are fetched to compute stats. For power users with hundreds of sessions, this transfers significant data.
- **No memoization**: Stats and streak are recalculated on every render (no `useMemo`).
- **No `SELECT` column pruning in fetchData**: `select("*")` fetches all columns from `workout_sessions` and `workout_templates` when only a few are needed for display.
- **Redundant `auth.getUser()` in insights hook**: User is already available from `AuthContext` but the hook calls Supabase auth independently.

---

## 5. Scenario: Workout Templates List Page

**Route:** `/templates` — Client Component (`src/app/templates/page.tsx`)

### Step-by-step Flow

```
1. Middleware → session refresh
2. Client Component mounts:
   a. useAuth() → gets { user }
   b. useEffect #1: if !user → router.push("/login")
   c. useEffect #2 (when user available): calls fetchTemplates()

3. fetchTemplates():
   supabase.from("workout_templates")
     .select("*")
     .order("created_at", { ascending: false })
   → setTemplates(data)
   NOTE: No .eq("user_id", user.id) filter! Relies on RLS policy.

4. Renders:
   - Quick link cards: "Treningi od znajomych" → /templates/shared
   -                    "Zarządzaj ćwiczeniami" → /exercises
   - Template cards grid with: name, workout_type badge, description, date
   - Each card has "Szczegóły" → /templates/{id} and a Delete button
```

### deleteTemplate()

```
1. confirm() dialog (browser native)
2. supabase.from("workout_templates").delete().eq("id", id)
3. On success: setTemplates(templates.filter(t => t.id !== id))
   → Local state removal, NO re-fetch
```

### Data Operations Summary

| Operation       | Type          | Location | Trigger           |
| --------------- | ------------- | -------- | ----------------- |
| Auth guard      | NAVIGATION    | Client   | useEffect         |
| Fetch templates | DB READ (all) | Client   | useEffect on user |
| Delete template | DB DELETE     | Client   | User action       |

### Optimizations

- **Local state removal on delete**: Filters out the deleted template from state instead of re-querying.
- **RLS-based filtering**: No explicit `user_id` filter in query — Supabase Row Level Security handles it server-side.

---

## 6. Scenario: Workout Template Detail/Edit Page

**Route:** `/templates/[id]` — Client Component (`src/app/templates/[id]/page.tsx`)

### Step-by-step Flow (View Mode)

```
1. Client Component mounts, extracts templateId from params
2. Three parallel data-fetching effects fire:
   a. fetchTemplateData()
   b. fetchAllExercises()
   c. checkIfShared()
```

### fetchTemplateData() — 2 queries

```
Query 1: Fetch template metadata
   supabase.from("workout_templates")
     .select("*")
     .eq("id", templateId)
     .single()
   → setTemplate(data); populate edit form state

Query 2: Fetch template exercises with NESTED JOINS
   supabase.from("workout_template_exercises")
     .select(`
       *,
       exercise:exercises(
         *,
         body_parts:exercise_body_parts(*)
       )
     `)
     .eq("workout_template_id", templateId)
     .order("order_index")
   → Each row has: order_index, sets_count, target_reps, rest_seconds
     AND the full exercise object with its body_parts array
   → setExercises(data); setEditExercises(data)
```

### fetchAllExercises() — 1 query (for exercise picker when editing)

```
   supabase.from("exercises")
     .select(`*, body_parts:exercise_body_parts(*)`)
     .order("name")
   → setAllExercises(data)
   NOTE: No user_id filter — relies on RLS.
```

### checkIfShared() — 1 query

```
   supabase.from("shared_workout_templates")
     .select("id")
     .eq("workout_template_id", templateId)
     .single()
   → If data exists → setIsShared(true)
   → PGRST116 ("not found") error is expected and silently caught
```

### Editing a Template (saveChanges)

```
1. User toggles "Edit" mode (local state, no DB)
2. Can modify: name, workout_type, description
3. Can add/remove/reorder exercises (all in local state)
4. Can create new exercises inline (INSERT into exercises + exercise_body_parts)
5. On "Save" → saveChanges():

   Step 1: UPDATE workout_templates metadata
      supabase.from("workout_templates")
        .update({ name, workout_type, description, updated_at })
        .eq("id", templateId)

   Step 2: DELETE ALL existing template exercises
      supabase.from("workout_template_exercises")
        .delete()
        .eq("workout_template_id", templateId)

   Step 3: INSERT new template exercises array
      supabase.from("workout_template_exercises")
        .insert(editExercises.map(ex => ({
          workout_template_id, exercise_id, order_index,
          sets_count, target_reps_min, target_reps_max, rest_seconds
        })))

   Step 4: Re-fetch template data (fetchTemplateData)
   Step 5: setEditing(false)
```

**Save strategy: DELETE ALL + INSERT ALL** — This is a "replace" pattern. The entire exercise list for the template is dropped and re-inserted. This simplifies reordering/add/remove logic but is less efficient than differential updates.

### Sharing/Unsharing (toggleShare)

```
If currently shared:
   supabase.from("shared_workout_templates")
     .delete()
     .eq("workout_template_id", templateId)

If not shared:
   supabase.from("shared_workout_templates")
     .insert({ workout_template_id, shared_by_user_id: user.id, is_public: true })
```

### Creating a New Exercise Inline (createNewExercise)

```
Step 1: INSERT into exercises
   supabase.from("exercises")
     .insert({ name, muscle_group, target_body_part, user_id })
     .select().single()

Step 2: INSERT body parts into junction table
   supabase.from("exercise_body_parts")
     .insert(bodyParts.map(bp => ({ exercise_id, body_part, is_primary })))

Step 3: Add to local state + add to template's exercise list
```

### Data Operations Summary

| Operation                             | Type                | Queries | Trigger                |
| ------------------------------------- | ------------------- | ------- | ---------------------- |
| Fetch template                        | DB READ             | 1       | Page load              |
| Fetch template exercises (with joins) | DB READ (nested)    | 1       | Page load              |
| Fetch all exercises (for picker)      | DB READ             | 1       | Page load              |
| Check if shared                       | DB READ             | 1       | Page load              |
| Save template metadata                | DB UPDATE           | 1       | User saves             |
| Delete old template exercises         | DB DELETE           | 1       | User saves             |
| Insert new template exercises         | DB INSERT           | 1       | User saves             |
| Re-fetch after save                   | DB READ             | 2       | After save             |
| Create inline exercise                | DB INSERT           | 2       | User action            |
| Toggle share                          | DB INSERT or DELETE | 1       | User action            |
| Delete template                       | DB DELETE           | 1       | User action → redirect |

### Optimizations

- **Nested Supabase joins**: A single query fetches template_exercises → exercises → exercise_body_parts using Supabase's PostgREST join syntax. Avoids 3 separate queries.
- **All exercises pre-fetched**: Exercise picker is ready immediately when user enters edit mode.

### Optimization Gaps

- **DELETE ALL + INSERT ALL on save**: Could use differential updates to only insert/delete changed rows.
- **Full re-fetch after save**: Could update local state directly since we know what was saved.

---

## 7. Scenario: Creating a New Workout Template

**Route:** `/templates/new` — Client Component (`src/app/templates/new/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts
2. useEffect: calls fetchExercises() + fetchSuggestedExercises()
```

### fetchExercises() — 1 query

```
   supabase.from("exercises")
     .select("*")
     .eq("user_id", user.id)
     .order("name")
   → setAllExercises(data)
```

### fetchSuggestedExercises() — 1 query (with nested join)

```
   supabase.from("workout_templates")
     .select(`
       id, workout_type,
       workout_template_exercises (
         exercise_id,
         exercises (*)
       )
     `)
     .eq("user_id", user.id)
     .eq("workout_type", workoutType)

   → Client-side: counts exercise usage frequency across all templates of same type
   → Sorts by frequency, takes top 5 as suggestions
   → Re-runs when workoutType changes (useEffect dependency)
```

### Building the Template (all in local state)

```
- User picks exercises from the list or creates new ones inline
- For each exercise, configures: sets_count, target_reps_min/max, rest_seconds
- Exercises can be reordered via up/down buttons
- All modifications are in-memory useState
```

### saveTemplate() — 2 INSERT queries

```
Step 1: INSERT template metadata
   supabase.from("workout_templates")
     .insert({ name, workout_type, description, user_id })
     .select().single()

Step 2: INSERT template exercises
   supabase.from("workout_template_exercises")
     .insert(selectedExercises.map(ex => ({
       workout_template_id: template.id,
       exercise_id, order_index, sets_count,
       target_reps_min, target_reps_max, rest_seconds
     })))

Step 3: router.push("/dashboard")
```

### Creating a New Exercise Inline — 1 INSERT

```
   supabase.from("exercises")
     .insert({ name, muscle_group, target_body_part, is_unilateral, user_id })
     .select().single()
   → Added to allExercises and selectedExercises locally
```

### Optimizations

- **Exercise suggestions**: Queries existing templates of the same workout type to suggest frequently-used exercises. Smart UX optimization that helps users build templates faster.
- **In-memory template building**: Zero DB writes until final save.

---

## 8. Scenario: Starting a New Workout

**Route:** `/workout/new` — Client Component (`src/app/workout/new/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts
2. Calls fetchData() + useExerciseRecommendations() hook
```

### fetchData() — 2 queries IN PARALLEL (Promise.all)

```
   const [templatesRes, exercisesRes] = await Promise.all([
     supabase.from("workout_templates").select("*").order("created_at", desc),
     supabase.from("exercises").select("*").order("name")
   ]);
   → setTemplates(data); setExercises(data)
```

**This is the only page that uses `Promise.all()` for parallel queries.**

### useExerciseRecommendations() — Independent pipeline (5 queries)

```
Step 1: supabase.auth.getUser() — redundant, user available from context
Step 2: workout_sessions (last 30 days, completed only)
Step 3: exercises (all for user)
Step 4: exercise_logs (for those sessions)
Step 5: set_logs (for those exercise logs)

Client-side computation:
- Per body part: volume, last trained date, exercise count
- Calculates average volume across all body parts
- Flags body parts with >7 days since training OR >20% below average volume
- Priority: high (>21 days / >40% deficit), moderate (>14 days / >20% deficit), low
- Returns recommendations with specific exercises the user can add
```

### selectTemplate() — 1 additional query

```
When user clicks a template:
   supabase.from("workout_template_exercises")
     .select("exercise_id")
     .eq("workout_template_id", templateId)
     .order("order_index")
   → Pre-selects those exercises
```

### startWorkout() — 3 sequential INSERT queries

This is the most write-heavy operation in the app:

```
Step 1: INSERT workout session
   supabase.from("workout_sessions")
     .insert({ user_id, workout_template_id, name, workout_type, started_at })
     .select().single()

Step 2: If from template — fetch template exercises with set counts:
   supabase.from("workout_template_exercises")
     .select("exercise_id, sets_count, order_index, target_reps_min, target_reps_max, rest_seconds")
     .eq("workout_template_id", selectedTemplate)
     .order("order_index")

Step 3: INSERT exercise logs (one per exercise)
   supabase.from("exercise_logs")
     .insert(exercisesWithSets.map(ex => ({
       workout_session_id, exercise_id, order_index,
       target_reps_min, target_reps_max, rest_seconds
     })))
     .select()

Step 4: INSERT set logs (N per exercise, pre-created as empty)
   supabase.from("set_logs")
     .insert(exerciseLogs.flatMap((log, idx) =>
       Array.from({ length: setsCount }, (_, setIdx) => ({
         exercise_log_id: log.id, set_number: setIdx + 1,
         reps: 0, weight: 0, rir: 0, completed: false
       }))
     ))

Step 5: router.push(`/workout/${session.id}`)
```

**Key insight**: The entire workout structure (session → exercise_logs → set_logs) is **pre-created in the database** with empty values before the user enters the workout page. This is the opposite of an "in-memory then save" pattern.

### Data Operations Summary

| Operation                   | Type      | Queries        | Trigger                    |
| --------------------------- | --------- | -------------- | -------------------------- |
| Fetch templates + exercises | DB READ   | 2 (parallel)   | Page load                  |
| Exercise recommendations    | DB READ   | 5 (sequential) | Page load (hook)           |
| Select a template           | DB READ   | 1              | User clicks template       |
| Create session              | DB INSERT | 1              | User clicks "Start"        |
| Fetch template exercises    | DB READ   | 1              | During start (if template) |
| Create exercise logs        | DB INSERT | 1              | During start               |
| Create set logs             | DB INSERT | 1              | During start               |

### Optimizations

- **`Promise.all` for initial data**: Templates and exercises fetched in parallel — faster load.
- **Batch insert for set_logs**: All sets for all exercises inserted in a single query using `flatMap`.
- **Exercise recommendations**: Proactive analysis helps users train neglected body parts.

### Optimization Gaps

- **Recommendations pipeline duplicates queries**: Same pattern as `useDashboardInsights` — fetches sessions, exercise_logs, set_logs independently.
- **Template exercises fetched twice**: Once in `selectTemplate()` (just IDs) and again in `startWorkout()` (with set counts). Could be combined.

---

## 9. Scenario: Active Workout Session (and Viewing Completed Workouts)

**Route:** `/workout/[id]` — Client Component (`src/app/workout/[id]/page.tsx`)

This page serves **dual purpose**: both the **active workout** (in-progress) and **viewing a completed workout**. The behavior differs based on whether `session.completed_at` is null.

### Step-by-step Flow (Page Load)

```
1. Client Component mounts, extracts sessionId from URL params
2. useEffect: calls fetchWorkoutSession()
```

### fetchWorkoutSession() — Heavy multi-query pipeline

```
Query 1: Fetch session metadata
   supabase.from("workout_sessions")
     .select("*")
     .eq("id", sessionId)
     .single()

Query 2: Fetch exercise logs with exercise details (joined)
   supabase.from("exercise_logs")
     .select(`*, exercise:exercises(*)`)
     .eq("workout_session_id", sessionId)
     .order("order_index")

Query 3..N: FOR EACH exercise log (Promise.all, parallelized):
   a. Fetch sets for this exercise:
      supabase.from("set_logs")
        .select("*")
        .eq("exercise_log_id", log.id)
        .order("set_number")

   b. Fetch PREVIOUS workout data for this exercise:
      supabase.from("exercise_logs")
        .select(`id, workout_session_id, workout_sessions!inner(completed_at)`)
        .eq("exercise_id", log.exercise_id)
        .neq("workout_session_id", sessionId)
        .not("workout_sessions.completed_at", "is", null)
        .order("workout_sessions(completed_at)", { ascending: false })
        .limit(1)

   c. IF previous workout found — fetch its sets:
      supabase.from("set_logs")
        .select("*")
        .eq("exercise_log_id", previousWorkouts[0].id)
        .order("set_number")
```

**Total queries**: 1 (session) + 1 (exercise logs) + N×(1 sets + 1 previous log + 0-1 previous sets) where N = number of exercises.

**For a workout with 6 exercises**: ~1 + 1 + 6×3 = **20 queries** on page load.

### Exercise Navigation (URL-synced)

```
1. currentExerciseIndex tracked in state
2. URL updated via window.history.replaceState with ?exercise=N
3. On page load, reads ?exercise param from URL to restore position

Navigation methods:
- goToNextExercise() → index + 1
- goToPreviousExercise() → index - 1
- selectExerciseFromList(index) → jump to any exercise (from modal)

All navigation is LOCAL — no DB queries.
Changes to exercises persist in state across navigation.
```

### Completing a Set (updateSet) — 1 DB WRITE per set

```
1. User fills in reps, weight, RIR, side (for unilateral)
2. Clicks "Potwierdź serię" (Confirm set)
3. handleComplete() in SetInput component:
   a. Calls onUpdate({ reps, weight, rir, side, completed: true })
4. updateSet(setId, updates):
   a. supabase.from("set_logs").update(updates).eq("id", setId)
   b. Updates local state (exerciseLogs + selectedExercise)
   c. Clears localStorage backup for this set
```

**Key difference from the old document**: Sets are saved **individually and immediately** to the database, NOT batched at the end. Each set confirmation = 1 DB UPDATE.

### localStorage Backup (SetInput component)

```
The SetInput component implements a PER-SET localStorage backup:

1. Each set has a unique key: `workout_set_${set.id}`
2. On every input change (reps, weight, rir, side):
   - Value is saved to localStorage immediately
   - Keys: `${storageKey}_reps`, `${storageKey}_weight`, etc.
3. On component mount:
   - Reads from localStorage first, falls back to DB value
4. On successful "Confirm":
   - localStorage entries are cleared for that set

This provides DATA LOSS PREVENTION if the browser crashes mid-workout.
```

### Completing the Workout (completeWorkout)

```
1. "Zakończ trening" button appears when all sets are completed
2. supabase.from("workout_sessions")
     .update({ completed_at: new Date().toISOString() })
     .eq("id", session.id)
3. router.push("/dashboard")
```

**Just 1 UPDATE** — all set data was already saved individually.

### Cancelling a Workout (cancelWorkout)

```
Manual cascade delete (3 queries):
1. DELETE all set_logs WHERE exercise_log_id IN (exercise log IDs)
2. DELETE all exercise_logs WHERE workout_session_id = session.id
3. DELETE workout_session WHERE id = session.id
→ router.push("/dashboard")
```

### Viewing a Completed Workout

Same page, same data loading. But:

- Set inputs are displayed in **read-only** completed state
- "Zakończ trening" button is absent
- "Edytuj" (Edit) on completed sets calls `onUpdate({ completed: false })` to reopen them
- The user can un-complete and re-complete sets even on finished workouts

### Data Operations Summary

| Operation                       | Type      | Queries | Trigger               |
| ------------------------------- | --------- | ------- | --------------------- |
| Fetch session                   | DB READ   | 1       | Page load             |
| Fetch exercise logs (joined)    | DB READ   | 1       | Page load             |
| Fetch sets per exercise         | DB READ   | N       | Page load (parallel)  |
| Fetch previous log per exercise | DB READ   | N       | Page load (parallel)  |
| Fetch previous sets             | DB READ   | 0-N     | Page load (parallel)  |
| Update a single set             | DB UPDATE | 1       | Each set confirmation |
| Complete workout                | DB UPDATE | 1       | User finishes         |
| Cancel workout                  | DB DELETE | 3       | User cancels          |
| Exercise navigation             | STATE     | 0       | Button clicks         |

### Optimizations

- **Per-set `Promise.all`**: Sets and previous-workout data for all exercises are fetched in parallel, not sequentially.
- **URL-synced exercise index**: User can refresh the page and return to the same exercise.
- **localStorage backup**: Prevents data loss on browser crash/close during active workout.
- **Immediate per-set saves**: Each confirmed set is persisted immediately — no risk of losing an entire workout.
- **Previous workout display**: Shows what the user did last time for each set, enabling progressive overload tracking.

### Optimization Gaps

- **N+1 query problem**: For N exercises, makes N individual queries for sets + N for previous data. Could potentially use `.in()` to batch.
- **Previous workout lookup is expensive**: Uses a cross-table join with ordering for each exercise. A denormalized "last performance" cache would be faster.
- **No `select()` column pruning**: `select("*")` on set_logs fetches all columns when only a subset is needed for display.

---

## 10. Scenario: Exercises Management Page

**Route:** `/exercises` — Client Component (`src/app/exercises/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts
2. useEffect: calls fetchExercises()
```

### fetchExercises() — 1 query with nested join

```
   supabase.from("exercises")
     .select(`*, body_parts:exercise_body_parts(*)`)
     .eq("user_id", user.id)
     .order("name")
   → setExercises(data); setFilteredExercises(data)
```

### Client-side Search/Filter

```
- searchQuery state updated on every keystroke
- useEffect filters exercises in memory:
  exercises.filter(ex =>
    ex.name.toLowerCase().includes(query) ||
    ex.target_body_part?.toLowerCase().includes(query) ||
    ex.muscle_group?.toLowerCase().includes(query)
  )
- No DB queries on search — instant filtering
```

### Editing an Exercise (saveExercise) — 3 sequential queries

```
Step 1: UPDATE exercise basic info
   supabase.from("exercises")
     .update({ name, description, muscle_group, target_body_part, is_unilateral, updated_at })
     .eq("id", exercise.id)

Step 2: DELETE all existing body parts
   supabase.from("exercise_body_parts")
     .delete()
     .eq("exercise_id", exercise.id)

Step 3: INSERT new body parts
   supabase.from("exercise_body_parts")
     .insert(editBodyParts.map((bp, index) => ({
       exercise_id, body_part: bp, is_primary: index === 0
     })))

Step 4: Re-fetch all exercises (fetchExercises)
Step 5: cancelEditing() — reset edit form state
```

**Save strategy**: Same DELETE ALL + INSERT ALL pattern as template exercises.

### Deleting an Exercise (deleteExercise) — 1 query

```
1. confirm() dialog
2. supabase.from("exercises").delete().eq("id", exerciseId)
3. setExercises(exercises.filter(ex => ex.id !== exerciseId))
   → Local state removal, NO re-fetch
```

### Data Operations Summary

| Operation                         | Type                        | Queries | Trigger         |
| --------------------------------- | --------------------------- | ------- | --------------- |
| Fetch exercises (with body parts) | DB READ                     | 1       | Page load       |
| Search/filter                     | CLIENT COMPUTE              | 0       | Every keystroke |
| Save exercise                     | DB UPDATE + DELETE + INSERT | 3       | User saves      |
| Re-fetch after save               | DB READ                     | 1       | After save      |
| Delete exercise                   | DB DELETE                   | 1       | User action     |

### Optimizations

- **Client-side search**: Zero DB queries for filtering — instant results.
- **Nested join fetch**: Single query gets exercises + their body parts.
- **Local state removal on delete**: No re-fetch needed.
- **Editable fields**: name, description, muscle_group, body parts (multi-select), is_unilateral — comprehensive inline editing without a separate page.

---

## 11. Scenario: Friends Page

**Route:** `/friends` — Client Component (`src/app/friends/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts
2. useEffect: if !user → redirect, else fetchFriends()
```

### fetchFriends() — 4 sequential queries + 1 conditional

```
Query 1: Accepted friendships (both directions)
   supabase.from("friendships")
     .select("*")
     .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
     .eq("status", "accepted")

Query 2: Pending received requests
   supabase.from("friendships")
     .select("*")
     .eq("friend_id", user.id)
     .eq("status", "pending")

Query 3: Sent pending requests
   supabase.from("friendships")
     .select("*")
     .eq("user_id", user.id)
     .eq("status", "pending")

Query 4: Fetch profiles for all related users
   Collects all friend/requester IDs from queries 1-3
   supabase.from("user_profiles")
     .select("*")
     .in("id", allUserIds)
   → Client-side: attaches profiles to friendships via .find()
```

### Searching for a User (searchUser) — 1 query

```
   supabase.from("user_profiles")
     .select("*")
     .eq("email", searchEmail)
     .single()
   → Shows result if found and not self
```

### Mutations

```
sendFriendRequest():
   INSERT into friendships { user_id, friend_id, status: "pending" }
   → Re-fetches all friends (fetchFriends)

acceptRequest(friendshipId):
   UPDATE friendships SET status = "accepted", updated_at
   WHERE id = friendshipId
   → Re-fetches all friends

rejectRequest(friendshipId):
   DELETE from friendships WHERE id = friendshipId
   → Re-fetches all friends

removeFriend(friendshipId):
   confirm() dialog
   DELETE from friendships WHERE id = friendshipId
   → Re-fetches all friends
```

### Tab Navigation

```
- Two tabs: "Znajomi" (Friends) and "Zaproszenia" (Requests)
- Controlled by activeTab state
- Switching tabs does NOT re-fetch — data already loaded
- Friends tab shows accepted friends + "Porównaj" (Compare) link → /progress/{friendId}
- Requests tab shows received + sent pending requests
```

### Data Operations Summary

| Operation              | Type      | Queries        | Trigger       |
| ---------------------- | --------- | -------------- | ------------- |
| Fetch accepted friends | DB READ   | 1              | Page load     |
| Fetch pending received | DB READ   | 1              | Page load     |
| Fetch pending sent     | DB READ   | 1              | Page load     |
| Fetch user profiles    | DB READ   | 1              | Page load     |
| Search user by email   | DB READ   | 1              | User searches |
| Send friend request    | DB INSERT | 1 + refetch(4) | User action   |
| Accept request         | DB UPDATE | 1 + refetch(4) | User action   |
| Reject/Remove          | DB DELETE | 1 + refetch(4) | User action   |
| Tab switch             | STATE     | 0              | User clicks   |

### Optimization Gaps

- **Full re-fetch on every mutation**: After send/accept/reject/remove, the entire fetchFriends() runs (4 queries). Could update local state instead.
- **No loading state per action**: The whole page goes to loading state on refetch.

---

## 12. Scenario: Friend Progress Comparison

**Route:** `/progress/[friendId]` — Client Component (`src/app/progress/[friendId]/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts, extracts friendId from params
2. useEffect: calls fetchComparisonData() — re-runs when period changes
```

### fetchComparisonData()

```
Query 1: Fetch friend's profile
   supabase.from("user_profiles")
     .select("*")
     .eq("id", friendId)
     .single()

Then runs fetchStatsForUser() TWICE — once for current user, once for friend:
```

### fetchStatsForUser(userId) — 3 queries per user (×2 = 6)

```
Query 1: workout_sessions for user in selected period
   supabase.from("workout_sessions")
     .select("*")
     .eq("user_id", userId)
     .gte("started_at", startDate)

Query 2: exercise_logs for those sessions
   supabase.from("exercise_logs")
     .select("id, workout_session_id")
     .in("workout_session_id", sessionIds)

Query 3: set_logs for those exercise logs (completed only)
   supabase.from("set_logs")
     .select("*")
     .in("exercise_log_id", exerciseLogIds)
     .eq("completed", true)

Client-side computation:
- totalWorkouts, totalSets, totalVolume, totalReps
- avgWeight, avgDuration
- bestVolume (per single session)
```

### Period Selection

```
- Three options: "2weeks", "1month", "3months"
- Changing period triggers full re-fetch (useEffect dependency on `period`)
- All data reloaded for both users
```

### Total queries: 1 (profile) + 6 (3 per user × 2) = **7 queries**

---

## 13. Scenario: Shared Workout Templates

**Route:** `/templates/shared` — Client Component (`src/app/templates/shared/page.tsx`)

### Step-by-step Flow

```
1. Client Component mounts
2. useEffect: fetchSharedTemplates()
```

### fetchSharedTemplates() — 1 query (from a VIEW)

```
   supabase.from("shared_templates_with_details")
     .select("*")
     .neq("shared_by_user_id", user.id)
     .order("shared_at", { ascending: false })

   → Uses a DATABASE VIEW that joins:
     shared_workout_templates + workout_templates + user_profiles
   → Returns: template name, type, description, sharer name/email, exercise count
   → Filters out user's own shared templates
```

### copyTemplate() — 1 RPC call (server-side function)

```
   supabase.rpc("copy_shared_workout_template", {
     p_source_template_id: templateId,
     p_user_id: user.id
   })

   → Calls a PostgreSQL function that:
     1. Copies the workout_template row (new user_id)
     2. Copies all workout_template_exercises rows
     3. Returns { success, template_name, new_template_id, exercises_copied }
   → On success: redirect to /templates/{new_template_id}
```

**This is the ONLY place the app uses Supabase RPC (server-side function)**. The function handles the copy atomically and bypasses RLS for cross-user data access.

### Data Operations Summary

| Operation              | Type           | Queries | Trigger          |
| ---------------------- | -------------- | ------- | ---------------- |
| Fetch shared templates | DB READ (view) | 1       | Page load        |
| Copy template          | DB RPC         | 1       | User clicks copy |

### Optimizations

- **Database VIEW**: Pre-joins multiple tables server-side, returning a flat result. Eliminates multiple client queries.
- **Server-side RPC for copy**: Atomic operation that handles cross-user data access, cascading copy, and RLS bypass in a single call.

---

## 14. Scenario: Analytics/Progress Page

**Route:** `/progress` — Client Component (`src/app/progress/page.tsx`)

### Architecture: Tab-based Lazy Loading

The progress page has **8 tabs**, each rendered by a separate component with its own custom hook. Only the active tab's component is mounted — switching tabs unmounts the old component and mounts the new one.

```
Tabs:
1. general    → <GeneralStats>       → useGeneralStats(userId)
2. strength   → <StrengthStats>      → useStrengthStats(userId)
3. trends     → <TrendsStats>        → useTrendsStats(userId)
4. goals      → <GoalsStats>         → useGoalsStats(userId)
5. bodyparts  → <BodyPartAnalysis>   → useBodyPartAnalysis(userId)
6. symmetry   → <SymmetryStats>      → useSymmetryAnalysis()
7. injury     → <InjuryRiskStats>    → useInjuryRisk()
8. periodization → <PeriodizationStats> → usePeriodization()
```

### Tab Navigation Behavior

```
- activeTab state controlled by buttons
- URL param ?tab= read on mount to set initial tab (e.g. from dashboard insight cards)
- Switching tabs: old component unmounts, new mounts, hook fires, data fetches
- Going BACK to a previously-viewed tab: re-mounts, re-fetches everything
- NO caching between tabs
```

### Common Data Pattern (most hooks)

Every stats hook follows the same 3-query sequential pattern:

```
Query 1: workout_sessions (filtered by user_id, sometimes date-limited)
Query 2: exercise_logs (filtered by session IDs, sometimes joined with exercises)
Query 3: set_logs (filtered by exercise_log_id, sometimes completed-only)

→ Heavy client-side computation on the result
```

### Per-Tab Details

#### Tab 1: General Stats (`useGeneralStats`)

- **Queries**: 2 (sessions + exercise_logs for count)
- **Fetches**: All sessions (no date filter)
- **Computes**: total workouts, workout time (week/month/alltime), avg duration, streaks (current + best), most frequent days/times
- **Chart data**: Day-of-week histogram, hour-of-day histogram

#### Tab 2: Strength Stats (`useStrengthStats`)

- **Queries**: 3 (sessions + exercise_logs joined with exercises + set_logs)
- **Fetches**: All completed sessions (no date filter)
- **Computes**: Per-exercise stats (max weight, 1RM via Epley formula, total volume), personal records sorted by estimated 1RM, top 10 most performed exercises, muscle group balance %, body part volumes/PRs/frequency
- **Heaviest computation** — O(N×M) where N=exercise logs, M=set logs

#### Tab 3: Trends Stats (`useTrendsStats`)

- **Queries**: 3 (sessions last 12 weeks + exercise_logs joined + set_logs)
- **Fetches**: Last 12 weeks only (date-filtered)
- **Computes**: Weekly volume progress with % improvement, per-exercise weight progression time-series, 90-day workout heatmap, best day/time analysis

#### Tab 4: Goals Stats (`useGoalsStats` + `useBodyPartGoals`)

- **Queries**: 1 (body_part_goals) + **N×(3-4)** per goal for progress calculation
- **N+1 problem**: Each goal triggers its own chain of queries (sessions → exercises → exercise_logs → set_logs)
- **Also provides CRUD**: createGoal, updateGoal, deleteGoal mutations
- **Auth redundancy**: Calls `supabase.auth.getUser()` inside every progress calculation

#### Tab 5: Body Part Analysis (`useBodyPartAnalysis`)

- **Queries**: 3 (all sessions + exercise_logs joined + set_logs)
- **Fetches**: All sessions (no date filter)
- **Computes**: Volume distribution per body part, imbalance detection (4 antagonist pairs), undertrained parts (>14d warning, >30d critical), 12-week weekly progress per body part, text recommendations

#### Tab 6: Symmetry Stats (`useSymmetryAnalysis`)

- **Queries**: 3 (sessions + exercise_logs for unilateral exercises only + set_logs with side)
- **Fetches**: Configurable period (default 12 weeks)
- **DB-level optimization**: Uses `!inner` join to only fetch unilateral exercises
- **Computes**: Left/right volume, avg weight, avg reps per exercise; imbalance % = |L−R| / ((L+R)/2) × 100; risk classification

#### Tab 7: Injury Risk (`useInjuryRisk`)

- **Queries**: 3 (sessions + exercise_logs joined + set_logs)
- **Computes**: Volume spikes (week-over-week), muscle imbalances, overtraining signals (sessions/week, deload detection), neglected stabilizer muscles (core, forearms, calves, neck, adductors, abductors)
- **Risk score**: Additive points system (high=25, moderate=15, low=5, capped at 100)

#### Tab 8: Periodization (`usePeriodization`)

- **Queries**: 3 (sessions + exercise_logs + set_logs, last configurable weeks)
- **Computes**: Weekly metrics (volume, intensity via Epley, sets, workouts), phase classification (accumulation/intensification/deload/transition), phase recommendation

### Cross-Tab Analysis

| Tab           | Queries | Date Filter        | Auth Pattern     |
| ------------- | ------- | ------------------ | ---------------- |
| General       | 2       | None (all time)    | userId param     |
| Strength      | 3       | None (all time)    | userId param     |
| Trends        | 3       | Last 12 weeks      | userId param     |
| Goals         | 1 + N×4 | Per-goal timeframe | inline getUser() |
| Body Parts    | 3       | None (all time)    | userId param     |
| Symmetry      | 3       | Configurable       | useAuth() hook   |
| Injury        | 3       | Configurable       | useAuth() hook   |
| Periodization | 3       | Configurable       | inline getUser() |

### Optimization Gaps (Analytics)

- **Massive data duplication**: Every tab independently fetches sessions + exercise_logs + set_logs. No shared data layer.
- **No date filters on 4 of 8 tabs**: General, Strength, Goals, Body Parts fetch ALL historical data.
- **No memoization**: All computations run on every render.
- **Tab switching re-fetches**: Components unmount on tab switch, losing all fetched data. Returning to a tab re-fetches everything.
- **N+1 query problem in Goals**: Each goal spawns 3-4 additional queries.
- **Duplicate computation logic**: Streak calculation exists in useGeneralStats, useGoalsStats, and dashboard's fetchData. Imbalance detection exists in useBodyPartAnalysis, useInjuryRisk, and useDashboardInsights.
- **Three different auth patterns across hooks**: Some take userId as param, some use useAuth(), some call getUser() inline.
- **`select("*")` everywhere**: Over-fetching columns from all 3 main tables.

---

## 15. Navigation Between Exercises (Summary)

This pattern applies to the workout session page (`/workout/[id]`):

```
┌─────────────────────────────────────────────────┐
│  exerciseLogs[] loaded once from DB (with sets)  │
│                                                   │
│  currentExerciseIndex = 0                         │
│  URL: /workout/{id}?exercise=0                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Ex. 0   │→ │ Ex. 1   │→ │ Ex. 2   │          │
│  │(current)│  │         │  │         │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│       ↕                                           │
│  Prev/Next buttons change index + URL             │
│  Exercise list modal for jump-to-any              │
│  No API calls on navigation                       │
│  Set modifications saved per-set to DB            │
│  Set inputs backed up to localStorage             │
└─────────────────────────────────────────────────┘
```

### Active Workout:

- Set data is **mutable** — each confirmed set writes to DB immediately
- `localStorage` backs up in-progress input values
- Previous workout data shown as hint ("Ostatnio: X reps, Y kg")
- Progress bar shows completed exercises / total

### Completed Workout:

- Same page, same data loading
- Sets shown in read-only completed state
- Can still un-complete and re-modify sets (UPDATE queries)

---

## 16. Optimizations Summary

### Implemented Optimizations

| Optimization                           | Where                              | Impact                                                         |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| **Middleware session refresh**         | All routes                         | Prevents auth token expiry                                     |
| **AuthProvider singleton**             | App-wide (layout.tsx)              | Single getSession() + onAuthStateChange, shared via context    |
| **UserMenu from user_metadata**        | Header                             | No extra profile query                                         |
| **RLS-based query filtering**          | Templates list                     | No explicit user_id filter needed                              |
| **Promise.all parallel queries**       | `/workout/new` fetchData           | Templates + exercises loaded concurrently                      |
| **Promise.all for per-exercise data**  | `/workout/[id]`                    | Sets + previous data for all exercises fetched in parallel     |
| **Immediate per-set saves**            | Active workout                     | No data loss risk, each set persisted instantly                |
| **localStorage backup**                | SetInput component                 | Recovers unsaved input on browser crash                        |
| **URL-synced exercise index**          | Workout session                    | Page refresh preserves exercise position                       |
| **Database VIEW for shared templates** | `/templates/shared`                | Pre-joined data, single query                                  |
| **Server-side RPC for template copy**  | Shared templates                   | Atomic cross-user copy, bypasses RLS                           |
| **Client-side search**                 | Exercises page                     | Zero-query instant filtering                                   |
| **Local state removal on delete**      | Templates + Exercises              | Avoids re-fetch after deletion                                 |
| **Nested Supabase joins**              | Template detail, Exercises         | Single query fetches related data via PostgREST joins          |
| **Exercise suggestions**               | New template creation              | Frequency-based suggestions from existing templates            |
| **Exercise recommendations**           | New workout page                   | Analytics-driven recommendations for neglected body parts      |
| **Conditional query skipping**         | Dashboard fetchData                | Skips exercise_logs/set_logs queries if no sessions            |
| **Date filtering at DB level**         | Insights, Trends, Symmetry, Injury | Limits data transfer to relevant time windows                  |
| **Unilateral-only filtering**          | Symmetry analysis                  | `!inner` join filters to only unilateral exercises at DB level |
| **Batch inserts**                      | Starting workout                   | All set_logs inserted in a single query                        |

### Missing / Potential Optimizations

| Opportunity                                 | Current State                                           | Impact                                                |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **Client-side cache / shared data layer**   | Every tab and page re-fetches independently             | Could share sessions/exercises/sets across hooks      |
| **Tab caching in Analytics**                | Unmount destroys data, revisiting re-fetches            | Keep-alive or cache hook results                      |
| **`useMemo` / `useCallback`**               | Analytics computations re-run on every render           | Significant CPU savings on large datasets             |
| **N+1 query fix in Goals**                  | Each goal spawns 3-4 queries                            | Batch all goals into a single calculation pass        |
| **Deduplicate computation logic**           | Streak, imbalance, volume in 3+ places                  | Extract into shared utility functions                 |
| **Unified auth pattern**                    | 3 different patterns across hooks                       | Standardize on userId param                           |
| **Column pruning (`select`)**               | `select("*")` on most queries                           | Reduce payload size                                   |
| **Pagination for sessions**                 | All-time data fetched for 4/8 analytics tabs            | Paginate or use server-side aggregation               |
| **Parallel queries in dashboard fetchData** | Sequential awaits for independent queries               | Use Promise.all                                       |
| **Deduplicate dashboard data pipelines**    | fetchData + useDashboardInsights fetch overlapping data | Share session/exercise data between them              |
| **Template exercises diff on save**         | DELETE ALL + INSERT ALL                                 | Differential update for changed rows only             |
| **Batch previous-workout lookup**           | N individual queries per exercise                       | Single query with GROUP BY or window function         |
| **Offline support**                         | None (depends on network for all reads/writes)          | Service worker + IndexedDB for mid-workout resilience |

---

## Appendix: Data Flow Diagrams

### Authentication Flow (Every Page Load)

```
Browser Request
    │
    ▼
Middleware (src/middleware.ts)
    │── createServerClient(cookies)
    │── supabase.auth.getUser()
    │── Refreshes token if needed
    │── Syncs cookies to response
    │
    ▼
AuthProvider (src/contexts/AuthContext.tsx) — mounted in layout.tsx
    │── supabase.auth.getSession() → sets user state
    │── supabase.auth.onAuthStateChange() → listens for changes
    │── Provides { user, loading } via React Context
    │
    ▼
Client Component
    │── useAuth() → reads user from context (no query)
    │── useEffect: if !user → redirect to /login
    │── useEffect: if user → fetch page-specific data
    │── Render UI
```

### Workout Lifecycle

```
[Template Created] (/templates/new)
    │
    │ INSERT workout_templates + INSERT workout_template_exercises
    │ Exercises configured with: sets_count, target_reps, rest_seconds
    │
    ▼
[User Starts Workout] (/workout/new)
    │
    │ INSERT workout_sessions (started_at = now)
    │ INSERT exercise_logs (one per exercise, from template)
    │ INSERT set_logs (N per exercise, all empty: reps=0, weight=0, completed=false)
    │ → All rows PRE-CREATED in DB before workout page loads
    │
    ▼
[Workout Page Loads] (/workout/{session_id})
    │
    │ READS: session + exercise_logs (joined with exercises) + set_logs
    │ READS: previous workout data for each exercise (N queries)
    │ → Displays "Previous" hint for progressive overload
    │
    ▼
[During Workout — PER-SET SAVES]
    │
    │ User fills in reps/weight/RIR for each set
    │ localStorage backs up in-progress input
    │ On "Confirm": UPDATE set_logs (reps, weight, rir, side, completed=true)
    │ localStorage cleared for that set
    │ Navigates between exercises via index (no DB queries)
    │
    ▼
[User Finishes Workout — 1 DB OPERATION]
    │
    │ UPDATE workout_sessions SET completed_at = now()
    │ (All set data already saved)
    │ → Redirect to /dashboard
    │
    ▼
[Cancelled Workout — 3 CASCADE DELETES]
    │
    ├──▶ DELETE set_logs (all for this session's exercise_logs)
    ├──▶ DELETE exercise_logs (all for this session)
    └──▶ DELETE workout_sessions (the session itself)
```

### Template Sharing Lifecycle

```
[Owner shares template]
    │
    │ INSERT shared_workout_templates
    │   { workout_template_id, shared_by_user_id, is_public: true }
    │
    ▼
[Friend views /templates/shared]
    │
    │ SELECT from shared_templates_with_details VIEW
    │   (joins: shared_workout_templates + workout_templates + user_profiles)
    │   Filter: shared_by_user_id != current user
    │
    ▼
[Friend copies template]
    │
    │ RPC: copy_shared_workout_template(source_id, user_id)
    │   → Server-side PostgreSQL function
    │   → Creates new workout_template (owned by friend)
    │   → Copies all workout_template_exercises
    │   → Returns { success, new_template_id, exercises_copied }
    │
    ▼
[Friend now has their own copy]
    │
    └──▶ Redirect to /templates/{new_template_id}
         Can edit independently (no link to original)
```
