# Migration Guide: Sponsor Assignment Update

## Overview

This migration ensures that all sponsors have the correct `memberId` or `groupId` assignment based on their donation history. This is required for the new "sponsors without donations" feature to work correctly.

## Background

Previously, donation records stored `memberId`/`groupId` directly on the donation, but the sponsor record itself might not have had an assignment. The new feature needs sponsors to have these assignments to identify which sponsors are assigned to a member/group but haven't donated yet.

## Migration Steps

### Option 1: Local Migration (Testing)

Test the migration locally before running on production:

```bash
# 1. Make sure you're in the project directory
cd /path/to/donorflow

# 2. Run the migration script
npx tsx scripts/migrate-sponsor-assignments.ts
```

Review the output to see what will be changed.

### Option 2: Production Migration

After deploying the new code to production:

```bash
# 1. SSH to the production server
ssh user@production-server

# 2. Navigate to the application directory
cd /path/to/production/donorflow

# 3. IMPORTANT: Backup the database first!
cp prisma/prod.db prisma/prod.db.backup-$(date +%Y%m%d-%H%M%S)

# 4. Add missing database columns (if not already present)
sqlite3 prisma/prod.db < scripts/add-donation-assignments.sql

# 5. Run the data migration
npx tsx scripts/migrate-sponsor-assignments.ts

# 6. Restart the application
pm2 restart donorflow

# 7. Verify the results
# Check the output for any conflicts or issues

# 8. Optional: Verify in Prisma Studio
npx prisma studio
# Open http://localhost:5555 and check the Sponsor and Donation tables
```

## What the Migration Does

### Step 1: Database Schema Update (SQL)

Adds the missing columns to the Donation table:
- `memberId` (optional) - Direct assignment to a member
- `groupId` (optional) - Direct assignment to a group
- Creates indexes for performance

### Step 2: Data Migration (TypeScript)

1. **Finds unassigned sponsors**: Looks for sponsors without `memberId`/`groupId`
2. **Analyzes donations**: Checks all donations from each sponsor
3. **Updates sponsors**: Sets the sponsor's `memberId`/`groupId` based on their donations
4. **Handles conflicts**: If a sponsor has donations to multiple members/groups, it uses the most common one

## Expected Output

```
🔄 Starting sponsor assignment migration...

📊 Found 45 sponsors total

✅ Updated "ACME Corp" → member: abc123 (5 donations)
✅ Updated "John Doe" → group: def456 (3 donations)
⏭️  Skipping "Jane Smith" - already assigned
⚠️  CONFLICT: "MultiCorp" has donations to multiple assignments:
     - member-abc123: 3 donations
     - member-xyz789: 2 donations
     → Using most common: member-abc123
⚠️  Skipping "New Sponsor Inc" - no donations found

============================================================
📋 Migration Summary:
============================================================
✅ Updated:          12 sponsors
⏭️  Already assigned:  28 sponsors
⚠️  No donations:      3 sponsors
⚠️  Conflicts:         2 sponsors
📊 Total processed:  45 sponsors
============================================================
```

## Rollback (if needed)

If something goes wrong:

```bash
# Restore from backup
cd /path/to/production/donorflow
cp prisma/prod.db.backup-YYYYMMDD-HHMMSS prisma/prod.db

# Restart the application
pm2 restart donorflow
```

## Deployment Workflow

Recommended deployment sequence:

```bash
# 1. Deploy the new code (from your local machine)
./deploy-rsync.sh

# 2. SSH to production server
ssh user@production-server

# 3. Backup database
cd /path/to/production/donorflow
cp prisma/prod.db prisma/prod.db.backup-$(date +%Y%m%d-%H%M%S)

# 4. Add database columns
sqlite3 prisma/prod.db < scripts/add-donation-assignments.sql

# 5. Run data migration
npx tsx scripts/migrate-sponsor-assignments.ts

# 6. Restart app
pm2 restart donorflow

# 7. Done! The app is running with the new code and migrated data
```

## Notes

- **Safe to run multiple times**: The script skips already-assigned sponsors
- **No data loss**: Only updates `memberId`/`groupId` fields on sponsors
- **Donations untouched**: No changes to the donation table
- **Conflicts handled**: Uses most common assignment when sponsor has donations to multiple members/groups
- **Unassigned sponsors**: Sponsors without donations remain unassigned (you can assign them manually in the UI)

## Verification

After migration, verify in the UI:

1. Go to Reports page
2. Click on a member or group row
3. Check the "Assigned Sponsors Without Donations" section
4. It should now correctly show sponsors assigned to that member/group who haven't donated

## Questions?

If you encounter any issues during migration, check:

- Database backup exists before running migration
- No errors in the migration output
- Application is running correctly (`pm2 status donorflow`)
- Logs for any errors (`pm2 logs donorflow`)
