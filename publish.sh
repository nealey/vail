#! /bin/sh

case "$1" in
    -prod|--prod)
        echo "Push to main branch, then update stack."
        #rsync -va static melville.woozle.org:/srv/vail/
        ;;
    "")
        rsync -va static/ melville.woozle.org:/srv/vail/testing/
        ;;
esac
