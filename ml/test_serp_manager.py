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
    assert manager is not None, "Manager should be initialized"
    
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
        print("  ⚠️ No services configured (API Keys not set)")
        print("  To enable testing, set environment variables:")
        print("    - SERPAPI_KEYS")
        print("    - VALUESERP_KEYS")
        print("    - ZENSERP_KEYS")
        print("\n  Skipping fetch test (API Keys required)")
        print("✅ Configuration test passed!")
        return
    
    print(f"  ✓ Services configured: {len(manager.services)}")
    
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
        assert len(results) > 0, "Should have at least one result"
    else:
        print(f"  ✗ Failed!")
        print(f"  Error: {error}")
        assert False, f"Fetch should succeed, got error: {error}"
    
    print()
    
    # Print status
    print("📊 Service Status:")
    manager.print_status()
    
    print("✅ All tests passed!")

if __name__ == '__main__':
    try:
        test_manager()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
