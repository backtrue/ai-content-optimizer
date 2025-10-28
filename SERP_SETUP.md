# SERP Multi-Service Setup Guide

## Overview

The system now supports automatic failover between multiple SERP providers:
- **SerpAPI** (https://serpapi.com)
- **ValueSERP** (https://www.valueserp.com)
- **ZenSERP** (https://zenserp.com)

When one service hits quota limits or returns errors, the system automatically switches to the next available service.

## Setup Instructions

### 1. Copy Environment Template

```bash
cp .env.serp.example .env.serp
```

### 2. Add Your API Keys

Edit `.env.serp` and add your API keys:

```env
# SerpAPI (https://serpapi.com)
SERPAPI_KEY=your_serpapi_key_here
SERPAPI_ENABLED=true

# ValueSERP (https://www.valueserp.com)
VALUESERP_KEY=your_valueserp_key_here
VALUESERP_ENABLED=true

# ZenSERP (https://zenserp.com)
ZENSERP_KEY=your_zenserp_key_here
ZENSERP_ENABLED=true
```

### 3. Load Environment Variables

```bash
# Load from .env.serp
export $(cat .env.serp | xargs)

# Or manually set them
export SERPAPI_KEY="your_key"
export VALUESERP_KEY="your_key"
export ZENSERP_KEY="your_key"
```

### 4. Run Collection with Multiple Services

```bash
python3 ml/serp_collection.py
```

## Configuration Options

### Service Priority

Set the order in which services are tried:

```env
SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp
```

### Rotation Strategy

Choose how services are selected:

- **fallback** (default): Try services in priority order, move to next on failure
- **priority**: Always prefer higher priority services
- **round-robin**: Distribute requests evenly across services
- **random**: Randomly select from available services

```env
SERP_ROTATION_STRATEGY=fallback
```

### Retry Configuration

```env
# Maximum retry attempts per keyword
SERP_MAX_RETRIES=3

# Delay between retries (milliseconds)
SERP_RETRY_DELAY_MS=1000
```

### Rate Limiting

```env
# Requests per minute limit
SERP_RATE_LIMIT_RPM=60
```

### Debugging

```env
# Enable debug logging
SERP_DEBUG=true

# Log all failures
SERP_LOG_FAILURES=true
```

## Example Configurations

### Conservative (Single Service)

```env
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true

VALUESERP_KEY=
VALUESERP_ENABLED=false

ZENSERP_KEY=
ZENSERP_ENABLED=false

SERP_ROTATION_STRATEGY=fallback
```

### Balanced (Two Services)

```env
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true

VALUESERP_KEY=your_key
VALUESERP_ENABLED=true

ZENSERP_KEY=
ZENSERP_ENABLED=false

SERP_SERVICE_PRIORITY=serpapi,valueserp
SERP_ROTATION_STRATEGY=fallback
```

### Maximum Redundancy (Three Services)

```env
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true

VALUESERP_KEY=your_key
VALUESERP_ENABLED=true

ZENSERP_KEY=your_key
ZENSERP_ENABLED=true

SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp
SERP_ROTATION_STRATEGY=fallback
SERP_MAX_RETRIES=3
```

## How It Works

### Automatic Failover

1. **Attempt 1**: Try SerpAPI
   - If successful → return results
   - If quota exceeded → mark as unavailable, try next service
   - If other error → wait and retry

2. **Attempt 2**: Try ValueSERP
   - Same logic as above

3. **Attempt 3**: Try ZenSERP
   - Same logic as above

### Error Handling

The system detects:
- **Quota Exceeded**: HTTP 429, 403, or "quota" in error message
  - Action: Skip to next service immediately
- **Rate Limited**: HTTP 429
  - Action: Wait and retry with next service
- **Invalid API Key**: HTTP 403
  - Action: Mark service as unavailable
- **Network Error**: Connection timeout or DNS failure
  - Action: Retry with delay
- **API Error**: Error in JSON response
  - Action: Try next service

### Status Tracking

Each service tracks:
- Success count
- Error count
- Last error message
- Current status (active, quota_exceeded, error, disabled)

View status at any time:

```bash
python3 -c "from ml.serp_manager import get_manager; get_manager().print_status()"
```

## Monitoring Collection

### Real-time Progress

```bash
python3 ml/monitor_collection.py
```

### Check Service Status

```bash
python3 -c "
from ml.serp_manager import get_manager
import json
manager = get_manager()
print(json.dumps(manager.get_status(), indent=2))
"
```

### View Collection Log

```bash
tail -f ml/training_data.json
```

## Troubleshooting

### All Services Failing?

1. **Check API Keys**
   ```bash
   echo $SERPAPI_KEY
   echo $VALUESERP_KEY
   echo $ZENSERP_KEY
   ```

2. **Check Service Status**
   ```bash
   python3 ml/serp_manager.py
   ```

3. **Enable Debug Mode**
   ```bash
   export SERP_DEBUG=true
   python3 ml/serp_collection.py
   ```

### Specific Service Not Working?

1. Test the service directly:
   ```bash
   python3 -c "
   from ml.serp_manager import SerpAPIService
   service = SerpAPIService('SerpAPI', 'your_key')
   results, error = service.fetch('test keyword')
   print(f'Results: {len(results) if results else 0}')
   print(f'Error: {error}')
   "
   ```

2. Check API key validity on provider's website

3. Verify quota hasn't been exceeded

### Quota Exceeded?

1. **Add New API Key**
   - Get new key from service provider
   - Add to `.env.serp`
   - Reload environment: `export $(cat .env.serp | xargs)`

2. **Switch to Different Service**
   - Disable exhausted service: `SERVICEAPI_ENABLED=false`
   - Enable backup service: `BACKUPAPI_ENABLED=true`

3. **Wait for Quota Reset**
   - Check provider's documentation for reset time
   - System will automatically retry after delay

## API Provider Comparison

| Feature | SerpAPI | ValueSERP | ZenSERP |
|---------|---------|-----------|---------|
| Free Tier | 100/month | Limited | Limited |
| Paid Tier | $9-99/month | $19-99/month | $9-49/month |
| Taiwan Support | ✓ | ✓ | ✓ |
| Chinese Support | ✓ | ✓ | ✓ |
| Response Time | Fast | Medium | Medium |
| Reliability | High | High | Medium |

## Best Practices

1. **Start with One Service**
   - Get comfortable with setup
   - Monitor quota usage
   - Add more services as needed

2. **Monitor Quota Usage**
   - Check provider dashboards regularly
   - Set alerts for quota thresholds
   - Plan for quota resets

3. **Rotate Services Strategically**
   - Use priority order based on quota
   - Prefer cheaper services when possible
   - Reserve premium services for critical tasks

4. **Keep Backups**
   - Always have 2+ services enabled
   - Test failover regularly
   - Document all API keys securely

5. **Log Everything**
   - Enable `SERP_LOG_FAILURES=true`
   - Monitor error patterns
   - Adjust configuration based on data

## Example: Adding a New API Key Mid-Collection

If collection is running and you run out of quota:

1. **Get new API key** from service provider

2. **Update .env.serp**
   ```bash
   nano .env.serp
   # Add new key and enable service
   ```

3. **Reload environment**
   ```bash
   export $(cat .env.serp | xargs)
   ```

4. **Restart collection**
   ```bash
   # Kill current process
   pkill -f "python3 ml/serp_collection.py"
   
   # Restart with new configuration
   python3 ml/serp_collection.py
   ```

The system will automatically use the newly configured service!

## Support

For issues:
1. Check service provider status pages
2. Review error messages in collection output
3. Enable debug mode for detailed logs
4. Check GitHub issues for similar problems
