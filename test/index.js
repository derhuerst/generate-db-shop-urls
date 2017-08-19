'use strict'

const test = require('tape')
const {journeys} = require('db-hafas')

const link = require('..')
const when = require('./when')

test('works Berlin Hbf -> Heilbronn Hbf', (t) => {
	Promise.all([
		journeys('8096003', '8000157', {when: when.outbound, results: 1}),
		journeys('8000157', '8096003', {when: when.returning, results: 1})
	])
	.then(([outbound, returning]) => {
		const query = {
			from: outbound[0].origin,
			to: outbound[0].destination,
			outbound: {
				departure: outbound[0].departure,
				arrival: outbound[0].arrival,
				legs: outbound[0].parts,
				price: outbound[0].price
			},
			return: {
				departure: returning[0].departure,
				arrival: returning[0].arrival,
				legs: returning[0].parts,
				price: returning[0].price
			}
		}

		return link(query)
	})
	.then((data) => {
		// todo
		console.error(data)
	})
	.catch(t.ifError)
	.then(() => t.end())
})
