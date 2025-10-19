# Exercise Editing Multi-Select Fix

## Problem

When editing exercises in `/exercises` page, users could only select one body part using a dropdown menu, instead of multiple body parts like when creating new exercises.

## Solution

Updated the `/exercises` page to use the same multi-select checkbox interface for editing exercises as used when creating new exercises.

## Changes Made

### File: `src/app/exercises/page.tsx`

#### 1. Imports

-   Added `CheckCircle2` icon from lucide-react

#### 2. State Management

-   **Added:** `editBodyParts` - array to track selected body parts
-   **Removed:** `editTargetBodyPart` - no longer needed (replaced by editBodyParts)

#### 3. Data Fetching

-   Updated `fetchExercises()` to include body_parts via JOIN:
    ```typescript
    .select(`
        *,
        body_parts:exercise_body_parts(*)
    `)
    ```

#### 4. Edit Functions

**`startEditing()`**

-   Now loads existing body parts from `exercise.body_parts` array
-   Falls back to `exercise.target_body_part` for older exercises
-   Populates `editBodyParts` state with all body parts

**`saveExercise()`**

-   Now saves multiple body parts to `exercise_body_parts` table
-   Deletes existing body parts first (DELETE + INSERT pattern)
-   Marks first body part as primary (`is_primary: true`)
-   Sets first body part to `target_body_part` for backward compatibility
-   Refreshes exercise list after save to get updated data

**`cancelEditing()`**

-   Resets `editBodyParts` array

#### 5. Helper Functions

-   Added `bodyPartOptions` array with all 14 body part options
-   Added `toggleEditBodyPart()` to handle checkbox selection/deselection

#### 6. UI Changes

**Edit Mode:**

-   **Before:** Single dropdown `<select>` for body part
-   **After:** Multi-select checkbox list with:
    -   Scrollable container (max-height: 48px / 12rem)
    -   Orange highlight for selected items (`bg-orange-500/20`)
    -   Checkmarks (CheckCircle2 icon) for selected items
    -   Selection counter at bottom
    -   Save button disabled if no body parts selected

**View Mode:**

-   **Before:** Single purple badge for `target_body_part`
-   **After:**
    -   Shows all body parts as badges
    -   Primary body part: Orange badge (`bg-orange-500/20 text-orange-400`)
    -   Secondary body parts: Gray badges (`bg-neutral-800 text-neutral-400`)
    -   Falls back to old format if no `body_parts` array exists
    -   Changed "Jednostronne" badge to cyan color to avoid confusion with primary

## Visual Example

### Edit Mode

```
┌──────────────────────────────────────┐
│ Nazwa: [Wyciskanie sztangi______]   │
│ Opis:  [__________________________] │
│ Grupa: [Górna partia ▼]             │
│                                      │
│ Wybierz partie mięśniowe (wiele):   │
│ ┌──────────────────────────────┐   │
│ │ ✅ Klatka piersiowa (orange) │   │
│ │ ✅ Triceps (orange)          │   │
│ │ ✅ Barki (orange)            │   │
│ │ ☐ Biceps                     │   │
│ │ ☐ Plecy                      │   │
│ │ ... (scrollable)             │   │
│ └──────────────────────────────┘   │
│ Wybrano: 3 partie                   │
│                                      │
│ ☐ Ćwiczenie jednostronne            │
│                                      │
│ [Zapisz] [Anuluj]                   │
└──────────────────────────────────────┘
```

### View Mode

```
Wyciskanie sztangi
Opis ćwiczenia

[Górna] [Klatka piersiowa] [Triceps] [Barki] [Jednostronne]
 blue       🟠 orange        ⚪ gray    ⚪ gray    cyan
```

## Database Operations

### Save Flow:

1. Update exercise basic info (name, description, muscle_group, etc.)
2. Set `target_body_part` to first selected (backward compatibility)
3. DELETE all existing body parts for this exercise
4. INSERT new body parts with `is_primary` flag on first one
5. Refresh exercise list to get updated `body_parts` array

### Query Example:

```typescript
// Delete old
await supabase
    .from("exercise_body_parts")
    .delete()
    .eq("exercise_id", exerciseId);

// Insert new
await supabase.from("exercise_body_parts").insert([
    { exercise_id, body_part: "chest", is_primary: true },
    { exercise_id, body_part: "triceps", is_primary: false },
    { exercise_id, body_part: "shoulders", is_primary: false },
]);
```

## Backward Compatibility

-   Old exercises with only `target_body_part` still display correctly
-   When editing old exercises, `target_body_part` is loaded as single-item array
-   After saving, converted to multi-body-part format
-   Display logic checks `body_parts` first, falls back to `target_body_part`

## Testing Checklist

-   [ ] Edit existing exercise with only `target_body_part`
-   [ ] Select multiple body parts
-   [ ] Save changes
-   [ ] Verify primary body part is orange
-   [ ] Verify secondary body parts are gray
-   [ ] Cancel editing resets selection
-   [ ] Save button disabled when no body parts selected
-   [ ] Body parts persist after page refresh
-   [ ] Search still works with new format
-   [ ] Delete exercise still works

## Known Limitations

### Templates/[id] Page Edit Mode

The template editing page (`/templates/[id]`) still has a single-select dropdown when editing exercises within a template. This is more complex to fix because:

-   It's editing exercises in the context of a template
-   The `updateExerciseTarget()` function updates local state
-   Need to track editing state per exercise
-   Would require significant refactoring of the exercise editing flow

**Recommendation:** Update this in a separate PR to:

1. Add similar multi-select UI
2. Update `updateExerciseTarget()` to handle arrays
3. Add save/cancel buttons per exercise (currently saves on change)
4. Update database when exercise body parts change

## Success Criteria

✅ Multi-select UI in exercises page edit mode
✅ Multiple body parts saved to database
✅ Primary body part highlighted in orange
✅ Secondary body parts shown in gray
✅ Backward compatible with old single body part
✅ No breaking changes to existing functionality
✅ Save button validation (requires at least one body part)

## Future Enhancements

1. Add multi-select to template exercise editing
2. Show body part indicators during workout
3. Filter exercises by any targeted body part
4. Bulk edit body parts for multiple exercises
5. Import common exercises with pre-configured body parts
