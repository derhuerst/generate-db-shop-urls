'use strict'

const qs = require('querystring')
const {fetch} = require('fetch-ponyfill')({Promise: require('pinkie-promise')})
// const cookie = require('cookie')
const ct = require('content-type')
const {decode} = require('iconv-lite')

const request = (endpoint, query) => {
	const target = query ? endpoint + '?' + qs.stringify(query) : endpoint

	return fetch(target, {
		cache: 'no-store',
		redirect: 'follow',
		headers: {
			'user-agent': 'https://github.com/derhuerst/generate-db-shop-urls'
		}
	})
	.then((res) => {
		if (!res.ok) throw new Error('response not ok: ' + res.status)

		// todo: parse cookies and use them in the next request
		// const cookies = {}
		// res.headers.forEach((value, name) => {
		// 	if (name === 'set-cookie') {
		// 		Object.assign(cookies, cookie.parse(value))
		// 	}
		// })
		// console.error(cookies)

		const c = ct.parse(res.headers.get('content-type'))
		if (c.parameters && c.parameters.charset) {
			return res.buffer()
			.then((raw) => decode(raw, c.parameters.charset))
		}

		return res.buffer()
		.then((raw) => raw.toString('utf8'))
	})
}

module.exports = request
