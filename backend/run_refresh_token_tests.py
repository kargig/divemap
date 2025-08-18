#!/usr/bin/env python3
"""
Test runner for refresh token functionality
"""

import os
import sys
import pytest

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set test environment variables
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "30"
os.environ["ENABLE_TOKEN_ROTATION"] = "true"
os.environ["ENABLE_AUDIT_LOGGING"] = "true"
os.environ["MAX_ACTIVE_SESSIONS_PER_USER"] = "5"

def main():
    """Run the refresh token tests"""
    print("🧪 Running Refresh Token Tests...")
    print("=" * 50)
    
    # Run tests with verbose output
    result = pytest.main([
        "tests/test_refresh_tokens.py",
        "-v",
        "--tb=short",
        "--strict-markers",
        "--disable-warnings"
    ])
    
    if result == 0:
        print("\n✅ All tests passed!")
        return True
    else:
        print("\n❌ Some tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
