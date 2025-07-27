#!/bin/bash
set -e

DATADIR="/data"

# Ensure the data directory is owned by mysql
chown -R mysql:mysql "$DATADIR"

# Initialize the data directory if it's empty
if [ ! -d "$DATADIR/mysql" ]; then
    echo "Initializing MySQL data directory..."
    mysqld --initialize-insecure --datadir="$DATADIR" --user=mysql
fi

exec mysqld --datadir="$DATADIR"
