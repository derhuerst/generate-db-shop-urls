# generate-db-shop-urls

**Magically generate Deutsche Bahn ticket URLs.** Given a [`journey` queried with `hafas-client@5`](https://github.com/public-transport/hafas-client/blob/5/docs/journeys.md), it tries to generate a matching ticket link in the [Deutsche Bahn shop](https://www.bahn.de/). Caveats:

- Uses a lot of scraping, as there is no (publicly accessible) machine-readable interface to the ticket system. This makes `generate-db-shop-urls` brittle.
- Because of how (bad) the shop works, the generated links will only be valid with a browser session that hasn't recently been used to search for a connection, or one without any cookies/session.

[![npm version](https://img.shields.io/npm/v/generate-db-shop-urls.svg)](https://www.npmjs.com/package/generate-db-shop-urls)
[![Prosperity/Apache license](https://img.shields.io/static/v1?label=license&message=Prosperity%2FApache&color=0997E8)](#license)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)


## Installing

```shell
npm install generate-db-shop-urls
```


## Usage

`generate-db-shop-urls` expects one (outbound) or two (outbound & returning) [`journey`s queried with `hafas-client@5`](https://github.com/public-transport/hafas-client/blob/5/docs/journeys.md) as input.

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


## License

This project is dual-licensed: **My contributions are licensed under the [*Prosperity Public License*](https://prosperitylicense.com), [contributions of other people](https://github.com/derhuerst/generate-db-shop-urls/graphs/contributors) are licensed as [Apache 2.0](https://apache.org/licenses/LICENSE-2.0)**.

> This license allows you to use and share this software for noncommercial purposes for free and to try this software for commercial purposes for thirty days.

> Personal use for research, experiment, and testing for the benefit of public knowledge, personal study, private entertainment, hobby projects, amateur pursuits, or religious observance, without any anticipated commercial application, doesn’t count as use for a commercial purpose.

[Get in touch with me](https://jannisr.de/) to buy a commercial license or read more about [why I sell private licenses for my projects](https://gist.github.com/derhuerst/0ef31ee82b6300d2cafd03d10dd522f7).

The [DB *Haltestellendaten* dataset](https://data.deutschebahn.com/dataset/data-haltestellen.html) used by this project is licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).


## Contributing

If you have a question, found a bug or want to propose a feature, have a look at [the issues page](https://github.com/derhuerst/generate-db-shop-urls/issues).

By contributing, you agree to release your modifications under the [Apache 2.0 license](LICENSE-APACHE).
