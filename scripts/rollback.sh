#!/bin/bash
FAILED_ENV=$1

if [ "$FAILED_ENV" == "green" ]; then
    PREV_ENV="blue"
else
    PREV_ENV="green"
fi

echo "Rolling back to previous stable environment: $PREV_ENV..."

docker exec nginx_proxy sh -c "sed -i 's/app_$FAILED_ENV:3000/app_$PREV_ENV:3000/g' /etc/nginx/nginx.conf && nginx -s reload"
docker stop app_$FAILED_ENV && docker rm app_$FAILED_ENV

echo "Rollback completed."