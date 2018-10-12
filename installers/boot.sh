#!/bin/sh
#/etc/init.d/broadlinkbridge

case "$1" in
start)
exec forever --sourceDir=/srv/openhab2-conf/broadlink-mqtt-bridge -p /srv/openhab2-conf/broadlink-mqtt-bridge index.js  
;;
stop)
exec forever stop --sourceDir=/srv/openhab2-conf/broadlink-mqtt-bridge index.js
;;
*)
echo "Usage: /etc/init.d/broadlinkbridge {start|stop}"
exit 1
;;
esac
exit 0