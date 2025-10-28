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
    """Base class for SERP services"""
    
    def __init__(self, name: str, api_key: str, enabled: bool = True):
        self.name = name
        self.api_key = api_key
        self.enabled = enabled
        self.status = ServiceStatus.ACTIVE if enabled else ServiceStatus.DISABLED
        self.last_error = None
        self.error_count = 0
        self.success_count = 0
        
    def fetch(self, keyword: str, **kwargs) -> Tuple[Optional[List[Dict]], Optional[str]]:
        """
        Fetch SERP results
        Returns: (results, error_message)
        """
        raise NotImplementedError
    
    def is_available(self) -> bool:
        return self.enabled and self.status in [ServiceStatus.ACTIVE]
    
    def mark_error(self, error: str):
        self.error_count += 1
        self.last_error = error
        if "quota" in error.lower() or "429" in error or "403" in error:
            self.status = ServiceStatus.QUOTA_EXCEEDED
        else:
            self.status = ServiceStatus.ERROR
    
    def mark_success(self):
        self.success_count += 1
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
        """Initialize all available services"""
        # SerpAPI
        serpapi_key = os.getenv('SERPAPI_KEY', '')
        serpapi_enabled = os.getenv('SERPAPI_ENABLED', 'true').lower() == 'true'
        if serpapi_key:
            self.services['serpapi'] = SerpAPIService('SerpAPI', serpapi_key, serpapi_enabled)
        
        # ValueSERP
        valueserp_key = os.getenv('VALUESERP_KEY', '')
        valueserp_enabled = os.getenv('VALUESERP_ENABLED', 'false').lower() == 'true'
        if valueserp_key:
            self.services['valueserp'] = ValueSERPService('ValueSERP', valueserp_key, valueserp_enabled)
        
        # ZenSERP
        zenserp_key = os.getenv('ZENSERP_KEY', '')
        zenserp_enabled = os.getenv('ZENSERP_ENABLED', 'false').lower() == 'true'
        if zenserp_key:
            self.services['zenserp'] = ZenSERPService('ZenSERP', zenserp_key, zenserp_enabled)
    
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
        """Get status of all services"""
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
                'last_error': service.last_error
            }
        
        return status
    
    def print_status(self):
        """Print formatted status"""
        status = self.get_status()
        print(f"\n{'='*70}")
        print(f"SERP Manager Status - {status['timestamp']}")
        print(f"Strategy: {status['strategy']}")
        print(f"{'='*70}")
        
        for name, svc_status in status['services'].items():
            print(f"\n{svc_status['name']}:")
            print(f"  Status: {svc_status['status']}")
            print(f"  Enabled: {svc_status['enabled']}")
            print(f"  Success: {svc_status['success_count']}")
            print(f"  Errors: {svc_status['error_count']}")
            if svc_status['last_error']:
                print(f"  Last Error: {svc_status['last_error']}")
        
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
