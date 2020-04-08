'use strict'

const util = require('util')
const createHafas = require('db-hafas')

const generateLink = require('.')
const when = require('./test/when') // Monday in a week, 10am

const berlin = '8011160'
const hamburg = '8096009'
const passau = '8000298'
const paris = '8796001'

const options = {
	bahncard: '0', // bahncard id (0 = no bahncard, see https://gist.github.com/juliuste/202bb04f450a79f8fa12a2ec3abcd72d)
	class: '2', // '1' or '2'
	age: 40, // age of the traveller
	returning: null // no returning journeys
}

// Berlin -> Hamburg, Hamburg -> Berlin
const hafas = createHafas('generate-db-shop-urls example')
const outbound = hafas.journeys(berlin, hamburg, {
	departure: when.outbound, results: 1
})
const returning = hafas.journeys(hamburg, berlin, {
	departure: when.returning, results: 1
})

Promise.all([outbound, returning])
.then(([outbound, returning]) => {
	options.returning = returning.journeys[0]
	return generateLink(outbound.journeys[0], options)
})

.then((data) => {
	console.log(util.inspect(data, {depth: null}))
})
.catch(console.error)
