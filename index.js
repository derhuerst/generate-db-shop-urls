'use strict'

const moment = require('moment-timezone')

const request = require('./lib/request')
const parse = require('./lib/parse')

const convertDate = (d) => {
	return moment.tz(+d, 'Europe/Berlin').locale('de')
}

const link = (data) => {
	const departure = moment.tz(+data.departure, 'Europe/Berlin').locale('de')
	const _return = data.return ? convertDate(data.return) : null

	const req = {
		S: data.from.name,
		REQ0JourneyStopsSID: 'L=00' + data.from.id,
		Z: data.to.name,
		REQ0JourneyStopsZID: 'L=00' + data.to.id,
		date: departure.format('dd, DD.MM.YY'),
		time: departure.format('HH:mm'),
		returnDate: _return ? _return.format('dd, DD.MM.YY') : '',
		returnTime: _return ? _return.format('HH:mm') : '',
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
		tariffClass: '2',
		rtMode: 'DB-HYBRID'
	}

	return request('https://reiseauskunft.bahn.de/bin/query.exe/dn', req)
	.then(parse(data))
}

module.exports = link
