#!/bin/bash

# DBX Bank Customer App - Production Log Tailing Script
# This script connects to the production server and tails the Node.js application logs

# Production server configuration
PROD_SERVER="164.92.84.174"
PROD_USER="root"
APP_NAME="customer-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 DBX Bank Customer App - Production Log Viewer${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --follow     Follow log output in real-time (default)"
    echo "  -n, --lines NUM  Show last NUM lines (default: 50)"
    echo "  -e, --errors     Show only error logs"
    echo "  -a, --all        Show all PM2 logs"
    echo "  -d, --direct     Use direct file access (fallback method)"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Tail logs with default settings"
    echo "  $0 -n 100            # Show last 100 lines"
    echo "  $0 -e                 # Show only error logs"
    echo "  $0 -a                 # Show all PM2 application logs"
    echo "  $0 -d                 # Use direct file access method"
    echo ""
}

# Default options
LINES=50
FOLLOW=true
ERRORS_ONLY=false
ALL_LOGS=false
DIRECT_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -e|--errors)
            ERRORS_ONLY=true
            shift
            ;;
        -a|--all)
            ALL_LOGS=true
            shift
            ;;
        -d|--direct)
            DIRECT_MODE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Function to check if SSH connection works
check_connection() {
    echo -e "${YELLOW}🔄 Testing SSH connection to production server...${NC}"
    
    if ssh -o ConnectTimeout=10 -o BatchMode=yes "$PROD_USER@$PROD_SERVER" exit 2>/dev/null; then
        echo -e "${GREEN}✅ SSH connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ SSH connection failed${NC}"
        echo -e "${YELLOW}💡 Make sure you can connect to the server with: ssh $PROD_USER@$PROD_SERVER${NC}"
        return 1
    fi
}

# Function to get PM2 process info
get_pm2_info() {
    echo -e "${YELLOW}🔄 Getting PM2 process information...${NC}"
    
    ssh "$PROD_USER@$PROD_SERVER" "pm2 list" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PM2 is running${NC}"
    else
        echo -e "${RED}❌ PM2 is not running or not accessible${NC}"
        return 1
    fi
}

# Function to tail logs using direct file access (fallback method)
tail_logs_direct() {
    echo -e "${GREEN}📋 Using direct file access method for $APP_NAME logs...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop tailing logs${NC}"
    echo ""
    echo -e "${BLUE}==================== LOGS START ====================${NC}"
    
    # Try to tail both output and error logs
    if [ "$ERRORS_ONLY" = true ]; then
        echo -e "${YELLOW}Tailing error logs only...${NC}"
        ssh "$PROD_USER@$PROD_SERVER" "tail -f ~/.pm2/logs/$APP_NAME-error.log"
    else
        echo -e "${YELLOW}Tailing both output and error logs...${NC}"
        # Use multitail or tail with multiple files
        ssh "$PROD_USER@$PROD_SERVER" "tail -n $LINES -f ~/.pm2/logs/$APP_NAME-out.log ~/.pm2/logs/$APP_NAME-error.log"
    fi
}

# Function to tail logs
tail_logs() {
    local log_command=""
    
    if [ "$ALL_LOGS" = true ]; then
        echo -e "${GREEN}📋 Showing all PM2 application logs...${NC}"
        if [ "$FOLLOW" = true ]; then
            log_command="pm2 logs --lines $LINES"
        else
            log_command="pm2 logs --lines $LINES --nostream"
        fi
    elif [ "$ERRORS_ONLY" = true ]; then
        echo -e "${GREEN}🚨 Showing only error logs for $APP_NAME...${NC}"
        if [ "$FOLLOW" = true ]; then
            log_command="pm2 logs $APP_NAME --err --lines $LINES"
        else
            log_command="pm2 logs $APP_NAME --err --lines $LINES --nostream"
        fi
    else
        echo -e "${GREEN}📋 Showing logs for $APP_NAME (last $LINES lines)...${NC}"
        if [ "$FOLLOW" = true ]; then
            log_command="pm2 logs $APP_NAME --lines $LINES"
        else
            log_command="pm2 logs $APP_NAME --lines $LINES --nostream"
        fi
    fi
    
    echo -e "${BLUE}Command: $log_command${NC}"
    if [ "$FOLLOW" = true ]; then
        echo -e "${YELLOW}Press Ctrl+C to stop tailing logs${NC}"
    fi
    echo ""
    echo -e "${BLUE}==================== LOGS START ====================${NC}"
    
    # Execute the log command on the remote server
    ssh "$PROD_USER@$PROD_SERVER" "$log_command" 2>/dev/null
    
    # If the PM2 command fails, try the direct method
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️ PM2 logs command failed, trying direct file access...${NC}"
        echo ""
        tail_logs_direct
    fi
}

# Function to show alternative log locations
show_alternatives() {
    echo -e "${YELLOW}💡 Alternative log locations and commands you can try:${NC}"
    echo ""
    echo -e "${BLUE}1. PM2 logs (basic):${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'pm2 logs $APP_NAME'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'pm2 logs $APP_NAME --lines 100'"
    echo ""
    echo -e "${BLUE}2. PM2 logs (streaming - older versions):${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'pm2 logs $APP_NAME --raw'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'pm2 logs --raw | tail -f'"
    echo ""
    echo -e "${BLUE}3. Direct log files (PM2 default location):${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f ~/.pm2/logs/$APP_NAME-out.log'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f ~/.pm2/logs/$APP_NAME-error.log'"
    echo ""
    echo -e "${BLUE}4. System logs:${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'journalctl -u $APP_NAME -f'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'journalctl -f | grep $APP_NAME'"
    echo ""
    echo -e "${BLUE}5. Application logs (if logging to file):${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f /var/log/$APP_NAME.log'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f /var/log/nodejs/$APP_NAME.log'"
    echo ""
    echo -e "${BLUE}6. Nginx logs:${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f /var/log/nginx/access.log'"
    echo "   ssh $PROD_USER@$PROD_SERVER 'tail -f /var/log/nginx/error.log'"
    echo ""
    echo -e "${BLUE}7. Manual live tailing:${NC}"
    echo "   ssh $PROD_USER@$PROD_SERVER"
    echo "   Then run: pm2 logs $APP_NAME"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}🚀 Starting log monitoring for $APP_NAME on $PROD_SERVER${NC}"
    echo ""
    
    # Check SSH connection
    if ! check_connection; then
        echo ""
        show_alternatives
        exit 1
    fi
    
    echo ""
    
    # Get PM2 info
    if ! get_pm2_info; then
        echo ""
        show_alternatives
        exit 1
    fi
    
    echo ""
    
    # Start tailing logs
    if [ "$DIRECT_MODE" = true ]; then
        tail_logs_direct
    else
        tail_logs
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}👋 Log monitoring stopped${NC}"; exit 0' INT

# Run main function
main
