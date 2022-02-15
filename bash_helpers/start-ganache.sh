#!/bin/bash


processPath=$(pwd)
dirPath="$processPath/bash_helpers"

echo $$ > $dirPath/ganachepid.txt

mainTerminalTitle=$(cat $dirPath/mainTerminalTitle.txt)

python3 $dirPath/move_window.py 0

wmctrl -a $mainTerminalTitle

sudo -i -u gustaf bash << EOF
ganache -f https://bsc-dataseed.binance.org -p 7545 --wallet.accountKeysPath $processPath/wallets.json
EOF

# ganache -f https://bsc-dataseed.binance.org -p 7545 --wallet.accountKeysPath $processPath/wallets.json
# npm run chain
#
# read hej
