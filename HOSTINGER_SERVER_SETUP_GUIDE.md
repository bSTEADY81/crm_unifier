# Hostinger VPS Server Setup Guide

## 🖥️ Initial Server Configuration

### 1. System Updates & Dependencies

SSH into your Hostinger VPS and run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential dependencies
sudo apt install -y nginx ufw git curl software-properties-common

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PM2 process manager globally
sudo npm install -g pm2

# Verify PM2 installation  
pm2 --version
```

### 2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall (will ask for confirmation)
sudo ufw --force enable

# Check firewall status
sudo ufw status verbose
```

### 3. Create Application Directories

```bash
# Create directories with proper permissions
sudo mkdir -p /srv/crm /var/log/crm
sudo chown $USER:$USER /srv/crm /var/log/crm
sudo chmod 755 /srv/crm /var/log/crm

# Verify directory creation
ls -la /srv/
ls -la /var/log/crm/
```

### 4. Install Certbot for SSL

```bash
# Install snapd if not already installed
sudo apt install snapd

# Install core snap and refresh
sudo snap install core
sudo snap refresh core

# Install Certbot
sudo snap install --classic certbot

# Create symlink to make certbot available in PATH
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Verify installation
certbot --version
```

### 5. Configure Git for Deployment

```bash
# Configure git (optional, for easier deployments)
git config --global user.name "Production Server"
git config --global user.email "server@yourdomain.com"

# Generate SSH key for GitHub (optional, for private repos)
ssh-keygen -t ed25519 -C "server@yourdomain.com" -f ~/.ssh/github_rsa
# Add the public key to your GitHub account if needed
cat ~/.ssh/github_rsa.pub
```

## 🚀 Application Deployment Setup

### 6. Clone Repository

```bash
# Navigate to application directory
cd /srv/crm

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/yourusername/crm-unifier.git .

# Verify repository was cloned
ls -la
```

### 7. Backend Setup

```bash
# Navigate to backend directory
cd /srv/crm/backend

# Install ALL dependencies (including dev dependencies for build)
npm ci

# Generate Prisma client
npx prisma generate

# Copy and configure environment file
cp ../.env.production .env

# IMPORTANT: Edit .env with your actual values
nano .env
# Update the following:
# - DATABASE_URL (from Supabase)
# - REDIS_URL (from Redis Cloud)  
# - Replace yourdomain.com with actual domain
# Save and exit (Ctrl+X, Y, Enter)

# Secure the environment file
chmod 600 .env
chown $USER:$USER .env

# Verify environment file
ls -la .env
```

### 8. Test Backend Locally

```bash
# Test the application startup (optional but recommended)
npm run dev &
BACKEND_PID=$!

# Wait a few seconds for startup
sleep 5

# Test health endpoint
curl http://localhost:3001/health

# Stop test instance
kill $BACKEND_PID
```

## 📊 System Information Commands

Use these commands to verify your setup:

```bash
# Check system resources
free -h              # Memory usage
df -h                # Disk space
top                  # Running processes
systemctl status nginx  # Nginx status

# Check open ports
sudo netstat -tlnp

# Check installed versions
node --version
npm --version
nginx -v
pm2 --version
```

## 🔒 Security Hardening (Optional but Recommended)

```bash
# Install fail2ban for SSH protection
sudo apt install fail2ban

# Configure SSH (edit /etc/ssh/sshd_config)
# - Disable password authentication if using keys
# - Change default SSH port if desired
# - Restart SSH: sudo systemctl restart ssh

# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## ✅ Verification Checklist

Before proceeding to application deployment:

- [ ] Node.js 20.x installed and working
- [ ] PM2 installed globally
- [ ] Nginx installed and running
- [ ] Firewall configured (ports 80, 443, SSH open)
- [ ] Certbot installed for SSL
- [ ] Application directory created (/srv/crm)
- [ ] Log directory created (/var/log/crm)
- [ ] Repository cloned successfully
- [ ] Environment file copied and configured
- [ ] Database connection string updated
- [ ] Redis connection string updated
- [ ] Domain names updated in configuration

## 🚨 Common Issues & Solutions

### Node.js Installation Issues
```bash
# If node command not found:
sudo apt remove nodejs npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Permission Issues
```bash
# Fix ownership of application directory
sudo chown -R $USER:$USER /srv/crm
sudo chmod -R 755 /srv/crm

# Fix log directory permissions
sudo chown -R $USER:$USER /var/log/crm
```

### Firewall Issues
```bash
# Reset firewall if needed
sudo ufw --force reset
# Then reconfigure as shown above
```

## 📝 Next Steps

After completing server setup:

1. ✅ Server configured with all dependencies
2. 🔄 Deploy application code and start PM2 services
3. 🔄 Configure Nginx reverse proxy
4. 🔄 Set up SSL certificates
5. 🔄 Test complete deployment

The server is now ready for application deployment!