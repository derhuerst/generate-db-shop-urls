'use strict'

const {DateTime} = require('luxon')
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
	const invalid = new Error(name + ' must be a valid FPTF 1.1.1 journey.')
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

const link = (outbound, returning) => {
	validateJourney(outbound, 'outbound')

	const orig = outbound.legs[0].origin
	const originId = orig.station && orig.station.id || orig.id || orig
	const dest = outbound.legs[outbound.legs.length - 1].destination
	const destinationId = dest.station && dest.station.id || dest.id || dest

	if (returning) {
		validateJourney(returning, 'returning')

		const rOrig = returning.legs[0].origin
		const rOrigId = rOrig.station && rOrig.station.id || rOrig.id || rOrig
		if (destinationId !== rOrigId) {
			throw new Error('origin.destination !== returning.orgin.')
		}
		if (new Date(outbound.arrival) > new Date(returning.departure)) {
			throw new Error('origin.destination !== returning.orgin.')
		}
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
		returnDate: returning ? formatDate(returning.legs[0].departure) : '',
		returnTime: returning ? formatTime(returning.legs[0].departure) : '',
		existOptimizePrice: '1',
		country: 'DEU',
		start: '1',
		REQ0JourneyStopsS0A: '1',
		timesel: 'depart',
		returnTimesel: 'depart',
		optimize: '0',
		auskunft_travelers_number: '1',
		'tariffTravellerType.1': 'E',
		'tariffTravellerReductionClass.1': '2',
		tariffClass: '2', // todo
		rtMode: 'DB-HYBRID',
		HWAI: showDetails(false)
	}
	debug('request', req)

	const onOutbound = ({data, cookies}) => {
		const results = parse(outbound, returning, false)(data)
		const result = results.find((f) => {
			return compareJourney(outbound, returning, f.journey, false)
		})
		if (!result) throw new Error('no matching outbound journey found')

		debug('outbound next step', result.nextStep)
		if (!returning) return result.nextStep
		return request(result.nextStep, null, cookies)
		.then(onReturning)
	}

	const onReturning = ({data}) => {
		const results = parse(outbound, returning, true)(data)
		const result = results.find((f) => {
			return compareJourney(outbound, returning, f.journey, true)
		})
		if (!result) throw new Error('no matching returning journey found')

		debug('returning next step', result.nextStep)
		return result.nextStep
	}

	return request('https://reiseauskunft.bahn.de/bin/query.exe/dn', req)
	.then(onOutbound)
}

module.exports = link
