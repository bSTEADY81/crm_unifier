# Nginx & SSL Configuration Guide

## 🌐 Nginx Reverse Proxy Setup

### 1. Configure Nginx Site

```bash
# Create Nginx configuration file
sudo nano /etc/nginx/sites-available/crm

# Paste the following configuration (replace yourdomain.com):
```

```nginx
# HTTP configuration (redirects to HTTPS)
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS configuration (main configuration)
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (ngx_http_headers_module is required) (63072000 seconds)
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # File upload limit
    client_max_body_size 10M;

    # Proxy settings
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;

    # Main proxy configuration
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_read_timeout 3600;  # For SSE/long polling
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check endpoint (no logging)
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        access_log off;
    }

    # API documentation (if available)
    location /docs {
        proxy_pass http://127.0.0.1:3001/docs;
    }
}
```

### 2. Enable Nginx Site

```bash
# Test configuration syntax
sudo nginx -t

# Enable the site
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration again
sudo nginx -t

# Reload Nginx configuration  
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx
```

### 3. Initial SSL Certificate Setup

**Important**: Make sure DNS has propagated first!

```bash
# Test DNS resolution
dig api.yourdomain.com

# If DNS is working, get SSL certificate
sudo certbot certonly --nginx -d api.yourdomain.com

# If DNS not ready, use webroot method:
# sudo mkdir -p /var/www/html
# sudo certbot certonly --webroot -w /var/www/html -d api.yourdomain.com
```

### 4. Configure SSL Auto-Renewal

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl list-timers | grep certbot

# If timer not active, enable it
sudo systemctl enable --now certbot.timer

# Verify auto-renewal is configured
sudo crontab -l
```

### 5. Final Nginx Reload

```bash
# After SSL certificates are installed
sudo nginx -t
sudo systemctl reload nginx

# Check that HTTPS is working
curl -I https://api.yourdomain.com/health
```

## 🔒 SSL Certificate Management

### Certificate Locations

```
Certificate: /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
Private Key: /etc/letsencrypt/live/api.yourdomain.com/privkey.pem
Certificate Chain: /etc/letsencrypt/live/api.yourdomain.com/chain.pem
```

### Manual Renewal

```bash
# Renew all certificates
sudo certbot renew

# Renew specific certificate
sudo certbot renew --cert-name api.yourdomain.com

# Force renewal (for testing)
sudo certbot renew --force-renewal

# After renewal, reload Nginx
sudo systemctl reload nginx
```

### Certificate Information

```bash
# Check certificate expiry
sudo certbot certificates

# Check certificate details
openssl x509 -in /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem -text -noout

# Test SSL configuration
curl -I https://api.yourdomain.com/health
```

## 🔧 Nginx Performance Optimization

### Additional Configuration (Optional)

Add to `/etc/nginx/nginx.conf` in the `http` block:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# File caching for static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Rate limiting (optional)
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

### Apply Performance Settings

```bash
# Edit main Nginx configuration
sudo nano /etc/nginx/nginx.conf

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 📊 Testing & Verification

### SSL/HTTPS Testing

```bash
# Test HTTPS connection
curl -I https://api.yourdomain.com/health

# Test HTTP redirect
curl -I http://api.yourdomain.com/health

# Test SSL grade (external)
# Visit: https://www.ssllabs.com/ssltest/
# Enter: api.yourdomain.com
```

### Nginx Testing

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log

# Test proxy functionality
curl -H "Host: api.yourdomain.com" http://localhost/health
```

## 🚨 Troubleshooting

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Check DNS propagation
dig api.yourdomain.com

# Manual certificate request (if auto fails)
sudo certbot certonly --manual -d api.yourdomain.com

# Check Nginx SSL configuration
sudo nginx -T | grep ssl
```

### Nginx Issues

```bash
# Check Nginx configuration
sudo nginx -t

# Check for port conflicts
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx logs
sudo journalctl -u nginx -f
```

### Proxy Issues

```bash
# Test backend directly
curl http://localhost:3001/health

# Check PM2 processes
pm2 list

# Test with host header
curl -H "Host: api.yourdomain.com" http://localhost:80/health
```

## ✅ Verification Checklist

Before proceeding to final testing:

- [ ] Nginx configuration file created and enabled
- [ ] DNS resolves to server IP: `dig api.yourdomain.com`
- [ ] SSL certificate obtained and installed
- [ ] HTTPS works: `curl -I https://api.yourdomain.com/health`
- [ ] HTTP redirects to HTTPS
- [ ] SSL auto-renewal configured
- [ ] Nginx logs show no errors
- [ ] Backend proxy working correctly

## 📝 Next Steps

After Nginx & SSL setup:

1. ✅ Reverse proxy configured
2. ✅ SSL certificates installed and auto-renewing
3. 🔄 Perform comprehensive testing
4. 🔄 Set up monitoring and alerts
5. 🔄 Configure log rotation and backup

Your CRM system is now accessible via HTTPS!