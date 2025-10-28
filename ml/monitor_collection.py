#!/usr/bin/env python3
"""
Monitor SERP data collection progress
Run this to check how many records have been collected
"""

import json
import os
from datetime import datetime

DATA_FILE = './ml/training_data.json'

def monitor():
    if not os.path.exists(DATA_FILE):
        print("❌ No data file found yet. Collection may still be starting.")
        return
    
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not data:
            print("⏳ Collection in progress... (0 records saved yet)")
            return
        
        print(f"\n{'='*60}")
        print(f"SERP Collection Progress - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        
        # Statistics
        print(f"\n📊 Statistics:")
        print(f"  Total records: {len(data)}")
        
        # Keywords breakdown
        keywords = {}
        ranks = {}
        for record in data:
            kw = record['keyword']
            rank = record['serp_rank']
            keywords[kw] = keywords.get(kw, 0) + 1
            ranks[rank] = ranks.get(rank, 0) + 1
        
        print(f"  Unique keywords: {len(keywords)}")
        print(f"\n🔤 Top 10 keywords by record count:")
        for kw, count in sorted(keywords.items(), key=lambda x: -x[1])[:10]:
            print(f"    {kw}: {count} records")
        
        print(f"\n📈 SERP rank distribution:")
        for rank in sorted(ranks.keys()):
            print(f"    Rank {rank}: {ranks[rank]} records")
        
        # Score distribution
        scores = [r['target_score'] for r in data]
        print(f"\n🎯 Target score distribution:")
        print(f"    Min: {min(scores)}, Max: {max(scores)}, Avg: {sum(scores)/len(scores):.1f}")
        
        print(f"\n{'='*60}")
        print(f"Collection status: ⏳ In Progress")
        print(f"Target: 100+ records (currently {len(data)}, {len(data)//10}% complete)")
        print(f"{'='*60}\n")
        
    except json.JSONDecodeError:
        print("⚠️ Data file is being written. Try again in a moment.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    monitor()
