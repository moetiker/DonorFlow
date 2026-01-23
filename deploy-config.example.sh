#!/bin/bash
##############################################################################
# DonorFlow - Deployment Configuration Template
##############################################################################
# Copy this file and customize for your environment:
#   cp deploy-config.example.sh deploy-config.production.sh
##############################################################################

# Remote server connection
DEPLOY_HOST="your-server.example.com"
DEPLOY_USER="your-username"

# Deployment path on remote server
DEPLOY_PATH="/home/$DEPLOY_USER/donorflow"

# systemd user service name
SERVICE_NAME="donorflow"

# Temporary directories for build artifacts
DEPLOY_TEMP="$HOME/deploy-temp"
REMOTE_DEPLOY_TEMP="/home/$DEPLOY_USER/deploy-temp"
