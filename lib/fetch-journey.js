'use strict'

const moment = require('moment-timezone')
const slugg = require('slugg')
const trim = require('trim-newlines')
const cheerio = require('cheerio')

const request = require('./request')

const parseTime = (base, str) => {
	const time = /(\d{2}):(\d{2})/.exec(str)
	const delay = /\+(\d+)/.exec(str)

	let when = null
	if (time && time[1] && time[2]) {
		when = moment.tz(base, 'Europe/Berlin')
		.tz('Europe/Berlin')
		.hours(time[1])
		.minutes(time[2])
		if (when < base) when.add(1, 'days')
	}

	return {
		when: when.toISOString(),
		delay: delay ? parseInt(delay[1]) * 60 : null,
	}
}

const operator = {type: 'operator', id: 'db', name: 'Deutsche Bahn'}

const parseLegs = (query, $) => (data, row) => {
	const classes = (row.attribs.class || '').split(/\s+/)
	const isFirst = classes.includes('first')
	const isLast = classes.includes('last')

	let leg = data.journey.legs[data.i]
	if (isFirst) {
		const i = parseInt(classes.find((c) => /^\d+$/.test(c)))
		if (isNaN(i)) return data

		leg = data.journey.legs[i] = {public: true, operator}
		data.i = i
	}

	if (isFirst || isLast) {
		const station = trim($('.station', row).text().trim())
		leg[isFirst ? 'origin' : 'destination'] = {
			type: 'station',
			id: slugg(station), // todo
			name: station
		}

		const base = query.departure // todo: what about return trip?
		const {when, delay} = parseTime(base, $('.time', row).text())
		// todo: set delay here
		leg[isFirst ? 'departure' : 'arrival'] = when
	}

	return data
}

const parseJourney = (query) => (html) => {
	const $ = cheerio.load(html)

	return $('.result')
	.find('tr')
	.get()
	.reduce(parseLegs(query, $), {
		i: null,
		journey: {
			type: 'journey',
			id: 'foo', // todo
			legs: []
		}
	})
	.journey
}

const fetchJourney = (query, link) => {
	return request(link)
	.then(parseJourney(query))
}

module.exports = fetchJourney
