'use strict'

const test = require('tape')
const createHafas = require('db-hafas')
const {join} = require('path')
const {readFileSync} = require('fs')
const cheerio = require('cheerio')

const request = require('../lib/request')
const parse = require('../lib/parse')
const link = require('..')
const when = require('./when')

const berlin = '008011160'
const hamburg = '008002549'
const passau = '8000298'

const hafas = createHafas('generate-db-shop-urls test')

const isBookingPage = (url) => {
	return request(url, null, null)
	.then(({data}) => {
		const $ = cheerio.load(data)
		const nextButton = $('.booking a[href]').get(0)
		const availContinueButton = $('#availContinueButton').get(0)
		// this is a really really brittle way to tell if the link generation
		// worked, hence if we're on the right page.
		// todo: find a more robust way, compare prices
		return nextButton || availContinueButton
	})
}

const koelnMainzOutbound = require('./hafas-koeln-mainz.json')
const koelnMainzHTML = readFileSync(join(__dirname, 'results-koeln-mainz.html'), {encoding: 'utf8'})
const koelnMainzExpected = require('./expected-koeln-mainz.json')
test('parsing works Köln Hbf -> Mainz Hbf', (t) => {
	const res = parse(koelnMainzOutbound, null, false)(koelnMainzHTML)
	// console.error(require('util').inspect(res, {depth: null, colors: true}))
	t.deepEqual(res, koelnMainzExpected)
	t.end()
})

test('works Berlin Hbf -> Hamburg Hbf', (t) => {
	hafas.journeys(berlin, hamburg, {
		departure: when.outbound, results: 1
	})
	.then((outbound) => link(outbound.journeys[0]))
	.then(isBookingPage)
	.then((isBookingPage) => {
		t.ok(isBookingPage, 'link is not a booking page')
		t.end()
	})
	.catch(t.ifError)
})

test('works Berlin Hbf -> Hamburg Hbf and back', (t) => {
	Promise.all([
		hafas.journeys(berlin, hamburg, {
			departure: when.outbound, results: 1
		}),
		hafas.journeys(hamburg, berlin, {
			departure: when.returning, results: 1
		})
	])
	.then(([outbound, returning]) => link(outbound.journeys[0], {returning: returning.journeys[0]}))
	.then(isBookingPage)
	.then((isBookingPage) => {
		t.ok(isBookingPage, 'link is not a booking page')
		t.end()
	})
	.catch(t.ifError)
})

test('works Berlin Hbf -> Passau', (t) => {
	hafas.journeys(berlin, passau, {
		departure: when.outbound, results: 1
	})
	.then((outbound) => link(outbound.journeys[0]))
	.then(isBookingPage)
	.then((isBookingPage) => {
		t.ok(isBookingPage, 'link is not a booking page')
		t.end()
	})
	.catch(t.ifError)
})
