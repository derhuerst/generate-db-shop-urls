'use strict'

const moment = require('moment-timezone')
const slugg = require('slugg')
const trim = require('trim-newlines')
const cheerio = require('cheerio')
const url = require('url')
const qs = require('querystring')

const {showDetails} = require('./helpers')

const nextStepLink = (outbound, returning, $, row) => {
	const href = $(row)
	.find('a[href]')
	.filter((i, link) => {
		return (
			slugg($(link).text().trim()) === 'ruckfahrt'
			|| slugg($(link).text().trim()) === 'zur-angebotsauswahl'
		)
	})
	.attr('href')
	if (!href) return null

	const u = url.parse(href, true)
	u.query.HWAI = showDetails(true)
	delete u.search

	return url.format(u)
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

const parseLegs = (outbound, returning, isReturn, $) => (data, row) => {
	const classes = (row.attribs.class || '').split(/\s+/)
	if (classes.includes('intermediate')) return data // skip walking etc.

	const isFirstOfLeg = classes.includes('first')
	const isLastOfLeg = classes.includes('last')
	let leg = data.journey.legs[data.i]

	if (isFirstOfLeg) {
		const i = parseInt(classes.find((c) => /^\d+$/.test(c)))
		if (Number.isNaN(i)) return data

		leg = data.journey.legs[i] = {public: true, operator}
		data.i = i
	}

	if (isFirstOfLeg || isLastOfLeg) {
		const station = trim($('.station', row).text().trim())
		leg[isFirstOfLeg ? 'origin' : 'destination'] = {
			type: 'station',
			id: null,
			name: station
		}

		const platform = trim($('.platform', row).text().trim())
		leg[isFirstOfLeg ? 'departurePlatform' : 'arrivalPlatform'] = platform

		const base = isReturn ? returning.legs[0].departure : outbound.legs[0].departure
		const {when, delay} = parseTime(base, $('.time', row).text())
		// todo: set delay here
		leg[isFirstOfLeg ? 'departure' : 'arrival'] = when
	}

	if (isFirstOfLeg) {
		leg.lines = $('.products a', row).get()
		.map((l) => {
			const name = $(l).text().trim().replace(/\s+/, ' ')
			return {type: 'line', id: slugg(name), name}
		})
	}

	return data
}

const parseIdFromStationLink = (link) => {
	const u = url.parse(link, true)
	const q = qs.parse(u.query.HWAI || '', '!')
	return q.HwaiBhfinfoStatus || null
}

const parseIdFromPrintLink = (link) => {
	const u = url.parse(link, true)
	return u.query.currentBhfInfoId || null
}

const tagStationInJourney = (journey, name, id) => {
	const normalized = slugg(name)

	// Note: This is almost as brittle as looking through the list of all DB stations and matching by name. Find a better way!
	for (let leg of journey.legs) {
		if (slugg(leg.origin.name) === normalized) leg.origin.id = id
		if (slugg(leg.destination.name) === normalized) leg.destination.id = id
	}
}

const tagStations = ($, row, journey) => {
	const stationLinks = $(`.moreDetail [id^="stInfoLinkC"]`, row).get()
	for (let l of stationLinks) {
		const name = trim($(l).text().trim())

		if (!l.attribs.href) continue
		const id = parseIdFromStationLink(l.attribs.href)
		if (!id) continue

		tagStationInJourney(journey, name, id)
	}

	// resolve id for first station
	const name = trim($(`.moreDetail .activeslider`, row).text().trim())

	const href = $(`.moreDetailContainer .printview`, row).attr('href')
	if (!href) return
	const id = parseIdFromPrintLink(href)
	if (!id) return

	tagStationInJourney(journey, name, id)
}

const parsePrice = (str) => {
	if (!str) return {amount: null, currency: null}
	const m = /(\d+),?(\d+)\s+([A-Z]{3})?/.exec(trim(str.trim()))
	if (m && m[1]) {
		return {
			amount: parseInt(m[1]) + (m[2] ? parseInt(m[2]) * .01 : 0),
			currency: m[3] || 'EUR'
		}
	}
	return {amount: null, currency: null}
}

const parse = (outbound, returning, isReturn) => (html) => {
	const $ = cheerio.load(html)

	return $('#resultsOverview .scheduledCon').get()
	.map((row, journeyI) => {
		const nextStep = nextStepLink(outbound, returning, $, row)
		if (!nextStep) return null

		const journey = $('.details .result tr', row).get()
		.reduce(parseLegs(outbound, returning, isReturn, $), {
			i: null,
			journey: {
				type: 'journey',
				id: (isReturn ? 'returning' : 'outbound') + '-' + journeyI, // todo
				legs: []
			}
		})
		.journey

		journey.legs = journey.legs.filter(l => !!l) // filter skipped legs

		tagStations($, row, journey)

		// todo: rename discount -> totalDiscount, price -> totalPrice
		const discount = parsePrice($('.farePep .fareOutput', row).text())
		const price = parsePrice($('.fareStd .fareOutput', row).text())
		if (!discount.amount && !price.amount) return null
		journey.price = price
		journey.discount = discount

		const firstLeg = journey.legs[0]
		journey.origin = firstLeg && firstLeg.origin
		journey.departure = firstLeg && firstLeg.departure
		const lastLeg = journey.legs[journey.legs.length - 1]
		journey.destination = lastLeg && lastLeg.destination
		journey.arrival = lastLeg && lastLeg.arrival

		return {journey, nextStep}
	})
	.filter((j) => !!j)
}

module.exports = parse
