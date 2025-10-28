# SERP Multi-Service Quick Start

## 5-Minute Setup

### Step 1: Copy Configuration
```bash
cp .env.serp.example .env.serp
```

### Step 2: Add Your API Keys
```bash
# Edit .env.serp with your keys
nano .env.serp
```

Add your API keys:
```env
SERPAPI_KEY=d5d040588a63fe91e0643b2a7ee1e4a8778ea777d0a9f7e065f77cd05b2a05db
VALUESERP_KEY=your_valueserp_key
ZENSERP_KEY=your_zenserp_key
```

### Step 3: Load Environment
```bash
export $(cat .env.serp | xargs)
```

### Step 4: Test Configuration
```bash
python3 ml/test_serp_manager.py
```

Expected output:
```
✓ SerpAPI
✓ ValueSERP
✓ ZenSERP
```

### Step 5: Start Collection
```bash
python3 ml/serp_collection.py
```

## Monitoring

### Check Progress
```bash
python3 ml/monitor_collection.py
```

### View Service Status
```bash
python3 ml/test_serp_manager.py
```

## Common Scenarios

### Scenario 1: SerpAPI Quota Exceeded

**What happens:**
- System detects HTTP 429 or 403
- Automatically switches to ValueSERP
- Collection continues without interruption

**What you see:**
```
✗ SerpAPI: Quota exceeded or invalid API key (403)
✓ Got 10 results from ValueSERP
```

### Scenario 2: Add New API Key Mid-Collection

**Steps:**
1. Get new API key from provider
2. Update `.env.serp`
3. Reload: `export $(cat .env.serp | xargs)`
4. Restart collection: `python3 ml/serp_collection.py`

System will automatically use the new key!

### Scenario 3: Disable Problematic Service

**Edit `.env.serp`:**
```env
SERPAPI_ENABLED=false  # Disable SerpAPI
VALUESERP_ENABLED=true  # Use ValueSERP instead
```

**Reload and restart:**
```bash
export $(cat .env.serp | xargs)
python3 ml/serp_collection.py
```

## Configuration Presets

### Minimal (One Service)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true
VALUESERP_ENABLED=false
ZENSERP_ENABLED=false
SERP_ROTATION_STRATEGY=fallback
EOF
```

### Balanced (Two Services)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true
VALUESERP_KEY=your_key
VALUESERP_ENABLED=true
ZENSERP_ENABLED=false
SERP_SERVICE_PRIORITY=serpapi,valueserp
SERP_ROTATION_STRATEGY=fallback
EOF
```

### Maximum (Three Services)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEY=your_key
SERPAPI_ENABLED=true
VALUESERP_KEY=your_key
VALUESERP_ENABLED=true
ZENSERP_KEY=your_key
ZENSERP_ENABLED=true
SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp
SERP_ROTATION_STRATEGY=fallback
SERP_MAX_RETRIES=3
EOF
```

## Troubleshooting

### No services configured?
```bash
# Check if keys are set
echo "SerpAPI: $SERPAPI_KEY"
echo "ValueSERP: $VALUESERP_KEY"
echo "ZenSERP: $ZENSERP_KEY"

# If empty, reload environment
export $(cat .env.serp | xargs)
```

### Test fetch failed?
```bash
# Enable debug mode
export SERP_DEBUG=true
python3 ml/test_serp_manager.py
```

### Collection stuck?
```bash
# Check if process is running
ps aux | grep "python3 ml/serp_collection.py"

# Kill and restart
pkill -f "python3 ml/serp_collection.py"
python3 ml/serp_collection.py
```

## Next Steps

1. **Monitor Collection**
   - Run `python3 ml/monitor_collection.py` periodically
   - Check for errors in output

2. **When Collection Completes**
   - Retrain model: `python3 ml/train_baseline.py`
   - Deploy: `git add ml/ && git commit && git push`

3. **Optimize Configuration**
   - Review service usage patterns
   - Adjust priority based on quota
   - Add more services if needed

## Files Reference

| File | Purpose |
|------|---------|
| `.env.serp` | Your configuration (don't commit) |
| `.env.serp.example` | Template (commit this) |
| `ml/serp_manager.py` | Multi-service manager |
| `ml/serp_collection.py` | Data collection script |
| `ml/test_serp_manager.py` | Configuration tester |
| `SERP_SETUP.md` | Detailed guide |

## Support

For detailed information, see `SERP_SETUP.md`

For issues:
1. Run `python3 ml/test_serp_manager.py`
2. Check error messages
3. Review `SERP_SETUP.md` troubleshooting section
4. Enable debug: `export SERP_DEBUG=true`
