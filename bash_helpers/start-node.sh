#!/bin/bash

function getIndexOf() {
  str=$1
  substr=$2

  prefix=${str%%$substr*}
  index=${#prefix}

  if [ $index -eq ${#str} ]; then
    echo -1
  else
    echo $index
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


mainTerminalTitle=$(cat $dirPath/mainTerminalTitle.txt)

nodeProcessPath=$(cat $dirPath/nodeProcessPathFile.txt)

res=$(wmctrl -l | grep Terminal)

tid="0$(substring "$res" "0" " ")"

echo "PID: $$"

echo $tid > $dirPath/nodetid.txt

echo $$ > $dirPath/nodepid.txt

# wmctrl -R $tid

# wmctrl -a $mainTerminalTitle
#
# read linen


wmctrl -a $mainTerminalTitle

# echo "$nodeProcessPath"

nodemon $nodeProcessPath > $dirPath/output.txt
