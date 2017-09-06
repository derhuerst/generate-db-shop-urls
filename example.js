'use strict'

const util = require('util')
const {journeys} = require('db-hafas')

const generateLink = require('.')
const when = require('./test/when') // Monday in a week, 10am

// Berlin -> Hamburg, Hamburg -> Berlin
const outbound = journeys('008011160', '008096009', {when: when.outbound, results: 1})
const returning = journeys('008096009', '008011160', {when: when.returning, results: 1})

Promise.all([outbound, returning])
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
		returning: {
			departure: returning[0].departure,
			arrival: returning[0].arrival,
			legs: returning[0].parts,
			price: returning[0].price
		}
	}

	return generateLink(query)
})
.then((data) => {
	console.log(util.inspect(data, {depth: null}))
})
.catch(console.error)
