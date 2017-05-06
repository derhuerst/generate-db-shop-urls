'use strict'

const moment = require('moment-timezone')
const slugg = require('slugg')
const trim = require('trim-newlines')
const cheerio = require('cheerio')
const url = require('url')
const qs = require('querystring')

const nextStepLink = ($, row) => {
	return $(row)
	.find('a[href]')
	.filter((i, link) => {
		return (
			slugg($(link).text().trim()) === 'ruckfahrt'
			|| slugg($(link).text().trim()) === 'zur-angebotsauswahl'
		)
	})
	.attr('href') || null
}

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

const parseLegs = (query, isReturn, $) => (data, row) => {
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

		const platform = trim($('.platform', row).text().trim())
		leg[isFirst ? 'departurePlatform' : 'arrivalPlatform'] = platform

		const base = isReturn ? query.return : query.departure
		const {when, delay} = parseTime(base, $('.time', row).text())
		// todo: set delay here
		leg[isFirst ? 'departure' : 'arrival'] = when
	}

	return data
}

const parse = (query, isReturn) => (html) => {
	const $ = cheerio.load(html)

	return $('#resultsOverview .scheduledCon').get()
	.map((row, i) => {
		const nextStep = nextStepLink($, row)
		if (!nextStep) return null

		const journey = $('.details .result tr', row).get()
		.reduce(parseLegs(query, isReturn, $), {
			i: null,
			journey: {
				type: 'journey',
				id: isReturn ? 'forth' : 'back', // todo
				legs: []
			}
		})
		.journey

		const discount = trim($('.farePep .fareOutput', row).text()) || null
		const price = trim($('.fareStd .fareOutput', row).text()) || null
		if (!discount && !price) return null
		journey.price = {amount: price, currency: 'EUR'}
		journey.discount = {amount: discount, currency: 'EUR'}

		const duration = trim($('.duration', row).text()) || null // todo: parse
		journey.duration = duration

		return {journey, nextStep}
	})
	.filter((j) => !!j)
}

module.exports = parse
