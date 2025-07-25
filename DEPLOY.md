# Customer App - Digital Ocean Deployment Guide

This document provides step-by-step instructions for deploying the Customer App to a Digital Ocean droplet.

> **📖 Note:** This is the primary deployment documentation. It replaces any older deployment guides and provides the most up-to-date, generic instructions for deploying this application.

## Quick Start

For experienced users who want to deploy quickly:

1. **Create a Digital Ocean droplet** (Ubuntu 24.04 LTS, 1GB RAM)
2. **Get API keys** from OpenAI and Resend
3. **Run deployment script** with your server IP:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh --ip YOUR_DROPLET_IP
   ```
4. **Configure SSL** with Let's Encrypt (if using a domain)

For detailed instructions, continue reading below.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Digital Ocean Droplet Setup](#digital-ocean-droplet-setup)
3. [Server Initial Configuration](#server-initial-configuration)
4. [Node.js Installation](#nodejs-installation)
5. [Application Deployment](#application-deployment)
6. [Nginx Installation and Configuration](#nginx-installation-and-configuration)
7. [SSL Certificate with Let's Encrypt](#ssl-certificate-with-lets-encrypt)
8. [PM2 Process Manager Setup](#pm2-process-manager-setup)
9. [Firewall Configuration](#firewall-configuration)
10. [Domain Configuration](#domain-configuration)
11. [Monitoring and Maintenance](#monitoring-and-maintenance)
12. [Backup and Recovery](#backup-and-recovery)

## Prerequisites

Before starting the deployment, ensure you have:

- **Digital Ocean account** with billing set up
- **Domain name** (optional, but recommended for SSL certificates)
- **SSH client** (Terminal on macOS/Linux, PuTTY on Windows)
- **API Keys:**
  - OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
  - Resend API key from [Resend](https://resend.com/)
- **Basic knowledge** of Linux command line
- **Local copy** of this application code

## Pre-Deployment Checklist

Before deploying, complete these steps:

1. **Get your API keys:**
   - Sign up for OpenAI and generate an API key
   - Sign up for Resend and generate an API key
   - Keep these keys secure - you'll add them during deployment

2. **Prepare your domain (if using custom domain):**
   - Purchase a domain name from any registrar
   - Have access to DNS management for the domain

3. **Set up SSH keys (recommended):**
   ```bash
   # Generate SSH key pair (if you don't have one)
   ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
   
   # Copy your public key
   cat ~/.ssh/id_rsa.pub
   ```

4. **Download/clone this repository:**
   ```bash
   git clone <repository-url>
   cd customer-app
   ```

5. **Set up local environment (optional for development):**
   ```bash
   # Create a .env file for local development
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   echo "RESEND_API_KEY=your_resend_api_key_here" >> .env
   chmod 600 .env
   ```

## Digital Ocean Droplet Setup

### 1. Create a Droplet

1. Log into your Digital Ocean account
2. Click "Create" → "Droplets"
3. Choose an image: **Ubuntu 24.04 LTS**
4. Choose a plan: **Basic** (1 GB Memory, 1 vCPU, 25 GB SSD)
5. Choose a datacenter region closest to your users
6. Authentication: Add your SSH keys or create a password
7. Choose a hostname (e.g., `customer-app-server`)
8. Click "Create Droplet"

### 2. Initial Connection

Once your droplet is created, connect via SSH:

```bash
ssh root@YOUR_DROPLET_IP
```

## Server Initial Configuration

### 1. Update System Packages

```bash
apt update && apt upgrade -y
```

### 2. Create Application Directory

```bash
mkdir -p /var/www/customer-app
cd /var/www/customer-app
```

### 3. Install Essential Packages

```bash
apt install -y curl wget git ufw nginx certbot python3-certbot-nginx
```

## Node.js Installation

### 1. Install Node.js 18.x LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 10.x.x
```

### 2. Install PM2 Process Manager

```bash
npm install -g pm2
```

## Application Deployment

### 1. Upload Application Files

You can upload files using rsync (recommended) or scp:

**Using rsync (from your local machine):**
```bash
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='*.log' --exclude='.env' --exclude='.DS_Store' \
  /path/to/your/customer-app/ root@YOUR_DROPLET_IP:/var/www/customer-app/
```

**Or using the provided deployment script:**
```bash
# Update the DROPLET_IP in redeploy.sh with your server IP
# Then run the deployment script
chmod +x redeploy.sh
./redeploy.sh
```

**Or using scp:**
```bash
scp -r /path/to/your/customer-app/* root@YOUR_DROPLET_IP:/var/www/customer-app/
```

