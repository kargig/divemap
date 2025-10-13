#!/bin/bash

# Setup script for utility script credentials
# This script helps users set up the correct environment variables

echo "=== Divemap Utility Scripts Credential Setup ==="
echo

# Check if local_testme exists
if [ -f "../local_testme" ]; then
    echo "Found local_testme file. Reading credentials..."
    
    # Extract admin credentials
    ADMIN_LINE=$(grep "admin/" ../local_testme | head -1)
    if [ -n "$ADMIN_LINE" ]; then
        ADMIN_USER=$(echo "$ADMIN_LINE" | cut -d'/' -f1 | xargs)
        ADMIN_PASS=$(echo "$ADMIN_LINE" | cut -d'/' -f2 | xargs)
        
        echo "Found admin credentials: $ADMIN_USER"
        echo
        echo "To use these credentials, run:"
        echo "export ADMIN_USER=\"$ADMIN_USER\""
        echo "export ADMIN_PASS=\"$ADMIN_PASS\""
        echo
        echo "Or for a single command:"
        echo "ADMIN_USER=\"$ADMIN_USER\" ADMIN_PASS=\"$ADMIN_PASS\" ./validation_test.sh"
        echo
    else
        echo "Could not find admin credentials in local_testme"
    fi
else
    echo "local_testme file not found. Please set credentials manually:"
    echo
    echo "export ADMIN_USER=\"admin\""
    echo "export ADMIN_PASS=\"YourActualPassword\""
    echo
fi

echo "For more information, see: utils/README_credentials.md"
