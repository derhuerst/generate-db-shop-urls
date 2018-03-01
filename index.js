'use strict'

const {DateTime} = require('luxon')

const request = require('./lib/request')
const parse = require('./lib/parse')
const compareJourney = require('./lib/compare-journey')
const {showDetails} = require('./lib/helpers')

const formatDate = (d) => {
	return DateTime.fromISO(d, {
		zone: 'Europe/Berlin',
		locale: 'de-DE'
	}).toFormat('ccc, dd.MM.yy')
}
const formatTime = (d) => {
	return DateTime.fromISO(d, {
		zone: 'Europe/Berlin',
		locale: 'de-DE'
	}).toFormat('HH:mm')
}

const link = (outbound, returning) => {
	if (!outbound) throw new Error('missing trip')

	const req = {
		seqnr: '1',
		// WAT. Their API fails if `S` is missing, even though the ID in
		// `REQ0JourneyStopsSID` overrides whatever is in `S`. Same for
		// `Z` and `REQ0JourneyStopsZID`.
		S: 'foo',
		// todo: support POIs and addresses
		REQ0JourneyStopsSID: 'A=1@L=00' + (outbound.origin.id || outbound.origin),
		Z: 'bar',
		REQ0JourneyStopsZID: 'A=1@L=00' + (outbound.destination.id || outbound.destination),
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
