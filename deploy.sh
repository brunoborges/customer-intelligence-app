#!/bin/bash

# DigitalOcean Deployment Script for Customer App
# Generic deployment script with configurable parameters

set -e  # Exit on any error

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS          IP address of the target server (required)"
    echo "  -u, --user USERNAME          SSH username (default: root)"
    echo "  -d, --directory DIRECTORY    Remote app directory (default: /var/www/customer-app)"
    echo "  -n, --name APP_NAME          Application name (default: customer-app)"
    echo "  -p, --port PORT              Application port (default: 3000)"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --ip 164.92.84.174"
    echo "  $0 -i 192.168.1.100 -u deploy -d /home/deploy/app -n myapp -p 3001"
    echo ""
}

# Default configuration
DROPLET_IP=""
DROPLET_USER="root"
APP_DIR="/var/www/customer-app"
SERVICE_NAME="customer-app"
APP_PORT="3000"
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
            SERVICE_NAME="$2"
            shift 2
            ;;
        -p|--port)
            APP_PORT="$2"
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
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if sshpass is installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v sshpass &> /dev/null; then
        print_error "sshpass is required but not installed."
        print_status "Installing sshpass..."
        
        # Install sshpass based on OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install hudochenkov/sshpass/sshpass
            else
                print_error "Please install Homebrew first: https://brew.sh/"
                exit 1
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            sudo apt-get update && sudo apt-get install -y sshpass
        else
            print_error "Unsupported OS. Please install sshpass manually."
            exit 1
        fi
    fi
    
    print_success "Dependencies check completed"
}

# Function to execute commands on remote server
remote_exec() {
    ssh -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "$1"
}

# Function to copy files to remote server
remote_copy() {
    scp -o StrictHostKeyChecking=no -r "$1" "$DROPLET_USER@$DROPLET_IP:$2"
}

# Setup server environment
setup_server() {
    print_status "Setting up server environment..."
    
    # Update system packages
    remote_exec "apt-get update && apt-get upgrade -y"
    
    # Install Node.js and npm if not already installed
    remote_exec "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
    remote_exec "apt-get install -y nodejs"
    
    # Install PM2 for process management
    remote_exec "npm install -g pm2"
    
    # Create application directory
    remote_exec "mkdir -p $APP_DIR"
    
    # Install nginx for reverse proxy
    remote_exec "apt-get install -y nginx"
    
    print_success "Server environment setup completed"
}

# Deploy application files
deploy_files() {
    print_status "Deploying application files..."
    
    # Create a temporary directory for deployment
    TEMP_DIR=$(mktemp -d)
    
    # Copy all files except node_modules, .git, and sensitive files
    rsync -av --exclude='node_modules' --exclude='.git' --exclude='*.log' --exclude='.env' --exclude='OPENAI_KEY' --exclude='RESEND_KEY' "$LOCAL_DIR/" "$TEMP_DIR/"
    
    # Copy files to server
    remote_copy "$TEMP_DIR/*" "$APP_DIR/"
    
    # Clean up temporary directory
    rm -rf "$TEMP_DIR"
    
    print_success "Application files deployed"
}

# Install dependencies and configure app
configure_app() {
    print_status "Installing dependencies and configuring application..."
    
    # Install npm dependencies
    remote_exec "cd $APP_DIR && npm install --production"
    
    # Create production environment file
    print_status "⚠️  Please set your API keys after deployment:"
    print_status "   export OPENAI_API_KEY='your_openai_api_key_here'"
    print_status "   export RESEND_API_KEY='your_resend_api_key_here'"
    print_status "   Or edit $APP_DIR/.env file on the server"
    
    remote_exec "cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=$APP_PORT
# Add your API keys here:
# OPENAI_API_KEY=your_openai_api_key_here
# RESEND_API_KEY=your_resend_api_key_here
EOF"
    
    # Set proper permissions
    remote_exec "chown -R root:root $APP_DIR"
    remote_exec "chmod -R 755 $APP_DIR"
    
    print_success "Application configured"
}

