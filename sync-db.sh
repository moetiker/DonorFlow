#!/bin/bash
##############################################################################
# DonorFlow - Sync Production Database to Local
##############################################################################
# Downloads the production database to your local environment.
#
# Usage: ./sync-db.sh [environment]
# Example: ./sync-db.sh production
##############################################################################

set -e

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment-specific configuration
if [ ! -f "$SCRIPT_DIR/deploy-config.$ENVIRONMENT.sh" ]; then
  echo -e "${RED}Configuration file not found: deploy-config.$ENVIRONMENT.sh${NC}"
  echo "Please create this file with your deployment settings."
  exit 1
fi

source "$SCRIPT_DIR/deploy-config.$ENVIRONMENT.sh"

# Validate required configuration
if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
  echo -e "${RED}Missing required configuration:${NC}"
  echo "   DEPLOY_HOST, DEPLOY_USER, and DEPLOY_PATH must be set"
  exit 1
fi

REMOTE_DB_PATH="$DEPLOY_PATH/current/prisma"
LOCAL_DB_PATH="$SCRIPT_DIR/prisma"

echo -e "${BLUE}Syncing database from $ENVIRONMENT${NC}"
echo "   Host: $DEPLOY_USER@$DEPLOY_HOST"
echo "   Remote: $REMOTE_DB_PATH"
echo "   Local:  $LOCAL_DB_PATH"
echo ""

# List available databases on remote
echo -e "${BLUE}Available databases on server:${NC}"
ssh "$DEPLOY_USER@$DEPLOY_HOST" "ls -la $REMOTE_DB_PATH/*.db 2>/dev/null || echo 'No .db files found'"
echo ""

# Find the main database file (prefer prod.db, then largest .db file)
REMOTE_DB=$(ssh "$DEPLOY_USER@$DEPLOY_HOST" "
  if [ -f '$REMOTE_DB_PATH/prod.db' ] && [ -s '$REMOTE_DB_PATH/prod.db' ]; then
    echo '$REMOTE_DB_PATH/prod.db'
  else
    ls -S $REMOTE_DB_PATH/*.db 2>/dev/null | head -1
  fi
")

if [ -z "$REMOTE_DB" ]; then
  echo -e "${RED}No database file found on remote server${NC}"
  exit 1
fi

DB_NAME=$(basename "$REMOTE_DB")
echo -e "${BLUE}Downloading: $DB_NAME${NC}"

# Backup local database if it exists
if [ -f "$LOCAL_DB_PATH/$DB_NAME" ]; then
  BACKUP_NAME="${DB_NAME%.db}-backup-$(date +%Y%m%d-%H%M%S).db"
  echo -e "${YELLOW}Backing up local database to: $BACKUP_NAME${NC}"
  cp "$LOCAL_DB_PATH/$DB_NAME" "$LOCAL_DB_PATH/$BACKUP_NAME"
fi

# Download database
scp "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_DB" "$LOCAL_DB_PATH/$DB_NAME"

echo ""
echo -e "${GREEN}Database synced successfully!${NC}"
echo "   File: $LOCAL_DB_PATH/$DB_NAME"
echo ""
echo -e "${YELLOW}Note: You may need to update your .env DATABASE_URL to use this file${NC}"
