# 🚀 Quick Start: Multiple Body Parts Feature

## Step 1: Run Database Migration

You need to run the migration to add the `exercise_body_parts` table before using this feature.

### Option A: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project root
cd c:\Users\Bartek Paczesny\.work\projects\fitness-webapp

# Push the migration to your Supabase project
supabase db push
```

### Option B: Manual Execution in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Open a new query
5. Copy the contents of `supabase/migrations/004_add_exercise_body_parts_junction.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)

## Step 2: Verify Migration

Run this query in the SQL Editor to verify the table was created:

```sql
SELECT * FROM exercise_body_parts LIMIT 1;
```

You should see the table structure with no errors.

## Step 3: Test the Feature

1. Start your development server:

    ```bash
    npm run dev
    ```

2. Navigate to any template: `/templates/[id]`

3. Click **"Dodaj ćwiczenie"** (Add Exercise)

4. You should now see:

    - Input field for exercise name
    - **Multi-select list** of body parts (instead of dropdown)
    - Checkboxes next to each body part
    - Selection counter at the bottom

5. Create a test exercise:

    - Name: "Wyciskanie sztangi"
    - Select: Klatka piersiowa, Triceps, Barki
    - Click "Utwórz nowe ćwiczenie"

6. Verify the exercise appears with **3 colored badges** showing all body parts

## ✅ Expected Result

After creating an exercise with multiple body parts:

```
Wyciskanie sztangi
[Klatka piersiowa] [Triceps] [Barki]
     (orange)        (gray)    (gray)
```

-   First selected body part (Klatka piersiowa) is orange = primary
-   Other body parts are gray = secondary

## 🐛 Troubleshooting

### Migration Failed

**Error:** `relation "exercise_body_parts" already exists`

-   **Solution:** The table already exists. You're good to go!

**Error:** `permission denied`

-   **Solution:** Make sure you're logged in to Supabase CLI:
    ```bash
    supabase login
    supabase link --project-ref your-project-ref
    ```

### UI Not Showing Multi-Select

**Problem:** Still seeing single dropdown

-   **Solution:**
    1. Clear your browser cache
    2. Hard refresh (Ctrl+Shift+R)
    3. Check the file was saved correctly: `src/app/templates/[id]/page.tsx`

**Problem:** Getting TypeScript errors

-   **Solution:** Restart your TypeScript server in VS Code:
    1. Press Ctrl+Shift+P
    2. Type "TypeScript: Restart TS Server"
    3. Press Enter

### Database Errors

**Error:** `insert or update on table "exercise_body_parts" violates foreign key constraint`

-   **Solution:** The migration didn't complete. Re-run the migration.

**Error:** `column "body_part" does not exist`

-   **Solution:** The migration wasn't applied. Follow Step 1 again.

## 📚 Additional Documentation

-   Full feature documentation: `MULTIPLE_BODY_PARTS_FEATURE.md`
-   Implementation details: `IMPLEMENTATION_SUMMARY.md`
-   Migration file: `supabase/migrations/004_add_exercise_body_parts_junction.sql`

## 🎯 What's Next?

After verifying the feature works:

1. **Use it for new exercises:** Create exercises with realistic body part combinations
2. **Check analytics:** Body part stats should aggregate from all targeted parts
3. **Test goals:** Body part goals should work with the new system
4. **Mobile testing:** Test the multi-select UI on mobile devices

## 💡 Tips

-   **Primary body part matters:** The first body part you select becomes the primary one
-   **Order matters:** Select the most targeted muscle first
-   **Be realistic:** Don't select every muscle for every exercise
-   **Common examples:**
    -   Bench Press: Chest (primary), Triceps, Shoulders
    -   Deadlift: Back (primary), Hamstrings, Glutes
    -   Pull-ups: Back (primary), Biceps
    -   Squats: Quads (primary), Hamstrings, Glutes

## ✨ Quick Demo

1. Go to `/templates/new` or edit existing template
2. Click "Dodaj ćwiczenie"
3. Type "Pompki" (Push-ups)
4. Click on:
    - ✅ Klatka piersiowa
    - ✅ Triceps
5. See "Wybrano: 2 partie"
6. Click "Utwórz nowe ćwiczenie"
7. Done! 🎉

---

**Need help?** Check the implementation files or reach out to the development team.
