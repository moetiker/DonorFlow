-- Migration: Add memberId and groupId to Donation table
-- This adds the ability to assign donations directly to members or groups
-- in addition to the sponsor assignment

-- Add memberId column
ALTER TABLE Donation ADD COLUMN memberId TEXT;

-- Add groupId column
ALTER TABLE Donation ADD COLUMN groupId TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Donation_memberId_idx" ON "Donation"("memberId");
CREATE INDEX IF NOT EXISTS "Donation_groupId_idx" ON "Donation"("groupId");

-- Show result
SELECT 'Migration completed successfully. Added memberId and groupId columns to Donation table.' as result;
