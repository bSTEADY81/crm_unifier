# DNS Configuration Guide

## 🌐 DNS Records Setup

### Required DNS Records

Configure these DNS records with your domain registrar or DNS provider:

#### API Subdomain (Backend)
```
Type: A
Name: api
Value: [Your Hostinger VPS IP Address]
TTL: 300 seconds (5 minutes)
```

#### App Subdomain (Frontend)
```
Type: CNAME
Name: app  
Value: cname.vercel-dns.com
TTL: 300 seconds (5 minutes)
```

**Note**: Vercel will provide the exact CNAME target in your dashboard under Settings → Domains

### Example Configuration

If your domain is `example.com`:
- `api.example.com` → Points to your Hostinger server IP
- `app.example.com` → Points to Vercel via CNAME

### DNS Providers

#### Hostinger DNS Manager
1. Login to Hostinger control panel
2. Go to "Domain" → "DNS Records"
3. Add the A and CNAME records above

#### Cloudflare (if using)
1. Login to Cloudflare dashboard
2. Select your domain
3. Go to "DNS" → "Records"
4. Add records with "Proxy status" OFF initially

#### Other Providers (GoDaddy, Namecheap, etc.)
1. Login to your registrar
2. Find "DNS Management" or "DNS Records"
3. Add the A and CNAME records

### Verification Commands

After setting DNS records, verify with these commands:

```bash
# Check API subdomain (A record)
dig api.yourdomain.com

# Check App subdomain (CNAME record)  
dig app.yourdomain.com

# Check propagation globally
curl -s "https://dns.google/resolve?name=api.yourdomain.com&type=A" | jq
```

### SSL Certificate Notes

- **Frontend (Vercel)**: SSL is automatic
- **Backend (Hostinger)**: We'll use Let's Encrypt after DNS propagates

### Propagation Timeline

- **Local DNS**: 5-15 minutes
- **Global propagation**: 2-24 hours (usually < 2 hours)
- **SSL availability**: After DNS propagates

### Testing Checklist

Before proceeding to backend deployment:

- [ ] `dig api.yourdomain.com` returns your server IP
- [ ] `dig app.yourdomain.com` returns Vercel CNAME
- [ ] Both domains resolve globally (check from different locations)

### Troubleshooting

#### DNS Not Propagating
1. Check TTL values (lower = faster propagation)
2. Flush local DNS: `sudo dscacheutil -flushcache` (Mac)
3. Test from different networks/devices
4. Use online DNS propagation checkers

#### Wrong IP Address
1. Verify Hostinger VPS IP address
2. Check for typos in DNS records
3. Ensure no conflicting DNS records exist

#### Vercel Domain Issues
1. Get exact CNAME target from Vercel dashboard
2. Don't use IP addresses for Vercel (use CNAME only)
3. Remove any existing A records for app subdomain

### Next Steps After DNS Setup

1. ✅ DNS records configured
2. ✅ Wait for propagation (can proceed with server setup in parallel)
3. 🔄 Deploy backend to Hostinger
4. 🔄 Configure SSL certificates
5. 🔄 Test full deployment