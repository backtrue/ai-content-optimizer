# Next Steps - ML Scoring System

## Current Status
- ✅ Baseline model trained (v1.0.0-xgboost-baseline)
- ✅ Data collection pipeline operational
- ⏳ **ACTIVE**: Collecting 100 keywords × ~8-10 URLs = ~800-1000 records
- 📊 Expected completion: 2-3 hours from 2025-10-28 09:19:38

## Timeline

### Phase 1: Data Collection (Current)
**Status**: ⏳ In Progress  
**Duration**: ~2-3 hours  
**Command**: 
```bash
SERPAPI_KEY="d5d040588a63fe91e0643b2a7ee1e4a8778ea777d0a9f7e065f77cd05b2a05db" python3 ml/serp_collection.py
```

**Monitor Progress**:
```bash
python3 ml/monitor_collection.py
```

### Phase 2: Model Retraining (After Collection)
**Status**: Pending  
**Duration**: ~5-10 minutes  
**Steps**:
1. Verify data collection completed
   ```bash
   python3 ml/monitor_collection.py
   ```

2. Train new model with expanded dataset
   ```bash
   export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
   export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
   python3 ml/train_baseline.py
   ```

3. Review model metrics
   ```bash
   cat ml/trained_model_config.json | jq '.metrics'
   ```

### Phase 3: Deployment & Testing
**Status**: Pending  
**Duration**: ~30 minutes  
**Steps**:
1. Update scoring-model.js with new model
2. Deploy to GitHub
3. Test with sample URLs
4. Monitor SERP performance

### Phase 4: Production Rollout
**Status**: Pending  
**Duration**: 1-2 weeks  
**Steps**:
1. A/B test (old rules vs new model)
2. Monitor accuracy metrics
3. Collect user feedback
4. Gradual rollout to all users

## Success Criteria

### Data Collection
- [ ] 100+ total records collected
- [ ] 50+ unique keywords covered
- [ ] Feature extraction success rate > 80%

### Model Performance
- [ ] Test R² > 0.40 (improvement from 0.1555)
- [ ] Cross-validation R² > 0.35
- [ ] RMSE < 10

### Production Readiness
- [ ] A/B test shows improvement
- [ ] No regression in existing scores
- [ ] User satisfaction > 80%

## Key Files

### Data
- `ml/training_data.csv` - Training data (features)
- `ml/training_data.json` - Training data (full metadata)
- `ml/trained_model.json` - XGBoost model binary
- `ml/trained_model_config.json` - Model metrics & config

### Scripts
- `ml/serp_collection.py` - SERP data collection
- `ml/train_baseline.py` - Model training
- `ml/monitor_collection.py` - Progress monitoring
- `ml/export_to_js.py` - Model export utility

### Documentation
- `ML_TRAINING_PROGRESS.md` - Detailed progress report
- `COLLECTION_STATUS.md` - Collection timeline & troubleshooting
- `NEXT_STEPS.md` - This file

## Monitoring Commands

### Check Collection Progress
```bash
python3 ml/monitor_collection.py
```

### Check Process Status
```bash
ps aux | grep "python3 ml/serp_collection.py"
```

### View Latest Data
```bash
tail -20 ml/training_data.json
```

### Count Records
```bash
python3 -c "import json; print(len(json.load(open('ml/training_data.json'))))"
```

## Troubleshooting

### Collection Stopped?
```bash
# Restart collection
SERPAPI_KEY="d5d040588a63fe91e0643b2a7ee1e4a8778ea777d0a9f7e065f77cd05b2a05db" python3 ml/serp_collection.py
```

### Need to Append More Keywords?
1. Edit `ml/serp_collection.py` - add keywords to `KEYWORDS` list
2. Run collection again (will append to existing data)

### Model Training Failed?
```bash
# Install libomp if needed
brew install libomp

# Set environment variables
export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"

# Retry training
python3 ml/train_baseline.py
```

## Expected Improvements

### From Baseline (19 records) to Production (100+ records)
| Metric | Baseline | Expected | Target |
|--------|----------|----------|--------|
| Test R² | 0.1555 | 0.40-0.50 | 0.65+ |
| Test RMSE | 12.74 | 8-10 | <8 |
| CV R² | -1.0765 | 0.30-0.40 | 0.60+ |
| Training Samples | 19 | 100+ | 200+ |

## Questions for Review

1. **Should we train separate AEO/SEO models?**
   - Current: Single unified model
   - Alternative: Separate models for AEO and SEO metrics

2. **How to handle new keywords?**
   - Option A: Monthly full retraining
   - Option B: Incremental updates
   - Option C: Online learning

3. **A/B Testing Strategy?**
   - 50/50 split (old rules vs new model)?
   - Gradual rollout (10% → 50% → 100%)?
   - User opt-in?

## Contact & Support

For issues or questions:
1. Check `COLLECTION_STATUS.md` for troubleshooting
2. Review `ML_TRAINING_PROGRESS.md` for technical details
3. Check GitHub commits for recent changes

---

**Last Updated**: 2025-10-28 09:19:38  
**Next Review**: After collection completes (estimated 2025-10-28 11:30)
