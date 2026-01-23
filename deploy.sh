#!/bin/bash

##############################################################################
# DonorFlow - Podman-based Deployment Script
##############################################################################
# Builds application in Podman container for reproducible Linux binaries,
# then deploys via tar archive with atomic backup/restore.
#
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production
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
  echo -e "${RED}❌ Configuration file not found: deploy-config.$ENVIRONMENT.sh${NC}"
  echo "Please create this file with your deployment settings."
  echo ""
  echo "Copy from template:"
  echo "  cp deploy-config.example.sh deploy-config.$ENVIRONMENT.sh"
  exit 1
fi

source "$SCRIPT_DIR/deploy-config.$ENVIRONMENT.sh"

# Set defaults
DEPLOY_TEMP="${DEPLOY_TEMP:-$HOME/deploy-temp}"
REMOTE_DEPLOY_TEMP="${REMOTE_DEPLOY_TEMP:-/home/$DEPLOY_USER/deploy-temp}"
SERVICE_NAME="${SERVICE_NAME:-donorflow}"

# Validate required configuration
if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
  echo -e "${RED}❌ Missing required configuration:${NC}"
  echo "   DEPLOY_HOST, DEPLOY_USER, and DEPLOY_PATH must be set"
  exit 1
fi

# Ensure DEPLOY_TEMP directory exists locally
mkdir -p "$DEPLOY_TEMP"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        DonorFlow - Podman Deployment                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🚀 Deploying to $ENVIRONMENT${NC}"
echo "   Host: $DEPLOY_USER@$DEPLOY_HOST"
echo "   Path: $DEPLOY_PATH"
echo ""

# Step 0: Bump version and commit
echo -e "${BLUE}📦 Step 0: Bumping version...${NC}"
cd "$SCRIPT_DIR"

