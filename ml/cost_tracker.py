#!/usr/bin/env python3
"""
SERP API Cost Tracker
Track API usage and estimate costs across services
支援每日摘要、R2 歸檔、週報生成
"""

import json
import os
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

class CostTracker:
    """Track API usage and costs"""
    
    # Pricing per 1000 requests (approximate, check provider for current pricing)
    PRICING = {
        'serpapi': {
            'free_tier': 100,  # 100 free requests/month
            'price_per_1000': 0.05,  # $0.05 per 1000 requests
            'name': 'SerpAPI'
        },
        'valueserp': {
            'free_tier': 100,
            'price_per_1000': 0.04,  # $0.04 per 1000 requests
            'name': 'ValueSERP'
        },
        'zenserp': {
            'free_tier': 100,
            'price_per_1000': 0.03,  # $0.03 per 1000 requests
            'name': 'ZenSERP'
        }
    }
    
    def __init__(self, log_file: str = './ml/api_usage.json'):
        self.log_file = log_file
        self.usage = self._load_usage()
    
    def _load_usage(self) -> Dict:
        """Load usage from file or create new"""
        if os.path.exists(self.log_file):
            try:
                with open(self.log_file, 'r') as f:
                    return json.load(f)
            except:
                return self._init_usage()
        return self._init_usage()
    
    def _init_usage(self) -> Dict:
        """Initialize usage tracking"""
        return {
            'created': datetime.now().isoformat(),
            'services': {
                'serpapi': {'requests': 0, 'errors': 0, 'cost': 0},
                'valueserp': {'requests': 0, 'errors': 0, 'cost': 0},
                'zenserp': {'requests': 0, 'errors': 0, 'cost': 0}
            },
            'total': {'requests': 0, 'errors': 0, 'cost': 0}
        }
    
    def _save_usage(self):
        """Save usage to file"""
        with open(self.log_file, 'w') as f:
            json.dump(self.usage, f, indent=2)
    
    def record_request(self, service: str, success: bool = True):
        """Record an API request"""
        service = service.lower()
        if service not in self.usage['services']:
            return
        
        self.usage['services'][service]['requests'] += 1
        if not success:
            self.usage['services'][service]['errors'] += 1
        
        self.usage['total']['requests'] += 1
        if not success:
            self.usage['total']['errors'] += 1
        
        self._update_costs()
        self._save_usage()
    
    def _update_costs(self):
        """Update cost estimates"""
        for service, data in self.usage['services'].items():
            pricing = self.PRICING[service]
            requests = data['requests']
            
            # Calculate cost (subtract free tier)
            billable = max(0, requests - pricing['free_tier'])
            cost = (billable / 1000) * pricing['price_per_1000']
            data['cost'] = round(cost, 4)
        
        # Update total
        total_cost = sum(data['cost'] for data in self.usage['services'].values())
        self.usage['total']['cost'] = round(total_cost, 4)
    
    def get_summary(self) -> Dict:
        """Get usage summary"""
        return {
            'created': self.usage['created'],
            'last_updated': datetime.now().isoformat(),
            'services': self.usage['services'],
            'total': self.usage['total'],
            'recommendations': self._get_recommendations()
        }
    
    def _get_recommendations(self) -> list:
        """Get cost optimization recommendations"""
        recommendations = []
        
        # Find cheapest service
        cheapest = min(
            self.PRICING.items(),
            key=lambda x: x[1]['price_per_1000']
        )
        recommendations.append(f"Cheapest service: {cheapest[1]['name']} (${cheapest[1]['price_per_1000']}/1000)")
        
        # Check for high error rates
        total_requests = self.usage['total']['requests']
        if total_requests > 0:
            error_rate = self.usage['total']['errors'] / total_requests
            if error_rate > 0.1:
                recommendations.append(f"High error rate: {error_rate*100:.1f}% - check API keys")
        
        # Suggest service rotation
        services_used = [s for s, d in self.usage['services'].items() if d['requests'] > 0]
        if len(services_used) == 1:
            recommendations.append("Consider enabling backup services for redundancy")
        
        return recommendations
    
    def print_summary(self):
        """Print formatted summary"""
        summary = self.get_summary()
        
        print(f"\n{'='*70}")
        print(f"API Usage & Cost Report")
        print(f"{'='*70}")
        
        print(f"\nCreated: {summary['created']}")
        print(f"Last Updated: {summary['last_updated']}")
        
        print(f"\n{'Service':<15} {'Requests':<12} {'Errors':<10} {'Cost':<10}")
        print(f"{'-'*47}")
        
        for service, data in summary['services'].items():
            name = self.PRICING[service]['name']
            print(f"{name:<15} {data['requests']:<12} {data['errors']:<10} ${data['cost']:<9.4f}")
        
        print(f"{'-'*47}")
        total = summary['total']
        print(f"{'TOTAL':<15} {total['requests']:<12} {total['errors']:<10} ${total['cost']:<9.4f}")
        
        print(f"\nRecommendations:")
        for i, rec in enumerate(summary['recommendations'], 1):
            print(f"  {i}. {rec}")
        
        print(f"\n{'='*70}\n")
    
    def export_csv(self, filename: str = './ml/api_usage.csv'):
        """Export usage to CSV"""
        summary = self.get_summary()
        
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Service', 'Requests', 'Errors', 'Cost ($)'])
            
            for service, data in summary['services'].items():
                name = self.PRICING[service]['name']
                writer.writerow([name, data['requests'], data['errors'], f"{data['cost']:.4f}"])
            
            writer.writerow(['TOTAL', summary['total']['requests'], 
                           summary['total']['errors'], f"{summary['total']['cost']:.4f}"])
        
        print(f"✓ Exported to {filename}")
    
    def generate_daily_summary(self, output_dir: str = './ml/cost-reports') -> str:
        """
        生成每日成本摘要
        
        Args:
            output_dir: 輸出目錄
        
        Returns:
            摘要檔案路徑
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        summary = self.get_summary()
        date_str = datetime.now().strftime('%Y-%m-%d')
        
        daily_summary = {
            'date': date_str,
            'timestamp': datetime.now().isoformat(),
            'usage': summary['services'],
            'total': summary['total'],
            'recommendations': summary['recommendations']
        }
        
        filename = output_path / f"cost-summary-{date_str}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(daily_summary, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 每日摘要已生成: {filename}")
        return str(filename)
    
    def generate_weekly_report(self, output_dir: str = './ml/cost-reports') -> str:
        """
        生成週報（彙整過去 7 天的成本數據）
        
        Args:
            output_dir: 輸出目錄
        
        Returns:
            週報檔案路徑
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        summary = self.get_summary()
        week_start = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        week_end = datetime.now().strftime('%Y-%m-%d')
        
        weekly_report = {
            'period': f"{week_start} to {week_end}",
            'generatedAt': datetime.now().isoformat(),
            'services': summary['services'],
            'total': summary['total'],
            'dailyAverage': {
                'requests': round(summary['total']['requests'] / 7, 2),
                'cost': round(summary['total']['cost'] / 7, 4)
            },
            'recommendations': summary['recommendations'],
            'projections': {
                'monthlyRequests': round(summary['total']['requests'] / 7 * 30),
                'monthlyCost': round(summary['total']['cost'] / 7 * 30, 4)
            }
        }
        
        filename = output_path / f"weekly-report-{week_end}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(weekly_report, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 週報已生成: {filename}")
        return str(filename)
    
    def export_to_r2_format(self, output_dir: str = './ml/cost-reports') -> Dict:
        """
        生成 R2 上傳格式的成本數據
        
        Args:
            output_dir: 輸出目錄
        
        Returns:
            包含日期、檔案路徑、上傳鍵的字典
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        date_str = datetime.now().strftime('%Y-%m-%d')
        
        # 生成每日摘要
        daily_summary = self.generate_daily_summary(output_dir)
        
        # 生成週報（如果是週一）
        weekly_report = None
        if datetime.now().weekday() == 0:  # 週一
            weekly_report = self.generate_weekly_report(output_dir)
        
        # 準備 R2 上傳資訊
        r2_info = {
            'date': date_str,
            'files': {
                'daily': {
                    'localPath': daily_summary,
                    'r2Key': f"cost-reports/{date_str}/daily-summary.json"
                }
            }
        }
        
        if weekly_report:
            r2_info['files']['weekly'] = {
                'localPath': weekly_report,
                'r2Key': f"cost-reports/{date_str}/weekly-report.json"
            }
        
        return r2_info
    
    def get_pipeline_metrics(self) -> Dict:
        """
        取得 Pipeline 執行指標（用於排程報表）
        
        Returns:
            包含蒐集樣本數、模型指標、API 成本的字典
        """
        summary = self.get_summary()
        
        return {
            'timestamp': datetime.now().isoformat(),
            'serpCollection': {
                'totalRequests': summary['total']['requests'],
                'successRate': self._calculate_success_rate(),
                'estimatedSamples': round(summary['total']['requests'] * 10),  # 假設每個請求 10 個 URL
                'cost': summary['total']['cost']
            },
            'apiUsage': summary['services'],
            'totalCost': summary['total']['cost'],
            'recommendations': summary['recommendations']
        }
    
    def _calculate_success_rate(self) -> float:
        """計算成功率"""
        total_requests = self.usage['total']['requests']
        if total_requests == 0:
            return 100.0
        
        total_errors = self.usage['total']['errors']
        success_rate = ((total_requests - total_errors) / total_requests) * 100
        return round(success_rate, 2)

# Global instance
_tracker = None

def get_tracker() -> CostTracker:
    """Get or create global tracker instance"""
    global _tracker
    if _tracker is None:
        _tracker = CostTracker()
    return _tracker

if __name__ == '__main__':
    tracker = get_tracker()
    tracker.print_summary()
    tracker.export_csv()
