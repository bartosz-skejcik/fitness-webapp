# Multiple Body Parts Per Exercise Feature

## Overview

This feature allows users to select multiple muscle groups/body parts that are trained during a single exercise. For example, a bench press can target both chest (primary) and triceps (secondary).

## Database Changes

### New Table: `exercise_body_parts`

A junction table that creates a many-to-many relationship between exercises and body parts.

**Schema:**

```sql
CREATE TABLE exercise_body_parts (
  id UUID PRIMARY KEY,
  exercise_id UUID REFERENCES exercises(id),
  body_part TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)
```

**Fields:**

-   `exercise_id`: Foreign key to the exercises table
-   `body_part`: One of the TargetBodyPart values (quads, chest, back, etc.)
-   `is_primary`: Indicates if this is the primary muscle group targeted
-   Unique constraint on (exercise_id, body_part) to prevent duplicates

### Migration Steps

1. **Run the migration:**

    ```sql
    -- Execute: supabase/migrations/004_add_exercise_body_parts_junction.sql
    ```

2. **What the migration does:**
    - Creates the `exercise_body_parts` table
    - Sets up appropriate indexes for performance
    - Configures Row Level Security (RLS) policies
    - Migrates existing `target_body_part` data to the new table
    - Marks the old column as deprecated (but keeps it for backward compatibility)

## Code Changes

### TypeScript Types (`src/types/database.ts`)

**New Interface:**

```typescript
export interface ExerciseBodyPart {
    id: string;
    exercise_id: string;
    body_part: TargetBodyPart;
    is_primary: boolean;
    created_at: string;
}
```

**Updated Exercise Interface:**

```typescript
export interface Exercise {
    // ... existing fields
    target_body_part?: TargetBodyPart | null; // Deprecated
    body_parts?: ExerciseBodyPart[]; // New: multiple body parts
}
```

### UI Changes

#### Template Exercise Creation (`src/app/templates/[id]/page.tsx`)

**Changes:**

1. Replaced single-select dropdown with multi-select checkbox list
2. Added visual indication (checkboxes) for selected body parts
3. Shows count of selected body parts
4. Displays selected body parts as badges with primary indicator

**New State:**

```typescript
const [newExerciseBodyParts, setNewExerciseBodyParts] = useState<
    TargetBodyPart[]
>([]);
```

**Multi-Select UI:**

-   Scrollable list of all body parts
-   Click to toggle selection
-   Orange highlight for selected items
-   Checkbox indicator
-   First selected becomes primary

#### Exercise Display

**Changes:**

-   Shows all body parts as badges
-   Primary body part highlighted in orange
-   Secondary body parts shown in neutral gray
-   Falls back to old `target_body_part` field if no body_parts data

## Usage

### Creating an Exercise with Multiple Body Parts

1. Go to a template editing page
2. Click "Dodaj ćwiczenie" (Add Exercise)
3. Enter exercise name
4. Select one or more body parts from the list
5. The first selected body part will be marked as primary
6. Click "Utwórz nowe ćwiczenie" (Create New Exercise)

### API Integration

**Creating an exercise with body parts:**

```typescript
// 1. Create the exercise
const { data: exercise } = await supabase
    .from("exercises")
    .insert({
        name: "Bench Press",
        muscle_group: "upper",
        target_body_part: "chest", // First selected for backward compatibility
        user_id: userId,
    })
    .select()
    .single();

// 2. Insert body parts
const bodyParts = ["chest", "triceps", "shoulders"];
const bodyPartsData = bodyParts.map((bp, index) => ({
    exercise_id: exercise.id,
    body_part: bp,
    is_primary: index === 0, // First one is primary
}));

await supabase.from("exercise_body_parts").insert(bodyPartsData);
```

**Fetching exercises with body parts:**

```typescript
const { data } = await supabase
    .from("exercises")
    .select(
        `
        *,
        body_parts:exercise_body_parts(*)
    `
    )
    .order("name");
```

## Backward Compatibility

-   The old `target_body_part` field is still populated with the primary body part
-   Existing code that reads `target_body_part` will continue to work
-   New code should prefer reading from `body_parts` array
-   Display logic checks for `body_parts` first, falls back to `target_body_part`

## Future Enhancements

Potential improvements:

1. Allow editing body parts after exercise creation
2. Show body part statistics aggregated from all selected parts
3. Filter exercises by any targeted body part (not just primary)
4. Import popular exercises with pre-configured body parts
5. Suggest body parts based on exercise name using AI
6. Show muscle activation percentages for each body part

## Testing Checklist

-   [ ] Run migration successfully
-   [ ] Create new exercise with multiple body parts
-   [ ] Verify body parts are saved to database
-   [ ] View exercise in template - see all body parts
-   [ ] Primary body part highlighted correctly
-   [ ] Old exercises (with only target_body_part) still display correctly
-   [ ] Multi-select UI works on mobile
-   [ ] Can select/deselect body parts smoothly
-   [ ] Create button disabled when no body parts selected

## Notes

-   The migration preserves all existing data
-   The feature is opt-in: old single body part exercises continue to work
-   First selected body part is always marked as primary
-   UI supports both old and new data formats seamlessly
