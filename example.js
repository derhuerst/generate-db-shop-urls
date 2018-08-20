'use strict'

const util = require('util')
const createHafas = require('db-hafas')

const generateLink = require('.')
const when = require('./test/when') // Monday in a week, 10am

const berlin = '8011160'
const hamburg = '8096009'

// Berlin -> Hamburg, Hamburg -> Berlin
const hafas = createHafas('generate-db-shop-urls example')
const outbound = hafas.journeys(berlin, hamburg, {
	departure: when.outbound, results: 1
})
const returning = hafas.journeys(hamburg, berlin, {
	departure: when.returning, results: 1
})

Promise.all([outbound, returning])
.then(([outbound, returning]) => generateLink(outbound[0], returning[0]))

.then((data) => {
	console.log(util.inspect(data, {depth: null}))
})
.catch(console.error)
