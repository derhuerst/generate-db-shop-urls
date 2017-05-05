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
	const isFirst = classes.includes('first')
	const isLast = classes.includes('last')

	let leg = data.journey.legs[data.i]
	if (isFirst) {
		const i = parseInt(classes.find((c) => /^\d+$/.test(c)))
		if (isNaN(i)) return data

		leg = data.journey.legs[i] = {public: true, operator}
		data.i = i
	}

	if (isFirst || isLast) {
		const station = trim($('.station', row).text().trim())

		leg[isFirst ? 'origin' : 'destination'] = {
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
