'use strict'

const slugg = require('slugg')
const trim = require('trim-newlines')
const cheerio = require('cheerio')
const {fetch} = require('fetch-ponyfill')()
const ct = require('content-type')
const {decode} = require('iconv-lite')

const operator = {type: 'operator', id: 'db', name: 'Deutsche Bahn'}

const parseLegs = ($) => (data, row) => {
	const classes = (row.attribs.class || '').split(/\s+/)
	const {journey} = data
	let leg = journey.legs[data.i]

	if (classes.includes('first')) {
		const i = classes.find((c) => /^\d+$/.test(c))
		if (!i) return data
		data.i = parseInt(i)

		if (!leg) leg = journey.legs[data.i] = {public: true, operator}

		const station = trim($('.station', row).text().trim())
		leg.origin = {
			type: 'station',
			id: slugg(station), // todo
			name: station
		}

		// todo: when, delay
	} else if (classes.includes('last')) {
		const station = trim($('.station', row).text().trim())
		leg.destination = {
			type: 'station',
			id: slugg(station), // todo
			name: station
		}

		// todo: when, delay
	}

	return data
}

const parseJourney = (html) => {
	const $ = cheerio.load(html)

	return $('.result')
	.find('tr')
	.get()
	.reduce(parseLegs($), {
		i: null,
		journey: {
			type: 'journey',
			id: 'foo', // todo
			legs: []
		}
	})
	.journey
}

const fetchJourney = (link) => {
	return fetch(link, {
		cache: 'no-store',
		redirect: 'follow',
		headers: {
			'user-agent': 'https://github.com/derhuerst/generate-db-shop-urls'
		}
	})
	.then((res) => {
		if (!res.ok) throw new Error('response not ok: ' + res.status)

		const c = ct.parse(res.headers.get('content-type'))
		if (c.parameters && c.parameters.charset) {
			return res.buffer()
			.then((raw) => decode(raw, 'ISO-8859-1'))
		}

		return res.buffer()
		.then((raw) => raw.toString('utf8'))
	})
	.then(parseJourney)
}

module.exports = fetchJourney
