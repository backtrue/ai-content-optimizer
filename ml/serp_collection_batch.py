#!/usr/bin/env python3
"""
SERP 蒐集批次化模組
支援外部關鍵字輸入、分批執行、R2 上傳
"""

import os
import json
import csv
import time
import argparse
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import requests

# 導入現有的工具
from serp_manager import get_manager as get_serp_manager
from cost_tracker import get_tracker as get_cost_tracker
from sheets_writer import get_sheets_writer, BASE_COLUMNS


class SerpCollectionBatch:
    """SERP 蒐集批次處理器"""
    
    def __init__(
        self,
        keywords: List[str],
        output_dir: str = './ml',
        batch_size: int = 10,
        analyze_api_url: str = 'https://ragseo.thinkwithblack.com/api/analyze',
        keyword_delay: float = 15.0,
        url_delay: float = 12.0
    ):
        """
        初始化批次蒐集器
        
        Args:
            keywords: 關鍵字清單
            output_dir: 輸出目錄
            batch_size: 每批處理的關鍵字數
            analyze_api_url: 分析 API URL
            keyword_delay: 關鍵字間隔（秒）
            url_delay: URL 間隔（秒）
        """
        self.keywords = keywords
        self.output_dir = Path(output_dir)
        self.batch_size = batch_size
        self.analyze_api_url = analyze_api_url
        self.keyword_delay = keyword_delay
        self.url_delay = url_delay
        
        # 初始化工具
        self.serp_manager = get_serp_manager()
        self.cost_tracker = get_cost_tracker()
        self.sheets_writer = get_sheets_writer()
        
        # 輸出目錄
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 進度追蹤
        self.records = []
        self.processed_count = 0
        self.failed_count = 0
        self.start_time = None
    
    def load_keywords_from_file(self, filepath: str) -> List[str]:
        """從 JSON 或 CSV 檔案載入關鍵字"""
        path = Path(filepath)
        
        if not path.exists():
            raise FileNotFoundError(f"關鍵字檔案不存在: {filepath}")
        
        keywords = []
        
        if path.suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    keywords = [str(kw).strip() for kw in data if kw]
                elif isinstance(data, dict) and 'keywords' in data:
                    keywords = [str(kw).strip() for kw in data['keywords'] if kw]
        
        elif path.suffix == '.csv':
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    kw = row.get('keyword', '').strip()
                    if kw:
                        keywords.append(kw)
        
        else:
            raise ValueError(f"不支援的檔案格式: {path.suffix}")
        
        print(f"✅ 已載入 {len(keywords)} 筆關鍵字")
        return keywords
    
    def fetch_serp_results(self, keyword: str) -> List[Dict]:
        """取得 SERP 結果"""
        try:
            results, error, service = self.serp_manager.fetch(keyword)
            
            service_name = (service or 'unknown').lower().replace('api', '').replace('serp', '').strip()
            self.cost_tracker.record_request(service_name, success=(results is not None))
            
            if results:
                print(f"  ✓ 取得 {len(results)} 筆結果 (來源: {service})")
                return results
            else:
                print(f"  ✗ 錯誤: {error}")
                return []
        
        except Exception as e:
            print(f"  ✗ SERP 蒐集失敗: {e}")
            return []
    
    def analyze_url(self, url: str, keyword: str, rank: int) -> Dict:
        """分析單個 URL"""
        if not url:
            return {
                'url': url,
                'keyword': keyword,
                'rank': rank,
                'analysis_status': 'failed',
                'analysis_error': 'Empty URL'
            }
        
        try:
            payload = {
                'contentUrl': url,
                'targetKeywords': [keyword],
                'returnChunks': False
            }
            
            response = requests.post(
                self.analyze_api_url,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                analysis = response.json()
                return {
                    'url': url,
                    'keyword': keyword,
                    'rank': rank,
                    'analysis_status': 'success',
                    'analysis': analysis
                }
            else:
                return {
                    'url': url,
                    'keyword': keyword,
                    'rank': rank,
                    'analysis_status': 'failed',
                    'analysis_error': f'HTTP {response.status_code}'
                }
        
        except Exception as e:
            return {
                'url': url,
                'keyword': keyword,
                'rank': rank,
                'analysis_status': 'failed',
                'analysis_error': str(e)
            }
    
    def process_keyword(self, keyword: str, keyword_index: int, total_keywords: int) -> List[Dict]:
        """處理單個關鍵字"""
        print(f"\n📌 [{keyword_index}/{total_keywords}] 處理關鍵字: {keyword}")
        
        keyword_records = []
        
        # 取得 SERP 結果
        serp_results = self.fetch_serp_results(keyword)
        if not serp_results:
            print(f"  ⚠️ 未取得 SERP 結果，跳過此關鍵字")
            return keyword_records
        
        # 分析每個 URL
        for rank, result in enumerate(serp_results, 1):
            url = result.get('link', '')
            title = result.get('title', '')
            
            print(f"  分析 [{rank}/10] {url[:60]}...")
            
            # 分析 URL
            analysis_result = self.analyze_url(url, keyword, rank)
            
            # 組合記錄
            record = {
                'keyword': keyword,
                'url': url,
                'title': title,
                'rank': rank,
                'timestamp': datetime.now().isoformat(),
                **analysis_result
            }
            
            keyword_records.append(record)
            self.processed_count += 1
            
            # 延遲
            time.sleep(self.url_delay)
        
        # 延遲（關鍵字間隔）
        time.sleep(self.keyword_delay)
        
        return keyword_records
    
    def process_batch(self, batch_keywords: List[str], batch_index: int, total_batches: int) -> List[Dict]:
        """處理一個批次"""
        print(f"\n🔄 批次 [{batch_index}/{total_batches}] 開始")
        
        batch_records = []
        
        for i, keyword in enumerate(batch_keywords, 1):
            keyword_index = (batch_index - 1) * self.batch_size + i
            records = self.process_keyword(keyword, keyword_index, len(self.keywords))
            batch_records.extend(records)
            
            # 定期保存進度
            if i % 5 == 0:
                self.save_progress(batch_records)
        
        print(f"✅ 批次 [{batch_index}/{total_batches}] 完成")
        return batch_records
    
    def save_progress(self, batch_records: List[Dict]) -> None:
        """保存進度"""
        self.records.extend(batch_records)
        
        # 保存 JSON
        json_path = self.output_dir / f"serp_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.records, f, ensure_ascii=False, indent=2)
        
        # 保存 CSV
        csv_path = self.output_dir / f"serp_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        self.save_csv(csv_path, self.records)
        
        print(f"  💾 已保存進度: {len(self.records)} 筆記錄")
    
    def save_csv(self, filepath: Path, records: List[Dict]) -> None:
        """保存為 CSV"""
        if not records:
            return
        
        # 提取所有欄位
        fieldnames = set()
        for record in records:
            fieldnames.update(record.keys())
        
        fieldnames = sorted(list(fieldnames))
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                writer.writerow(record)
    
    def run(self) -> Dict:
        """執行批次蒐集"""
        print(f"🚀 開始 SERP 蒐集批次化")
        print(f"  關鍵字數: {len(self.keywords)}")
        print(f"  批次大小: {self.batch_size}")
        print(f"  總批次數: {(len(self.keywords) + self.batch_size - 1) // self.batch_size}")
        
        self.start_time = datetime.now()
        
        # 分批處理
        total_batches = (len(self.keywords) + self.batch_size - 1) // self.batch_size
        
        for batch_index in range(total_batches):
            start_idx = batch_index * self.batch_size
            end_idx = min(start_idx + self.batch_size, len(self.keywords))
            batch_keywords = self.keywords[start_idx:end_idx]
            
            try:
                batch_records = self.process_batch(batch_keywords, batch_index + 1, total_batches)
                self.save_progress(batch_records)
            except Exception as e:
                print(f"❌ 批次 {batch_index + 1} 失敗: {e}")
                self.failed_count += 1
        
        # 最終統計
        elapsed = datetime.now() - self.start_time
        
        summary = {
            'status': 'completed',
            'total_keywords': len(self.keywords),
            'total_records': len(self.records),
            'processed_count': self.processed_count,
            'failed_count': self.failed_count,
            'elapsed_seconds': elapsed.total_seconds(),
            'output_dir': str(self.output_dir),
            'completed_at': datetime.now().isoformat()
        }
        
        print(f"\n✅ 蒐集完成")
        print(f"  總耗時: {elapsed}")
        print(f"  記錄數: {len(self.records)}")
        print(f"  成功: {self.processed_count}")
        print(f"  失敗: {self.failed_count}")
        
        return summary


def main():
    """主程式"""
    parser = argparse.ArgumentParser(
        description='SERP 蒐集批次化處理'
    )
    parser.add_argument(
        '--keywords-file',
        help='關鍵字檔案路徑 (JSON 或 CSV)'
    )
    parser.add_argument(
        '--keywords-json',
        help='關鍵字 JSON 字串'
    )
    parser.add_argument(
        '--output-dir',
        default='./ml',
        help='輸出目錄'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='每批關鍵字數'
    )
    parser.add_argument(
        '--analyze-api-url',
        default='https://ragseo.thinkwithblack.com/api/analyze',
        help='分析 API URL'
    )
    parser.add_argument(
        '--keyword-delay',
        type=float,
        default=15.0,
        help='關鍵字間隔（秒）'
    )
    parser.add_argument(
        '--url-delay',
        type=float,
        default=12.0,
        help='URL 間隔（秒）'
    )
    
    args = parser.parse_args()
    
    # 載入關鍵字
    keywords = []
    
    if args.keywords_file:
        collector = SerpCollectionBatch([], args.output_dir)
        keywords = collector.load_keywords_from_file(args.keywords_file)
    
    elif args.keywords_json:
        try:
            keywords = json.loads(args.keywords_json)
            if not isinstance(keywords, list):
                raise ValueError('keywords_json 必須是陣列')
            print(f"✅ 已載入 {len(keywords)} 筆關鍵字")
        except json.JSONDecodeError as e:
            print(f"❌ 關鍵字 JSON 解析失敗: {e}")
            return
    
    else:
        print("❌ 必須提供 --keywords-file 或 --keywords-json")
        parser.print_help()
        return
    
    if not keywords:
        print("❌ 未提供任何關鍵字")
        return
    
    # 執行蒐集
    collector = SerpCollectionBatch(
        keywords=keywords,
        output_dir=args.output_dir,
        batch_size=args.batch_size,
        analyze_api_url=args.analyze_api_url,
        keyword_delay=args.keyword_delay,
        url_delay=args.url_delay
    )
    
    summary = collector.run()
    
    # 保存摘要
    summary_path = Path(args.output_dir) / f"batch_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print(f"📊 摘要已保存: {summary_path}")


if __name__ == '__main__':
    main()
