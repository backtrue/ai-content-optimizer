#!/usr/bin/env python3
"""
關鍵字資料匯出腳本
從 Cloudflare KV (KEYWORD_ANALYTICS) 匯出去重後的關鍵字清單
支援時間範圍與 locale 篩選
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
from pathlib import Path

# 假設 Cloudflare Workers 環境變數已設定
# 此腳本可透過 Worker API 或直接 KV 存取


def load_env_variables() -> None:
    """載入本地環境檔"""
    candidate_files = ['.env', '.env.local', '.env.example']
    
    for filename in candidate_files:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' not in line:
                        continue
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if value and len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]
                    os.environ[key] = value
            print(f"✅ 已載入環境設定檔：{filename}")
            break


class KeywordExporter:
    """關鍵字匯出器"""
    
    def __init__(self, api_url: str, api_token: str):
        """
        初始化匯出器
        
        Args:
            api_url: Worker API 基礎 URL (e.g., https://api.example.com)
            api_token: 認證 Token (KEYWORD_ANALYTICS_TOKEN)
        """
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.keywords_endpoint = f"{self.api_url}/api/keywords/recent"
    
    def fetch_keywords(
        self,
        limit: int = 200,
        since: Optional[str] = None,
        locale: Optional[str] = None
    ) -> List[Dict]:
        """
        從 Worker API 取得關鍵字
        
        Args:
            limit: 最大筆數
            since: ISO 8601 時間戳 (e.g., "2025-11-10T00:00:00Z")
            locale: 語系篩選 (e.g., "zh-TW", "en")
        
        Returns:
            關鍵字記錄清單
        """
        import requests
        
        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
        
        params = {'limit': limit}
        if since:
            params['since'] = since
        if locale:
            params['locale'] = locale
        
        try:
            response = requests.get(
                self.keywords_endpoint,
                headers=headers,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            print(f"✅ 取得 {data.get('count', 0)} 筆關鍵字記錄")
            return data.get('records', [])
        except Exception as e:
            print(f"❌ 取得關鍵字失敗: {e}")
            return []
    
    def deduplicate_keywords(self, records: List[Dict]) -> Dict[str, Dict]:
        """
        去重關鍵字（保留最新的記錄）
        
        Args:
            records: 關鍵字記錄清單
        
        Returns:
            去重後的關鍵字字典 {keyword: record}
        """
        deduped = {}
        
        for record in records:
            keyword = record.get('keyword', '').strip()
            if not keyword:
                continue
            
            # 保留最新的記錄（按 timestamp 排序）
            if keyword not in deduped or record.get('timestamp', '') > deduped[keyword].get('timestamp', ''):
                deduped[keyword] = record
        
        print(f"✅ 去重完成：{len(records)} → {len(deduped)} 筆")
        return deduped
    
    def export_to_json(
        self,
        keywords: Dict[str, Dict],
        output_path: str,
        date_str: Optional[str] = None
    ) -> str:
        """
        匯出為 JSON 檔案
        
        Args:
            keywords: 去重後的關鍵字字典
            output_path: 輸出目錄路徑
            date_str: 日期字串 (e.g., "2025-11-11")，預設為今日
        
        Returns:
            輸出檔案路徑
        """
        if not date_str:
            date_str = datetime.now().strftime('%Y-%m-%d')
        
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"keywords-{date_str}.json"
        filepath = output_dir / filename
        
        output_data = {
            'exportedAt': datetime.now().isoformat(),
            'dateStr': date_str,
            'count': len(keywords),
            'keywords': list(keywords.keys()),
            'records': list(keywords.values())
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 已匯出至 JSON：{filepath}")
        return str(filepath)
    
    def export_to_csv(
        self,
        keywords: Dict[str, Dict],
        output_path: str,
        date_str: Optional[str] = None
    ) -> str:
        """
        匯出為 CSV 檔案
        
        Args:
            keywords: 去重後的關鍵字字典
            output_path: 輸出目錄路徑
            date_str: 日期字串
        
        Returns:
            輸出檔案路徑
        """
        import csv
        
        if not date_str:
            date_str = datetime.now().strftime('%Y-%m-%d')
        
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"keywords-{date_str}.csv"
        filepath = output_dir / filename
        
        # 準備 CSV 欄位
        fieldnames = ['keyword', 'locale', 'timestamp', 'source', 'volume', 'difficulty']
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for keyword, record in keywords.items():
                row = {
                    'keyword': keyword,
                    'locale': record.get('locale', ''),
                    'timestamp': record.get('timestamp', ''),
                    'source': record.get('source', ''),
                    'volume': record.get('volume', ''),
                    'difficulty': record.get('difficulty', '')
                }
                writer.writerow(row)
        
        print(f"✅ 已匯出至 CSV：{filepath}")
        return str(filepath)


def main():
    """主程式"""
    parser = argparse.ArgumentParser(
        description='從 Cloudflare KV 匯出去重後的關鍵字清單'
    )
    parser.add_argument(
        '--api-url',
        default=os.getenv('KEYWORD_EXPORT_API_URL', 'http://localhost:8787'),
        help='Worker API 基礎 URL'
    )
    parser.add_argument(
        '--api-token',
        default=os.getenv('KEYWORD_ANALYTICS_TOKEN', ''),
        help='認證 Token'
    )
    parser.add_argument(
        '--output-dir',
        default='./keywords-export',
        help='輸出目錄'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=200,
        help='最大筆數'
    )
    parser.add_argument(
        '--since',
        help='時間範圍起點 (ISO 8601 格式)'
    )
    parser.add_argument(
        '--locale',
        help='語系篩選 (e.g., zh-TW, en)'
    )
    parser.add_argument(
        '--format',
        choices=['json', 'csv', 'both'],
        default='both',
        help='匯出格式'
    )
    parser.add_argument(
        '--date',
        help='日期字串 (YYYY-MM-DD)，預設為今日'
    )
    
    args = parser.parse_args()
    
    # 載入環境變數
    load_env_variables()
    
    # 驗證必要參數
    if not args.api_token:
        print("❌ 錯誤：KEYWORD_ANALYTICS_TOKEN 未設定")
        sys.exit(1)
    
    # 初始化匯出器
    exporter = KeywordExporter(args.api_url, args.api_token)
    
    # 取得關鍵字
    print(f"📥 正在從 {args.api_url} 取得關鍵字...")
    records = exporter.fetch_keywords(
        limit=args.limit,
        since=args.since,
        locale=args.locale
    )
    
    if not records:
        print("⚠️ 未取得任何關鍵字記錄")
        sys.exit(1)
    
    # 去重
    keywords = exporter.deduplicate_keywords(records)
    
    # 匯出
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if args.format in ['json', 'both']:
        exporter.export_to_json(keywords, args.output_dir, args.date)
    
    if args.format in ['csv', 'both']:
        exporter.export_to_csv(keywords, args.output_dir, args.date)
    
    print(f"✅ 匯出完成：{len(keywords)} 筆去重後的關鍵字")


if __name__ == '__main__':
    main()
