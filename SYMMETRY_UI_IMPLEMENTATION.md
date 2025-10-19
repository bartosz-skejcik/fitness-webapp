# Symmetry Tracking UI Implementation Summary

## ✅ Completed Features

### 1. Exercise Creation UI (templates/new/page.tsx)

-   **Checkbox for Unilateral Exercises**: Added checkbox labeled "Ćwiczenie jednostronne (jedna strona naraz)" when creating new exercises
-   **Database Integration**: Saves `is_unilateral` flag to database when creating exercises
-   **State Management**: Added `newExerciseIsUnilateral` state to track checkbox value

### 2. Workout Logging UI (workout/[id]/page.tsx)

-   **Side Selection Interface**: For unilateral exercises, displays two buttons:
    -   👈 Lewa (Left side)
    -   Prawa 👉 (Right side)
-   **Visual Feedback**: Selected side is highlighted with blue border and background
-   **Required Selection**: Button is disabled with message "Wybierz stronę" until a side is selected
-   **Side Tracking**: Saves `side` field ("left" or "right") to set_logs table

### 3. Completed Set Display

-   **Side Badge**: Shows small badge indicating which side was used (Lewa/Prawa)
-   **Visual Integration**: Badge appears next to "Seria X" label with orange styling to match completed sets
-   **Previous Set Reference**: Also shows side in the "Ostatnio:" (Last time) section for context

### 4. Previous Workout Data

-   **Side Information**: When showing previous performance, displays which side was used
-   **Contextual Comparison**: Helps user see which side they worked last time for better progressive overload tracking

## 🎯 User Flow

### Creating a Unilateral Exercise:

1. Click "Dodaj" to add exercise
2. Enter exercise name (e.g., "Bulgarian Split Squat")
3. Select body part (e.g., "Quads")
4. ✅ **NEW**: Check "Ćwiczenie jednostronne" checkbox
5. Click "Utwórz nowe ćwiczenie"

### Logging a Unilateral Set:

1. During workout, when on a unilateral exercise
2. **NEW**: See "Która strona?" (Which side?) section with two buttons
3. Click either 👈 Lewa or Prawa 👉
4. Enter reps, weight, and RIR as normal
5. Click "Potwierdź serię" (button now enabled after selecting side)
6. **NEW**: Completed set shows side badge (e.g., "Lewa")

### Viewing Symmetry Analytics:

1. Go to Progress page
2. Click "Symetria" tab
3. See breakdown of left vs right performance for all unilateral exercises
4. Get warnings if imbalances > 15%
5. View recommendations for correcting imbalances

## 📊 Data Flow

```
Exercise Creation
└─> is_unilateral: true saved to exercises table

Workout Logging
└─> For each set on unilateral exercise:
    ├─> User selects side (left/right)
    ├─> side: "left" or "right" saved to set_logs table
    └─> Displayed in completed set view

Symmetry Analysis
└─> Query all set_logs with side != null
    ├─> Group by exercise_id
    ├─> Calculate left volume vs right volume
    ├─> Identify imbalances > 15%
    └─> Display warnings and recommendations
```

## 🎨 UI/UX Highlights

### Side Selection Buttons:

-   Clean two-button layout (Left | Right)
-   Blue highlight when selected
-   Emojis for quick visual identification (👈 👉)
-   Disabled state on confirm button until side is selected

### Completed Sets:

-   Small, unobtrusive badge showing side
-   Orange color scheme matching completed set styling
-   Clear text: "Lewa" or "Prawa"

### Previous Performance:

-   Shows side in subtle gray badge
-   Helps user maintain consistency or deliberately switch sides
-   Positioned next to "Ostatnio:" label

## 🔧 Technical Implementation

### Database Fields:

-   `exercises.is_unilateral` (boolean): Marks exercise as unilateral
-   `set_logs.side` (text): Stores "left" or "right" for each set

### Component Props:

-   SetInput component accepts `isUnilateral?: boolean` prop
-   Conditionally renders side selector based on prop
-   Validates side selection before allowing set completion

### State Management:

-   Local state for side selection in SetInput component
-   Initialized from existing set data for editing
-   Saved to database on set completion

## 📝 Notes

### Bilateral Exercises:

-   `is_unilateral = false` or `null`: No side tracking
-   `side` field remains `null` in set_logs
-   UI behaves exactly as before (no side buttons)

### Unilateral Exercises:

-   `is_unilateral = true`: Side tracking enabled
-   User MUST select a side to complete set
-   Both left and right tracked separately for symmetry analysis

### Flexibility:

-   Users can do multiple sets of same side in a row
-   Can alternate sides within same exercise
-   Can change strategies between workouts
-   Previous performance shown per-side for reference

## 🚀 Next Steps

To use the feature:

1. ✅ Migration already run (add-symmetry-tracking.sql)
2. Create or edit exercises to mark them as unilateral
3. During workouts, select which side for each set
4. View analytics in the Symmetry tab after logging several workouts

Common unilateral exercises to mark:

-   Bulgarian Split Squats
-   Single-Leg Press
-   Dumbbell Row (single arm)
-   Single-Leg RDL
-   Single-Arm Overhead Press
-   Pistol Squats
-   Single-Leg Curls
-   Single-Arm Cable Exercises

## ✨ Benefits

1. **Injury Prevention**: Track and correct muscle imbalances before they cause issues
2. **Balanced Development**: Ensure both sides of body develop equally
3. **Progressive Overload**: See previous performance for specific side
4. **Data-Driven**: Know exact percentages of imbalance, not just guessing
5. **Smart Recommendations**: Get actionable advice for fixing imbalances
