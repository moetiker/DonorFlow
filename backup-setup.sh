#!/bin/bash
# Setup automatic database backups on web-volki-01

SERVER="web-volki-01"

echo "=========================================="
echo "DonorFlow Backup Setup"
echo "=========================================="
echo "Setting up automatic backups on $SERVER"
echo ""

ssh $SERVER << 'ENDSSH'
set -e

echo "→ Creating backup script..."
cat > ~/backup-donorflow.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/moetiker/donorflow-backups"
DB_FILE="/home/moetiker/donorflow/prisma/production.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/production_$DATE.db"
    echo "$(date): Backup created: production_$DATE.db" >> "$BACKUP_DIR/backup.log"

    # Delete old backups (older than 30 days)
    find "$BACKUP_DIR" -name "production_*.db" -mtime +30 -delete

    # Count remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "production_*.db" | wc -l)
    echo "$(date): Total backups: $BACKUP_COUNT" >> "$BACKUP_DIR/backup.log"
else
    echo "$(date): ERROR - Database file not found!" >> "$BACKUP_DIR/backup.log"
fi
EOF

chmod +x ~/backup-donorflow.sh
echo "  ✓ Backup script created at ~/backup-donorflow.sh"

echo "→ Setting up daily cron job (2:00 AM)..."
# Remove existing donorflow backup cron jobs
crontab -l 2>/dev/null | grep -v "backup-donorflow.sh" | crontab - 2>/dev/null || true
# Add new cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /home/moetiker/backup-donorflow.sh") | crontab -
echo "  ✓ Cron job added"

echo "→ Testing backup script..."
~/backup-donorflow.sh
if [ $? -eq 0 ]; then
    echo "  ✓ Backup test successful"
    echo ""
    echo "Backup location: /home/moetiker/donorflow-backups"
    ls -lh /home/moetiker/donorflow-backups/*.db 2>/dev/null | tail -5
else
    echo "  ⚠ Backup test failed"
fi

echo ""
echo "=========================================="
echo "Backup Setup Complete!"
echo "=========================================="
echo "Backup directory: /home/moetiker/donorflow-backups"
echo "Schedule: Daily at 2:00 AM"
echo "Retention: 30 days"
echo ""
echo "Manual backup: ssh $SERVER '~/backup-donorflow.sh'"
echo "View backups: ssh $SERVER 'ls -lh ~/donorflow-backups/'"
echo "=========================================="
ENDSSH
