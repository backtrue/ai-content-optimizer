#!/usr/bin/env python3
"""
Multi-service SERP manager with automatic failover
Supports: SerpAPI, ValueSERP, ZenSERP
Automatically switches services when quota is exceeded or errors occur
"""

import os
import json
import time
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from enum import Enum

class ServiceStatus(Enum):
    ACTIVE = "active"
    QUOTA_EXCEEDED = "quota_exceeded"
    ERROR = "error"
    DISABLED = "disabled"

class SerpService:
    """SERP 服務基類"""
    
    def __init__(self, name: str, api_keys: list, enabled: bool = True):
        self.name = name
        self.api_keys = api_keys if isinstance(api_keys, list) else [api_keys]
        self.current_key_index = 0
        self.enabled = enabled
        self.status = ServiceStatus.ACTIVE if enabled else ServiceStatus.DISABLED
        self.last_error = None
        self.error_count = 0
        self.success_count = 0
        self.key_stats = {key: {'success': 0, 'error': 0} for key in self.api_keys}
    
    @property
    def api_key(self) -> str:
        """取得目前的 API Key"""
        if not self.api_keys:
            return ""
        return self.api_keys[self.current_key_index]
    
    def rotate_api_key(self):
        """輪換到下一個 API Key"""
        if len(self.api_keys) > 1:
            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
            if os.getenv('SERP_LOG_API_KEY_ROTATION', 'false').lower() == 'true':
                print(f"  [API Key 輪換] {self.name}: 切換到 API Key #{self.current_key_index + 1}")
    
    def record_key_result(self, success: bool):
        """記錄目前 API Key 的結果"""
        key = self.api_key
        if key in self.key_stats:
            if success:
                self.key_stats[key]['success'] += 1
            else:
                self.key_stats[key]['error'] += 1
        
    def fetch(self, keyword: str, **kwargs) -> Tuple[Optional[List[Dict]], Optional[str]]:
        """
        Fetch SERP results
        Returns: (results, error_message)
        """
        raise NotImplementedError
    
    def is_available(self) -> bool:
        return self.enabled and self.status in [ServiceStatus.ACTIVE]
    
    def mark_error(self, error: str):
        """標記錯誤並決定是否輪換 API Key"""
        self.error_count += 1
        self.last_error = error
        self.record_key_result(False)
        
        if "quota" in error.lower() or "429" in error or "403" in error:
            # 配額超限，輪換 API Key
            self.rotate_api_key()
            self.status = ServiceStatus.QUOTA_EXCEEDED
        else:
            self.status = ServiceStatus.ERROR
    
    def mark_success(self):
        """標記成功"""
        self.success_count += 1
        self.record_key_result(True)
        if self.status == ServiceStatus.ERROR:
            self.status = ServiceStatus.ACTIVE

