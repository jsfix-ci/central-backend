#!/bin/bash -eo pipefail
testloop() {
	local count=${1:-10}
	touch testloop.txt
	local temp=$(mktemp)
	local i line
	for i in $(seq $count); do
		{ make test || true; } | tee $temp
		line=$(grep -n -m 1 passing $temp | cut -d ':' -f 1)
		tail -n +$line $temp >> testloop.txt
	done
}
testloop "$@"
