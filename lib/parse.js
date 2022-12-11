'use strict'

const slugg = require('slugg')
const {strictEqual} = require('assert')
const moment = require('moment-timezone')
const {createHash} = require('crypto')
const trim = require('trim-newlines')
const cheerio = require('cheerio')
const url = require('url')
const debug = require('debug')('generate-db-shop-urls:parse')

const evaNrsByBetreiberNrs = require('./eva-nrs-by-betreiber-nrs.json')
const {showDetails} = require('./helpers')

const getEvaNrByBetreiberNr = (betreiberNr, name) => {
	const byName = evaNrsByBetreiberNrs[betreiberNr]
	if (!byName) return null

	for (const [_name, evaNr] of Object.entries(byName)) {
		if (slugg(_name) === slugg(name)) return evaNr
	}
	return null
}
strictEqual(getEvaNrByBetreiberNr('1071', 'Berlin Hbf'), '8011160')
strictEqual(getEvaNrByBetreiberNr('1071', 'Berlin Hbf (tief)'), '8098160')
strictEqual(getEvaNrByBetreiberNr('1071', 'Berlin Hbf (S-Bahn)'), '8089021')
strictEqual(getEvaNrByBetreiberNr('1071', 'Berlin Hbf (foo)'), null)
strictEqual(getEvaNrByBetreiberNr('bar', 'Berlin Hbf (foo)'), null)

const nextStepLink = (outbound, returning, $, row) => {
	const href = $(".buttonbold", row).attr("href")
	if (!href) return null

	const u = url.parse(href, true)
	u.query.HWAI = showDetails(true)
	delete u.search

	return url.format(u)
}

const parseDate = (str) => {
	const match = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(str)
	if (!match) return null
	return [
		// year
		('20' + match[3]).slice(-4),
		// month
		('0' + match[2]).slice(-2),
		// day of the month
		('0' + match[1]).slice(-2),
	].join('-')
}
strictEqual(parseDate(' 24.12.22 '), '2022-12-24')
strictEqual(parseDate('3.3.23\n'), '2023-03-03')

const parseTime = (isoDate, str, tBase = 0) => {
	const match = /(\d{2}):(\d{2})/.exec(str)
	if (!match || !match[1] || !match[2]) return null

	const _ = moment.tz(isoDate + 'T00:00Z', 'Europe/Berlin')
	const dt = moment(_).tz('Europe/Berlin')
	.hours(parseInt(match[1]))
	.minutes(parseInt(match[2]))
	if (dt < tBase) dt.add(1, 'days')
	return dt.toISOString()
}
strictEqual(parseTime('2020-04-08', 'ab 20:53 '), '2020-04-08T18:53:00.000Z')
strictEqual(parseTime('2020-04-08', 'an 23:53 \n'), '2020-04-08T21:53:00.000Z')
strictEqual(parseTime('2020-04-08', '00:12'), '2020-04-07T22:12:00.000Z')
strictEqual(
	parseTime('2020-04-08', '00:12', Date.parse('2020-04-08T04:00:00Z')),
	'2020-04-08T22:12:00.000Z',
)

const createParseWhen = (tBase = 0) => {
	const parseWhen = (isoDate, node) => {
		const timeNode = node.get(0).childNodes.find(n => n.type === 'text')
		const plannedWhen = parseTime(isoDate, (timeNode || {}).data || '', tBase)
		const when = parseTime(
			isoDate,
			node.find('.delay, .delayOnTime').text() || '',
			tBase,
		)

		let delay = null
		if (when && plannedWhen) {
			delay = Math.round((new Date(when) - new Date(plannedWhen)) / 1000)
		}
		tBase = Date.parse(plannedWhen)
		return {plannedWhen, when, delay}
	}
	return parseWhen
}
// todo: assert

