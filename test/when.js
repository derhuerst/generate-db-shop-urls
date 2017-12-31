'use strict'

const {DateTime} = require('luxon')

const createWhen = (days = 0, hours = 0) => {
	return DateTime.fromMillis(Date.now(), {
		zone: 'Europe/Berlin',
		locale: 'de-DE',
	})
	.startOf('week')
	.plus({weeks: 1, days, hours})
	.toJSDate()
}

const outbound = createWhen(0, 10) // Monday of next week, 10am
const returning = createWhen(1, 8) // Tuesday of next week, 8am

module.exports = {outbound, returning}
