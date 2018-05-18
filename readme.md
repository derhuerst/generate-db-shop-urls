# generate-db-shop-urls

**Magically generate Deutsche Bahn ticket URLs.** Searches for a ticket link in the [Deutsche Bahn shop](https://www.bahn.de/) that matches the [`journey`](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.2/spec/readme.md#journey) you passed as a query. Caveats:

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

`generate-db-shop-urls` accepts a form very similar to the [*Friendly Public Transport Format* `1.0.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.1/spec/readme.md) as input.

```js
const {journeys} = require('db-hafas')
const generateTicketLink = require('generate-db-shop-urls')

const berlin = '8096003'
const hamburg = '8000157'
Promise.all([
	journeys(berlin, hamburg, {
		when: new Date('2017-05-18T05:00+0200'),
		results: 1
	}),
	journeys(hamburg, berlin, {
		when: new Date('2017-05-19T12:00+0200'),
		results: 1
	})
])
.then(([outboundJourneys, returningJourneys]) => {
	return generateTicketLink(outboundJourneys[0], returningJourneys[0])
})
.then(console.log, console.error)
```


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/generate-db-shop-urls/issues).
