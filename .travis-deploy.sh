#!/usr/bin/env bash
container="fredrickbacker/broadlink-mqtt-bridge"

# Login into docker
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

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
      --exporter-opt name=docker.io/fredrickbacker/broadlink-mqtt-bridge:latest \
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
      --exporter-opt name=docker.io/fredrickbacker/broadlink-mqtt-bridge:latest-$arch \
      --exporter-opt push=true \
      --frontend-opt platform=linux/$arch \
      --frontend-opt filename=./Dockerfile &
done

wait

# manifest
docker manifest create fredrickbacker/broadlink-mqtt-bridge:latest \
    fredrickbacker/broadlink-mqtt-bridge:latest-arm \
    fredrickbacker/broadlink-mqtt-bridge:latest-armhf \
    fredrickbacker/broadlink-mqtt-bridge:latest-arm64 \
    fredrickbacker/broadlink-mqtt-bridge:latest-amd64

# add to manifest
for arch in $architectures
do
    docker manifest annotate fredrickbacker/broadlink-mqtt-bridge:latest fredrickbacker/broadlink-mqtt-bridge:latest-$arch --arch $arch    
done
docker tag fredrickbacker/broadlink-mqtt-bridge:latest-arm fredrickbacker/broadlink-mqtt-bridge:latest-armhf
docker push fredrickbacker/broadlink-mqtt-bridge:latest-armhf
docker manifest annotate fredrickbacker/broadlink-mqtt-bridge:latest fredrickbacker/broadlink-mqtt-bridge:latest-armhf --arch armhf

docker manifest push fredrickbacker/broadlink-mqtt-bridge:latest


#docker pull $container:$TRAVIS_TAG-arm

#docker push $container:$TRAVIS_TAG-armhf

