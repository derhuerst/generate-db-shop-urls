'use strict'

const cheerio = require('cheerio')
const request = require('./request')

const parseIbnrFromBahnhofDePage = (bahnhofDeHtml) => {
	const $ = cheerio.load(bahnhofDeHtml)

	const bhftafelLinks = $('.bf-station-detail__list a[href^="https://iris.noncd.db.de/wbt"]')
	for (const link of bhftafelLinks.get()) {
		const url = new URL(link.attribs.href)

		// only consider departure board links
		if (url.searchParams.get('typ') !== 'ab') continue

		// extract IBNR
		if (!url.searchParams.has('bhf')) continue
		const ibnr = url.searchParams.get('bhf')
		return ibnr
	}

	return null
}

const fetchIbnrFromBahnhofDe = async (bahnhofDeNr) => {
	const url = 'https://www.bahnhof.de/bahnhof-de/id/' + encodeURIComponent(bahnhofDeNr)
	const {data: html} = await request(url)

	return parseIbnrFromBahnhofDePage(html)
}

module.exports = {
	parseIbnrFromBahnhofDePage,
	fetchIbnrFromBahnhofDe,
}
