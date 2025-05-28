# Azure App Service Deployment Guide

## Issues Fixed

### 1. Server Auto-Start Issue ✅
**Problem**: Azure wasn't auto-starting the Node.js server despite `WEBSITE_STARTUP_FILE` being set.

**Root Cause**: The compiled `server.js` was missing the `HOST` parameter required for Azure App Service.

**Solution**: Updated `apps/api/src/server.ts` to include:
```javascript
const HOST = process.env.HOST || '0.0.0.0';
app.listen(parseInt(PORT), HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
});
```

### 2. Permission Error Issue ✅
**Problem**: "You do not have permission to view this directory or page" error.

**Root Cause**: Missing `web.config` file for IIS/Azure App Service to route requests to Node.js.

**Solution**: Created `web.config` with proper IIS node configuration.

### 3. Root Route Handling ✅
**Problem**: Server not handling root path requests properly.

**Solution**: Added proper root route handler:
```javascript
app.get('/', (req, res) => {
  res.json({ 
    message: 'UnityVoice API Server is running',
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
```

## Azure App Service Configuration

### Required Environment Variables
```
WEBSITE_STARTUP_FILE = node apps/api/dist/server.js
PORT = 8080
NODE_ENV = production
HOST = 0.0.0.0
```

### Required Files
- ✅ `web.config` - IIS configuration for Node.js routing
- ✅ `.deployment` - Custom deployment script configuration
- ✅ `deploy.js` - Build and deployment script
- ✅ `apps/api/dist/server.js` - Compiled server with HOST parameter

## Deployment Steps

### 1. Build the Application
```bash
# Install dependencies
npm install

# Build API
cd apps/api && npm run build

# Build Web (if needed)
cd ../web && npm run build
```

### 2. Deploy to Azure
```bash
# Using Azure CLI
az webapp deployment source config-zip --resource-group <resource-group> --name <app-name> --src <zip-file>

# Or use the deployment script
npm run deploy
```

### 3. Verify Deployment
1. Check Azure App Service logs in Kudu console
2. Visit `https://<your-app>.azurewebsites.net/` - should show JSON response
3. Visit `https://<your-app>.azurewebsites.net/health` - should show health status

## Troubleshooting

### Server Not Starting
1. Check Azure App Service logs in Kudu console (`https://<app-name>.scm.azurewebsites.net/`)
2. Verify `WEBSITE_STARTUP_FILE` points to correct path
3. Ensure `apps/api/dist/server.js` exists and is compiled correctly
4. Check that `HOST` environment variable is set to `0.0.0.0`

### Permission Errors
1. Verify `web.config` exists in root directory
2. Check IIS logs in Azure App Service
3. Ensure file permissions are correct

### Database Connection Issues
1. Check database connection strings in environment variables
2. Verify firewall rules allow Azure App Service IP ranges
3. Test connection using `/health` endpoint

### Port Issues
1. Ensure `PORT` environment variable is set to `8080` (or Azure's assigned port)
2. Verify server listens on `process.env.PORT`
3. Check that `HOST` is set to `0.0.0.0` not `localhost`

## File Structure After Deployment
```
/
├── web.config                 # IIS configuration
├── .deployment               # Azure deployment config
├── deploy.js                 # Deployment script
├── package.json              # Root package.json
├── apps/
│   ├── api/
│   │   ├── dist/
│   │   │   └── server.js     # Compiled server (entry point)
│   │   └── src/
│   │       └── server.ts     # Source server file
│   └── web/
│       └── .next/            # Next.js build output
└── node_modules/             # Dependencies
```

## Testing Locally
```bash
# Test the compiled server
node apps/api/dist/server.js

# Should output:
# Server is running on 0.0.0.0:3001
# Environment: development
# Process ID: <pid>
```

## Azure App Service Logs
Monitor logs in real-time:
```bash
az webapp log tail --name <app-name> --resource-group <resource-group>
```

## Next Steps
1. Deploy the updated code to Azure App Service
2. Verify the server starts automatically
3. Test the root URL and API endpoints
4. Monitor logs for any remaining issues 