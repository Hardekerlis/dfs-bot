#!/bin/bash

scrtName="env"

#Color variables
NC='\033[0m'
YELLOW='\033[1;33m'
GREEN='\033[1;32m'
PURPLE='\033[0;35m'
LIGHTPURPLE='\033[1;35m'
BLUE='\033[0;34m'

rm "$(pwd)/typescript"

function log() {

  type=""

  if [ "$2" == "" ]; then
    type="info"
  else
    type=$2
  fi

  if [ "$type" == "info" ]; then
    echo -e "${YELLOW}[$scrtName]${GREEN}[INFO]${NC} $1"
  elif [ "$type" == "debug" ]; then
    if [ $debugActive -eq 1 ]; then
      echo -e "${YELLOW}[$scrtName]${PURPLE}[DEBUG]${NC} $1"
    fi
  elif [ "$type" == "debug2" ]; then
    if [ $debug2Active -eq 1 ]; then
      echo -e "${YELLOW}[$scrtName]${LIGHTPURPLE}[DEBUG]${NC} $1"
    fi
  fi

}


log "Initializing environment..."



dirPath="`pwd`/bash_helpers/"
dirPathShort="`pwd`/bash_helpers"

function getIndexOf() {
  str=$1
  substr=$2

  if [ "$2" == "-1" ]; then
    echo ${#str}
  else
    prefix=${str%%$substr*}
    index=${#prefix}

    if [ $index -eq ${#str} ]; then
      echo -1
    else
      echo $index
    fi
  fi
}

function substring() {

  fullStr=$1

  indexOfSubstr=$(getIndexOf "$fullStr" "$2")

  if [ $indexOfSubstr -eq -1 ]; then
    echo -1
  else
    strLength=${#fullStr}
    first=${fullStr:$indexOfSubstr:$strLength}
    indexOfSecond=$(getIndexOf "$first" "$3")
    if [ $indexOfSecond -eq -1 ]; then
      echo -1
    else
      second=${first:0:$indexOfSecond}
      echo ${second:${#2}:${#second}}
    fi
  fi
}

# Config variables
debugActive=1
debug2Active=1
idleTerminationActive=1

maxAmtSame=10
sleepNumBetweenIntervals=0.5

function loadConfig() {
  config=$(cat $dirPath/config)

  log "Loading config: \n$config"
  log "-- config end --"

  if [[ "$config" == *"debug=false;"* ]]; then
    debugActive=0
  fi

  if [[ "$config" == *"debug2=false;"* ]]; then
    debug2Active=0
  fi

  if [[ "$config" == *"neverStop=true;"* ]]; then
    idleTerminationActive=0
  fi

  terminateAfterIdleAmt=$(substring "$config" "idleTerminateAfter=" ";")

  if ! [ $terminateAfterIdleAmt -eq -1 ]; then
    maxAmtSame=$terminateAfterIdleAmt
  fi

  intervalSleep=$(substring "$config" "intervalSleep=" ";")

  if ! [ $intervalSleep -eq -1 ]; then
    division=$(echo "scale=2 ; $intervalSleep / 1000" | bc)
    indexOfDot=$(getIndexOf "$division" ".")
    if ! [ $indexOfDot -eq -1 ]; then
      division="0$division"
    fi
    sleepNumBetweenIntervals=$division
  fi

  log "debug active: $debugActive"
  log "debug2 active: $debug2Active"
  log "Idle termination active: $idleTerminationActive"
  log "idle terminate after: $maxAmtSame"
  log "interval sleep: $sleepNumBetweenIntervals"

}

loadConfig

nodeFilePath=$1

nodeProcessFullPath="`pwd`/$nodeFilePath"
echo $nodeProcessFullPath > $dirPath/nodeProcessPathFile.txt

prevnodepid=`cat $dirPath/nodepid.txt`
prevganachepid=`cat $dirPath/ganachepid.txt`
prevkeypid=`cat $dirPath/keypid.txt`


# terminalTitle=$(xdotool getactivewindow getwindowname)
# terminalTitle=$(cat /proc/$$/comm)
terminalTitle=$(xprop -id $(xprop -root -f _NET_ACTIVE_WINDOW 0x " \$0\\n" _NET_ACTIVE_WINDOW | awk "{print \$2}") | grep "WM_NAME(STRING)")

terminalTitle=$(substring "$terminalTitle" "= " -1)

# echo "title: $terminalTitle"
#
# exit 0

echo $terminalTitle > $dirPath/mainTerminalTitle.txt

# exit 0

echo "" > $dirPath/output.txt
echo "" > $dirPath/internal_cmds.txt

function removeAllProcesses() {

  wholePathNode="node /usr/local/bin/nodemon $1"

  wholePathGanache="/bin/bash $dirPathShort//start-ganache.sh"

  wholePathKey="/bin/bash $dirPathShort/start-key-detection.sh"

  pkill -f "$wholePathNode"
  pkill -f "$wholePathGanache"
  sudo pkill -f "$wholePathKey"

  pkill -f "showkey"
  pkill -f "sudo showkey"

}


function cleanup() {
  log "Cleaning up..."
  echo "" > $dirPath/output.txt
  log "Terminating all processes..."

  kill -9 "$1"
  kill -9 "$2"
  kill -9 "$3"

  log "Terminating sub-processes"
  removeAllProcesses $nodeProcessFullPath
  log "Sub-processes terminated."

  log "Removing wallets.json..."
  walletsPath="$(pwd)/wallets.json"
  rm $walletsPath
  rm "$(pwd)/typescript"

  log "wallets.json removed."

  log "All processes terminated."
  log "Clean up finished."
  log "Exiting..."
  exit 0
}

log "Starting node..." "debug"
gnome-terminal -- $dirPathShort/start-node.sh
log "Node started." "debug"


log "Awaiting correct pid for node..." "debug"
prevnodetid=$(cat $dirPath/nodetid.txt)

nodepid=`cat $dirPath/nodepid.txt`
gotnodepid=false
gotnodetid=false

while ! $gotnodepid && ! $gotnodetid; do
  nodepid=`cat $dirPath/nodepid.txt`
  nodetid=$(cat $dirPath/nodetid.txt)
  if ! [ "$nodepid" == "$prevnodepid"  ]; then
    gotnodepid=true
  fi
  if ! [ "$nodetid" == "$prevnodetid" ]; then
    gotnodetid=true
  fi
  sleep 0.5
done

log "Got pid." "debug"
log "node pid: $nodepid" "debug"
# log "prev node pid: $prevnodepid" "debug"

# exit 0


log "Starting key-detection..." "debug"
gnome-terminal -- $dirPathShort/start-key-detection.sh
log "Key-detection started." "debug"

# gnome-terminal -- ganache -f https://bsc-dataseed.binance.org -p 7545 --wallet.accountKeysPath ~/yield-farm/wallets.json
log "Starting ganache..." "debug"
gnome-terminal -- $dirPathShort/start-ganache.sh

log "Ganache started." "debug"

log "Awaiting correct pids for key-detection & ganache..." "debug"

# sleep 2
# nodepid=`cat $dirPath/nodepid.txt`
ganachepid=`cat $dirPath/ganachepid.txt`
keypid=`cat $dirPath/keypid.txt`
# gotnodepid=false
gotganchepid=false
gotkeypid=false

while ! $gotganchepid && ! $gotkeypid; do
  ganachepid=`cat $dirPath/ganachepid.txt`
  keypid=`cat $dirPath/keypid.txt`

  if ! [ "$ganachepid" == "$prevganachepid"  ]; then
    gotganchepid=true
  fi
  if ! [ "$keypid" == "$prevkeypid"  ]; then
    gotkeypid=true
  fi
  sleep 0.5
done

log "Got pids." "debug"
log "key pid: $keypid" "debug"
log "ganache pid: $ganachepid" "debug"

terminalsArranged="$nodetid"
terminalsArrangedCount=0
#node terminal shouldnt be moved, therefore two
terminalsExpected=2

function arrangeCreatedTerminals() {

  if ! [ $terminalsArrangedCount -ge $terminalsExpected ]; then
    log "Arranging created terminals..."

    res=$(wmctrl -l | grep Terminal)

    while IFS= read -r line; do
      tid="0$(substring "$line" "0" " ")"

      # if ! [[ "$terminalsArranged" == *"$tid"* ]]; then
      if ! [[ "$tid" == *"$nodetid"* ]]; then
        log "arranging tid: $tid" "debug2"

        wmctrl -R $tid
        wmctrl -a $terminalTitle


        wmctrl -i -r $tid -t 1
        terminalsArranged="$terminalsArranged, $tid"
        terminalsArrangedCount=$((terminalsArrangedCount+1))
      fi
      # fi


    done <<< $res

    log "Created terminals arranged."
  fi

}

arrangeCreatedTerminals


ganacheJustRestarted=0


function restartGanache() {
  ganachePidBeforeRestart=$1
  log "Restarting ganache..."
  log "Terminating ganache..." "debug"
  kill -9 $1

  # wait $1


  log "Ganache terminated." "debug"
  log "Starting ganache..." "debug"
  gnome-terminal -- $dirPath/start-ganache.sh
  log "Ganache started." "debug"

  log "Gathering ganache pid..." "debug"

  ganachepid=`cat $dirPath/ganachepid.txt`

  while [ "$ganachepid" == "$ganachePidBeforeRestart" ]; do
    ganachepid=`cat $dirPath/ganachepid.txt`
  done

  log "Got ganache pid: $ganachepid" "debug"

  log "Ganache successfully restarted."

  ganacheJustRestarted=1

  terminalsArrangedCount=0

  arrangeCreatedTerminals
}


# exit 0

shouldRun=true
prevLineIndex=-1
amtSame=0

# echo "" > output.txt

nodemonRestartingDueToChangesStr="[nodemon] restarting due to changes..."

function handleLine() {
  line=$1
  echo -e "${BLUE}[node]${NC} $line"
  if [[ "$line" == *"$nodemonRestartingDueToChangesStr"* ]]; then
    # log "RESTART GANACHE"

    log "Detected nodemon restart: $ganacheJustRestarted" "debug"

    if [ $ganacheJustRestarted -eq 0 ]; then
      restartGanache $ganachepid
    else
      ganacheJustRestarted=0
    fi

  fi
}

function handleInternalCmds() {
  internalCmds=$(cat $dirPath/internal_cmds.txt)
  if [[ "$internalCmds" == *"terminate"* ]]; then
    shouldRun=false
  fi
}

log "Environment initialized."

while $shouldRun; do
  lineIndex=-1
  while IFS= read -r line; do
    lineIndex=$((lineIndex+1))
    if [ $lineIndex -gt $prevLineIndex ]; then
      handleLine "$line"
    fi
  done <<< `cat $dirPath/output.txt`

  if [ $idleTerminationActive -eq 1 ]; then
    if [ $lineIndex -eq $prevLineIndex ]; then
      amtSame=$((amtSame+1))
      log "Terminating in $amtSame / $maxAmtSame" "debug2"
      if [ $amtSame -eq $maxAmtSame ]; then
        shouldRun=false
      fi
    else
      amtSame=0
    fi
  fi

  prevLineIndex=$lineIndex
  sleep $sleepNumBetweenIntervals

  handleInternalCmds

  arrangeCreatedTerminals


done


cleanup $nodepid $ganachepid $keypid
