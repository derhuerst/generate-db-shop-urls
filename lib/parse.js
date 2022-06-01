'use strict'

const moment = require('moment-timezone')
const {strictEqual} = require('assert')
const slugg = require('slugg')
const trim = require('trim-newlines')
const cheerio = require('cheerio')
const url = require('url')
const qs = require('querystring')
const debug = require('debug')('generate-db-shop-urls:parse')

const {showDetails} = require('./helpers')

const nextStepLink = (outbound, returning, $, row) => {
	const href = $(".buttonbold", row).attr("href")
	if (!href) return null

	const u = url.parse(href, true)
	u.query.HWAI = showDetails(true)
	delete u.search

	return url.format(u)
}

const parseTime = (base, str) => {
	const match = /(\d{2}):(\d{2})/.exec(str)
	if (!match || !match[1] || !match[2]) return null

	base = moment.tz(base, 'Europe/Berlin')
	const dt = moment(base).tz('Europe/Berlin')
	.hours(parseInt(match[1]))
	.minutes(parseInt(match[2]))
	if (dt < base) dt.add(1, 'days')
	return dt.toISOString()
}
strictEqual(parseTime('2020-04-08T17:16Z', 'ab 20:53 '), '2020-04-08T18:53:00.000Z')
strictEqual(parseTime('2020-04-08T19:16Z', 'an 23:53 \n'), '2020-04-08T21:53:00.000Z')
strictEqual(parseTime('2020-04-08T19:16Z', '00:12'), '2020-04-08T22:12:00.000Z')

const parseWhen = (base, node) => {
	const timeNode = node.get(0).childNodes.find(n => n.type === 'text')
	const plannedWhen = parseTime(base, (timeNode || {}).data || '')
	const when = parseTime(base, node.find('.delay, .delayOnTime').text() || '')

	let delay = null
	if (when && plannedWhen) {
		delay = Math.round((new Date(when) - new Date(plannedWhen)) / 1000)
	}
	return {plannedWhen, when, delay}
}

const parseJourneyIdFromAlarmLink = (link) => {
	const u = new URL(link)
	return u.searchParams.get('ident') || null
}

const parseLegs = (outbound, returning, isReturn, $) => (data, row) => {
	const classes = (row.attribs.class || '').split(/\s+/)
	if (classes.includes('intermediate')) return data // skip walking etc.

	const isFirstOfLeg = classes.includes('sectionDeparture')
	const isLastOfLeg = classes.includes('sectionArrival')
	
	let leg
	if (isFirstOfLeg) {
		// create new leg
		leg = {public: true}
	} else {
		// get last added leg
		leg = data.journey.legs[data.journey.legs.length - 1]
	}

	if (isFirstOfLeg || isLastOfLeg) {
		const station = trim($('.station', row).text().trim().split(/\n+/)[0])
		leg[isFirstOfLeg ? 'origin' : 'destination'] = {
			type: 'station',
			id: null,
			name: station
		}

		const platform = $('.platform', row).text().trim().split(/\s+/)[1]
		// todo: prognosedPlatform?
		leg[isFirstOfLeg ? 'departurePlatform' : 'arrivalPlatform'] = platform

		const base = isReturn
			? returning.legs[0].plannedDeparture
			: outbound.legs[0].plannedDeparture
		// todo: base might be *after* the date/time to parse, or `null`
		const {when, plannedWhen, delay} = parseWhen(base, $('.time', row))
		// todo: cancelled, prognosedWhen
		leg[isFirstOfLeg ? 'departure' : 'arrival'] = when
		leg[isFirstOfLeg ? 'plannedDeparture' : 'plannedArrival'] = plannedWhen
		leg[isFirstOfLeg ? 'departureDelay' : 'arrivalDelay'] = delay
	}

	if (isFirstOfLeg) {
		leg.lines = $('.products a', row).get()
		.map((l) => {
			const name = $(l).text().trim().replace(/\s+/, ' ')
			return {type: 'line', id: slugg(name), name}
		})
		.filter(l => !!l.id && !!l.name)
	}

	if (isFirstOfLeg) {
		data.journey.legs.push(leg)
	}

	return data
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
	const stationOptions = $('.stationInfo select option', row).get()
	for (let l of stationOptions) {
		const name = trim($(l).text().trim())

		if (!l.attribs.href) continue
		// https://data.deutschebahn.com/dataset/data-haltestellen.html
		// todo: translate to HAFAS/IBNR
		const betreiberNr = l.attribs.value
		if (!betreiberNr) continue
		tagStationInJourney(journey, name, betreiberNr)
	}
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

	return $('.scheduledCon, .liveCon', '#resultsOverviewContainer').get()
	.map((row, journeyI) => {
		const nextStep = nextStepLink(outbound, returning, $, row)
		if (!nextStep) return null

		const journey = $('.details .connectionDetails li', row).get()
		.reduce(parseLegs(outbound, returning, isReturn, $), {
			journey: {
				type: 'journey',
				id: (isReturn ? 'returning' : 'outbound') + '-' + journeyI, // todo
				legs: []
			}
		})
		.journey

		tagStations($, row, journey)

		// todo: rename discount -> totalDiscount, price -> totalPrice
		const discount = parsePrice($('.farePep .fareOutput', row).text())
		const price = parsePrice($('.fareStd .fareOutput', row).text())
		if (!discount.amount && !price.amount) return null
		journey.price = price
		journey.discount = discount

		const firstLeg = journey.legs[0]
		journey.origin = firstLeg?.origin
		journey.departure = firstLeg?.departure
		journey.plannedDeparture = firstLeg?.plannedDeparture
		journey.departureDelay = firstLeg?.departureDelay
		// todo: prognosedDeparture

		const lastLeg = journey.legs[journey.legs.length - 1]
		journey.destination = lastLeg?.destination
		journey.arrival = lastLeg?.arrival
		journey.plannedArrival = lastLeg?.plannedArrival
		journey.arrivalDelay = lastLeg?.arrivalDelay
		// todo: prognosedArrival

		return {journey, nextStep}
	})
	.filter((j) => !!j)
}

module.exports = parse
