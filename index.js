'use strict'

const {DateTime} = require('luxon')
const merge = require('lodash.merge')
const debug = require('debug')('generate-db-shop-urls')

const request = require('./lib/request')
const parse = require('./lib/parse')
const compareJourney = require('./lib/compare-journey')
const {showDetails} = require('./lib/helpers')

const isProduction = process.env.NODE_ENV !== 'production'
const timezone = 'Europe/Berlin'
const locale = 'de-DE'

const isObj = o => o !== null && 'object' === typeof o && !Array.isArray(o)

const isISO8601String = str => 'string' === typeof str && !Number.isNaN(+new Date(str))

const validateJourney = (j, name) => {
	if (!isObj(j)) throw new Error(name + ' must be an object.')
	const invalid = new Error(name + ' is invalid.')
	if (j.type !== 'journey' || !Array.isArray(j.legs) || !j.legs.length) throw invalid
	const firstLeg = j.legs[0]
	if (!firstLeg.origin || !isISO8601String(firstLeg.departure)) throw invalid
	const lastLeg = j.legs[j.legs.length - 1]
	if (!lastLeg.destination || !isISO8601String(lastLeg.arrival)) throw invalid
	const orig = firstLeg.origin
	if (isObj(orig) && orig.type !== 'station' && orig.type !== 'stop') {
		throw new Error(name + '.origin must be a station/stop.')
	}
	const dest = lastLeg.destination
	if (isObj(dest) && dest.type !== 'station' && dest.type !== 'stop') {
		throw new Error(name + '.destination must be a station/stop.')
	}
}

const formatDate = (d) => {
	return DateTime
	.fromISO(d, {zone: timezone, locale})
	.toFormat('ccc, dd.MM.yy')
}
const formatTime = (d) => {
	return DateTime
	.fromISO(d, {zone: timezone, locale})
	.toFormat('HH:mm')
}

const defaults = {
	class: '2', // '1' or '2'
	bahncard: '0', // no bahncard (see https://gist.github.com/juliuste/202bb04f450a79f8fa12a2ec3abcd72d)
	age: 40, // age of the traveller
	returning: null // no return journey
}

const link = (outbound, opt) => {
	const options = merge({}, defaults, opt || {})

	validateJourney(outbound, 'outbound')

	const orig = outbound.legs[0].origin
	const originId = orig.station && orig.station.id || orig.id || orig
	const lastOutboundLeg = outbound.legs[outbound.legs.length - 1]
	const dest = lastOutboundLeg.destination
	const destinationId = dest.station && dest.station.id || dest.id || dest

	if (options.returning) {
		validateJourney(options.returning, 'opt.returning')

		const rOrig = options.returning.legs[0].origin
		const rOrigId = rOrig.station && rOrig.station.id || rOrig.id || rOrig
		if (destinationId !== rOrigId) {
			throw new Error('origin.destination !== opt.returning.orgin.')
		}
		if (new Date(lastOutboundLeg.plannedArrival) > new Date(options.returning.legs[0].plannedDeparture)) {
			throw new Error('origin.destination !== opt.returning.orgin.')
		}
	}

	if (!['1', '2'].includes(options.class)) {
		throw new Error('opt.class must be `1` or `2`.')
	}
	if (typeof options.bahncard !== 'string' || options.bahncard.length > 1 || options.bahncard.length > 2) {
		throw new Error('opt.bahncard is invalid.')
	}
	if (typeof options.age !== 'number' || options.age < 0 || options.age > 200) {
		throw new Error('opt.age is invalid.')
	}

	const req = {
		seqnr: '1',
		// WAT. Their API fails if `S` is missing, even though the ID in
		// `REQ0JourneyStopsSID` overrides whatever is in `S`. Same for
		// `Z` and `REQ0JourneyStopsZID`.
		S: 'foo',
		// todo: support POIs and addresses
		REQ0JourneyStopsSID: 'A=1@L=00' + originId,
		Z: 'bar',
		REQ0JourneyStopsZID: 'A=1@L=00' + destinationId,
		date: formatDate(outbound.legs[0].departure),
		time: formatTime(outbound.legs[0].departure),
		returnDate: options.returning ? formatDate(options.returning.legs[0].departure) : '',
		returnTime: options.returning ? formatTime(options.returning.legs[0].departure) : '',
		existOptimizePrice: '1',
		country: 'DEU',
		start: '1',
		REQ0JourneyStopsS0A: '1',
		timesel: 'depart',
		returnTimesel: 'depart',
		optimize: '0',
		auskunft_travelers_number: '1',
		'tariffTravellerType.1': 'E',
		'tariffTravellerReductionClass.1': options.bahncard,
		'tariffTravellerAge.1': options.age,
		tariffClass: options.class,
		rtMode: 'DB-HYBRID',
		HWAI: showDetails(false)
	}
	debug('request', req)

	const {data, cookies} = await request('https://reiseauskunft.bahn.de/bin/query.exe/dn', req)
	const results = parse(outbound, options.returning, false)(data)

	let result = results.find((f) => {
		return compareJourney(outbound, options.returning, f.journey, false)
	})
	// todo: return `null` instead?
	if (!result) throw new Error('no matching outbound journey found')
	debug('outbound next step', result.nextStep)

	if (options.returning) {
		const {data} = await request(result.nextStep, null, cookies)
		const results = parse(outbound, options.returning, true)(data)

		result = results.find((f) => {
			return compareJourney(outbound, options.returning, f.journey, true)
		})
		// todo: return `null` instead?
		if (!result) throw new Error('no matching returning journey found')
		debug('returning next step', result.nextStep)
	}

	return result.nextStep
}

module.exports = link
