I'll analyze the data operations file to understand the current flow and propose optimizations.Based on my analysis of your DATA_OPERATIONS.md file, I've identified several critical optimization opportunities for your fitness webapp. Here's a comprehensive optimization proposal:

## 🎯 **Critical Optimizations**

### **1. Database-Level Aggregations** (Biggest Impact)

Currently, your app fetches raw data and computes stats client-side. Move these to PostgreSQL:

#### **Dashboard Stats - Replace Steps 2-8 with SQL Views/Functions**

```sql
-- Create a materialized view for user workout stats
CREATE MATERIALIZED VIEW user_workout_stats AS
SELECT 
    ws.user_id,
    COUNT(ws.id) as total_workouts,
    COUNT(CASE WHEN ws.started_at >= NOW() - INTERVAL '7 days' THEN 1 END) as weekly_workouts,
    COALESCE(SUM(sl.reps * sl.weight), 0) as total_volume
FROM workout_sessions ws
LEFT JOIN exercise_logs el ON el.workout_session_id = ws.id
LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.completed = true
GROUP BY ws.user_id;

-- Refresh periodically or on-demand
REFRESH MATERIALIZED VIEW user_workout_stats;
```

**Current:** 9 queries fetching ~10,000+ rows → Client computes stats  
**Optimized:** 1 query returning 1 row with pre-computed stats  
**Time Saved:** ~500-2000ms → ~50ms

#### **Create a Database Function for Current Streak**

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
            AND DATE(started_at) = check_date
        ) INTO has_workout;
        
        IF NOT has_workout THEN
            EXIT;
        END IF;
        
        current_streak := current_streak + 1;
        check_date := check_date - INTERVAL '1 day';
    END LOOP;
    
    RETURN current_streak;
END;
$$ LANGUAGE plpgsql;
```

### **2. Fix N+1 Query Problems**

#### **Active Workout Page - Batch Previous Workout Lookup**

**Current:** N individual queries (20 queries for 6 exercises)  
**Optimized:** Use window functions

```sql
-- Single query to get previous workout data for all exercises
SELECT DISTINCT ON (el.exercise_id)
    el.exercise_id,
    el.id as previous_log_id,
    el.workout_session_id,
    ws.completed_at,
    json_agg(json_build_object(
        'set_number', sl.set_number,
        'reps', sl.reps,
        'weight', sl.weight,
        'rir', sl.rir
    ) ORDER BY sl.set_number) as previous_sets
FROM exercise_logs el
INNER JOIN workout_sessions ws ON ws.id = el.workout_session_id
LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id
WHERE el.exercise_id = ANY($1::uuid[])  -- Array of exercise IDs
    AND el.workout_session_id != $2     -- Current session
    AND ws.completed_at IS NOT NULL
    AND ws.user_id = $3
