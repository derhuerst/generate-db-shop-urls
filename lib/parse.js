'use strict'

const moment = require('moment-timezone')
const {strictEqual} = require('assert')
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
		const caption = slugg($(link).text().trim())
		return (
			caption === 'ruckfahrt'
			|| caption === 'zur-angebotsauswahl'
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

const parseLegs = (outbound, returning, isReturn, $) => (data, row) => {
	const classes = (row.attribs.class || '').split(/\s+/)
	if (classes.includes('intermediate')) return data // skip walking etc.

	const isFirstOfLeg = classes.includes('first')
	const isLastOfLeg = classes.includes('last')
	let leg = data.journey.legs[data.i]

	if (isFirstOfLeg) {
		const i = parseInt(classes.find((c) => /^\d+$/.test(c)))
		if (Number.isNaN(i)) return data

		leg = data.journey.legs[i] = {public: true}
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

	return $('.scheduledCon, .liveCon', '#resultsOverview').get()
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
		journey.plannedDeparture = firstLeg && firstLeg.plannedDeparture
		journey.departureDelay = firstLeg && firstLeg.departureDelay
		// todo: prognosedDeparture

		const lastLeg = journey.legs[journey.legs.length - 1]
		journey.destination = lastLeg && lastLeg.destination
		journey.arrival = lastLeg && lastLeg.arrival
		journey.plannedArrival = lastLeg && lastLeg.plannedArrival
		journey.arrivalDelay = lastLeg && lastLeg.arrivalDelay
		// todo: prognosedArrival

		return {journey, nextStep}
	})
	.filter((j) => !!j)
}

module.exports = parse
