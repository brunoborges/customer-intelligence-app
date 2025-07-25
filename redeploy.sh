#!/bin/bash

# Quick Redeploy Script for Customer App
# This script only updates files and restarts the app (faster than full setup)

set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS          IP address of the target server (required)"
    echo "  -u, --user USERNAME          SSH username (default: root)"
    echo "  -d, --directory DIRECTORY    Remote app directory (default: /var/www/customer-app)"
    echo "  -n, --name APP_NAME          Application name (default: customer-app)"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --ip 164.92.84.174"
    echo "  $0 -i 192.168.1.100 -u deploy -d /home/deploy/app"
    echo ""
}

# Default configuration
DROPLET_IP=""
DROPLET_USER="root"
APP_DIR="/var/www/customer-app"
APP_NAME="customer-app"
LOCAL_DIR="."

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--ip)
            DROPLET_IP="$2"
            shift 2
            ;;
        -u|--user)
            DROPLET_USER="$2"
            shift 2
            ;;
        -d|--directory)
            APP_DIR="$2"
            shift 2
            ;;
        -n|--name)
            APP_NAME="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$DROPLET_IP" ]]; then
    echo "Error: IP address is required"
    echo ""
    show_usage
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to execute commands on remote server
remote_exec() {
    ssh -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "$1"
}

# Function to sync files to remote server using rsync
remote_sync() {
    rsync -avz --delete \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='.env' \
        --exclude='.DS_Store' \
        --exclude='*.tmp' \
        --exclude='OPENAI_KEY' \
        --exclude='RESEND_KEY' \
        -e "ssh -o StrictHostKeyChecking=no" \
        "$LOCAL_DIR/" "$DROPLET_USER@$DROPLET_IP:$APP_DIR/"
}

echo "🔄 Quick redeploying Customer App..."
echo "Target: $DROPLET_USER@$DROPLET_IP"
echo "App Directory: $APP_DIR"
echo "App Name: $APP_NAME"
echo ""

# Stop the application
print_status "Stopping application..."
remote_exec "cd $APP_DIR && pm2 stop $APP_NAME || true"

# Sync files to server (only changed files)
print_status "Syncing changed files to server..."
remote_sync

# Install any new dependencies
print_status "Installing dependencies..."
remote_exec "cd $APP_DIR && npm install --production"

# Restart the application
print_status "Restarting application..."
remote_exec "cd $APP_DIR && pm2 restart $APP_NAME"

print_success "🎉 Redeploy completed!"
print_status "Application is available at: http://$DROPLET_IP"

# Check status
sleep 3
print_status "Application status:"
remote_exec "pm2 status $APP_NAME"