# Configure Nginx reverse proxy
configure_nginx() {
    print_status "Configuring Nginx reverse proxy..."
    
    # Create Nginx configuration
    remote_exec "cat > /etc/nginx/sites-available/$SERVICE_NAME << 'EOF'
server {
    listen 80;
    listen [::]:80;
    
    server_name _;
    
    # Increase client max body size for file uploads
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Serve static files directly
    location /static/ {
        alias $APP_DIR/public/;
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }
}
EOF"
    
    # Enable the site
    remote_exec "ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/"
    remote_exec "rm -f /etc/nginx/sites-enabled/default"
    
    # Test Nginx configuration
    remote_exec "nginx -t"
    
    # Restart Nginx
    remote_exec "systemctl restart nginx"
    remote_exec "systemctl enable nginx"
    
    print_success "Nginx configured and restarted"
}

# Configure PM2 process manager
configure_pm2() {
    print_status "Configuring PM2 process manager..."
    
    # Create PM2 ecosystem file
    remote_exec "cat > $APP_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: 'server.js',
    cwd: '$APP_DIR',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '$APP_DIR/logs/err.log',
    out_file: '$APP_DIR/logs/out.log',
    log_file: '$APP_DIR/logs/combined.log',
    time: true
  }]
};
EOF"
    
    # Create logs directory
    remote_exec "mkdir -p $APP_DIR/logs"
    
    # Stop any existing PM2 processes
    remote_exec "cd $APP_DIR && pm2 delete $SERVICE_NAME || true"
    
    # Start the application with PM2
    remote_exec "cd $APP_DIR && pm2 start ecosystem.config.js"
    
    # Save PM2 configuration
    remote_exec "pm2 save"
    
    # Setup PM2 to start on boot
    remote_exec "pm2 startup systemd -u root --hp /root"
    
    print_success "PM2 configured and application started"
}

# Configure firewall
configure_firewall() {
    print_status "Configuring firewall..."
    
    # Install and configure UFW
    remote_exec "ufw --force enable"
    remote_exec "ufw allow ssh"
    remote_exec "ufw allow 80/tcp"
    remote_exec "ufw allow 443/tcp"
    
    print_success "Firewall configured"
}

# Check application status
check_status() {
    print_status "Checking application status..."
    
    # Check PM2 status
    print_status "PM2 Status:"
    remote_exec "pm2 status"
    
    # Check Nginx status
    print_status "Nginx Status:"
    remote_exec "systemctl status nginx --no-pager"
    
    # Check if application is responding
    print_status "Testing application response..."
    sleep 5  # Give the app time to start
    
    if remote_exec "curl -f http://localhost:$APP_PORT/ > /dev/null 2>&1"; then
        print_success "Application is responding on port $APP_PORT"
    else
        print_warning "Application may not be responding yet"
    fi
    
    print_success "Deployment completed!"
    print_status "Your application should be available at: http://$DROPLET_IP"
}

# Main deployment process
main() {
    echo "🚀 Starting deployment to DigitalOcean..."
    echo "Target: $DROPLET_USER@$DROPLET_IP"
    echo "App Directory: $APP_DIR"
    echo "Service Name: $SERVICE_NAME"
    echo "App Port: $APP_PORT"
    echo ""
    
    check_dependencies
    setup_server
    deploy_files
    configure_app
    configure_nginx
    configure_pm2
    configure_firewall
    check_status
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_warning "⚠️  IMPORTANT: Set your API keys to use AI features:"
    echo ""
    print_status "1. SSH into your server:"
    echo "   ssh $DROPLET_USER@$DROPLET_IP"
    echo ""
    print_status "2. Edit the environment file:"
    echo "   nano $APP_DIR/.env"
    echo ""
    print_status "3. Add your API keys:"
    echo "   OPENAI_API_KEY=your_actual_openai_key"
    echo "   RESEND_API_KEY=your_actual_resend_key"
    echo ""
    print_status "4. Restart the application:"
    echo "   pm2 restart $SERVICE_NAME"
    echo ""
    print_status "Application URLs:"
    echo "  • Main Application: http://$DROPLET_IP"
    echo "  • Login Page: http://$DROPLET_IP/login"
    echo "  • AI Matcher: http://$DROPLET_IP/intelligent-matcher"
    echo "  • Customer Management: http://$DROPLET_IP/customers"
    echo ""
    print_status "Useful commands:"
    echo "  • Check logs: ssh $DROPLET_USER@$DROPLET_IP 'pm2 logs $SERVICE_NAME'"
    echo "  • Restart app: ssh $DROPLET_USER@$DROPLET_IP 'pm2 restart $SERVICE_NAME'"
    echo "  • Check status: ssh $DROPLET_USER@$DROPLET_IP 'pm2 status'"
}

# Run deployment
main "$@"
