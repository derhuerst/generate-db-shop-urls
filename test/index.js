'use strict'

const test = require('tape')
const {journeys} = require('db-hafas')
const cheerio = require('cheerio')

const request = require('../lib/request')
const link = require('..')
const when = require('./when')

const berlin = '008011160'
const hamburg = '008002549'

const isBookingPage = (url) => {
	return request(link, null, null)
	.then((html) => {
		const $ = cheerio.load(html)
		const nextButtons = $('.booking a[href]').get()
		// this is a really really brittle way to tell if the link generation
		// worked, hence if we're on the right page.
		// todo: find a more robust way, compare prices
		return nextButtons.length > 0
	})
}

test('works Berlin Hbf -> Hamburg Hbf', (t) => {
	journeys(berlin, hamburg, {when: when.outbound, results: 1})
	.then(([outbound]) => link(outbound))
	.then(isBookingPage)
	.then((isBookingPage) => {
		t.ok(isBookingPage, 'link is not a booking page')
		t.end()
	})
	.catch(t.ifError)
})

test('works Berlin Hbf -> Hamburg Hbf and back', (t) => {
	Promise.all([
		journeys(berlin, hamburg, {when: when.outbound, results: 1}),
		journeys(hamburg, berlin, {when: when.returning, results: 1})
	])
	.then(([outbound, returning]) => link(outbound[0], returning[0]))
	.then(isBookingPage)
	.then((isBookingPage) => {
		t.ok(isBookingPage, 'link is not a booking page')
		t.end()
	})
	.catch(t.ifError)
})