GROUP BY el.exercise_id, el.id, el.workout_session_id, ws.completed_at
ORDER BY el.exercise_id, ws.completed_at DESC;
```

**Time Saved:** 20 queries → 1 query (~400ms → ~50ms)

#### **Analytics Goals Tab - Fix N×4 Query Problem**

```sql
-- Create a function that calculates all goal progress in one pass
CREATE OR REPLACE FUNCTION calculate_all_goal_progress(p_user_id UUID)
RETURNS TABLE (
    goal_id UUID,
    body_part TEXT,
    goal_type TEXT,
    current_value NUMERIC,
    target_value NUMERIC,
    progress_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.body_part,
        g.goal_type,
        CASE 
            WHEN g.goal_type = 'volume' THEN
                COALESCE(SUM(sl.reps * sl.weight), 0)
            WHEN g.goal_type = 'frequency' THEN
                COUNT(DISTINCT ws.id)::NUMERIC
        END as current_value,
        g.target_value,
        (current_value / g.target_value * 100) as progress_percentage
    FROM body_part_goals g
    LEFT JOIN workout_sessions ws ON ws.user_id = g.user_id
        AND ws.started_at >= NOW() - make_interval(days => g.timeframe)
    LEFT JOIN exercise_logs el ON el.workout_session_id = ws.id
    LEFT JOIN exercises e ON e.id = el.exercise_id 
        AND e.target_body_part = g.body_part
    LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id 
        AND sl.completed = true
    WHERE g.user_id = p_user_id
    GROUP BY g.id, g.body_part, g.goal_type, g.target_value;
END;
$$ LANGUAGE plpgsql;
```

**Current:** 1 + (N goals × 4 queries) = ~17 queries for 4 goals  
**Optimized:** 1 query  
**Time Saved:** ~800ms → ~80ms

### **3. Consolidate Duplicate Data Fetches**

#### **Dashboard: Merge fetchData() and useDashboardInsights()**

Both pipelines fetch overlapping data. Create a unified hook:

```typescript
// New unified hook
function useDashboardData() {
    const { user } = useAuth();
    
    const fetchUnifiedData = useCallback(async () => {
        if (!user) return;
        
        // Fetch everything in parallel
        const [templates, sessions, exercises, exerciseLogs, setLogs] = 
            await Promise.all([
                supabase.from('workout_templates')
                    .select('id, name, workout_type, description, created_at')
                    .eq('user_id', user.id),
                    
                supabase.from('workout_sessions')
                    .select('id, name, workout_type, started_at, completed_at')
                    .eq('user_id', user.id)
                    .order('started_at', { ascending: false }),
                    
                supabase.from('exercises')
                    .select('id, name, target_body_part')
                    .eq('user_id', user.id),
                    
                // Fetch last 30 days only
                supabase.from('exercise_logs')
                    .select('id, workout_session_id, exercise_id')
                    .in('workout_session_id', /* last 30d session IDs */),
                    
                supabase.from('set_logs')
                    .select('reps, weight, exercise_log_id')
                    .eq('completed', true)
                    .in('exercise_log_id', /* log IDs */)
            ]);
        
        // Compute stats AND insights from shared data
        const stats = computeStats(sessions, exerciseLogs, setLogs);
        const insights = computeInsights(sessions, exercises, exerciseLogs, setLogs);
        
        return { templates, sessions, stats, insights };
    }, [user]);
    
    // ... useMemo for expensive computations
}
```

**Current:** 9 sequential queries with duplicate fetches  
**Optimized:** 5 parallel queries, shared computation  
**Time Saved:** ~1200ms → ~300ms

### **4. Implement Query Column Pruning**

Replace `select("*")` with specific columns:

```typescript
// Before
supabase.from('workout_sessions').select('*')

// After - ~60% payload reduction
supabase.from('workout_sessions')
    .select('id, name, workout_type, started_at, completed_at')
```

### **5. Add Pagination for High-Volume Queries**

```typescript
// Dashboard - Don't fetch ALL sessions
const { data: recentSessions } = await supabase
    .from('workout_sessions')
    .select('id, name, workout_type, started_at, completed_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(5);  // Only fetch what you display

// For stats - use date windowing
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data: statsSessions } = await supabase
    .from('workout_sessions')
    .select('id, started_at, completed_at')
    .eq('user_id', user.id)
    .gte('started_at', thirtyDaysAgo.toISOString());
```

### **6. Implement React Query for Shared Cache**

```bash
npm install @tanstack/react-query
```

```typescript
// Create shared queries
export function useWorkoutSessions(userId: string) {
    return useQuery({
        queryKey: ['sessions', userId],
        queryFn: () => fetchSessions(userId),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useExercises(userId: string) {
    return useQuery({
        queryKey: ['exercises', userId],
        queryFn: () => fetchExercises(userId),
        staleTime: 30 * 60 * 1000, // 30 minutes
    });
}
```

**Benefits:**
- Analytics tabs share data (no re-fetch on tab switch)
- Automatic background refresh
- Optimistic updates
- Reduced load by ~70%

### **7. Add Database Indexes**

```sql
-- Critical indexes for query performance
CREATE INDEX idx_workout_sessions_user_started 
    ON workout_sessions(user_id, started_at DESC);

CREATE INDEX idx_exercise_logs_session 
    ON exercise_logs(workout_session_id);

CREATE INDEX idx_set_logs_exercise_completed 
    ON set_logs(exercise_log_id, completed) 
    WHERE completed = true;

CREATE INDEX idx_exercise_logs_exercise_id 
    ON exercise_logs(exercise_id);

-- For previous workout lookups
CREATE INDEX idx_workout_sessions_completed 
    ON workout_sessions(user_id, completed_at DESC NULLS LAST) 
    WHERE completed_at IS NOT NULL;
```

### **8. Add useMemo for Heavy Computations**

```typescript
const stats = useMemo(() => {
    if (!sessions.length) return null;
    
    const totalWorkouts = sessions.length;
    const weeklyWorkouts = sessions.filter(s => 
        new Date(s.started_at) >= weekAgo
    ).length;
    const currentStreak = calculateStreak(sessions);
    
    return { totalWorkouts, weeklyWorkouts, currentStreak };
}, [sessions]); // Only recompute when sessions change
```

## 📊 **Expected Performance Improvements**

| Page | Current Load Time | Optimized Load Time | Improvement |
|------|-------------------|---------------------|-------------|
| Dashboard | ~1500ms | ~400ms | **73% faster** |
| Active Workout | ~2000ms | ~500ms | **75% faster** |
| Analytics (Goals) | ~2500ms | ~600ms | **76% faster** |
| Analytics (Strength) | ~1800ms | ~450ms | **75% faster** |

## 🚀 **Implementation Priority**

1. **Immediate (High Impact, Low Effort):**
   - Add database indexes (5 min)
   - Column pruning in queries (30 min)
   - Parallel queries in dashboard (1 hour)
   - Add useMemo wrappers (1 hour)

2. **Short-term (High Impact, Medium Effort):**
   - Batch previous workout lookup (3 hours)
   - Create stats materialized view (4 hours)
   - Implement React Query (6 hours)

3. **Long-term (High Impact, High Effort):**
   - Database functions for complex aggregations (2 days)
   - Consolidated analytics data layer (3 days)

Would you like me to create a pull request implementing any of these optimizations? I can start with the high-impact, low-effort changes first.