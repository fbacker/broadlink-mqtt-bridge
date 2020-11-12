#!/usr/bin/env bash
container="fredrickbacker/broadlink-mqtt-bridge"

# Login into docker
docker login --username $DOCKER_USER --password $DOCKER_PASSWORD

architectures="arm arm64 amd64"
images=""
platforms=""

for arch in $architectures
do
# Build for all architectures and push manifest
  platforms="linux/$arch,$platforms"
done

platforms=${platforms::-1}


# Push multi-arch image
buildctl build --frontend dockerfile.v0 \
      --local dockerfile=. \
      --local context=. \
      --exporter image \
      --exporter-opt name=docker.io/$container:$TRAVIS_TAG \
      --exporter-opt push=true \
      --frontend-opt platform=$platforms \
      --frontend-opt filename=./Dockerfile

# Push image for every arch with arch prefix in tag
for arch in $architectures
do
# Build for all architectures and push manifest
  buildctl build --frontend dockerfile.v0 \
      --local dockerfile=. \
      --local context=. \
      --exporter image \
      --exporter-opt name=docker.io/$container:$TRAVIS_TAG-$arch \
      --exporter-opt push=true \
      --frontend-opt platform=linux/$arch \
      --frontend-opt filename=./Dockerfile.cross &
done

wait

docker pull $container:$TRAVIS_TAG-arm
docker tag $container:$TRAVIS_TAG-arm $container:$TRAVIS_TAG-armhf
docker push $container:$TRAVIS_TAG-armhf