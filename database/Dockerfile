FROM mysql:lts

# Copy the init script to the proper location
# MySQL automatically creates database and user from environment variables
# This script only needs to create tables and insert sample data
COPY ./init.sql /docker-entrypoint-initdb.d/

EXPOSE 3306

# Use the default MySQL entrypoint which handles environment variables automatically
CMD ["mysqld"]
