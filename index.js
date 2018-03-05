'use strict'

const {DateTime} = require('luxon')

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
	if (
		j.type !== 'journey' ||
		!j.origin ||
		!isISO8601String(j.departure) ||
		!j.destination ||
		!isISO8601String(j.arrival) ||
		!Array.isArray(j.legs) || j.legs.length === 0
	) {
		throw new Error(name + ' must be a valid FPTF 1.0.1 journey.')
	}
	if (isObj(j.origin) && j.origin.type !== 'station') {
		throw new Error(name + '.origin must be a station.')
	}
	if (isObj(j.destination) && j.destination.type !== 'station') {
		throw new Error(name + '.destination must be a station.')
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
	if (isProduction) {
		validateJourney(outbound, 'outbound')
		var originId = outbound.origin.id || outbound.origin
		var destinationId = outbound.destination.id || outbound.destination
		if (returning) {
			validateJourney(returning, 'returning')
			const returningOriginId = returning.origin.id || returning.origin
			if (destinationId !== returningOriginId) {
				throw new Error('origin.destination !== returning.orgin.')
			}
			if (new Date(outbound.arrival) > new Date(returning.departure)) {
				throw new Error('origin.destination !== returning.orgin.')
			}
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
		date: formatDate(outbound.departure),
		time: formatTime(outbound.departure),
		returnDate: returning ? formatDate(returning.departure) : '',
		returnTime: returning ? formatTime(returning.departure) : '',
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

	const onOutbound = ({data, cookies}) => {
		const results = parse(outbound, returning, false)(data)
		const result = results.find((f) => {
			return compareJourney(outbound, returning, f.journey, false)
		})
		if (!result) throw new Error('no matching outbound journey found')

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

		return result.nextStep
	}

	return request('https://reiseauskunft.bahn.de/bin/query.exe/dn', req)
	.then(onOutbound)
}

module.exports = link
