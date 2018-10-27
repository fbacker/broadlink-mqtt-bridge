#!/bin/bash

pidFile=/var/run/forever-broadlinkbridge.pid
logFile=/var/log/broadlinkbridge/output.log

sourceDir=/srv/openhab2-conf/broadlink-mqtt-bridge
scriptfile=index.js
scriptId=$sourceDir/$scriptfile


start() {
    echo "Starting $scriptId\n"

    cd $sourceDir
    PATH=/usr/local/bin:$PATH
    NODE_ENV=production forever start --pidFile $pidFile -l $logFile -a -d --sourceDir $sourceDir/ -c /usr/bin/node $scriptfile

    RETVAL=$?
}

restart() {
    echo -n "Restarting $scriptId\n"
    /usr/bin/forever restart $scriptId
    RETVAL=$?
}

stop() {
    echo -n "Shutting down $scriptId\n"
    /usr/bin/forever stop $scriptId
    RETVAL=$?
}

status() {
    echo -n "Status $scriptId\n"
    /usr/bin/forever list
    RETVAL=$?
}


case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage:  {start|stop|status|restart}"
        exit 1
        ;;
esac
exit $RETVAL