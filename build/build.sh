#! /bin/sh

set -e

cd $(dirname $0)/..

target=vail
VERSION=$(cat CHANGELOG.md | awk -F '[][]' '/^## \[/ {print $2; exit}')
tag=nealey/$target:$VERSION

echo "==== Building $tag"
docker build \
    --tag $tag \
    -f build/Dockerfile \
    .
