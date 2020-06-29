# generate-db-shop-urls

**Magically generate Deutsche Bahn ticket URLs.** Given a [`journey` queried with `hafas-client@5`](https://github.com/public-transport/hafas-client/blob/5/journeys.md), it tries to generate a matching ticket link in the [Deutsche Bahn shop](https://www.bahn.de/). Caveats:

- Uses a lot of scraping, as there is no (publicly accessible) machine-readable interface to the ticket system. This makes `generate-db-shop-urls` brittle.
- Because of how (bad) the shop works, the generated links will only be valid with a browser session that hasn't recently been used to search for a connection, or one without any cookies/session.

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

const outbound = await hafas.journeys(berlin, hamburg, {
	departure: new Date('2017-05-18T05:00+0200'),
	results: 1,
})
const returning = await hafas.journeys(hamburg, berlin, {
	departure: new Date('2017-05-19T12:00+0200'),
	results: 1,
})

const link = await generateTicketLink(outbound.journeys[0], {
	returning:  returning.journeys[0],
})
console.log(link)
```

## API

```js
async (outbound, opt = {}) => {}
```

`opt` overrides the default options which look as follows:

```js
{
	// type of BahnCard, '0' = no bahncard
	// see https://gist.github.com/juliuste/202bb04f450a79f8fa12a2ec3abcd72d
	bahncard: '0',
	class: '2', // '1' or '2'
	age: 40, // age of the traveller
	returning: null // returning journey to match (optional)
}
```


## Contributing

If you have a question, found a bug or want to propose a feature, have a look at [the issues page](https://github.com/derhuerst/generate-db-shop-urls/issues).
