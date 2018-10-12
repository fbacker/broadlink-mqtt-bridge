#!/bin/bash
#
# initd-example      Node init.d 
#
# chkconfig: 345 
# description: Script to start 
# processname: forever/coffeescript/node
# pidfile: /var/run/forever-broadlinkbridge.pid 
# logfile: /var/run/forever-broadlinkbridge.log
#


pidFile=/var/run/forever-broadlinkbridge.pid 
logFile=/var/run/forever-broadlinkbridge.log 

sourceDir=/srv/openhab2-conf/broadlink-mqtt-bridge
scriptfile=index.js
scriptId=$sourceDir/$scriptfile


start() {
    echo "Starting $scriptId"

    # Start our CoffeeScript app through forever
    # Notice that we change the PATH because on reboot
    # the PATH does not include the path to node.
    # Launching forever or coffee with a full path
    # does not work unless we set the PATH.
    cd $sourceDir
    PATH=/usr/local/bin:$PATH
    NODE_ENV=production forever start --pidFile $pidFile -l $logFile -a -d --sourceDir $sourceDir/ -c /usr/bin/node $scriptfile

    RETVAL=$?
}

restart() {
    echo -n "Restarting $scriptId"
    /usr/bin/forever restart $scriptId
    RETVAL=$?
}

stop() {
    echo -n "Shutting down $scriptId"
    /usr/bin/forever stop $scriptId
    RETVAL=$?
}

status() {
    echo -n "Status $scriptId"
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