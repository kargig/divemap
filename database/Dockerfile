FROM mysql:lts

ENV MYSQL_ROOT_PASSWORD=changeme
ENV MYSQL_DATABASE=appdb
ENV MYSQL_USER=appuser
ENV MYSQL_PASSWORD=secret

#COPY docker-entrypoint.sh /entrypoint.sh
#RUN chmod +x /entrypoint.sh

COPY ./init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 3306
# Define default command
CMD ["mysqld"]
