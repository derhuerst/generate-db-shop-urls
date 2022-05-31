'use strict'

const createHafas = require('db-hafas')

const generateLink = require('.')
const when = require('./test/when') // Monday in a week, 10am

const berlin = '8011160'
const hamburg = '8096009'
// const passau = '8000298'
// const paris = '8796001'

const hafas = createHafas('generate-db-shop-urls example')

;(async () => {
	// Berlin -> Hamburg, Hamburg -> Berlin
	const outbound = await hafas.journeys(berlin, hamburg, {
		departure: when.outbound, results: 1
	})
	const returning = await hafas.journeys(hamburg, berlin, {
		departure: when.returning, results: 1
	})

	const link = await generateLink(outbound.journeys[0], {
		returning: returning.journeys[0],
	})

	console.log('open the following link in a *private* browsing session (without bahn.de cookies):')
	console.log(link)
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})
