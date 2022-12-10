#!/usr/bin/env node
'use strict'

const {pipeline, Transform} = require('stream')
const csvParser = require('csv-parser')

const KIND_SCORES = Object.assign(Object.create(null), {
	'nur DPN': 1,
	'RV': 2,
	'FV': 3,
})

// Betreiber_Nr -> name -> {evaNr, kind}
const evaNrsByBetreiberNrs = {}

pipeline(
	process.stdin,
	csvParser({separator: ';'}),
	new Transform({
		objectMode: true,
		transform: (station, _, cb) => {
			for (const field of [
				'Betreiber_Nr',
				'NAME',
				'EVA_NR',
				'Verkehr',
			]) {
				if (!station[field]) {
					console.error(`missing ${field}:`, station)
					return cb()
				}
			}
			const {
				Betreiber_Nr: betreiberNr,
				NAME: name,
				EVA_NR: evaNr,
				Verkehr: kind,
			} = station

			if ('number' !== typeof KIND_SCORES[kind]) {
				console.error(`invalid/unsupported Verkehr:`, station)
				return cb()
			}
			const kindScore = KIND_SCORES[kind]

			if (!(betreiberNr in evaNrsByBetreiberNrs)) {
				evaNrsByBetreiberNrs[betreiberNr] = {
					[name]: {kindScore, evaNr},
				}
			} else if (!(name in evaNrsByBetreiberNrs[betreiberNr])) {
				evaNrsByBetreiberNrs[betreiberNr][name] = {kindScore, evaNr}
				return cb()
			} else if (evaNrsByBetreiberNrs[betreiberNr][name].kindScore < kindScore) {
				// If there are >1 entries for a betreiberNr & name, we keep the one with
				// the highest kind score.
				evaNrsByBetreiberNrs[betreiberNr][name] = {kindScore, evaNr}
			}

			cb()
		},
		final: function (cb) {
			// transform to plain netreiberNr -> name -> evaNr map
			for (const byName of Object.values(evaNrsByBetreiberNrs)) {
				for (const [name, {evaNr}] of Object.entries(byName)) {
					byName[name] = evaNr
				}
			}

			this.push(JSON.stringify(evaNrsByBetreiberNrs))
			cb()
		},
	}),
	process.stdout,
	(err) => {
		if (!err) return;
		console.error(err)
		process.exit(1)
	},
)
