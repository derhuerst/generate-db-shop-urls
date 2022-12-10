'use strict'

const test = require('tape')
const createHafas = require('db-hafas')
const {join} = require('path')
const {readFileSync} = require('fs')
const cheerio = require('cheerio')

const {
	parseIbnrFromBahnhofDePage,
	fetchIbnrFromBahnhofDe,
} = require('../lib/fetch-ibnr-from-bahnhof.de.js')
const request = require('../lib/request')
const parse = require('../lib/parse')
const link = require('..')
const when = require('./when')

const bahnhofDe2545HannoverHbf = readFileSync(join(__dirname, 'bahnhof.de-2545-hannover-hbf.html'), {
	encoding: 'utf8',
})
const düsseldorfHanauOutbound = require('./hafas-düsseldorf-hanau.json')
const düsseldorfHanauHTML = readFileSync(join(__dirname, 'results-düsseldorf-hanau.html'), {encoding: 'utf8'})
const düsseldorfHanauExpected = require('./expected-düsseldorf-hanau.json')

const berlin = '8011160'
const hamburg = '8002549'
const passau = '8000298'

const hafas = createHafas('generate-db-shop-urls test')

const isBookingPage = async (url) => {
	const {data} = await request(url, null, null)
	const $ = cheerio.load(data)
	const nextButton = $('.booking a[href]').get(0)
	const availContinueButton = $('#availContinueButton').get(0)
	// this is a really really brittle way to tell if the link generation
	// worked, hence if we're on the right page.
	// todo: find a more robust way, compare prices
	return !!(nextButton || availContinueButton)
}

test('parseIbnrFromBahnhofDePage works', (t) => {
	const hannoverHbfIbnr = parseIbnrFromBahnhofDePage(bahnhofDe2545HannoverHbf)
	t.equal(hannoverHbfIbnr, '8000152')
	t.end()
})

test('fetchIbnrFromBahnhofDe works', async (t) => {
	const hannoverHbfIbnr = await fetchIbnrFromBahnhofDe('2545')
	t.equal(hannoverHbfIbnr, '8000152')
	t.end()
})

test('parsing works Düsseldorf Hbf -> Hanau Hbf', (t) => {
	const res = parse(düsseldorfHanauOutbound, null, false)(düsseldorfHanauHTML)
	t.deepEqual(res, düsseldorfHanauExpected)
	t.end()
})

test('works Berlin Hbf -> Hamburg Hbf', {timeout: 10000}, async (t) => {
	const outbound = await hafas.journeys(berlin, hamburg, {
		departure: when.outbound, results: 1
	})
	const res = await link(outbound.journeys[0])
	t.ok(await isBookingPage(res), 'res is not a booking page link')
})

test('works Berlin Hbf -> Hamburg Hbf and back', {timeout: 10000}, async (t) => {
	const [outbound, returning] = await Promise.all([
		hafas.journeys(berlin, hamburg, {
			departure: when.outbound, results: 1
		}),
		hafas.journeys(hamburg, berlin, {
			departure: when.returning, results: 1
		})
	])
	const res = await link(outbound.journeys[0], {
		returning: returning.journeys[0],
	})
	t.ok(await isBookingPage(res), 'res is not a booking page link')
})

test('works Berlin Hbf -> Passau', {timeout: 10000}, async (t) => {
	const outbound = await hafas.journeys(berlin, passau, {
		departure: when.outbound, results: 1
	})
	const res = await link(outbound.journeys[0])
	t.ok(await isBookingPage(res), 'res is not a booking page link')
})
