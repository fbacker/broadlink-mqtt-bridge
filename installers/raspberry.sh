#!/usr/bin/env bash

# Install with
# bash -c "$(curl -sL https://raw.githubusercontent.com/fbacker/broadlink-mqtt-bridge/master/installers/raspberry.sh)"


echo -e "\e[0m"
echo " _______   _______    ______     __      ________  ___       __   _____  ___  __   ___  "
echo "|   _  \"\ /\"      \  /    \" \   /\"\"\    |\"      \"\|\"  |     |\" \ (\"   \|\"  \|/\"| /  \") "
echo "(. |_)  :|:        |// ____  \ /    \   (.  ___  :||  |     ||  ||.\\   \    (: |/   /  "
echo "|:     \/|_____/   /  /    ) :/' /\  \  |: \   ) ||:  |     |:  ||: \.   \\  |    __/   "
echo "(|  _  \\ //      (: (____/ ///  __'  \ (| (___\ ||\  |___  |.  ||.  \    \. (// _  \   "
echo "|: |_)  :|:  __   \\        /   /  \\  \|:       :( \_|:  \ /\  ||    \    \ |: | \  \  "
echo "(_______/|__|  \___)\"_____(___/    \___(________/ \_______(__\_|_\___|\____\(__|  \__) "
echo ""
echo "Version 2.1.5"
echo ""
echo -e "\e[0m"

# Location
PATH_TARGET=/srv/openhab2-conf
PATH_FOLDER=broadlink-mqtt-bridge
PATH_FULL="$PATH_TARGET/$PATH_FOLDER"

# Define the tested version of Node.js.
NODE_TESTED="v10.13.0"
NPM_TESTED="6.4.1"

# Determine which Pi is running.
ARM=$(uname -m) 

# Check the Raspberry Pi version.
#if [ "$ARM" != "armv7l" ]; then
#	echo -e "\e[91mSorry, your Raspberry Pi is not supported."
#	echo -e "\e[91mPlease run OpenHAB RPI on a Raspberry Pi 2 or 3."
#	echo -e "\e[91mIf this is a Pi Zero, you are in the same boat as the original Raspberry Pi. You must run in server only mode."
#	exit;
#fi

# Define helper methods.
function version_gt() { test "$(echo "$@" | tr " " "\n" | sort -V | head -n 1)" != "$1"; }
function command_exists () { type "$1" &> /dev/null ;}

# Installing helper tools
echo -e "\e[96mInstalling helper tools ...\e[90m"
#sudo apt-get --assume-yes install git || exit

# Check if we need to install or upgrade Node.js.
echo -e "\e[96mCheck current Node installation ...\e[0m"
if command_exists node; then
	echo -e "\e[0mNode currently installed. Checking version number.";
	NODE_CURRENT=$(node -v)
	echo -e "\e[0mMinimum Node version: \e[1m$NODE_TESTED\e[0m"
	echo -e "\e[0mInstalled Node version: \e[1m$NODE_CURRENT\e[0m"
	if version_gt $NODE_TESTED $NODE_CURRENT; then
		echo -e "\e[96mNode needs to be upgraded.\e[0m"
		exit;
	else
		echo -e "\e[92mNo Node.js upgrade necessary.\e[0m"
	fi

else
	echo -e "\e[93mNode.js is not installed.\e[0m";
	exit;
fi

echo -e "\e[96mCheck current NPM installation ...\e[0m"
if command_exists npm; then
	echo -e "\e[0mNPM currently installed. Checking version number.";
	NPM_CURRENT=$(npm -v)
	echo -e "\e[0mMinimum NPM version: \e[1m$NPM_TESTED\e[0m"
	echo -e "\e[0mInstalled NPM version: \e[1m$NPM_CURRENT\e[0m"
	if version_gt $NPM_TESTED $NPM_CURRENT; then
		echo -e "\e[96mNPM needs to be upgraded.\e[0m"
		exit;
	else
		echo -e "\e[92mNo NPM upgrade necessary.\e[0m"
	fi

else
	echo -e "\e[93mNPM is not installed.\e[0m";
	exit;
fi


# Install Broadlink-bridge
cd "$PATH_TARGET"
if [ ! -d "./$PATH_FOLDER" ] ; then
	echo -e "\e[96mCloning ...\e[90m"
	if git clone --depth=1 https://github.com/fbacker/broadlink-mqtt-bridge.git; then 
		echo -e "\e[92mCloning Done!\e[0m"
	else
		echo -e "\e[91mUnable to clone."
		exit;
	fi
fi

cd "$PATH_FULL"
echo -e "\e[96mUpgrade ...\e[90m"
git reset --hard
sudo rm -r ./node_modules
sudo rm package-lock.json
if git pull; then 
	echo -e "\e[92mUpgrade Done!\e[0m"
	echo -e "\e[92mInstall packages\e[0m"
	
	if npm install --production; then 
		echo -e "\e[92mDependencies installation Done!\e[0m"
	else
		echo -e "\e[91mUnable to install dependencies!"
		exit;
	fi
else
	echo -e "\e[91mUnable to upgrade."
	echo -e "\e[91mPlease run git pull manually."
	exit;
fi

echo -e "\e[92mUpdate System Services\e[0m"
sudo cp "$PATH_FULL/installers/boot/broadlinkbridge.service" /etc/systemd/system/
sudo chmod +x /etc/systemd/system/broadlinkbridge.service
sudo systemctl daemon-reload
sudo systemctl restart broadlinkbridge.service
echo -e "\e[92mBroadlink rebooted and ready!\e[0m"
exit;