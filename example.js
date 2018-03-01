'use strict'

const util = require('util')
const {journeys} = require('db-hafas')

const generateLink = require('.')
const when = require('./test/when') // Monday in a week, 10am

// Berlin -> Hamburg, Hamburg -> Berlin
const outbound = journeys('008011160', '008096009', {when: when.outbound, results: 1})
const returning = journeys('008096009', '008011160', {when: when.returning, results: 1})

Promise.all([outbound, returning])
.then(([outbound, returning]) => generateLink(outbound[0], returning[0]))

.then((data) => {
	console.log(util.inspect(data, {depth: null}))
})
.catch(console.error)
