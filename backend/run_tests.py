#!/usr/bin/env python3
"""
Test runner script for the Divemap API.
"""

import subprocess
import sys
import os

def run_tests(test_path=None, verbose=False, coverage=True):
    """Run the test suite."""
    cmd = ["python", "-m", "pytest"]

    if test_path:
        cmd.append(test_path)
    else:
        cmd.append("tests/")

    if verbose:
        cmd.append("-v")

    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term-missing", "--cov-report=html"])

    print(f"Running tests with command: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, check=True)
        print("\n✅ All tests passed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Tests failed with exit code {e.returncode}")
        return False

def run_specific_test(test_file):
    """Run a specific test file."""
    return run_tests(test_file, verbose=True)

def run_without_coverage():
    """Run tests without coverage reporting."""
    return run_tests(coverage=False)

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "all":
            run_tests(verbose=True)
        elif command == "auth":
            run_specific_test("tests/test_auth.py")
        elif command == "users":
            run_specific_test("tests/test_users.py")
        elif command == "dive-sites":
            run_specific_test("tests/test_dive_sites.py")
        elif command == "diving-centers":
            run_specific_test("tests/test_diving_centers.py")
        elif command == "no-cov":
            run_without_coverage()
        elif command == "help":
            print("""
Test Runner Usage:
    python run_tests.py all          - Run all tests with coverage
    python run_tests.py auth         - Run authentication tests only
    python run_tests.py users        - Run user management tests only
    python run_tests.py dive-sites   - Run dive sites tests only
    python run_tests.py diving-centers - Run diving centers tests only
    python run_tests.py no-cov       - Run all tests without coverage
    python run_tests.py help         - Show this help message
            """)
        else:
            print(f"Unknown command: {command}")
            print("Use 'python run_tests.py help' for usage information.")
    else:
        # Default: run all tests
        run_tests(verbose=True)

if __name__ == "__main__":
    main()