#!/bin/bash
TARGET_ENV=$1 
IMAGE_TAG=$2

echo "Deploying to $TARGET_ENV with image tag $IMAGE_TAG..."

docker run -d \
  --name app_$TARGET_ENV \
  --network jenkins_default \
  -e DATABASE_URL="postgresql://postgres:1997@postgres_prod:5432/smart_city" \
  node-app:$IMAGE_TAG

docker exec nginx_proxy sh -c "sed -i 's/app_blue:3000\|app_green:3000/app_$TARGET_ENV:3000/g' /etc/nginx/nginx.conf && nginx -s reload"

echo "Deployment to $TARGET_ENV completed successfully."