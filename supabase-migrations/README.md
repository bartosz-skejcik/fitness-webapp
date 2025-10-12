# Friends Feature Migration

This SQL migration adds the friends functionality to the fitness tracker app.

## How to Run the Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Navigate to the **SQL Editor** section
3. Click **"New Query"**
4. Copy and paste the contents of `add-friends.sql`
5. Click **"Run"** to execute the migration

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd /home/j5on/.work/projects/fitness-webapp

# Run the migration
supabase db push
```

### Option 3: Manual SQL Execution

You can also connect directly to your PostgreSQL database and run the SQL file:

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase-migrations/add-friends.sql
```

## What This Migration Does

1. **Creates `friendships` table**

    - Stores friend relationships between users
    - Tracks status: pending, accepted, rejected
    - Prevents users from friending themselves
    - Ensures unique friendships

2. **Adds indexes** for performance

    - Indexes on user_id, friend_id, and status columns

3. **Sets up Row Level Security (RLS)**

    - Users can only see their own friendships
    - Users can create friend requests
    - Users can accept/reject requests they receive
    - Users can delete friendships they're part of

4. **Creates helper view**
    - `user_friends` view for easier querying of accepted friends

## Testing the Migration

After running the migration, you can test it by:

1. Navigate to `/friends` in your app
2. Search for a friend by email
3. Send a friend request
4. Accept the request (from the friend's account)
5. View the friend comparison at `/progress/[friendId]`

## Rollback (if needed)

If you need to rollback this migration:

```sql
DROP VIEW IF EXISTS user_friends;
DROP TABLE IF EXISTS friendships;
```
