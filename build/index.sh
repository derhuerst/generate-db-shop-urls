#!/bin/sh

set -euo pipefail

cd $(dirname "$0")
set -x

curl 'https://download-data.deutschebahn.com/static/datasets/haltestellen/D_Bahnhof_2020_alle.CSV' -sfL \
	| ./eva-nrs-by-betreiber-nrs.js \
	>../lib/eva-nrs-by-betreiber-nrs.json
