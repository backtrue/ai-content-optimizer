#!/usr/bin/env python3
"""
SERP API Cost Tracker
Track API usage and estimate costs across services
"""

import json
import os
from datetime import datetime
from typing import Dict

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
        import csv
        
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
