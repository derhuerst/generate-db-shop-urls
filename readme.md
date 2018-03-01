# generate-db-shop-urls

**Magically generate Deutsche Bahn ticket URLs.** Searches for a ticket link in the [Deutsche Bahn shop](https://www.bahn.de/) that matches the journey you passed as a query. Caveats:

- Uses a lot of scraping, as there is no (publicly accessible) machine-readable interface to the ticket system. This makes `generate-db-shop-urls` brittle.
- The generated links only work if you don't have `bahn.de` cookies. Try private browsing.

[![npm version](https://img.shields.io/npm/v/generate-db-shop-urls.svg)](https://www.npmjs.com/package/generate-db-shop-urls)
[![build status](https://img.shields.io/travis/derhuerst/generate-db-shop-urls.svg)](https://travis-ci.org/derhuerst/generate-db-shop-urls)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/generate-db-shop-urls.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installing

```shell
npm install generate-db-shop-urls
```


## Usage

`generate-db-shop-urls` accepts a form very similar to the [*Friendly Public Transport Format* `1.0.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.1/spec/readme.md) as input.

```js
const {journeys} = require('db-hafas')
const generateTicketLink = require('generate-db-shop-urls')

Promise.all([
	journeys('8096003', '8000157', {
		when: new Date('2017-05-18T05:00+0200'),
		results: 1
	}),
	journeys('8000157', '8096003', {
		when: new Date('2017-05-19T12:00+0200'),
		results: 1
	})
])
.then(([outbound, returning]) => {
	return generateTicketLink({
		from: outbound[0].origin,
		to: outbound[0].destination,
		outbound: {
			departure: outbound[0].departure,
			arrival: outbound[0].arrival,
			legs: outbound[0].legs,
			price: outbound[0].price
		},
		return: {
			departure: returning[0].departure,
			arrival: returning[0].arrival,
			legs: returning[0].legs,
			price: returning[0].price
		}
	})
})
.then(console.log, console.error)
```


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/generate-db-shop-urls/issues).
