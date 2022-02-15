#!/usr/bin/env python3
import subprocess
import sys

target = int(sys.argv[1])

# --- for Unity, there is a deviation in the y coordinate of the wmctrl -command
# --- for Unity, set: deviation = -28
deviation = 0
# ---

# get the (sorted) x resolution of the screens as a list
screens = [int(s.split("+")[-2]) for s in subprocess.check_output(
    ["xrandr"]).decode("utf-8").split() if (s).count("+") == 2]
screens.sort()
# get the frontmost window and its coordinates
frontmost = [l.split("#")[-1].strip() for l in subprocess.check_output([
    "xprop", "-root"]).decode("utf-8").splitlines() if "_NET_ACTIVE_WINDOW(WINDOW)" in l][0]
active = frontmost[:2]+(10-len(frontmost))*"0"+frontmost[2:]
windata = [l.split() for l in subprocess.check_output(
    ["wmctrl", "-lG"]).decode("utf-8").splitlines() if active in l][0]
# get the current screen the window is on, and (thus) the x-position (of the screen)
currscreen = len([cr for cr in screens if cr <= int(windata[2])])
currpos = sum([item for item in screens[:currscreen]])
# calculate the target position/the distance to move the window
target_pos = screens[target-1]
move = target_pos-currpos
command = ["wmctrl", "-ir", active, "-e", "0,"+(",").join(
    [str(int(windata[2])+move), str(int(windata[3])-28), windata[4], windata[5]])]
# move the window to the targeted screen
subprocess.Popen(command)