### 2. Install Dependencies

```bash
cd /var/www/customer-app
npm install --production
```

### 3. Set Environment Variables

Set the required API key environment variables:

```bash
# Set OpenAI API key (required for AI features)
export OPENAI_API_KEY="your_openai_api_key_here"

# Set Resend API key (required for email functionality)
export RESEND_API_KEY="your_resend_api_key_here"

# Add to the application's environment file
echo "OPENAI_API_KEY=your_openai_api_key_here" >> $APP_DIR/.env
echo "RESEND_API_KEY=your_resend_api_key_here" >> $APP_DIR/.env

# Set proper permissions on the environment file
chmod 600 $APP_DIR/.env
```

**Note:** You'll need to obtain these API keys:
- **OpenAI API Key:** Sign up at [OpenAI](https://platform.openai.com/) and create an API key
- **Resend API Key:** Sign up at [Resend](https://resend.com/) and create an API key for email functionality

## Nginx Installation and Configuration

### 1. Nginx is already installed from the previous step

Verify nginx installation:
```bash
nginx -v
systemctl status nginx
```

### 2. Create Nginx Configuration

Create the site configuration file:

```bash
nano /etc/nginx/sites-available/customer-app
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP www.YOUR_DOMAIN_OR_IP;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Enable the Site

```bash
# Create symbolic link to enable the site
ln -s /etc/nginx/sites-available/customer-app /etc/nginx/sites-enabled/

# Remove default site (optional)
rm /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

## SSL Certificate with Let's Encrypt

### 1. Install Certbot (already installed)

Certbot should already be installed from the previous steps.

### 2. Obtain SSL Certificate

**For a domain name:**
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**For IP address only (not recommended for production):**
```bash
# You can still use nginx without SSL for IP-only access
# SSL certificates require a domain name
```

### 3. Test Certificate Renewal

```bash
# Test automatic renewal
certbot renew --dry-run

# Set up automatic renewal (cron job)
crontab -e
```

Add this line to crontab for automatic renewal:
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Verify SSL Configuration

After obtaining the certificate, your nginx configuration will be automatically updated to look like this:

```nginx
server {
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = yourdomain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 404; # managed by Certbot
}
```

## PM2 Process Manager Setup

### 1. Start the Application with PM2

```bash
cd /var/www/customer-app
pm2 start server.js --name "customer-app"
```

### 2. Configure PM2 for Auto-restart

```bash
# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup

# Follow the instructions provided by the startup command
```

### 3. PM2 Management Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs customer-app

# Restart application
pm2 restart customer-app

# Stop application
pm2 stop customer-app

# Monitor in real-time
pm2 monit
```

## Firewall Configuration

### 1. Configure UFW Firewall

```bash
# Enable UFW
ufw enable

# Allow SSH
ufw allow ssh

# Allow HTTP
ufw allow 80

# Allow HTTPS
ufw allow 443

# Check status
ufw status
```

## Domain Configuration

### 1. DNS Records

If using a custom domain, configure these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_DROPLET_IP | 3600 |
| A | www | YOUR_DROPLET_IP | 3600 |

### 2. Update Nginx Configuration

Replace `YOUR_DOMAIN_OR_IP` in the nginx configuration with your actual domain or IP address.

## Monitoring and Maintenance

### 1. Log Locations

- **Application logs:** `pm2 logs customer-app`
- **Nginx access logs:** `/var/log/nginx/access.log`
- **Nginx error logs:** `/var/log/nginx/error.log`
- **System logs:** `/var/log/syslog`

### 2. Health Check Scripts

Create a health check script:

```bash
nano /usr/local/bin/health-check.sh
```

Add the following content:

```bash
#!/bin/bash
# Health check script for customer app

# Check if PM2 process is running
if ! pm2 list | grep -q "customer-app.*online"; then
    echo "$(date): Customer app is not running, restarting..." >> /var/log/health-check.log
    pm2 restart customer-app
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "$(date): Nginx is not running, starting..." >> /var/log/health-check.log
    systemctl start nginx
fi
```

Make it executable and add to cron:

```bash
chmod +x /usr/local/bin/health-check.sh

# Add to crontab (run every 5 minutes)
crontab -e
```

Add this line:
```bash
*/5 * * * * /usr/local/bin/health-check.sh
```

## Backup and Recovery

### 1. Nginx Configuration Backup

```bash
# Create backup
tar -czf /backup/nginx-config-$(date +%Y%m%d).tar.gz -C /etc nginx

# Restore backup
tar -xzf /backup/nginx-config-YYYYMMDD.tar.gz -C /etc/
systemctl reload nginx
```

### 2. Application Backup

```bash
# Create application backup
tar -czf /backup/customer-app-$(date +%Y%m%d).tar.gz -C /var/www customer-app

# Restore application
tar -xzf /backup/customer-app-YYYYMMDD.tar.gz -C /var/www/
cd /var/www/customer-app
npm install --production
pm2 restart customer-app
```

### 3. SSL Certificates Backup

```bash
# Backup Let's Encrypt certificates
tar -czf /backup/letsencrypt-$(date +%Y%m%d).tar.gz -C /etc letsencrypt

# Restore certificates
tar -xzf /backup/letsencrypt-YYYYMMDD.tar.gz -C /etc/
systemctl reload nginx
```

## Deployment Script Usage

This repository includes automated deployment scripts that accept command-line parameters for easy customization:

### Configure and Run Deployment Scripts

The scripts now accept parameters, so you don't need to edit the files:

**Quick Redeploy Script:**
```bash
# Basic usage with just IP address
./redeploy.sh --ip YOUR_SERVER_IP

# Full customization
./redeploy.sh --ip 192.168.1.100 --user deploy --directory /home/deploy/app --name myapp

# Show help for all options
./redeploy.sh --help
```

**Full Deployment Script:**
```bash
# Basic usage with just IP address
./deploy.sh --ip YOUR_SERVER_IP

# Full customization
./deploy.sh --ip 192.168.1.100 --user deploy --directory /home/deploy/app --name myapp --port 3001

# Show help for all options
./deploy.sh --help
```

### Script Parameters

Both scripts support these parameters:

| Parameter | Short | Default | Description |
|-----------|-------|---------|-------------|
| `--ip` | `-i` | *required* | IP address of target server |
| `--user` | `-u` | `root` | SSH username |
| `--directory` | `-d` | `/var/www/customer-app` | Remote app directory |
| `--name` | `-n` | `customer-app` | Application/service name |
| `--port` | `-p` | `3000` | Application port (deploy.sh only) |
| `--help` | `-h` | - | Show usage information |

### Usage Examples

```bash
# Deploy to a Digital Ocean droplet
./deploy.sh --ip 164.92.84.174

# Deploy with custom user and directory
./deploy.sh --ip 192.168.1.100 --user ubuntu --directory /opt/myapp

# Quick redeploy after code changes
./redeploy.sh --ip 164.92.84.174

# Deploy to a different port
./deploy.sh --ip 192.168.1.100 --port 8080 --name my-customer-app
```

### Script Features

The deployment scripts include several helpful features:

- **Parameter validation:** Scripts check for required parameters and show helpful error messages
- **Usage help:** Run with `--help` to see all available options
- **Flexible configuration:** Customize user, directory, port, and app name without editing files
- **Error handling:** Scripts exit on errors and provide clear status messages
- **Color-coded output:** Easy to follow deployment progress with colored status messages

### Making Scripts Executable

Before using the scripts for the first time, make them executable:

```bash
chmod +x deploy.sh redeploy.sh
```

## Troubleshooting

### Common Issues

1. **Port 3000 already in use:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   pm2 restart customer-app
   ```

2. **Nginx configuration test fails:**
   ```bash
   nginx -t
   # Fix any syntax errors shown
   ```

3. **SSL certificate renewal fails:**
   ```bash
   certbot renew --dry-run
   # Check domain DNS configuration
   ```

4. **Application won't start:**
   ```bash
   cd /var/www/customer-app
   npm install
   pm2 logs customer-app
   ```

5. **Cannot connect to application:**
   - Check if PM2 process is running: `pm2 status`
   - Check nginx status: `systemctl status nginx`
   - Check firewall: `ufw status`
   - Verify port 3000 is accessible locally: `curl http://localhost:3000`

6. **API keys not working:**
   - Check environment variables are set: `echo $OPENAI_API_KEY` and `echo $RESEND_API_KEY`
   - Verify .env file contains the keys: `cat /var/www/customer-app/.env`
   - Make sure the application is reading environment variables correctly
   - Verify keys are valid by testing them separately

7. **Deployment script fails:**
   - Check SSH connection: `ssh root@YOUR_DROPLET_IP`
   - Verify rsync is installed locally: `which rsync`
   - Make sure you're providing the correct IP: `./deploy.sh --ip YOUR_ACTUAL_IP`
   - Use `--help` to see all available options: `./deploy.sh --help`

### Performance Optimization

1. **Enable Gzip compression in Nginx:**
   ```nginx
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
   ```

2. **PM2 cluster mode for better performance:**
   ```bash
   pm2 start server.js --name "customer-app" -i max
   ```

## Security Considerations

1. **Regular updates:**
   ```bash
   apt update && apt upgrade -y
   npm audit fix
   ```

2. **Fail2ban for SSH protection:**
   ```bash
   apt install fail2ban
   systemctl enable fail2ban
   ```

3. **Regular backups:** Set up automated daily backups of application, nginx config, and SSL certificates.

## Customization for Your Environment

### Application Configuration

The application can be customized for your specific needs:

1. **Port Configuration:**
   - Default port is 3000, change in `server.js` if needed
   - Update nginx configuration if you change the port

2. **Application Name:**
   - Update `package.json` name field
   - Update PM2 process name in deployment scripts
   - Update nginx site configuration filename

3. **Domain and Branding:**
   - Replace any domain-specific references in HTML files
   - Update logos and branding in `public/images/`
   - Modify navigation and page titles as needed

4. **Database Configuration:**
   - The app uses Excel files by default (`nudge_customers.xlsx`)
   - Modify file paths in the application code if needed
   - Consider migrating to a proper database for production use

### Security Hardening

For production deployments, consider these additional security measures:

1. **Create a non-root user:**
   ```bash
   adduser deploy
   usermod -aG sudo deploy
   # Use this user instead of root for deployment
   ```

2. **SSH Key-only authentication:**
   ```bash
   # Disable password authentication
   sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart sshd
   ```

3. **Fail2ban for SSH protection:**
   ```bash
   apt install fail2ban
   systemctl enable fail2ban
   ```

4. **Regular updates:**
   ```bash
   # Set up automatic security updates
   apt install unattended-upgrades
   dpkg-reconfigure unattended-upgrades
   ```

## Environment Variables

The application uses environment variables for configuration instead of plain text files for security. 

### Migration from File-based API Keys

If you're upgrading from a previous version that used `OPENAI_KEY` and `RESEND_KEY` files:

1. **Backup your existing keys:**
   ```bash
   # Save your current keys
   OPENAI_KEY_VALUE=$(cat OPENAI_KEY)
   RESEND_KEY_VALUE=$(cat RESEND_KEY)
   ```

2. **Create .env file:**
   ```bash
   echo "OPENAI_API_KEY=$OPENAI_KEY_VALUE" > .env
   echo "RESEND_API_KEY=$RESEND_KEY_VALUE" >> .env
   chmod 600 .env
   ```

3. **Remove old key files (optional):**
   ```bash
   rm OPENAI_KEY RESEND_KEY
   ```

4. **Restart the application:**
   ```bash
   pm2 restart customer-app
   ```

### Environment Variable Configuration

These can be set in multiple ways:

### 1. Using .env file (Recommended for production)
Create a `.env` file in the application directory:
```bash
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your_actual_openai_key_here
RESEND_API_KEY=your_actual_resend_key_here
```

### 2. Using system environment variables
```bash
export OPENAI_API_KEY="your_actual_openai_key_here"
export RESEND_API_KEY="your_actual_resend_key_here"
```

### 3. Using PM2 ecosystem file
The deployment scripts automatically create an ecosystem.config.js file that loads the .env file.

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | API key for OpenAI services | Yes |
| `RESEND_API_KEY` | API key for Resend email service | Yes |
| `NODE_ENV` | Application environment (production/development) | No |
| `PORT` | Port number for the application | No |

## Current Production Configuration

This deployment guide has been tested with the following configuration:
- **Server:** Digital Ocean Ubuntu 24.04 LTS Droplet
- **Instance Size:** 1GB RAM, 1 vCPU, 25GB SSD
- **Node.js:** v18.20.8
- **Nginx:** v1.26.0 with reverse proxy to port 3000
- **Process Manager:** PM2 for application management
- **SSL:** Let's Encrypt certificates with automatic renewal

**Example production setup:**
- Server IP: `164.92.84.174` (replace with your IP)
- Domain: `yourdomain.com` (replace with your domain)
- SSL Certificate: Auto-renewed via Let's Encrypt

---

**Note:** This deployment guide provides a complete production-ready setup. Make sure to:
1. Replace all placeholder values (YOUR_DROPLET_IP, yourdomain.com, etc.) with your actual values
2. Obtain your own API keys for OpenAI and Resend services
3. Test the deployment in a staging environment before going to production
4. Keep your API keys secure and never commit them to version control
