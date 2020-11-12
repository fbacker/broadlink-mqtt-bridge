#!/usr/bin/env bash
container="fredrickbacker/broadlink-mqtt-bridge"
export DOCKER_CLI_EXPERIMENTAL=enabled

# Login into docker
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin

architectures="arm arm64 amd64 armhf"
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
      --exporter-opt name=docker.io/$container:latest \
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
      --exporter-opt name=docker.io/$container:latest-$arch \
      --exporter-opt push=true \
      --frontend-opt platform=linux/$arch \
      --frontend-opt filename=./Dockerfile &
done

wait


#docker pull $container:latest-arm
#docker tag $container:latest-arm $container:latest-armhf
#docker push $container:latest-armhf

# manifest
#docker manifest create $container:latest \
#    $container:latest-arm \
#    $container:latest-armhf \
#    $container:latest-arm64 \
#    $container:latest-amd64

# add to manifest
#for arch in $architectures
#do
#    docker manifest annotate $container:latest $container:latest-$arch --arch $arch    
#done
#docker tag $container:latest-arm $container:latest-armhf
#docker push $container:latest-armhf
#docker manifest annotate $container:latest $container:latest-armhf --arch armhf

#docker manifest push $container:latest


#docker pull $container:$TRAVIS_TAG-arm

#docker push $container:$TRAVIS_TAG-armhf

