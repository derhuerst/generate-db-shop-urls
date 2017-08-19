'use strict'

const floor = require('floordate')

const minute = 60 * 1000
const hour = 60 * minute
const day = 24 * hour

// note that the JS week beings with Sunday

// Monday of next week, 10am
const outbound = new Date(+floor(new Date(), 'week') + 8 * day + 10 * hour)
// Tuesday of next week, 8am
const returning = new Date(+floor(new Date(), 'week') + 9 * day + 8 * hour)

module.exports = {outbound, returning}