CURRENT_VERSION=$(grep -o '"version":\s*"[^"]*"' package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
echo "   Current version: $CURRENT_VERSION"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
echo "   New version: $NEW_VERSION"

sed -i "s/\"version\":\s*\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

git add package.json
git commit -m "Bump version to $NEW_VERSION for deployment"
git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"

echo -e "${GREEN}✅ Version bumped to $NEW_VERSION${NC}"
echo ""

# Step 1: Check if Podman is available
echo -e "${BLUE}📋 Step 1: Pre-deployment checks...${NC}"
if ! command -v podman &> /dev/null; then
  echo -e "${RED}❌ ERROR: podman is not installed${NC}"
  echo ""
  echo "   Please install Podman:"
  echo "   - Fedora/RHEL: sudo dnf install podman"
  echo "   - Ubuntu/Debian: sudo apt install podman"
  echo "   - macOS: brew install podman"
  exit 1
fi
echo -e "${GREEN}✅ Podman available${NC}"

# Step 2: Build application in Podman container
echo -e "${BLUE}🐳 Step 2: Building in Podman container...${NC}"
IMAGE_NAME="donorflow-build"

podman build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile.build" "$SCRIPT_DIR"

echo -e "${BLUE}📦 Extracting built files from container...${NC}"
CONTAINER_ID=$(podman create "$IMAGE_NAME")

BUILD_DIR="$DEPLOY_TEMP/build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

podman cp "$CONTAINER_ID:/app/." "$BUILD_DIR/"
podman rm "$CONTAINER_ID"

# Clean up old images
echo -e "${BLUE}🧹 Cleaning up old Podman images...${NC}"
OLD_IMAGES=$(podman images "$IMAGE_NAME" --format "{{.ID}}" | tail -n +2)
if [ -n "$OLD_IMAGES" ]; then
  echo "$OLD_IMAGES" | xargs podman rmi -f 2>/dev/null || true
fi

echo -e "${GREEN}✅ Build completed${NC}"

# Step 3: Clean up build directory
echo -e "${BLUE}🧹 Step 3: Cleaning build directory...${NC}"
cd "$BUILD_DIR"

rm -rf \
  .git \
  .gitignore \
  .vscode \
  .idea \
  .env \
  .env.local \
  .env.*.local \
  Dockerfile.build \
  deploy*.sh \
  .eslintrc* \
  eslint.config.js \
  tsconfig.json \
  CLAUDE.md \
  README.md \
  .deployignore \
  node_modules/.cache \
  coverage

# CRITICAL: Remove database files (preserved on server)
echo -e "${BLUE}🔒 Removing database files from package...${NC}"
rm -f prisma/*.db prisma/*.db-journal prisma/*.db-shm prisma/*.db-wal

# Verify critical files
echo -e "${BLUE}🔍 Verifying build contents...${NC}"
MISSING_FILES=()
[ ! -f "package.json" ] && MISSING_FILES+=("package.json")
[ ! -f "ecosystem.config.js" ] && MISSING_FILES+=("ecosystem.config.js")
[ ! -d ".next" ] && MISSING_FILES+=(".next/")
[ ! -d "node_modules" ] && MISSING_FILES+=("node_modules/")
[ ! -d "prisma" ] && MISSING_FILES+=("prisma/")

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo -e "${RED}❌ ERROR: Critical files missing:${NC}"
  printf '   - %s\n' "${MISSING_FILES[@]}"
  exit 1
fi

echo -e "${GREEN}✅ All critical files present${NC}"

# Step 4: Create deployment package
echo -e "${BLUE}📦 Step 4: Creating deployment package...${NC}"
PACKAGE_NAME="deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$DEPLOY_TEMP/$PACKAGE_NAME" -C "$BUILD_DIR" .

PACKAGE_SIZE=$(du -h "$DEPLOY_TEMP/$PACKAGE_NAME" | cut -f1)
echo -e "${GREEN}✅ Package created: $PACKAGE_NAME ($PACKAGE_SIZE)${NC}"

rm -rf "$BUILD_DIR"

# Step 5: Upload to server
echo -e "${BLUE}📤 Step 5: Uploading to server...${NC}"
ssh "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p $REMOTE_DEPLOY_TEMP"
scp "$DEPLOY_TEMP/$PACKAGE_NAME" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_DEPLOY_TEMP/"

# Step 6: Deploy on remote server
echo -e "${BLUE}🔧 Step 6: Deploying on remote server...${NC}"
ssh "$DEPLOY_USER@$DEPLOY_HOST" bash -s << EOF
set -e

REMOTE_DEPLOY_TEMP="$REMOTE_DEPLOY_TEMP"
SERVICE_NAME="$SERVICE_NAME"

mkdir -p "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

# Backup current deployment
BACKUP_DIR="backup-\$(date +%Y%m%d-%H%M%S)"
if [ -d "current" ]; then
  echo "📂 Moving current deployment to \$BACKUP_DIR"
  mv current "\$BACKUP_DIR"

  # Keep only last 3 backups
  ls -dt backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
else
  echo "📂 First deployment"
  BACKUP_DIR=""
fi

# Extract new deployment
echo "📦 Extracting new deployment..."
mkdir -p current
tar -xzf "\$REMOTE_DEPLOY_TEMP/$PACKAGE_NAME" -C current/

# Restore data from backup
if [ -n "\$BACKUP_DIR" ] && [ -d "\$BACKUP_DIR" ]; then
  # Restore database files
  if [ -d "\$BACKUP_DIR/prisma" ]; then
    for db in \$BACKUP_DIR/prisma/*.db; do
      if [ -f "\$db" ]; then
        echo "💾 Restoring \$(basename \$db)..."
        cp "\$db" current/prisma/
      fi
    done
  fi

  # Restore .env
  if [ -f "\$BACKUP_DIR/.env" ]; then
    echo "🔐 Restoring .env..."
    cp "\$BACKUP_DIR/.env" current/.env
  fi

  # Restore logs directory
  if [ -d "\$BACKUP_DIR/logs" ]; then
    echo "📋 Restoring logs..."
    cp -r "\$BACKUP_DIR/logs" current/
  fi
fi

cd current

# Create .env from template if missing
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env with production settings!"
  fi
fi

# Create logs directory
mkdir -p logs

# Check mise and install Node.js
if command -v mise &> /dev/null; then
  echo "📥 Setting up Node.js via mise..."
  eval "\$(mise activate bash)"
  mise trust 2>/dev/null || true
  mise install
fi

# Sync database schema
echo "🗄️  Syncing database schema..."
npx prisma db push --accept-data-loss

# Generate missing status tokens
echo "🔗 Generating missing status tokens..."
source .env && npx tsx prisma/generate-status-tokens.ts

# Restart application with systemd user service
echo "🔄 Restarting application..."
if systemctl --user is-enabled \$SERVICE_NAME &>/dev/null; then
  systemctl --user restart \$SERVICE_NAME
  sleep 2
  systemctl --user status \$SERVICE_NAME --no-pager -l
else
  echo ""
  echo "⚠️  systemd service not installed yet!"
  echo ""
  echo "📋 First-time setup required:"
  echo "   mkdir -p ~/.config/systemd/user"
  echo "   cp \$SERVICE_NAME.service.example ~/.config/systemd/user/\$SERVICE_NAME.service"
  echo "   systemctl --user daemon-reload"
  echo "   systemctl --user enable \$SERVICE_NAME"
  echo "   loginctl enable-linger \$USER"
  echo "   systemctl --user start \$SERVICE_NAME"
  echo ""
  echo "   Or run this one-liner:"
  echo "   mkdir -p ~/.config/systemd/user && cp \$SERVICE_NAME.service.example ~/.config/systemd/user/\$SERVICE_NAME.service && systemctl --user daemon-reload && systemctl --user enable \$SERVICE_NAME && loginctl enable-linger \$USER && systemctl --user start \$SERVICE_NAME"
  echo ""
fi

# Cleanup
rm "\$REMOTE_DEPLOY_TEMP/$PACKAGE_NAME"

echo ""
echo "✅ Deployment completed successfully!"
EOF

# Cleanup local package
rm "$DEPLOY_TEMP/$PACKAGE_NAME"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Deployment Completed Successfully            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "  ✅ Version: $NEW_VERSION"
echo "  ✅ Built in Podman container"
echo "  ✅ Uploaded and extracted"
echo "  ✅ Database preserved and schema synced"
echo "  ✅ Status tokens generated"
echo "  ✅ Application restarted"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  ssh $DEPLOY_USER@$DEPLOY_HOST \"journalctl --user -u $SERVICE_NAME -f\""
echo "  ssh $DEPLOY_USER@$DEPLOY_HOST \"systemctl --user restart $SERVICE_NAME\""
echo "  ssh $DEPLOY_USER@$DEPLOY_HOST \"systemctl --user status $SERVICE_NAME\""
echo ""
