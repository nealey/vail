#! /bin/sh

cd $(dirname $0)

case "$1" in
    -prod|--prod)
        echo "Push to main branch, then update stack."
	docker -H ssh://melville.woozle.org service update --image ghcr.io/nealey/vail:main melville_vail
        ;;
    "")
        rsync -va static/ melville.woozle.org:/srv/vail/testing/
        ;;
esac
