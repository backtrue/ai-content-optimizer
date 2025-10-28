#!/usr/bin/env python3
"""
Test script for SERP manager
Verify all configured services are working
"""

import os
import sys
from serp_manager import get_manager

def test_manager():
    """Test SERP manager configuration and services"""
    
    print("\n" + "="*70)
    print("SERP Manager Test")
    print("="*70 + "\n")
    
    manager = get_manager()
    
    # Check configuration
    print("📋 Configuration:")
    print(f"  Strategy: {manager.strategy}")
    print(f"  Priority: {', '.join(manager.priority)}")
    print(f"  Max Retries: {manager.max_retries}")
    print(f"  Retry Delay: {manager.retry_delay}s")
    print(f"  Debug: {manager.debug}")
    print()
    
    # Check services
    print("🔧 Configured Services:")
    if not manager.services:
        print("  ❌ No services configured!")
        print("  Please set API keys in environment variables:")
        print("    - SERPAPI_KEY")
        print("    - VALUESERP_KEY")
        print("    - ZENSERP_KEY")
        return False
    
    for name, service in manager.services.items():
        status = "✓" if service.is_available() else "✗"
        print(f"  {status} {service.name}")
        print(f"     Enabled: {service.enabled}")
        print(f"     Status: {service.status.value}")
    
    print()
    
    # Test fetch
    print("🧪 Testing Fetch:")
    test_keyword = "非洲豬瘟"
    print(f"  Keyword: {test_keyword}")
    
    results, error, service = manager.fetch(test_keyword)
    
    if results:
        print(f"  ✓ Success!")
        print(f"  Service: {service}")
        print(f"  Results: {len(results)}")
        for i, result in enumerate(results[:3], 1):
            print(f"    {i}. {result['title'][:50]}...")
    else:
        print(f"  ✗ Failed!")
        print(f"  Error: {error}")
        return False
    
    print()
    
    # Print status
    print("📊 Service Status:")
    manager.print_status()
    
    return True

if __name__ == '__main__':
    success = test_manager()
    sys.exit(0 if success else 1)
