# ML Scoring Model Training

## Overview
This directory contains scripts and notebooks for training an ML-based scoring model using SERP rankings as ground truth.

## Quick Start

### 1. Install Dependencies
```bash
pip install requests pandas scikit-learn xgboost
```

### 2. Set Environment Variables
```bash
export VALUESERP_API_KEY="95A6F2493F944B5984BE498A9AB52528"
export ANALYZE_API_URL="https://ragseo.thinkwithblack.com/functions/api/analyze"
```

### 3. Collect Training Data
```bash
python ml/serp_collection.py
```

This will:
- Fetch top 10 SERP results for each keyword (25 keywords total)
- Call our `/analyze` API to extract features for each URL
- Generate `training_data.csv` and `training_data.json`
- Takes ~30-45 minutes (includes rate limiting)

### 4. Train Model
Open `model_training.ipynb` in Google Colab or Jupyter:
- Load `training_data.csv`
- Analyze feature correlations
- Train XGBoost model
- Export coefficients to JSON

### 5. Deploy Model
Copy trained model coefficients to `functions/api/scoring-model.js` and update the `DEFAULT_MODEL` object.

## Files

- `serp_collection.py` - SERP data collection script
- `training_data.csv` - Flattened training data (features + target scores)
- `training_data.json` - Full training data with metadata
- `model_training.ipynb` - Model training notebook (Colab/Jupyter)
- `trained_model.json` - Exported model coefficients (after training)

## Data Format

Each training record contains:
- `url` - Page URL
- `keyword` - Search keyword
- `serp_rank` - SERP position (1-10)
- `target_score` - Quality score derived from rank (100 for rank 1, 55 for rank 10)
- `features` - 30+ normalized features extracted from content analysis

## Model Training

### Target Metric
SERP rank converted to score:
- Rank 1 → 100
- Rank 2 → 95
- Rank 3 → 90
- ...
- Rank 10 → 55

### Features
All features are normalized to 0-1 scale:
- Content signals: wordCount, h2Count, paragraphCount, etc.
- HCU results: hcuYesRatio, hcuNoRatio
- Quality flags: depthLow, readabilityWeak, etc.

### Model Type
Gradient Boosting (XGBoost) for:
- Non-linear relationships
- Feature interactions
- Interpretability (SHAP values)

## Notes

- Collection rate-limited to ~1 request/second per API
- Estimated time: 30-45 minutes for 25 keywords × 10 results = 250 URLs
- API errors are logged but don't stop collection
- Rerun `serp_collection.py` to append new keywords