class SerpAPIService(SerpService):
    """SerpAPI service implementation"""
    
    def fetch(self, keyword: str, **kwargs) -> Tuple[Optional[List[Dict]], Optional[str]]:
        if not self.is_available():
            return None, f"Service {self.name} is not available"
        
        url = "https://serpapi.com/search"
        params = {
            'api_key': self.api_key,
            'q': keyword,
            'gl': 'tw',
            'hl': 'zh-TW',
            'num': 10,
            'engine': 'google'
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            
            # Check for quota exceeded
            if response.status_code == 429:
                error = "Rate limit exceeded (429)"
                self.mark_error(error)
                return None, error
            
            if response.status_code == 403:
                error = "Quota exceeded or invalid API key (403)"
                self.mark_error(error)
                return None, error
            
            response.raise_for_status()
            data = response.json()
            
            # Check for API error in response
            if 'error' in data:
                error = f"API error: {data['error']}"
                self.mark_error(error)
                return None, error
            
            results = []
            for idx, result in enumerate(data.get('organic_results', [])[:10], 1):
                results.append({
                    'rank': idx,
                    'url': result.get('link', ''),
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'position': result.get('position', idx)
                })
            
            self.mark_success()
            return results, None
        
        except requests.exceptions.RequestException as e:
            error = f"Request error: {str(e)}"
            self.mark_error(error)
            return None, error
        except Exception as e:
            error = f"Unexpected error: {str(e)}"
            self.mark_error(error)
            return None, error

class ValueSERPService(SerpService):
    """ValueSERP service implementation"""
    
    def fetch(self, keyword: str, **kwargs) -> Tuple[Optional[List[Dict]], Optional[str]]:
        if not self.is_available():
            return None, f"Service {self.name} is not available"
        
        url = "https://api.valueserp.com/search"
        params = {
            'api_key': self.api_key,
            'q': keyword,
            'country': 'tw',
            'language': 'zh-TW',
            'num': 10
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            
            # Check for quota exceeded
            if response.status_code == 429:
                error = "Rate limit exceeded (429)"
                self.mark_error(error)
                return None, error
            
            if response.status_code == 403:
                error = "Quota exceeded or invalid API key (403)"
                self.mark_error(error)
                return None, error
            
            response.raise_for_status()
            data = response.json()
            
            # Check for API error in response
            if 'error' in data:
                error = f"API error: {data['error']}"
                self.mark_error(error)
                return None, error
            
            results = []
            for idx, result in enumerate(data.get('results', [])[:10], 1):
                results.append({
                    'rank': idx,
                    'url': result.get('url', ''),
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'position': idx
                })
            
            self.mark_success()
            return results, None
        
        except requests.exceptions.RequestException as e:
            error = f"Request error: {str(e)}"
            self.mark_error(error)
            return None, error
        except Exception as e:
            error = f"Unexpected error: {str(e)}"
            self.mark_error(error)
            return None, error

class ZenSERPService(SerpService):
    """ZenSERP service implementation"""
    
    def fetch(self, keyword: str, **kwargs) -> Tuple[Optional[List[Dict]], Optional[str]]:
        if not self.is_available():
            return None, f"Service {self.name} is not available"
        
        url = "https://api.zenserp.com/search"
        params = {
            'apikey': self.api_key,
            'q': keyword,
            'gl': 'tw',
            'hl': 'zh-TW',
            'num': 10
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            
            # Check for quota exceeded
            if response.status_code == 429:
                error = "Rate limit exceeded (429)"
                self.mark_error(error)
                return None, error
            
            if response.status_code == 403:
                error = "Quota exceeded or invalid API key (403)"
                self.mark_error(error)
                return None, error
            
            response.raise_for_status()
            data = response.json()
            
            # Check for API error in response
            if 'error' in data:
                error = f"API error: {data['error']}"
                self.mark_error(error)
                return None, error
            
            results = []
            for idx, result in enumerate(data.get('organic', [])[:10], 1):
                results.append({
                    'rank': idx,
                    'url': result.get('url', ''),
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'position': idx
                })
            
            self.mark_success()
            return results, None
        
        except requests.exceptions.RequestException as e:
            error = f"Request error: {str(e)}"
            self.mark_error(error)
            return None, error
        except Exception as e:
            error = f"Unexpected error: {str(e)}"
            self.mark_error(error)
            return None, error

class SerpManager:
    """Multi-service SERP manager with automatic failover"""
    
    def __init__(self):
        self.services: Dict[str, SerpService] = {}
        self.strategy = os.getenv('SERP_ROTATION_STRATEGY', 'fallback')
        self.priority = os.getenv('SERP_SERVICE_PRIORITY', 'serpapi,valueserp,zenserp').split(',')
        self.max_retries = int(os.getenv('SERP_MAX_RETRIES', '3'))
        self.retry_delay = int(os.getenv('SERP_RETRY_DELAY_MS', '1000')) / 1000
        self.debug = os.getenv('SERP_DEBUG', 'false').lower() == 'true'
        self.log_failures = os.getenv('SERP_LOG_FAILURES', 'true').lower() == 'true'
        
        self._init_services()
    
    def _init_services(self):
        """初始化所有可用的服務"""
        # SerpAPI - 支援多個 API Key
        serpapi_keys_str = os.getenv('SERPAPI_KEYS', '')
        serpapi_enabled = os.getenv('SERPAPI_ENABLED', 'true').lower() == 'true'
        if serpapi_keys_str:
            serpapi_keys = [k.strip() for k in serpapi_keys_str.split(',') if k.strip()]
            self.services['serpapi'] = SerpAPIService('SerpAPI', serpapi_keys, serpapi_enabled)
        
        # ValueSERP - 支援多個 API Key
        valueserp_keys_str = os.getenv('VALUESERP_KEYS', '')
        valueserp_enabled = os.getenv('VALUESERP_ENABLED', 'false').lower() == 'true'
        if valueserp_keys_str:
            valueserp_keys = [k.strip() for k in valueserp_keys_str.split(',') if k.strip()]
            self.services['valueserp'] = ValueSERPService('ValueSERP', valueserp_keys, valueserp_enabled)
        
        # ZenSERP - 支援多個 API Key
        zenserp_keys_str = os.getenv('ZENSERP_KEYS', '')
        zenserp_enabled = os.getenv('ZENSERP_ENABLED', 'false').lower() == 'true'
        if zenserp_keys_str:
            zenserp_keys = [k.strip() for k in zenserp_keys_str.split(',') if k.strip()]
            self.services['zenserp'] = ZenSERPService('ZenSERP', zenserp_keys, zenserp_enabled)
    
    def _get_service_order(self) -> List[str]:
        """Get service order based on strategy"""
        available = [s for s in self.priority if s in self.services and self.services[s].is_available()]
        
        if self.strategy == 'priority':
            return available
        elif self.strategy == 'fallback':
            return available
        elif self.strategy == 'round-robin':
            # Simple round-robin (could be enhanced with state tracking)
            return available
        else:
            return available
    
    def fetch(self, keyword: str) -> Tuple[Optional[List[Dict]], Optional[str], str]:
        """
        Fetch SERP results with automatic failover
        Returns: (results, error_message, service_used)
        """
        services_to_try = self._get_service_order()
        
        if not services_to_try:
            return None, "No available SERP services configured", "none"
        
        last_error = None
        service_used = None
        
        for attempt in range(self.max_retries):
            for service_name in services_to_try:
                service = self.services[service_name]
                
                if self.debug:
                    print(f"  [Attempt {attempt+1}/{self.max_retries}] Trying {service.name}...")
                
                results, error = service.fetch(keyword)
                service_used = service.name
                
                if results is not None:
                    if self.debug:
                        print(f"  ✓ Success with {service.name}")
                    return results, None, service_used
                
                if error:
                    last_error = error
                    if self.log_failures:
                        print(f"  ✗ {service.name}: {error}")
                    
                    # If quota exceeded, try next service
                    if "quota" in error.lower() or "429" in error or "403" in error:
                        continue
                    
                    # For other errors, wait before retry
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay)
            
            # If all services failed, wait before next attempt
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay)
        
        return None, last_error or "All services exhausted", service_used or "none"
    
    def get_status(self) -> Dict:
        """取得所有服務的狀態"""
        status = {
            'timestamp': datetime.now().isoformat(),
            'strategy': self.strategy,
            'services': {}
        }
        
        for name, service in self.services.items():
            status['services'][name] = {
                'name': service.name,
                'enabled': service.enabled,
                'status': service.status.value,
                'success_count': service.success_count,
                'error_count': service.error_count,
                'last_error': service.last_error,
                'api_key_count': len(service.api_keys),
                'current_api_key_index': service.current_key_index,
                'api_key_stats': service.key_stats
            }
        
        return status
    
    def print_status(self):
        """列印格式化的狀態"""
        status = self.get_status()
        print(f"\n{'='*70}")
        print(f"SERP 管理器狀態 - {status['timestamp']}")
        print(f"策略: {status['strategy']}")
        print(f"{'='*70}")
        
        for name, svc_status in status['services'].items():
            print(f"\n{svc_status['name']}:")
            print(f"  狀態: {svc_status['status']}")
            print(f"  已啟用: {svc_status['enabled']}")
            print(f"  成功: {svc_status['success_count']}")
            print(f"  錯誤: {svc_status['error_count']}")
            print(f"  API Key 數量: {svc_status['api_key_count']}")
            print(f"  目前 API Key: #{svc_status['current_api_key_index'] + 1}")
            
            # 顯示每個 API Key 的統計
            if svc_status['api_key_count'] > 1:
                print(f"  API Key 統計:")
                for i, (key, stats) in enumerate(svc_status['api_key_stats'].items(), 1):
                    masked_key = key[:8] + '...' + key[-4:] if len(key) > 12 else key
                    print(f"    #{i} ({masked_key}): 成功 {stats['success']}, 錯誤 {stats['error']}")
            
            if svc_status['last_error']:
                print(f"  最後錯誤: {svc_status['last_error']}")
        
        print(f"\n{'='*70}\n")

# Global instance
_manager = None

def get_manager() -> SerpManager:
    """Get or create global manager instance"""
    global _manager
    if _manager is None:
        _manager = SerpManager()
    return _manager

def fetch_serp(keyword: str) -> Tuple[Optional[List[Dict]], Optional[str], str]:
    """Convenience function to fetch SERP"""
    manager = get_manager()
    return manager.fetch(keyword)

if __name__ == '__main__':
    # Test the manager
    manager = get_manager()
    manager.print_status()
    
    # Test fetch
    print("Testing fetch with keyword: '非洲豬瘟'")
    results, error, service = fetch_serp('非洲豬瘟')
    
    if results:
        print(f"✓ Got {len(results)} results from {service}")
        for r in results[:3]:
            print(f"  {r['rank']}. {r['title'][:50]}...")
    else:
        print(f"✗ Error: {error}")
    
    manager.print_status()
