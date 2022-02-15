#!/bin/bash

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


dirPath="`pwd`/bash_helpers"

echo $$ > $dirPath/keypid.txt

mainTerminalTitle=$(cat $dirPath/mainTerminalTitle.txt)

nodeProcessPath=$(cat $dirPath/nodeProcessPathFile.txt)

python3 $dirPath/move_window.py 0

wmctrl -a $mainTerminalTitle

# echo "$nodeProcessPath"

echo "key detection $$"

echo "" > $dirPath/keys.txt

function startListen() {
  while true; do
    sudo script -c showkey -a > $dirPath/keys.txt
  done
}

startListen &

isCtrlPressed=0

function handleLine() {
  #18 keycode for "e"

  if [[ "$1" == *"29 press"* ]]; then
    isCtrlPressed=1
  elif [ $isCtrlPressed -eq 1 ] && [[ $1 == *"29 release"* ]]; then
    isCtrlPressed=0
  fi

  if [[ "$1" == *"18"* ]] && [ $isCtrlPressed -eq 1 ]; then
    # currentWindowName=$(xdotool getactivewindow getwindowname)
    # currentWindowName=$(cat /proc/$$/comm)
    currentWindowName=$(xprop -id $(xprop -root -f _NET_ACTIVE_WINDOW 0x " \$0\\n" _NET_ACTIVE_WINDOW | awk "{print \$2}") | grep "WM_NAME(STRING)")
    currentWindowName=$(substring "$currentWindowName" "= " -1)

    echo "$mainTerminalTitle : $currentWindowName"

    if [ "$mainTerminalTitle" == "$currentWindowName" ]; then
      echo "terminate" > $dirPath/internal_cmds.txt
    fi
  fi
}


prevLineIndex=-1

while true; do
  lineIndex=-1
  while IFS= read -r line; do
    lineIndex=$((lineIndex+1))
    if [ $lineIndex -gt $prevLineIndex ]; then
      handleLine "$line"
    fi
  done <<< `cat $dirPath/keys.txt`
  prevLineIndex=$lineIndex
  sleep 0.1
done
