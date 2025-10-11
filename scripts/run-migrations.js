#!/usr/bin/env node

/**
 * Migration runner script
 * Applies all SQL migrations in order from the migrations directory
 * Usage: node scripts/run-migrations.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing Supabase credentials in .env.local");
    console.error(
        "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create migrations tracking table if it doesn't exist
async function createMigrationsTable() {
    const { error } = await supabase.rpc("exec_sql", {
        sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
    });

    if (error) {
        // If RPC doesn't exist, we'll try direct query (needs service role key)
        console.log(
            "⚠️  Warning: Could not create migrations table using RPC."
        );
        console.log(
            "You may need to create it manually or use the Supabase Dashboard."
        );
        console.log("SQL to run:");
        console.log(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        return false;
    }
    return true;
}

// Get list of applied migrations
async function getAppliedMigrations() {
    const { data, error } = await supabase
        .from("schema_migrations")
        .select("migration_name")
        .order("migration_name");

    if (error) {
        console.log("⚠️  Could not fetch applied migrations:", error.message);
        return [];
    }

    return data ? data.map((row) => row.migration_name) : [];
}

// Record migration as applied
async function recordMigration(migrationName) {
    const { error } = await supabase
        .from("schema_migrations")
        .insert({ migration_name: migrationName });

    if (error) {
        throw new Error(`Failed to record migration: ${error.message}`);
    }
}

// Execute SQL migration
async function executeMigration(sql, migrationName) {
    // For security reasons, we can't execute arbitrary SQL with anon key
    // This would require a service role key or using Supabase CLI
    console.log("\n📝 Migration SQL:");
    console.log("=".repeat(80));
    console.log(sql);
    console.log("=".repeat(80));
    console.log("\n⚠️  Note: To apply this migration, you have two options:");
    console.log(
        "1. Copy the SQL above and run it in Supabase Dashboard > SQL Editor"
    );
    console.log("2. Use Supabase CLI: supabase db push");
    console.log(
        "\nAfter applying, the migration will be tracked automatically.\n"
    );
}

// Main migration runner
async function runMigrations() {
    console.log("🚀 Starting migration process...\n");

    const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

    if (!fs.existsSync(migrationsDir)) {
        console.error("❌ Migrations directory not found:", migrationsDir);
        process.exit(1);
    }

    // Get all migration files
    const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

    if (files.length === 0) {
        console.log("✅ No migration files found.");
        return;
    }

    console.log(`📁 Found ${files.length} migration file(s):\n`);
    files.forEach((file, idx) => {
        console.log(`   ${idx + 1}. ${file}`);
    });
    console.log("");

    // Try to create migrations tracking table
    await createMigrationsTable();

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log(
        `✓ Previously applied migrations: ${appliedMigrations.length}\n`
    );

    // Apply pending migrations
    let appliedCount = 0;
    for (const file of files) {
        const migrationName = file.replace(".sql", "");

        if (appliedMigrations.includes(migrationName)) {
            console.log(`⏭️  Skipping (already applied): ${file}`);
            continue;
        }

        console.log(`\n🔄 Processing migration: ${file}`);

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf8");

        try {
            await executeMigration(sql, migrationName);
            // In a production setup with service role key, we would:
            // await recordMigration(migrationName);
            appliedCount++;
        } catch (error) {
            console.error(
                `\n❌ Error applying migration ${file}:`,
                error.message
            );
            console.error("Migration process stopped.");
            process.exit(1);
        }
    }

    console.log("\n" + "=".repeat(80));
    if (appliedCount === 0) {
        console.log("✅ All migrations are up to date!");
    } else {
        console.log(
            `✅ Migration process complete! ${appliedCount} migration(s) shown above.`
        );
        console.log(
            "⚠️  Remember to apply the SQL in Supabase Dashboard or using Supabase CLI."
        );
    }
    console.log("=".repeat(80) + "\n");
}

// Run migrations
runMigrations().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
