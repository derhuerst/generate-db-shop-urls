'use strict'

const floor = require('floordate')

const minute = 60 * 1000
const hour = 60 * minute
const day = 24 * hour
const week = 7 * day

// Monday in a week, 10am
const when = new Date(+floor(new Date(), 'week') + week + 10 * hour)

module.exports = when
