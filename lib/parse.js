'use strict'

const cheerio = require('cheerio')
const slugg = require('slugg')
const trim = require('trim-newlines')
const url = require('url')
const qs = require('querystring')

const fetchJourney = require('./fetch-journey')

const ticketLink = ($, row) => {
	return $(row)
	.find('a[href]')
	.filter((i, link) => {
		return (
			slugg($(link).text().trim()) === 'ruckfahrt'
			|| slugg($(link).text().trim()) === 'zur-angebotsauswahl'
		)
	})
	.attr('href') || null
}

const detailsLink = ($, row, i) => {
	const base = $(row)
	.find('a[href^="https://reiseauskunft.bahn.de/"]')
	.filter((i, link) => {
		return slugg($(link).text().trim()) === 'details-einblenden'
	})
	.attr('href')

	if (!base) return null
	const u = url.parse(base, true)
	u.query.HWAI = `CONNECTION$C0-${i}!id=C0-${i}!HwaiConId=C0-${i}!HwaiDetailStatus=details!`
	u.query.ajax = '1'
	// seqnr: '2',
	// ident: 'bq.01736594.1493850490',
	// rt: '1',
	// rememberSortType: 'minDeparture',
	u.search = '?' + qs.stringify(u.query)
	return url.format(u)
}

const parse = (query) => (html) => {
	const $ = cheerio.load(html)

	const tasks = $('#resultsOverview .scheduledCon').get()
	.reduce((tasks, row, i) => {
		const ticket = ticketLink($, row)
		if (!ticket) return tasks

		const details = detailsLink($, row, tasks.length)
		if (!details) return tasks

		const discount = trim($('.farePep .fareOutput', row).text()) || null
		const price = trim($('.fareStd .fareOutput', row).text()) || null
		if (!discount && !price) return tasks

		const duration = trim($('.duration', row).text()) || null // todo: parse

		const task = fetchJourney(query, details)
		.then((journey) => {
			journey.price = {amount: price, currency: 'EUR', link: ticket}
			journey.discount = {amount: discount, currency: 'EUR', link: ticket}
			journey.duration = duration

			return journey
		})

		tasks.push(task)
		return tasks
	}, [])

	return Promise.all(tasks)
}

module.exports = parse
