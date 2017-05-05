'use strict'

const moment = require('moment-timezone')
const qs = require('querystring')
const {fetch} = require('fetch-ponyfill')()
const cookie = require('cookie')
const ct = require('content-type')
const {decode} = require('iconv-lite')

const parse = require('./lib/parse')

const endpoint = 'https://reiseauskunft.bahn.de/bin/query.exe/dn'

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
	const target = endpoint + '?' + qs.stringify(req)

	return fetch(target, {
		cache: 'no-store',
		redirect: 'follow',
		headers: {
			'user-agent': 'https://github.com/derhuerst/generate-db-shop-urls'
		}
	})
	.then((res) => {
		if (!res.ok) throw new Error('response not ok: ' + res.status)

		// todo: parse cookies
		// const cookies = {}
		// res.headers.forEach((value, name) => {
		// 	if (name === 'set-cookie') {
		// 		Object.assign(cookies, cookie.parse(value))
		// 	}
		// })
		// console.error(cookies)

		const c = ct.parse(res.headers.get('content-type'))
		if (c.parameters && c.parameters.charset) {
			return res.buffer()
			.then((raw) => decode(raw, 'ISO-8859-1'))
		}

		return res.buffer()
		.then((raw) => raw.toString('utf8'))
	})
	.then(parse)
}

module.exports = link