const irrelevantBookingLinkParams = [
	'protocol',
	'ident',
	'bcrvglpreis',
	'services',
	'showAvail',
]
const parseJourneyIdFromBookingLink = (link) => {
	const u = new URL(link)
	const p = Array.from(u.searchParams.entries())
	.filter(([k]) => !irrelevantBookingLinkParams.includes(k))
	.sort(([kA, kB]) => kA < kB ? -1 : (kA > kB ? 1 : 0))
	return createHash('sha1')
	.update(new URLSearchParams(p).toString())
	.digest('hex')
}
strictEqual(
	parseJourneyIdFromBookingLink(`\
https://reiseauskunft.bahn.de/bin/query.exe/dn?ld=43121&protocol=https:&seqnr=1&ident=1j.020193121.1654088623&rt=1&rememberSortType=minDeparture&sTID=C0-1.0@1&oCID=C0-1&orderSOP=yes&showAvail=yes&completeFulfillment=1&hafasSessionExpires=0106221518&zielorth=Hanau&zielortb=rheinmain&zielorta=DEU&xcoorda=8929003&ycoorda=50120957&distancea=193&zielortm=Hanau%20Hbf&services=hbma&bcrvglpreis=8260&HWAI=SELCON!lastsel=C0-1!&`
	),
	createHash('sha1')
	.update(`\
HWAI=SELCON%21lastsel%3DC0-1%21&orderSOP=yes&ld=43121&seqnr=1&rt=1&rememberSortType=minDeparture&sTID=C0-1.0%401&oCID=C0-1&completeFulfillment=1&hafasSessionExpires=0106221518&zielorth=Hanau&zielortb=rheinmain&zielorta=DEU&xcoorda=8929003&ycoorda=50120957&distancea=193&zielortm=Hanau+Hbf`)
	.digest('hex'),
)

const parseLegs = (outbound, returning, isReturn, $, isoDate, parseWhen) => (data, row) => {
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

		const {when, plannedWhen, delay} = parseWhen(isoDate, $('.time', row))
		// todo: cancelled, prognosedWhen
		leg[isFirstOfLeg ? 'departure' : 'arrival'] = when
		leg[isFirstOfLeg ? 'plannedDeparture' : 'plannedArrival'] = plannedWhen
		leg[isFirstOfLeg ? 'departureDelay' : 'arrivalDelay'] = delay
	}

	if (isFirstOfLeg) {
		leg.lines = $('.products a', row).get()
		.map((l) => {
			let name = $(l).text().trim().replace(/\s+/, ' ')
			let fahrtNr = null
			if (name.includes('(')) {
				const m = /^([\w\s]+)\s\(([^)]+)\)$/.exec(name)
				if (m) {
					name = m[1]
					fahrtNr = m[2]
				}
			}
			return {
				type: 'line',
				id: slugg(fahrtNr || name),
				name,
				fahrtNr,
			}
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
		const betreiberNr = l.attribs.value
		if (!betreiberNr) continue
		const name = trim($(l).text().trim())

		const evaNr = getEvaNrByBetreiberNr(betreiberNr, name)
		if (!evaNr) continue

		debug(`translating Betreiber-Nr "${betreiberNr}" & name "${name}" to EVA ID "${evaNr}"`)
		tagStationInJourney(journey, name, evaNr)
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

	// Within the markup, (wall clock) times implicitly refer to different "base" dates.
	let isoDate = parseDate($('#tp_overview_headline_date').text())
	let tBase = 0

	return $('.scheduledCon, .liveCon, .dateDividerText', '#resultsOverviewContainer').get()
	.map((row, journeyI) => {
		const $Row = $(row)

		if ($Row.hasClass('dateDividerText')) {
			isoDate = parseDate($Row.text())
			tBase = +moment.tz(isoDate + 'T00:00', 'Europe/Berlin')
			debug(`using ${tBase} (${isoDate}) as tBase from here`)
			return null // skip row
		}
		const parseWhen = createParseWhen(tBase)

		const nextStep = nextStepLink(outbound, returning, $, row)
		if (!nextStep) {
			debug('journey without next step (booking link)', journeyI)
			return null
		}

		const bookingLink = nextStep // todo
		const id = (
			bookingLink && parseJourneyIdFromBookingLink(bookingLink)
			|| (isReturn ? 'returning' : 'outbound') + '-' + journeyI
		)

		const journey = $('.details .connectionDetails li', row).get()
		.reduce(parseLegs(outbound, returning, isReturn, $, isoDate, parseWhen), {
			journey: {
				type: 'journey',
				id,
				legs: []
			}
		})
		.journey

		if (journey.legs.length === 0) {
			debug('journey with 0 legs, ignoring', journeyI, journey)
			return null
		}

		tagStations($, row, journey)

		// todo: rename discount -> totalDiscount, price -> totalPrice
		const discount = parsePrice($('.farePep .fareOutput', row).text())
		const price = parsePrice($('.fareStd .fareOutput', row).text())
		if (!discount.amount && !price.amount) return null
		journey.price = price
		journey.discount = discount

		return {journey, nextStep}
	})
	.filter((j) => !!j)
}

module.exports = parse
