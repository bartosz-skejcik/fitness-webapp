# Fitness App — Data Operations & Architecture Guide v2 (Android / Jetpack Compose)

> **Purpose**: This document serves as the authoritative guideline for Android developers implementing the native Kotlin/Jetpack Compose version of the fitness tracker app. It is derived from the [web app's DATA_OPERATIONS.md](https://github.com/bartosz-skejcik/fitness-webapp/blob/main/DATA_OPERATIONS.md) and incorporates all optimizations from [DATA_OPTIMIZATIONS.md](https://github.com/bartosz-skejcik/fitness-webapp/blob/main/DATA_OPTIMIZATIONS.md), adapted for Android-native patterns.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema (Shared with Web)](#2-database-schema-shared-with-web)
3. [Database-Level Optimizations (Apply Before Android Development)](#3-database-level-optimizations-apply-before-android-development)
4. [Android Architecture & Technology Stack](#4-android-architecture--technology-stack)
5. [Data Layer: Repository Pattern](#5-data-layer-repository-pattern)
6. [Offline-First Strategy with Room](#6-offline-first-strategy-with-room)
7. [Screen: Authentication Flow](#7-screen-authentication-flow)
8. [Screen: Dashboard (Home)](#8-screen-dashboard-home)
9. [Screen: Workout Templates List](#9-screen-workout-templates-list)
10. [Screen: Workout Template Detail/Edit](#10-screen-workout-template-detailedit)
11. [Screen: Create New Workout Template](#11-screen-create-new-workout-template)
12. [Screen: Start New Workout](#12-screen-start-new-workout)
13. [Screen: Active Workout Session](#13-screen-active-workout-session)
14. [Screen: Exercises Management](#14-screen-exercises-management)
15. [Screen: Friends](#15-screen-friends)
16. [Screen: Friend Progress Comparison](#16-screen-friend-progress-comparison)
17. [Screen: Shared Workout Templates](#17-screen-shared-workout-templates)
18. [Screen: Analytics / Progress](#18-screen-analytics--progress)
19. [Optimizations Summary (Web Gaps → Android Solutions)](#19-optimizations-summary-web-gaps--android-solutions)
20. [Implementation Priority](#20-implementation-priority)
21. [Appendix: Data Flow Diagrams](#appendix-data-flow-diagrams)

---

## 1. Architecture Overview

### Web App (Current — for reference)

| Layer         | Technology                                                    |
| ------------- | ------------------------------------------------------------- |
| Frontend      | Next.js (App Router), React, TypeScript                       |
| State         | React `useState`/`useEffect`, React Context                   |
| Backend / DB  | Supabase (PostgreSQL via `@supabase/supabase-js`)             |
| Auth          | Supabase Auth (Google & Discord OAuth, cookie-based sessions) |
| Data Fetching | Direct Supabase browser-client calls in `useEffect`           |
| Caching       | **None** — no SWR, no React Query, no client-side cache       |

### Android App (Target)

| Layer              | Technology                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| UI                 | Jetpack Compose, Material 3                                                 |
| Navigation         | Jetpack Navigation Compose (type-safe)                                      |
| Architecture       | MVVM + Clean Architecture (UI → ViewModel → Repository → DataSource)        |
| DI                 | Hilt (Dagger)                                                               |
| State Management   | `StateFlow` / `MutableStateFlow` in ViewModels, `collectAsState` in Compose |
| Remote Data Source | Supabase Kotlin SDK (`io.github.jan-tennert.supabase`)                      |
| Local Data Source  | Room Database (offline cache + active workout resilience)                   |
| Networking         | Ktor (used by Supabase Kotlin SDK internally)                               |
| Auth               | Supabase Auth via Kotlin SDK (Google OAuth via Credential Manager)          |
| Caching Strategy   | **Offline-first**: Room as single source of truth, Supabase for sync        |
| Background Sync    | WorkManager (periodic sync of analytics data)                               |
| Charts             | Vico or MPAndroidChart (Compose-compatible)                                 |

### Key Architectural Differences from Web

| Concern                | Web (Current)                       | Android (Target)                                    |
| ---------------------- | ----------------------------------- | --------------------------------------------------- |
| Data caching           | None — re-fetch on every navigation | Room DB as persistent cache + StateFlow in-memory   |
| Offline support        | None                                | Full offline for active workouts, partial elsewhere |
| Auth token management  | Middleware cookie refresh           | Supabase Kotlin SDK auto-refresh                    |
| Duplicate data fetches | Multiple hooks fetch same data      | Single Repository per domain, shared by ViewModels  |
| N+1 queries            | Present in workout page & analytics | Batched queries via SQL functions                   |
| Computation location   | Client-side JS in browser           | Database functions + local Room queries             |

---

## 2. Database Schema (Shared with Web)

The Android app connects to the **same Supabase PostgreSQL database**. The schema is identical:

### Tables

| Table                        | Key Columns                                                                                                                   | Purpose                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `auth.users`                 | `id`, `email`, `user_metadata (jsonb)`                                                                                        | Supabase-managed auth                                |
| `user_profiles`              | `id` (FK→auth.users), `email`, `full_name`, `avatar_url`                                                                      | Public profile info, auto-created via trigger        |
| `exercises`                  | `id`, `user_id`, `name`, `description`, `muscle_group`, `target_body_part`, `is_unilateral`, `created_at`                     | Exercise catalog (user-scoped)                       |
| `exercise_body_parts`        | `id`, `exercise_id`, `body_part`, `is_primary`                                                                                | Many-to-many: exercises ↔ body parts                 |
| `workout_templates`          | `id`, `user_id`, `name`, `workout_type`, `description`, `created_at`                                                          | Reusable workout plans                               |
| `workout_template_exercises` | `id`, `workout_template_id`, `exercise_id`, `order_index`, `sets_count`, `target_reps_min`, `target_reps_max`, `rest_seconds` | Exercises within a template                          |
| `workout_sessions`           | `id`, `user_id`, `workout_template_id`, `name`, `workout_type`, `started_at`, `completed_at`, `notes`                         | A workout instance (in-progress or completed)        |
| `exercise_logs`              | `id`, `workout_session_id`, `exercise_id`, `order_index`, `target_reps_min`, `target_reps_max`, `rest_seconds`, `notes`       | Exercise performed within a session                  |
| `set_logs`                   | `id`, `exercise_log_id`, `set_number`, `reps`, `weight`, `rir`, `completed`, `side`                                           | Individual set data (reps, weight, RIR, L/R side)    |
| `friendships`                | `id`, `user_id`, `friend_id`, `status`                                                                                        | Friend connections (`pending`/`accepted`/`rejected`) |
| `shared_workout_templates`   | `id`, `workout_template_id`, `shared_by_user_id`, `is_public`                                                                 | Templates shared with friends                        |
| `body_part_goals`            | `id`, `user_id`, `body_part`, `goal_type`, `target_value`, `timeframe`, `is_active`                                           | Per-body-part volume/frequency goals                 |

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

friendships ←→ user_profiles
shared_workout_templates → workout_templates
body_part_goals → auth.users
```

### Existing Views

- **`user_friends`**: Pre-filtered view of accepted friendships with `friend_user_id` resolved.
- **`shared_templates_with_details`**: Pre-joined view of shared templates with template metadata, sharer profile, and exercise count.

### Existing RPC Functions

- **`copy_shared_workout_template(p_source_template_id, p_user_id)`**: Atomic server-side function to copy a shared template (SECURITY DEFINER, bypasses RLS).

---

## 3. Database-Level Optimizations (Apply Before Android Development)

These SQL migrations should be applied to the Supabase database **before** the Android app is built. They benefit both the web and Android clients.

### 3.1 Critical Indexes

```sql
-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started
    ON workout_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_session
    ON exercise_logs(workout_session_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_completed
    ON set_logs(exercise_log_id, completed)
    WHERE completed = true;

CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise_id
    ON exercise_logs(exercise_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed
    ON workout_sessions(user_id, completed_at DESC NULLS LAST)
    WHERE completed_at IS NOT NULL;
```

### 3.2 Materialized View: User Workout Stats

Eliminates 7+ queries on dashboard → 1 query returning 1 row.

> **Bugs fixed (2026-02-19):**
> - `COUNT(ws.id)` → `COUNT(DISTINCT ws.id)` and `COUNT(DISTINCT CASE ... THEN ws.id END)`: the JOIN to `exercise_logs` and `set_logs` multiplies session rows (one per set), causing massive overcounting. `DISTINCT` on the session ID de-duplicates.
> - `weekly_workouts` and `total_volume` now use `date_trunc('week', NOW())` (Monday 00:00 of the current calendar week) instead of `NOW() - INTERVAL '7 days'`. The rolling-7-days approach would count e.g. only 3 days of the week if today is Wednesday.
> - `total_volume` is now the **current week's volume**, not all-time. The column name is intentionally kept as `total_volume` for API compatibility.
> - Removed the `refresh_user_workout_stats()` wrapper function — the trigger now calls `REFRESH MATERIALIZED VIEW CONCURRENTLY` directly, which is simpler and avoids an unnecessary indirection.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS user_workout_stats AS
SELECT
    ws.user_id,
    COUNT(DISTINCT ws.id) AS total_workouts,
    COUNT(DISTINCT CASE
        WHEN ws.started_at >= date_trunc('week', NOW()) THEN ws.id
    END) AS weekly_workouts,
    COALESCE(SUM(
        CASE WHEN ws.started_at >= date_trunc('week', NOW())
            THEN sl.reps * sl.weight
            ELSE 0
        END
    ), 0) AS total_volume,
    MAX(ws.started_at) AS last_workout_at
FROM workout_sessions ws
LEFT JOIN exercise_logs el ON el.workout_session_id = ws.id
LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.completed = true
WHERE ws.completed_at IS NOT NULL
GROUP BY ws.user_id;

-- Create unique index (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_workout_stats_user
    ON user_workout_stats(user_id);
```

### 3.3 Database Function: Current Streak

```sql
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_streak INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    has_workout BOOLEAN;
BEGIN
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM workout_sessions
            WHERE user_id = p_user_id
            AND DATE(started_at AT TIME ZONE 'UTC') = check_date
            AND completed_at IS NOT NULL
        ) INTO has_workout;

        IF NOT has_workout THEN
            -- Allow checking yesterday if no workout today yet
            IF current_streak = 0 AND check_date = CURRENT_DATE THEN
                check_date := check_date - INTERVAL '1 day';
                CONTINUE;
            END IF;
            EXIT;
        END IF;

        current_streak := current_streak + 1;
        check_date := check_date - INTERVAL '1 day';
    END LOOP;

    RETURN current_streak;
END;
$$ LANGUAGE plpgsql;
```

### 3.4 Database Function: Dashboard Stats (Unified)

Combines stats + streak into a single RPC call.

```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS TABLE (
    total_workouts BIGINT,
    weekly_workouts BIGINT,
    total_volume NUMERIC,
    current_streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.total_workouts,
        s.weekly_workouts,
        s.total_volume,
        calculate_user_streak(p_user_id) as current_streak
    FROM user_workout_stats s
    WHERE s.user_id = p_user_id;

    -- Return zeros if no data
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

### 3.5 Database Function: Batch Previous Workout Lookup

Fixes the N+1 query problem in the active workout page.

```sql
CREATE OR REPLACE FUNCTION get_previous_workout_sets(
    p_exercise_ids UUID[],
    p_current_session_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    exercise_id UUID,
    set_number INTEGER,
    reps INTEGER,
    weight NUMERIC,
    rir INTEGER,
    side TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_logs AS (
        SELECT DISTINCT ON (el.exercise_id)
            el.exercise_id,
            el.id as exercise_log_id
        FROM exercise_logs el
        INNER JOIN workout_sessions ws ON ws.id = el.workout_session_id
        WHERE el.exercise_id = ANY(p_exercise_ids)
            AND el.workout_session_id != p_current_session_id
            AND ws.completed_at IS NOT NULL
            AND ws.user_id = p_user_id
        ORDER BY el.exercise_id, ws.completed_at DESC
    )
    SELECT
        ll.exercise_id,
        sl.set_number,
        sl.reps,
        sl.weight,
        sl.rir,
        sl.side
    FROM latest_logs ll
    JOIN set_logs sl ON sl.exercise_log_id = ll.exercise_log_id
    ORDER BY ll.exercise_id, sl.set_number;
END;
$$ LANGUAGE plpgsql;
```

### 3.6 Database Function: Goal Progress (Batch)

Fixes the N×4 query problem in the analytics goals tab.

> **Bugs fixed (2026-02-19):**
> - **Volume included sets from the wrong body part.** `set_logs` was joined directly to `exercise_logs`, so sets from exercises that *didn't* match the goal's body part were still summed. Added `AND e.id IS NOT NULL` to the `set_logs` join condition so only sets from matching exercises are aggregated.
> - **Frequency counted all sessions, not just relevant ones.** `COUNT(DISTINCT ws.id)` counted every session in the timeframe, including ones with no exercises targeting the goal body part. Changed to `COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN ws.id END)`.
> - **Timeframe used rolling windows instead of calendar periods.** `weekly` now uses `date_trunc('week', NOW())` (Monday 00:00) and `monthly` uses `date_trunc('month', NOW())` (1st of the month). Added an `ELSE` clause to the `CASE` to prevent silent `NULL` comparisons for unknown timeframe values.

```sql
CREATE OR REPLACE FUNCTION calculate_all_goal_progress(p_user_id UUID)
RETURNS TABLE (
    goal_id UUID,
    body_part TEXT,
    goal_type TEXT,
    target_value NUMERIC,
    timeframe TEXT,
    current_value NUMERIC,
    progress_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        g.id AS goal_id,
        g.body_part,
        g.goal_type,
        g.target_value,
        g.timeframe,
        CASE
            WHEN g.goal_type = 'volume' THEN
                COALESCE(SUM(sl.reps * sl.weight), 0)
            WHEN g.goal_type = 'frequency' THEN
                COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN ws.id END)::NUMERIC
            ELSE 0
        END AS current_value,
        CASE
            WHEN g.target_value > 0 THEN
                ROUND(
                    (CASE
                        WHEN g.goal_type = 'volume' THEN COALESCE(SUM(sl.reps * sl.weight), 0)
                        WHEN g.goal_type = 'frequency' THEN COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN ws.id END)::NUMERIC
                        ELSE 0
                    END) / g.target_value * 100,
                    1
                )
            ELSE 0
        END AS progress_percentage
    FROM body_part_goals g
    LEFT JOIN workout_sessions ws ON ws.user_id = g.user_id
        AND ws.completed_at IS NOT NULL
        AND ws.started_at >= CASE
            WHEN g.timeframe = 'weekly'  THEN date_trunc('week', NOW())
            WHEN g.timeframe = 'monthly' THEN date_trunc('month', NOW())
            ELSE NOW() - INTERVAL '0 days'
        END
    LEFT JOIN exercise_logs el ON el.workout_session_id = ws.id
    LEFT JOIN exercises e ON e.id = el.exercise_id
        AND e.target_body_part = g.body_part
    LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id
        AND sl.completed = true
        AND e.id IS NOT NULL
    WHERE g.user_id = p_user_id
        AND g.is_active = true
    GROUP BY g.id, g.body_part, g.goal_type, g.target_value, g.timeframe;
END;
$$ LANGUAGE plpgsql;
```

### 3.7 Database Function: Friend Comparison Stats

> **Bug fixed (2026-02-19):** The `LATERAL` subquery recomputed session volume once per outer row. Because `workout_sessions` is multiplied by `set_logs` due to the JOINs, the same `ws.id` triggered the lateral repeatedly with identical results. Replaced with a pre-aggregated CTE so each session's volume is computed exactly once.

```sql
CREATE OR REPLACE FUNCTION get_comparison_stats(
    p_user_id UUID,
    p_friend_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    compared_user_id UUID,
    total_workouts BIGINT,
    total_sets BIGINT,
    total_volume NUMERIC,
    total_reps BIGINT,
    avg_weight NUMERIC,
    best_session_volume NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH session_volumes AS (
        SELECT
            el.workout_session_id,
            SUM(sl.reps * sl.weight) AS vol
        FROM exercise_logs el
        JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.completed = true
        GROUP BY el.workout_session_id
    )
    SELECT
        ws.user_id AS compared_user_id,
        COUNT(DISTINCT ws.id) AS total_workouts,
        COUNT(sl.id) AS total_sets,
        COALESCE(SUM(sl.reps * sl.weight), 0) AS total_volume,
        COALESCE(SUM(sl.reps)::BIGINT, 0::BIGINT) AS total_reps,
        COALESCE(AVG(sl.weight) FILTER (WHERE sl.weight > 0), 0) AS avg_weight,
        COALESCE(MAX(sv.vol), 0) AS best_session_volume
    FROM workout_sessions ws
    LEFT JOIN exercise_logs el ON el.workout_session_id = ws.id
    LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.completed = true
    LEFT JOIN session_volumes sv ON sv.workout_session_id = ws.id
    WHERE ws.user_id IN (p_user_id, p_friend_id)
        AND ws.completed_at IS NOT NULL
        AND ws.started_at >= NOW() - make_interval(days => p_days)
    GROUP BY ws.user_id;
END;
$$ LANGUAGE plpgsql;
```

### 3.8 Trigger: Auto-Refresh Stats on Workout Completion

> **Bug fixed (2026-02-19):** The trigger called `refresh_user_workout_stats()`, a helper function that no longer exists (removed in 3.2). The trigger now calls `REFRESH MATERIALIZED VIEW CONCURRENTLY` directly. The `CONCURRENTLY` option requires the unique index from 3.2 to be present and allows the view to remain queryable during the refresh.

```sql
CREATE OR REPLACE FUNCTION on_workout_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY user_workout_stats;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workout_completed
    AFTER UPDATE OF completed_at ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION on_workout_completed();
```

---

## 4. Android Architecture & Technology Stack

### Package Structure

```
com.fitness.app/
├── di/                          # Hilt modules
│   ├── DatabaseModule.kt
│   ├── NetworkModule.kt
│   └── RepositoryModule.kt
├── data/
│   ├── local/                   # Room database
│   │   ├── FitnessDatabase.kt
│   │   ├── dao/
│   │   │   ├── ExerciseDao.kt
│   │   │   ├── WorkoutTemplateDao.kt
│   │   │   ├── WorkoutSessionDao.kt
│   │   │   ├── SetLogDao.kt
│   │   │   └── FriendshipDao.kt
│   │   └── entity/
│   │       ├── ExerciseEntity.kt
│   │       ├── ExerciseBodyPartEntity.kt
│   │       ├── WorkoutTemplateEntity.kt
│   │       ├── WorkoutTemplateExerciseEntity.kt
│   │       ├── WorkoutSessionEntity.kt
│   │       ├── ExerciseLogEntity.kt
│   │       ├── SetLogEntity.kt
│   │       ├── FriendshipEntity.kt
│   │       ├── UserProfileEntity.kt
│   │       ├── BodyPartGoalEntity.kt
│   │       └── SharedWorkoutTemplateEntity.kt
│   ├── remote/                  # Supabase data sources
│   │   ├── SupabaseClient.kt
│   │   ├── ExerciseRemoteDataSource.kt
│   │   ├── WorkoutRemoteDataSource.kt
│   │   ├── FriendRemoteDataSource.kt
│   │   └── AnalyticsRemoteDataSource.kt
│   ├── repository/              # Repository implementations
│   │   ├── ExerciseRepository.kt
│   │   ├── WorkoutTemplateRepository.kt
│   │   ├── WorkoutSessionRepository.kt
│   │   ├── FriendRepository.kt
│   │   ├── AnalyticsRepository.kt
│   │   └── AuthRepository.kt
│   └── mapper/                  # Entity ↔ Domain model mappers
│       └── ...
├── domain/
│   ├── model/                   # Domain models (Kotlin data classes)
│   │   ├── Exercise.kt
│   │   ├── WorkoutTemplate.kt
│   │   ├── WorkoutSession.kt
│   │   ├── SetLog.kt
│   │   ├── DashboardStats.kt
│   │   ├── AnalyticsData.kt
│   │   └── ...
│   └── util/                    # Shared computation logic
│       ├── StreakCalculator.kt
│       ├── VolumeCalculator.kt
│       ├── ImbalanceDetector.kt
│       ├── EpleyOneRepMax.kt
│       └── InjuryRiskScorer.kt
├── ui/
│   ├── theme/
│   ├── navigation/
│   │   └── AppNavGraph.kt
│   ├── common/                  # Shared composables
│   ├── auth/
│   ├── dashboard/
│   │   ├── DashboardScreen.kt
│   │   └── DashboardViewModel.kt
│   ├── templates/
│   ├── workout/
│   ├── exercises/
│   ├── friends/
│   ├── analytics/
│   └── shared/
└── util/
    ├── NetworkMonitor.kt
    └── DateUtils.kt
```

### Dependency Versions (Recommended)

```kotlin
// build.gradle.kts (app)
dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2025.01.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // ViewModel + Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.53.1")
    kapt("com.google.dagger:hilt-compiler:2.53.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // Supabase Kotlin SDK
    implementation(platform("io.github.jan-tennert.supabase:bom:3.1.1"))
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.ktor:ktor-client-okhttp:3.0.3")

    // WorkManager (background sync)
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Charting
    implementation("com.patrykandpatrick.vico:compose-m3:2.1.0")

    // Coil (avatar images)
    implementation("io.coil-kt:coil-compose:2.7.0")

    // DataStore (preferences)
    implementation("androidx.datastore:datastore-preferences:1.1.1")
}
```

---

## 5. Data Layer: Repository Pattern

### Core Principle: Single Source of Truth

Every piece of data flows through a **Repository** that decides whether to serve from Room (local) or Supabase (remote).

```kotlin
// Pattern for all repositories
class WorkoutSessionRepository @Inject constructor(
    private val remoteDataSource: WorkoutRemoteDataSource,
    private val localDao: WorkoutSessionDao,
    private val networkMonitor: NetworkMonitor
) {
    /**
     * Returns a Flow of sessions from Room (offline-first).
     * Triggers a background sync from Supabase when network is available.
     */
    fun getRecentSessions(userId: String, limit: Int = 5): Flow<List<WorkoutSession>> {
        return localDao.getRecentSessions(userId, limit)
            .onStart { syncIfNeeded(userId) }
            .map { entities -> entities.map { it.toDomainModel() } }
    }

    private suspend fun syncIfNeeded(userId: String) {
        if (networkMonitor.isOnline()) {
            try {
                val remoteSessions = remoteDataSource.fetchRecentSessions(
                    userId = userId,
                    limit = 20,
                    columns = "id, name, workout_type, started_at, completed_at"
                )
                localDao.upsertAll(remoteSessions.map { it.toEntity() })
            } catch (e: Exception) {
                Log.w("WorkoutRepo", "Sync failed", e)
            }
        }
    }
}
```

### Supabase Kotlin Client Setup

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideSupabaseClient(): SupabaseClient {
        return createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY
        ) {
            install(Auth) {
                autoSaveToStorage = true
                autoLoadFromStorage = true
            }
            install(Postgrest)
            install(Realtime)
        }
    }
}
```

### Column Pruning (Applied Everywhere)

**Web gap**: The web app uses `select("*")` everywhere, transferring unnecessary data.

**Android solution**: Always specify columns in Supabase queries.

```kotlin
// ❌ Web pattern (don't do this)
supabase.from("workout_sessions").select()

// ✅ Android pattern — only fetch what you need
supabase.from("workout_sessions").select(
    columns = Columns.list("id", "name", "workout_type", "started_at", "completed_at")
) {
    filter { eq("user_id", userId) }
    order("started_at", Order.DESCENDING)
    limit(5)
}
```

---

## 6. Offline-First Strategy with Room

### Room Database Definition

```kotlin
@Database(
    entities = [
        ExerciseEntity::class,
        ExerciseBodyPartEntity::class,
        WorkoutTemplateEntity::class,
        WorkoutTemplateExerciseEntity::class,
        WorkoutSessionEntity::class,
        ExerciseLogEntity::class,
        SetLogEntity::class,
        FriendshipEntity::class,
        UserProfileEntity::class,
        BodyPartGoalEntity::class,
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class FitnessDatabase : RoomDatabase() {
    abstract fun exerciseDao(): ExerciseDao
    abstract fun workoutTemplateDao(): WorkoutTemplateDao
    abstract fun workoutSessionDao(): WorkoutSessionDao
    abstract fun exerciseLogDao(): ExerciseLogDao
    abstract fun setLogDao(): SetLogDao
    abstract fun friendshipDao(): FriendshipDao
    abstract fun analyticsDao(): AnalyticsDao
}
```

### Offline Tiers

| Feature              | Offline Capability | Strategy                                               |
| -------------------- | ------------------ | ------------------------------------------------------ |
| Active workout       | **Full**           | Room is primary store; sync to Supabase on completion  |
| View recent workouts | **Full**           | Cached in Room on each sync                            |
| View templates       | **Full**           | Cached in Room                                         |
| Edit templates       | **Partial**        | Queue changes; sync when online                        |
| Dashboard stats      | **Partial**        | Show cached stats; refresh indicator when stale        |
| Analytics            | **Partial**        | Cached computation results in Room                     |
| Friends / Social     | **Online only**    | Requires network; show offline message                 |
| Start new workout    | **Full**           | Can start from cached template; create session locally |

### Sync Strategy for Active Workouts

This is the most critical offline scenario — the user must **never lose workout data**.

```kotlin
class ActiveWorkoutRepository @Inject constructor(
    private val sessionDao: WorkoutSessionDao,
    private val exerciseLogDao: ExerciseLogDao,
    private val setLogDao: SetLogDao,
    private val remote: WorkoutRemoteDataSource,
    private val networkMonitor: NetworkMonitor
) {
    /**
     * Save a set immediately to Room.
     * Queue a Supabase sync that will execute when network is available.
     */
    suspend fun completeSet(setId: String, reps: Int, weight: Double, rir: Int, side: String?) {
        // 1. Always save to Room first (instant, never fails)
        setLogDao.updateSet(setId, reps, weight, rir, side, completed = true)

        // 2. Attempt remote sync (fire-and-forget)
        if (networkMonitor.isOnline()) {
            try {
                remote.updateSetLog(setId, reps, weight, rir, side, completed = true)
            } catch (e: Exception) {
                setLogDao.markPendingSync(setId)
            }
        } else {
            setLogDao.markPendingSync(setId)
        }
    }

    /**
     * Sync all pending set changes when connectivity is restored.
     * Called by WorkManager or on app foreground.
     */
    suspend fun syncPendingSets() {
        val pendingSets = setLogDao.getPendingSyncSets()
        for (set in pendingSets) {
            try {
                remote.updateSetLog(set.id, set.reps, set.weight, set.rir, set.side, set.completed)
                setLogDao.clearPendingSync(set.id)
            } catch (e: Exception) {
                break // Stop on first failure, retry later
            }
        }
    }
}
```

### WorkManager for Background Sync

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val activeWorkoutRepo: ActiveWorkoutRepository,
    private val analyticsRepo: AnalyticsRepository
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            activeWorkoutRepo.syncPendingSets()
            analyticsRepo.refreshCacheIfStale()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun enqueuePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                repeatInterval = 15,
                repeatIntervalTimeUnit = TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork("fitness_sync", ExistingPeriodicWorkPolicy.KEEP, syncRequest)
        }
    }
}
```

---

## 7. Screen: Authentication Flow

### Architecture

```
Google Sign-In (Credential Manager)
    │
    ▼
Supabase Auth (signInWith(Google))
    │
    ▼
AuthRepository stores session
    │
    ▼
AuthViewModel emits AuthState sealed class
    │
    ▼
NavGraph observes state → navigates to Dashboard or Login
```

### Implementation

```kotlin
// AuthState.kt
sealed class AuthState {
    data object Loading : AuthState()
    data class Authenticated(
        val userId: String,
        val displayName: String,
        val avatarUrl: String?
    ) : AuthState()
    data object Unauthenticated : AuthState()
}

// AuthViewModel.kt
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    val authState: StateFlow<AuthState> = authRepository.observeAuthState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AuthState.Loading)

    fun signInWithGoogle(context: Context) {
        viewModelScope.launch {
            authRepository.signInWithGoogle(context)
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
        }
    }
}

// AuthRepository.kt
class AuthRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    fun observeAuthState(): Flow<AuthState> = supabaseClient.auth.sessionStatus.map { status ->
        when (status) {
            is SessionStatus.Authenticated -> {
                val user = supabaseClient.auth.currentUserOrNull()
                AuthState.Authenticated(
                    userId = user?.id ?: "",
                    displayName = user?.userMetadata?.get("full_name")?.toString() ?: "",
                    avatarUrl = user?.userMetadata?.get("avatar_url")?.toString()
                )
            }
            is SessionStatus.NotAuthenticated -> AuthState.Unauthenticated
            else -> AuthState.Loading
        }
    }

    fun getCurrentUserId(): String? = supabaseClient.auth.currentUserOrNull()?.id
}
```

### Key Differences from Web

- **No middleware session refresh** — Supabase Kotlin SDK handles token refresh automatically.
- **No redundant `auth.getUser()` calls** — Single `sessionStatus` Flow observed app-wide.
- **Credential Manager** replaces browser OAuth redirect flow.

---

## 8. Screen: Dashboard (Home)

### Web Problems Being Solved

| Web Problem                                          | Android Solution                                  |
| ---------------------------------------------------- | ------------------------------------------------- |
| 9 sequential Supabase queries                        | 1 RPC call (`get_dashboard_stats`) + 2 queries    |
| `fetchData()` and `useDashboardInsights()` duplicate | Single `DashboardRepository` shares data          |
| `select("*")` over-fetching                          | Column pruning on all queries                     |
| No caching — re-fetches on every navigation          | Room cache + StateFlow; instant display on return |
| No `useMemo` — stats recompute on every render       | Computed once in ViewModel, cached in StateFlow   |
| Client-side streak calculation                       | Database function `calculate_user_streak()`       |

### Data Operations

```
DashboardScreen mounts
    │
    DashboardViewModel.init()
    │
    ├── [PARALLEL via coroutineScope]
    │   │
    │   ├── 1. RPC: get_dashboard_stats(userId)
    │   │   → Returns: { total_workouts, weekly_workouts, total_volume, current_streak }
    │   │   → 1 query instead of web's 8
    │   │
    │   ├── 2. SELECT from workout_sessions
    │   │   → columns: id, name, workout_type, started_at, completed_at
    │   │   → .eq(user_id).order(started_at DESC).limit(5)
    │   │   → Only 5 rows (web fetches ALL then slices)
    │   │
    │   ├── 3. SELECT from workout_templates
    │   │   → columns: id, name, workout_type, description, created_at
    │   │   → .eq(user_id).order(created_at DESC)
    │   │
    │   └── 4. Insights computation (from cached analytics data in Room)
    │       → If Room data is stale (>5 min), trigger background refresh
    │       → Compute: imbalance, undertrained, PR, top performer
    │
    └── All results → DashboardUiState StateFlow
```

### ViewModel

```kotlin
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dashboardRepo: DashboardRepository,
    private val templateRepo: WorkoutTemplateRepository,
    private val sessionRepo: WorkoutSessionRepository,
    private val analyticsRepo: AnalyticsRepository,
    private val authRepo: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val userId = authRepo.getCurrentUserId() ?: return@launch

            coroutineScope {
                val statsDeferred = async { dashboardRepo.getDashboardStats(userId) }
                val sessionsDeferred = async { sessionRepo.getRecentSessions(userId, limit = 5) }
                val templatesDeferred = async { templateRepo.getTemplates(userId) }
                val insightsDeferred = async { analyticsRepo.getCachedInsights(userId) }

                _uiState.update { state ->
                    state.copy(
                        stats = statsDeferred.await(),
                        recentSessions = sessionsDeferred.await().first(),
                        templates = templatesDeferred.await().first(),
                        insights = insightsDeferred.await(),
                        isLoading = false
                    )
                }
            }
        }
    }
}

data class DashboardUiState(
    val isLoading: Boolean = true,
    val stats: DashboardStats = DashboardStats(),
    val recentSessions: List<WorkoutSession> = emptyList(),
    val templates: List<WorkoutTemplate> = emptyList(),
    val insights: List<BodyPartInsight> = emptyList()
)
```

### Total Queries: 3 parallel (+ 1 RPC) vs Web's 9 sequential

| Metric           | Web        | Android   |
| ---------------- | ---------- | --------- |
| Supabase calls   | 9          | 3 + 1 RPC |
| Data transferred | ~50-100 KB | ~5-10 KB  |
| Time to content  | ~1500ms    | ~300ms    |
| On return nav    | Re-fetches | Instant   |

---

## 9. Screen: Workout Templates List

### Data Operations

```
TemplatesScreen mounts
    │
    TemplatesViewModel.init()
    │
    ├── Observe: templateRepo.getTemplates(userId) → Flow<List<WorkoutTemplate>>
    │   → Served from Room (instant) + background Supabase sync
    │
    └── UI renders template cards from StateFlow
```

### Delete Operation

```kotlin
fun deleteTemplate(templateId: String) {
    viewModelScope.launch {
        // 1. Delete from Room immediately (instant UI update via Flow)
        templateDao.delete(templateId)

        // 2. Delete from Supabase
        try {
            supabase.from("workout_templates").delete {
                filter { eq("id", templateId) }
            }
        } catch (e: Exception) {
            // Re-insert to Room if remote fails, or queue for later
        }
    }
}
```

### Optimization vs Web

- **Web**: Fetches ALL templates on every page visit, uses `select("*")`.
- **Android**: Room Flow provides instant data; background sync only fetches changes. Column pruning applied.

---

## 10. Screen: Workout Template Detail/Edit

### Data Operations (View Mode)

```
TemplateDetailScreen(templateId)
    │
    TemplateDetailViewModel.init(templateId)
    │
    ├── [PARALLEL]
    │   ├── 1. Room: templateDao.getTemplateWithExercises(templateId) → Flow
    │   │   → Uses Room @Relation for nested joins
    │   │
    │   ├── 2. Room: exerciseDao.getAllExercises(userId) → Flow
    │   │   → For the exercise picker in edit mode
    │   │
    │   └── 3. Supabase: check if shared
    │       → SELECT id FROM shared_workout_templates WHERE workout_template_id = ?
    │
    └── Background: sync template data from Supabase if stale
```

### Save Operation (Edit Mode) — Differential Update

**Web pattern (problematic)**: DELETE ALL + INSERT ALL template exercises → full re-fetch.

**Android pattern (optimized)**: Compute and apply diff.

```kotlin
suspend fun saveTemplateChanges(
    templateId: String,
    updatedName: String,
    updatedType: String,
    updatedDescription: String?,
    updatedExercises: List<TemplateExercise>
) {
    // 1. Update template metadata
    supabase.from("workout_templates").update({
        set("name", updatedName)
        set("workout_type", updatedType)
        set("description", updatedDescription)
        set("updated_at", Clock.System.now().toString())
    }) {
        filter { eq("id", templateId) }
    }

    // 2. Compute diff
    val currentExercises = templateExerciseDao.getByTemplateId(templateId)
    val currentIds = currentExercises.map { it.exerciseId }.toSet()
    val updatedIds = updatedExercises.map { it.exerciseId }.toSet()

    val toDelete = currentIds - updatedIds
    val toInsert = updatedIds - currentIds
    val toUpdate = currentIds.intersect(updatedIds)

    // 3. Apply targeted changes (not DELETE ALL + INSERT ALL)
    if (toDelete.isNotEmpty()) {
        supabase.from("workout_template_exercises").delete {
            filter {
                eq("workout_template_id", templateId)
                isIn("exercise_id", toDelete.toList())
            }
        }
    }
    if (toInsert.isNotEmpty()) {
        val newRows = updatedExercises.filter { it.exerciseId in toInsert }
            .map { it.toInsertDto(templateId) }
        supabase.from("workout_template_exercises").insert(newRows)
    }
    for (exercise in updatedExercises.filter { it.exerciseId in toUpdate }) {
        supabase.from("workout_template_exercises").update({
            set("order_index", exercise.orderIndex)
            set("sets_count", exercise.setsCount)
            set("target_reps_min", exercise.targetRepsMin)
            set("target_reps_max", exercise.targetRepsMax)
            set("rest_seconds", exercise.restSeconds)
        }) {
            filter {
                eq("workout_template_id", templateId)
                eq("exercise_id", exercise.exerciseId)
            }
        }
    }

    // 4. Update Room locally (no re-fetch)
    templateExerciseDao.replaceForTemplate(templateId, updatedExercises.map { it.toEntity() })
}
```

---

## 11. Screen: Create New Workout Template

### Data Operations

```
NewTemplateScreen
    │
    NewTemplateViewModel.init()
    │
    ├── 1. Room: exerciseDao.getAllExercises(userId) → Flow (instant from cache)
    │
    ├── 2. Room: exercise suggestions query (computed locally, no Supabase call)
    │   → SELECT exercise_id, COUNT(*) as frequency
    │     FROM workout_template_exercises wte
    │     JOIN workout_templates wt ON wt.id = wte.workout_template_id
    │     WHERE wt.user_id = ? AND wt.workout_type = ?
    │     GROUP BY exercise_id ORDER BY frequency DESC LIMIT 5
    │
    ├── [User builds template in local state]
    │
    └── Save: 2 INSERT operations
        ├── INSERT workout_templates → returns new ID
        └── INSERT workout_template_exercises (batch)
        → Update Room cache → Navigate to dashboard
```

### Key Optimization

- **Web**: Fetches all templates from Supabase to compute suggestions client-side.
- **Android**: Room query computes suggestions directly — zero network calls for suggestions.

---

## 12. Screen: Start New Workout

### Data Operations

```
NewWorkoutScreen
    │
    NewWorkoutViewModel.init()
    │
    ├── [PARALLEL — from Room cache, 0 Supabase calls on load]
    │   ├── 1. Room: templateDao.getAllTemplates(userId) → Flow
    │   ├── 2. Room: exerciseDao.getAllExercises(userId) → Flow
    │   └── 3. Room: Compute exercise recommendations locally
    │       → Last 30 days of workout data from cached sessions
    │       → Find undertrained body parts (>7 days or >20% below avg)
    │
    ├── User selects template
    │   └── Room: templateExerciseDao.getByTemplateId(templateId)
    │       → 1 Room query (web makes 2 Supabase queries)
    │
    └── startWorkout(): 3 Supabase INSERT operations
        ├── INSERT workout_sessions
        ├── INSERT exercise_logs (batch)
        └── INSERT set_logs (batch, pre-created as empty)
        → Also INSERT all to Room for offline access
        → Navigate to /workout/{sessionId}
```

### Key Optimization

- **Web**: 5 Supabase queries for recommendations + 2 redundant template fetches.
- **Android**: 0 Supabase queries on page load. All served from Room.

---

## 13. Screen: Active Workout Session

### This is the most critical screen — data loss prevention is paramount.

### Web Problems Being Solved

| Web Problem                              | Android Solution                               |
| ---------------------------------------- | ---------------------------------------------- |
| N+1 queries (20 queries for 6 exercises) | 1 RPC call `get_previous_workout_sets()`       |
| localStorage backup (fragile)            | Room as primary store (survives process death) |
| `select("*")` on set_logs                | Column pruning                                 |
| No offline support                       | Full offline: Room-first, sync on network      |

### Data Operations (Page Load)

```
ActiveWorkoutScreen(sessionId)
    │
    ActiveWorkoutViewModel.init(sessionId)
    │
    ├── [PARALLEL]
    │   │
    │   ├── 1. Room: sessionDao.getSessionWithExercisesAndSets(sessionId)
    │   │   → @Transaction query returning full workout tree
    │   │   → Session + ExerciseLogs (with Exercise) + SetLogs
    │   │   → 1 Room query replaces web's 2 Supabase queries
    │   │
    │   └── 2. Supabase RPC: get_previous_workout_sets(exerciseIds, sessionId, userId)
    │       → 1 query replaces web's N×3 queries
    │       → Returns all previous sets for all exercises
    │       → Cache in Room for offline access
    │
    └── Emit ActiveWorkoutUiState via StateFlow
```

### Room DAO for Full Workout Fetch

```kotlin
@Dao
interface WorkoutSessionDao {

    @Transaction
    @Query("SELECT * FROM workout_sessions WHERE id = :sessionId")
    fun getSessionWithDetails(sessionId: String): Flow<SessionWithExercisesAndSets?>
}

data class SessionWithExercisesAndSets(
    @Embedded val session: WorkoutSessionEntity,
    @Relation(
        entity = ExerciseLogEntity::class,
        parentColumn = "id",
        entityColumn = "workout_session_id"
    )
    val exerciseLogs: List<ExerciseLogWithSets>
)

data class ExerciseLogWithSets(
    @Embedded val exerciseLog: ExerciseLogEntity,
    @Relation(
        entity = ExerciseEntity::class,
        parentColumn = "exercise_id",
        entityColumn = "id"
    )
    val exercise: ExerciseEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "exercise_log_id"
    )
    val sets: List<SetLogEntity>
)
```

### Set Completion (Per-Set Save)

```kotlin
fun completeSet(setId: String, reps: Int, weight: Double, rir: Int, side: String?) {
    viewModelScope.launch {
        // 1. Save to Room IMMEDIATELY (survives process death)
        setLogDao.updateSet(setId, reps, weight, rir, side, completed = true)
        // Room Flow auto-updates UI

        // 2. Sync to Supabase in background
        syncManager.enqueueSetSync(setId)
    }
}
```

### Exercise Navigation

```kotlin
// Purely local state, no DB queries on navigation
private val _currentExerciseIndex = MutableStateFlow(0)
val currentExerciseIndex: StateFlow<Int> = _currentExerciseIndex.asStateFlow()

fun goToNextExercise() {
    _currentExerciseIndex.update { (it + 1).coerceAtMost(exerciseCount - 1) }
}

fun goToPreviousExercise() {
    _currentExerciseIndex.update { (it - 1).coerceAtLeast(0) }
}
```

### Workout Completion

```kotlin
suspend fun completeWorkout(sessionId: String) {
    val completedAt = Clock.System.now().toString()
    sessionDao.markCompleted(sessionId, completedAt)

    supabase.from("workout_sessions").update({
        set("completed_at", completedAt)
    }) { filter { eq("id", sessionId) } }

    // DB trigger refreshes materialized view; refresh local cache too
    analyticsRepo.refreshDashboardStats(userId)
}
```

### Workout Cancellation

```kotlin
suspend fun cancelWorkout(sessionId: String) {
    // Room: cascade delete handles children
    sessionDao.delete(sessionId)

    // Supabase: manual cascade (3 queries, same as web)
    val logIds = supabase.from("exercise_logs")
        .select(Columns.list("id")) { filter { eq("workout_session_id", sessionId) } }
        .decodeList<IdDto>().map { it.id }

    if (logIds.isNotEmpty()) {
        supabase.from("set_logs").delete { filter { isIn("exercise_log_id", logIds) } }
    }
    supabase.from("exercise_logs").delete { filter { eq("workout_session_id", sessionId) } }
    supabase.from("workout_sessions").delete { filter { eq("id", sessionId) } }
}
```

### Query Comparison

| Operation                      | Web Queries | Android Queries |
| ------------------------------ | ----------- | --------------- |
| Load workout session           | 1           | 0 (Room)        |
| Load exercise logs + exercises | 1           | 0 (Room)        |
| Load sets per exercise         | N           | 0 (Room)        |
| Load previous workout per ex.  | N × 2       | 1 (RPC)         |
| **Total for 6 exercises**      | **~20**     | **1 remote**    |

---

## 14. Screen: Exercises Management

### Data Operations

```
ExercisesScreen
    │
    ExercisesViewModel.init()
    │
    ├── Room: exerciseDao.getExercisesWithBodyParts(userId) → Flow
    │   → Instant from cache, auto-updates on changes
    │
    ├── Search: filtered in-memory from Flow emission (same as web — instant)
    │
    ├── Edit: Differential update (not DELETE ALL + INSERT ALL)
    │   ├── UPDATE exercises SET name, description, muscle_group, ...
    │   ├── Compute body_parts diff → targeted INSERT/DELETE
    │   └── Update Room + Supabase
    │
    └── Delete: Room delete (instant UI via Flow) + Supabase delete (background)
```

---

## 15. Screen: Friends

### Data Operations

```
FriendsScreen
    │
    FriendsViewModel.init()
    │
    ├── Supabase: 2 queries (optimized from web's 4)
    │   │
    │   ├── 1. SELECT from friendships
    │   │   → .or("user_id.eq.${userId},friend_id.eq.${userId}")
    │   │   → Returns ALL friendships in ONE query
    │   │   → Client-side partition: accepted, pendingReceived, pendingSent
    │   │
    │   └── 2. SELECT from user_profiles WHERE id IN (allRelatedIds)
    │
    ├── Mutations: optimistic local state update (web re-fetches 4 queries)
    │   ├── sendRequest → INSERT + add to local StateFlow
    │   ├── acceptRequest → UPDATE + move in local StateFlow
    │   ├── rejectRequest → DELETE + remove from local StateFlow
    │   └── removeFriend → DELETE + remove from local StateFlow
    │
    └── Real-time: Supabase Realtime channel for friendship changes
        → Push notifications for new friend requests
```

### Key Optimization vs Web

- **Web**: 4 queries on load + full 4-query re-fetch after every mutation.
- **Android**: 2 queries on load + optimistic local updates (0 re-queries after mutation).

---

## 16. Screen: Friend Progress Comparison

### Data Operations

```
ComparisonScreen(friendId)
    │
    ComparisonViewModel.init(friendId)
    │
    ├── [PARALLEL]
    │   ├── 1. Supabase: user_profiles WHERE id = friendId → .single()
    │   └── 2. Supabase RPC: get_comparison_stats(userId, friendId, periodDays)
    │       → Computes stats for BOTH users in 1 call
    │       → Replaces web's 7 sequential queries
    │
    └── Period change: re-call RPC with new period parameter
```

### Comparison

- **Web**: 1 profile + 6 data queries = **7 queries**
- **Android**: 1 profile + 1 RPC = **2 queries**

---

## 17. Screen: Shared Workout Templates

### Data Operations

Same as web — already well-optimized with database VIEW + RPC.

```
SharedTemplatesScreen
    │
    SharedTemplatesViewModel.init()
    │
    ├── 1. Supabase: SELECT from shared_templates_with_details VIEW
    │   → .neq("shared_by_user_id", userId).order("shared_at", DESC)
    │   → Pre-joined data (1 query)
    │
    └── Copy: supabase.rpc("copy_shared_workout_template", params)
        → Atomic server-side function
        → On success: update Room cache + navigate to template detail
```

---

## 18. Screen: Analytics / Progress

### Web Problems Being Solved

| Web Problem                                             | Android Solution                                        |
| ------------------------------------------------------- | ------------------------------------------------------- |
| 8 tabs, each fetches 2-3 queries independently          | Shared `AnalyticsRepository` with cached base data      |
| Tab switch unmounts + re-fetches                        | ViewModel-scoped cache survives tab switches            |
| No memoization — recomputes on every recomposition      | Computed once in ViewModel, exposed via lazy StateFlows |
| N+1 in Goals tab (N×4 queries)                          | 1 RPC `calculate_all_goal_progress()`                   |
| 4/8 tabs fetch ALL historical data (no date filters)    | Date windows on all tabs + server-side aggregation      |
| 3 different auth patterns across hooks                  | Single `userId` parameter everywhere                    |
| `select("*")` everywhere                                | Column pruning                                          |
| Duplicate computation logic (streak, imbalance, volume) | Shared utility functions in `domain/util/`              |

### Architecture: Tab-based with Shared Data Layer

```kotlin
@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val analyticsRepo: AnalyticsRepository,
    private val authRepo: AuthRepository
) : ViewModel() {

    private val userId: String = authRepo.getCurrentUserId() ?: ""

    // Shared base data — loaded ONCE, used by all tabs
    private val baseData = MutableStateFlow<AnalyticsBaseData?>(null)

    // Per-tab computed state (lazy — only computed when tab is first selected)
    val generalStats: StateFlow<GeneralStatsState> = baseData
        .filterNotNull()
        .map { GeneralStatsState.Success(computeGeneralStats(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, GeneralStatsState.Loading)

    val strengthStats: StateFlow<StrengthStatsState> = baseData
        .filterNotNull()
        .map { StrengthStatsState.Success(computeStrengthStats(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, StrengthStatsState.Loading)

    val trendsStats: StateFlow<TrendsStatsState> = baseData
        .filterNotNull()
        .map { TrendsStatsState.Success(computeTrendsStats(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, TrendsStatsState.Loading)

    val bodyPartStats: StateFlow<BodyPartStatsState> = baseData
        .filterNotNull()
        .map { BodyPartStatsState.Success(computeBodyPartStats(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, BodyPartStatsState.Loading)

    val symmetryStats: StateFlow<SymmetryStatsState> = baseData
        .filterNotNull()
        .map { SymmetryStatsState.Success(computeSymmetryStats(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, SymmetryStatsState.Loading)

    val injuryRiskStats: StateFlow<InjuryRiskState> = baseData
        .filterNotNull()
        .map { InjuryRiskState.Success(computeInjuryRisk(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, InjuryRiskState.Loading)

    val periodizationStats: StateFlow<PeriodizationState> = baseData
        .filterNotNull()
        .map { PeriodizationState.Success(computePeriodization(it)) }
        .stateIn(viewModelScope, SharingStarted.Lazily, PeriodizationState.Loading)

    // Goals tab uses the dedicated RPC function
    val goalsStats: StateFlow<GoalsStatsState> = flow {
        emit(GoalsStatsState.Loading)
        val goals = analyticsRepo.getGoalProgress(userId)
        emit(GoalsStatsState.Success(goals))
    }.stateIn(viewModelScope, SharingStarted.Lazily, GoalsStatsState.Loading)

    init {
        viewModelScope.launch {
            val data = analyticsRepo.getAnalyticsBaseData(userId, daysBack = 90)
            baseData.value = data
        }
    }
}
```

### Shared Base Data Query

```kotlin
class AnalyticsRepository @Inject constructor(
    private val remote: AnalyticsRemoteDataSource,
    private val localDao: AnalyticsDao
) {
    /**
     * Fetches the base dataset used by ALL analytics tabs.
     * 3 queries total, shared across all 8 tabs.
     * Web makes 3 queries PER TAB (24+ total when browsing all tabs).
     */
    suspend fun getAnalyticsBaseData(userId: String, daysBack: Int = 90): AnalyticsBaseData {
        val sinceDate = Clock.System.now().minus(daysBack.days).toString()

        // 3 queries total — shared across ALL 8 tabs
        val (sessions, exerciseLogs, setLogs) = coroutineScope {
            val sessionsDeferred = async {
                remote.fetchSessions(
                    userId = userId,
                    sinceDate = sinceDate,
                    columns = "id, name, workout_type, started_at, completed_at"
                )
            }
            val exerciseLogsDeferred = async {
                // Deferred — needs session IDs, but we can fetch all for user in date range
                // using a server-side join to avoid the dependency
                remote.fetchExerciseLogsWithExercises(
                    userId = userId,
                    sinceDate = sinceDate,
                    columns = "id, workout_session_id, exercise_id, order_index, exercises!inner(id, name, target_body_part, muscle_group, is_unilateral)"
                )
            }
            val setLogsDeferred = async {
                remote.fetchCompletedSetLogs(
                    userId = userId,
                    sinceDate = sinceDate,
                    columns = "id, exercise_log_id, set_number, reps, weight, rir, side"
                )
            }

            Triple(
                sessionsDeferred.await(),
                exerciseLogsDeferred.await(),
                setLogsDeferred.await()
            )
        }

        // Cache in Room for offline access
        localDao.cacheAnalyticsData(sessions, exerciseLogs, setLogs)

        return AnalyticsBaseData(sessions, exerciseLogs, setLogs)
    }

    /**
     * Goal progress via single RPC (replaces web's N×4 queries).
     */
    suspend fun getGoalProgress(userId: String): List<GoalProgress> {
        return supabase.postgrest.rpc(
            function = "calculate_all_goal_progress",
            parameters = mapOf("p_user_id" to userId)
        ).decodeList<GoalProgress>()
    }

    /**
     * CRUD operations for goals (used by Goals tab).
     */
    suspend fun createGoal(goal: BodyPartGoal) {
        supabase.from("body_part_goals").insert(goal.toDto())
        localDao.insertGoal(goal.toEntity())
    }

    suspend fun updateGoal(goalId: String, updates: GoalUpdate) {
        supabase.from("body_part_goals").update({
            set("target_value", updates.targetValue)
            set("timeframe", updates.timeframe)
            set("is_active", updates.isActive)
        }) { filter { eq("id", goalId) } }
        localDao.updateGoal(goalId, updates.targetValue, updates.timeframe, updates.isActive)
    }

    suspend fun deleteGoal(goalId: String) {
        localDao.deleteGoal(goalId) // Instant UI update via Flow
        supabase.from("body_part_goals").delete { filter { eq("id", goalId) } }
    }
}
```

### Tab Retention in Compose

```kotlin
@Composable
fun AnalyticsScreen(viewModel: AnalyticsViewModel = hiltViewModel()) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    val tabs = listOf(
        "General", "Strength", "Trends", "Goals",
        "Body Parts", "Symmetry", "Injury", "Periodization"
    )

    Column {
        ScrollableTabRow(selectedTabIndex = selectedTab) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) }
                )
            }
        }

        // Key difference from web: tabs are NOT unmounted on switch.
        // The ViewModel persists across tab changes — no re-fetching.
        // Each tab's StateFlow uses SharingStarted.Lazily, so computation
        // only happens on first access and is then cached.
        when (selectedTab) {
            0 -> GeneralStatsTab(viewModel.generalStats.collectAsState().value)
            1 -> StrengthStatsTab(viewModel.strengthStats.collectAsState().value)
            2 -> TrendsStatsTab(viewModel.trendsStats.collectAsState().value)
            3 -> GoalsStatsTab(
                    state = viewModel.goalsStats.collectAsState().value,
                    onCreateGoal = viewModel::createGoal,
                    onUpdateGoal = viewModel::updateGoal,
                    onDeleteGoal = viewModel::deleteGoal
                 )
            4 -> BodyPartStatsTab(viewModel.bodyPartStats.collectAsState().value)
            5 -> SymmetryStatsTab(viewModel.symmetryStats.collectAsState().value)
            6 -> InjuryRiskStatsTab(viewModel.injuryRiskStats.collectAsState().value)
            7 -> PeriodizationStatsTab(viewModel.periodizationStats.collectAsState().value)
        }
    }
}
```

### Shared Computation Utilities (domain/util/)

The web app duplicates computation logic across multiple hooks (streak in 3 places, imbalance in 3 places, volume everywhere). The Android app centralizes these:

```kotlin
// domain/util/VolumeCalculator.kt
object VolumeCalculator {
    fun totalVolume(sets: List<SetLog>): Double =
        sets.filter { it.completed }.sumOf { it.reps * it.weight }

    fun volumeByBodyPart(
        sets: List<SetLog>,
        exerciseLogs: List<ExerciseLogWithExercise>
    ): Map<String, Double> {
        val logToBodyPart = exerciseLogs.associate { it.id to it.exercise.targetBodyPart }
        return sets.filter { it.completed }
            .groupBy { logToBodyPart[it.exerciseLogId] ?: "unknown" }
            .mapValues { (_, sets) -> sets.sumOf { it.reps * it.weight } }
    }
}

// domain/util/ImbalanceDetector.kt
object ImbalanceDetector {
    private val antagonistPairs = listOf(
        "chest" to "back",
        "quads" to "hamstrings",
        "biceps" to "triceps",
        "adductors" to "abductors"
    )

    fun detect(volumeByPart: Map<String, Double>): List<Imbalance> {
        return antagonistPairs.mapNotNull { (a, b) ->
            val volA = volumeByPart[a] ?: 0.0
            val volB = volumeByPart[b] ?: 0.0
            if (volA == 0.0 && volB == 0.0) return@mapNotNull null
            val ratio = if (volA > volB) volA / volB.coerceAtLeast(1.0)
                        else volB / volA.coerceAtLeast(1.0)
            if (ratio > 1.25) Imbalance(
                partA = a, partB = b, ratio = ratio,
                severity = when {
                    ratio > 1.5 -> Severity.HIGH
                    ratio > 1.35 -> Severity.MODERATE
                    else -> Severity.LOW
                }
            ) else null
        }
    }
}

// domain/util/EpleyOneRepMax.kt
object EpleyOneRepMax {
    fun calculate(weight: Double, reps: Int): Double {
        if (reps <= 0 || weight <= 0) return 0.0
        if (reps == 1) return weight
        return weight * (1 + reps / 30.0)
    }
}

// domain/util/StreakCalculator.kt — used ONLY as fallback when offline
// Prefer the database function calculate_user_streak() when online
object StreakCalculator {
    fun calculateFromSessions(sessions: List<WorkoutSession>): Int {
        val workoutDates = sessions
            .filter { it.completedAt != null }
            .map { LocalDate.parse(it.startedAt.substring(0, 10)) }
            .toSet()

        var streak = 0
        var checkDate = Clock.System.now().toLocalDateTime(TimeZone.UTC).date

        while (true) {
            if (checkDate in workoutDates) {
                streak++
                checkDate = checkDate.minus(1, DateTimeUnit.DAY)
            } else if (streak == 0) {
                // Allow checking yesterday if no workout today
                checkDate = checkDate.minus(1, DateTimeUnit.DAY)
                if (checkDate !in workoutDates) break
            } else {
                break
            }
        }
        return streak
    }
}
```

### Analytics Query Comparison (All 8 Tabs)

| Metric                | Web                           | Android                            |
| --------------------- | ----------------------------- | ---------------------------------- |
| Queries per tab visit | 2-3 + N×4 for Goals           | 0 (cached from shared base data)   |
| Total for all 8 tabs  | ~24+ queries                  | 3 base + 1 RPC (Goals) = **4**     |
| Tab switch behavior   | Unmount + re-fetch everything | Instant (ViewModel cache)          |
| Recomposition cost    | Full recompute every render   | Computed once, cached in StateFlow |
| Auth pattern          | 3 different approaches        | Single `userId` param              |
| Date filtering        | Missing on 4/8 tabs           | Applied on all via `daysBack`      |

---

## 19. Optimizations Summary (Web Gaps → Android Solutions)

### Database-Level (Shared — Benefits Both Platforms)

| Optimization                             | Migration Required | Impact                                  |
| ---------------------------------------- | ------------------ | --------------------------------------- |
| Add 5 critical indexes                   | Yes                | 2-10x faster query execution            |
| Materialized view `user_workout_stats`   | Yes (see 3.2)      | Dashboard: 8 queries → 1; fixed JOIN multiplication overcounting and calendar-week logic |
| Function `calculate_user_streak()`       | Yes                | Server-side streak, no client iteration |
| Function `get_dashboard_stats()`         | Yes                | Single RPC for all dashboard stats      |
| Function `get_previous_workout_sets()`   | Yes                | Active workout: N×3 → 1 query           |
| Function `calculate_all_goal_progress()` | Yes (see 3.6)      | Goals tab: N×4 → 1 query; fixed body-part filtering and calendar-period logic |
| Function `get_comparison_stats()`        | Yes (see 3.7)      | Friend comparison: 7 → 2 queries; replaced inefficient LATERAL with CTE |
| Trigger `on_workout_completed`           | Yes (see 3.8)      | Auto-refresh materialized view; fixed missing function call |

### Android-Specific (Not Applicable to Web)

| Optimization                    | Web Problem                              | Android Solution                                   |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Room as persistent cache        | No client-side cache; re-fetch on nav    | Instant data on every screen via Room Flows        |
| Offline active workout          | localStorage backup (fragile, per-set)   | Room + pending sync queue (survives process death) |
| Shared ViewModel for analytics  | 8 independent data pipelines             | 1 shared base data set, lazy per-tab computation   |
| Column pruning everywhere       | `select("*")` on most queries            | Explicit column lists on every Supabase call       |
| Differential template save      | DELETE ALL + INSERT ALL                  | Compute diff → targeted INSERT/DELETE/UPDATE       |
| Optimistic mutations (friends)  | Full 4-query re-fetch after every action | Update local StateFlow immediately                 |
| Background sync via WorkManager | No background processing                 | Pending set syncs, cache refresh when online       |
| Shared computation utilities    | Streak/imbalance/volume duplicated 3x    | Centralized in `domain/util/`                      |
| Parallel coroutines everywhere  | Sequential awaits in `fetchData()`       | `coroutineScope { async {} }` for all parallel ops |
| Pagination for sessions         | Fetches ALL sessions for 4/8 analytics   | Date-windowed + `limit()` on all queries           |
| Supabase Realtime for friends   | Polling / manual refresh                 | Push-based friend request notifications            |

### Expected Performance Improvements (vs Web)

| Screen              | Web Load Time | Android Load Time                         | Improvement        |
| ------------------- | ------------- | ----------------------------------------- | ------------------ |
| Dashboard           | ~1500ms       | ~200ms (cached) / ~400ms (cold)           | **73-87% faster**  |
| Active Workout      | ~2000ms       | ~100ms (Room) + ~150ms (prev workout RPC) | **88% faster**     |
| Analytics (any tab) | ~1800-2500ms  | ~300ms (cold) / ~0ms (tab switch)         | **80-100% faster** |
| Analytics (Goals)   | ~2500ms       | ~200ms                                    | **92% faster**     |
| Templates List      | ~500ms        | ~50ms (Room)                              | **90% faster**     |
| Friend Comparison   | ~1200ms       | ~400ms                                    | **67% faster**     |
| Start New Workout   | ~1500ms       | ~100ms (Room)                             | **93% faster**     |

---

## 20. Implementation Priority

> **Status updated 2026-02-19.** The following screens are already complete and working: Login/Auth, Home Dashboard, Workout History, Start New Workout, Active Workout Session (both new workouts and viewing historical). The priority list below reflects what remains.

### Phase 1: Database Migrations ✅ COMPLETE

All SQL from Section 3 has been applied including the bug-fix migration (2026-02-19).

### Phase 2: Android Core Infrastructure ✅ COMPLETE (implied by working screens)

Project setup, Room, Supabase SDK, Auth flow, Navigation, NetworkMonitor, base Repository pattern.

### Phase 3: Core Screens — IN PROGRESS

**Completed:**
- ✅ Login / Auth flow
- ✅ Dashboard (Home)
- ✅ Workout History
- ✅ Start New Workout
- ✅ Active Workout Session

**Remaining (recommended order):**

1. **Exercises Management screen** — needed before templates work properly; users need to create/edit the exercise catalog that templates are built from.
2. **Workout Templates List screen** — depends on exercises being manageable; uses Room cache + background sync.
3. **Workout Template Detail / Edit screen** — differential save pattern (Section 10); depends on exercises.
4. **Create New Workout Template screen** — depends on exercises + templates list.

### Phase 4: Social Features (Week ~3-4 from now)

**Effort: 2 weeks | Impact: Feature parity**

1. Friends screen with Realtime notifications
2. Friend comparison screen (using `get_comparison_stats()` RPC)
3. Shared templates screen (existing VIEW + `copy_shared_workout_template` RPC)

### Phase 5: Analytics (Week ~5-7 from now)

**Effort: 3 weeks | Impact: Power user features**

1. Shared `AnalyticsRepository` with base data caching
2. `domain/util/` computation utilities (VolumeCalculator, ImbalanceDetector, EpleyOneRepMax, StreakCalculator)
3. General stats tab
4. Strength stats tab
5. Trends stats tab
6. Goals stats tab (using `calculate_all_goal_progress()` RPC)
7. Body part analysis tab
8. Symmetry stats tab
9. Injury risk tab
10. Periodization tab

### Phase 6: Polish & Offline (Week ~8-9 from now)

**Effort: 2 weeks | Impact: Production readiness**

1. Full offline support for active workouts (pending sync queue + WorkManager)
2. WorkManager periodic background sync
3. Stale data indicators in UI
4. Error handling and retry logic
5. Animations and transitions
6. Performance profiling and optimization

---

## Appendix: Data Flow Diagrams

### Authentication Flow (Android)

```
App Launch
    │
    ▼
Hilt injects SupabaseClient (singleton)
    │── Auth plugin auto-loads saved session from encrypted storage
    │── If session exists + valid → SessionStatus.Authenticated
    │── If session expired → auto-refresh token
    │── If no session → SessionStatus.NotAuthenticated
    │
    ▼
AuthRepository.observeAuthState() → Flow<AuthState>
    │
    ▼
AuthViewModel.authState → StateFlow<AuthState>
    │
    ▼
AppNavGraph observes authState:
    ├── AuthState.Loading → Splash screen with spinner
    ├── AuthState.Authenticated → Navigate to Dashboard
    └── AuthState.Unauthenticated → Navigate to Login
```

### Workout Lifecycle (Android)

```
[Template Created] (NewTemplateScreen)
    │
    │ Supabase INSERT workout_templates + workout_template_exercises
    │ Room INSERT for local cache
    │
    ▼
[User Starts Workout] (NewWorkoutScreen)
    │
    │ Supabase INSERT: workout_sessions + exercise_logs + set_logs (batch, pre-created)
    │ Room INSERT: mirror all rows locally
    │ → All rows exist in BOTH Room and Supabase before workout screen loads
    │
    ▼
[Workout Page Loads] (ActiveWorkoutScreen)
    │
    │ Room: @Transaction query loads full workout tree (instant, 0 network)
    │ Supabase RPC: get_previous_workout_sets() → 1 query for all exercises
    │ Cache previous sets in Room
    │
    ▼
[During Workout — PER-SET SAVES]
    │
    │ User enters reps/weight/RIR for each set
    │ On "Confirm":
    │   1. Room UPDATE set_logs (instant, survives process death)
    │   2. Room Flow emits new state → UI auto-updates
    │   3. Background: Supabase UPDATE (fire-and-forget)
    │   4. If offline: mark set as pending_sync in Room
    │
    │ Exercise navigation: local StateFlow index change (0 queries)
    │
    ▼
[User Finishes Workout — 1 Remote Operation]
    │
    │ Room: UPDATE workout_sessions SET completed_at
    │ Supabase: UPDATE workout_sessions SET completed_at
    │ DB Trigger: auto-refreshes materialized view
    │ Refresh local analytics cache
    │ → Navigate to Dashboard
    │
    ▼
[Background Sync (WorkManager)]
    │
    │ On network available:
    │   1. Sync any pending_sync set_logs
    │   2. Refresh analytics cache if stale
    │   3. Sync any queued template edits
```

### Offline Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         ANDROID APP                               │
│                                                                    │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │   Compose UI  │◄──│   ViewModel      │◄──│   Repository   │  │
│  │  (StateFlow)  │   │  (StateFlow)     │   │  (decides src) │  │
│  └──────────────┘    └──────────────────┘    └───────┬────────┘  │
│                                                       │           │
│                                          ┌────────────┼──────┐   │
│                                          │            │      │   │
│                                    ┌─────▼─���───┐ ┌───▼────┐ │   │
│                                    │   Room DB  │ │Supabase│ │   │
│                                    │  (always)  │ │(online)│ │   │
│                                    └─────┬──────┘ └───┬────┘ │   │
│                                          │            │      │   │
│                                          │    ┌───────┘      │   │
│                                          │    │              │   │
│                                    ┌─────▼────▼─────┐        │   │
│                                    │  Sync Manager   │        │   │
│                                    │  (WorkManager)  │        │   │
│                                    └─────────────────┘        │   │
│                                                               │   │
└───────────────────────────────────────────────────────────────────┘

READ PATH:
  1. UI requests data → ViewModel → Repository
  2. Repository returns Room Flow (instant)
  3. Repository triggers background Supabase sync
  4. Supabase response → upsert to Room → Flow emits update → UI refreshes

WRITE PATH:
  1. User action → ViewModel → Repository
  2. Repository writes to Room FIRST (instant UI update)
  3. Repository attempts Supabase write
     ├── Online: write succeeds → done
     └── Offline: mark as pending_sync → WorkManager syncs later
```

### Analytics Shared Data Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AnalyticsViewModel                              │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              baseData: StateFlow<AnalyticsBaseData>          │  │
│  │  (loaded ONCE: sessions + exerciseLogs + setLogs)           │  │
│  └───────────────────────┬────────────────────────────────────┘  │
│                          │                                        │
│      ┌──────────┬────────┼───��────┬──────────┬──────────┐        │
│      ▼          ▼        ▼        ▼          ▼          ▼        │
│  ┌───────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐  │
│  │General│ │Strength│ │Trends│ │Body  │ │Symmetry│ │Injury  │  │
│  │Stats  │ │Stats   │ │Stats │ │Parts │ │Stats   │ │Risk    │  │
│  │       │ │        │ │      │ │      │ │        │ │        │  │
│  │Lazy   │ │Lazy    │ │Lazy  │ │Lazy  │ │Lazy    │ │Lazy    │  │
│  │Flow   │ │Flow    │ │Flow  │ │Flow  │ │Flow    │ │Flow    │  │
│  └───────┘ └────────┘ └──────┘ └──────┘ └────────┘ └────────┘  │
│                                                                    │
│  ┌────────────┐  ┌──────────────┐                                │
│  │Goals Stats │  │Periodization │  ← These also use baseData     │
│  │(+ RPC call)│  │Stats         │                                │
│  └────────────┘  └──────────────┘                                │
│                                                                    │
│  Web: 24+ queries across all tabs (3 per tab, re-fetched each)   │
│  Android: 3 queries + 1 RPC = 4 total, cached in ViewModel      │
└──────────────────────────────────────────────────────────────────┘
```
