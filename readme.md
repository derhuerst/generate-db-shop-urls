# generate-db-shop-urls

**Magically generate Deutsche Bahn ticket URLs.** Searches for a ticket link in the [Deutsche Bahn shop](https://www.bahn.de/) that matches a [`journey` queried with `hafas-client@5`](https://github.com/public-transport/hafas-client/blob/5/journeys.md). Caveats:

- Uses a lot of scraping, as there is no (publicly accessible) machine-readable interface to the ticket system. This makes `generate-db-shop-urls` brittle.

[![npm version](https://img.shields.io/npm/v/generate-db-shop-urls.svg)](https://www.npmjs.com/package/generate-db-shop-urls)
[![build status](https://img.shields.io/travis/derhuerst/generate-db-shop-urls.svg?branch=master)](https://travis-ci.org/derhuerst/generate-db-shop-urls)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/generate-db-shop-urls.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installing

```shell
npm install generate-db-shop-urls
```


## Usage

`generate-db-shop-urls` expects one (outbound) or two (outbound & returning) [`journey`s queried with `hafas-client@5`](https://github.com/public-transport/hafas-client/blob/5/journeys.md) as input.

```js
const createHafas = require('db-hafas')
const generateTicketLink = require('generate-db-shop-urls')

const berlin = '8096003'
const hamburg = '8000157'
const hafas = createHafas('my-awesome-program')

// default options
const options = {
	bahncard: '0', // bahncard id (0 = no bahncard, see https://gist.github.com/juliuste/202bb04f450a79f8fa12a2ec3abcd72d)
	class: '2', // '1' or '2'
	age: 40, // age of the traveller
	returning: null // no returning journeys
}

Promise.all([
	hafas.journeys(berlin, hamburg, {
		departure: new Date('2017-05-18T05:00+0200'),
		results: 1
	}),
	hafas.journeys(hamburg, berlin, {
		departure: new Date('2017-05-19T12:00+0200'),
		results: 1
	})
])
.then(([outbound, returning]) => {
	options.returning = returning.journeys[0]
	return generateTicketLink(outbound.journeys[0], options)
})
.then(console.log, console.error)
```


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/generate-db-shop-urls/issues).
