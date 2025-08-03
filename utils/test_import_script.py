#!/usr/bin/env python3
"""
Test script for the enhanced dive site import functionality
"""

import sys
import os
from pathlib import Path

# Add the current directory to the path so we can import the main script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from import_dive_sites_enhanced import DiveSiteImporter

def test_file_parsing():
    """Test that the script can parse dive site files correctly"""
    print("🧪 Testing file parsing...")
    
    # Create a test file
    test_file = Path("test_site.txt")
    test_content = '''name "Test Dive Site"
description "A beautiful test dive site"
notes "Additional notes about the site"
gps 36.970309 25.124448'''
    
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(test_content)
    
    try:
        # Test parsing
        importer = DiveSiteImporter()
        result = importer.parse_dive_site_file(test_file)
        
        if result:
            print("✅ File parsing successful!")
            print(f"   Name: {result['name']}")
            print(f"   Description: {result['description']}")
            print(f"   Coordinates: {result['latitude']}, {result['longitude']}")
        else:
            print("❌ File parsing failed!")
            return False
            
    finally:
        # Clean up
        if test_file.exists():
            test_file.unlink()
    
    return True

def test_similarity_calculation():
    """Test the similarity calculation function"""
    print("\n🧪 Testing similarity calculation...")
    
    importer = DiveSiteImporter()
    
    test_cases = [
        ("Antiparos - Panteronisi corner", "Antiparos Panteronisi", 0.8),
        ("The Rock", "the rock", 1.0),
        ("Moofuschi rock", "Moofuschi Reef", 0.6),
        ("Dive Site A", "Dive Site B", 0.5),
    ]
    
    for str1, str2, expected_min in test_cases:
        similarity = importer.calculate_similarity(str1, str2)
        print(f"   '{str1}' vs '{str2}': {similarity:.2f}")
        if similarity >= expected_min:
            print("   ✅ Similarity above threshold")
        else:
            print("   ⚠️  Similarity below expected threshold")
    
    return True

def test_distance_calculation():
    """Test the distance calculation function"""
    print("\n🧪 Testing distance calculation...")
    
    importer = DiveSiteImporter()
    
    # Test coordinates (Athens area)
    lat1, lon1 = 37.9838, 23.7275  # Athens center
    lat2, lon2 = 37.9838, 23.7276  # Very close point
    
    distance = importer.calculate_distance(lat1, lon1, lat2, lon2)
    print(f"   Distance between close points: {distance:.1f}m")
    
    if distance < 10:  # Should be very close
        print("   ✅ Distance calculation working correctly")
    else:
        print("   ❌ Distance calculation seems incorrect")
        return False
    
    return True

def main():
    """Run all tests"""
    print("🚀 Testing Enhanced Dive Site Import Script")
    print("=" * 50)
    
    tests = [
        test_file_parsing,
        test_similarity_calculation,
        test_distance_calculation,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                print(f"❌ Test failed: {test.__name__}")
        except Exception as e:
            print(f"❌ Test error in {test.__name__}: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! The script should work correctly.")
        return 0
    else:
        print("❌ Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 