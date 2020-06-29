'use strict'

const qs = require('querystring')
const {fetch} = require('fetch-ponyfill')({
	Promise: require('pinkie-promise')
})
const ct = require('content-type')
const {decode} = require('iconv-lite')

const parseCookies = (res) => {
	const cookies = Object.create(null)
	res.headers.forEach((value, name) => {
		if (name !== 'set-cookie') return;
		// todo: ?
		// Object.assign(cookies, cookie.parse(value))
		const v = value.split(';')[0]
		Object.assign(cookies, qs.parse(v, ';'))
	})
	return cookies
}

const formatCookies = (cookies) => qs.stringify(cookies, '; ')

const request = async (endpoint, query, cookies) => {
	const target = query ? endpoint + '?' + qs.stringify(query) : endpoint

	const headers = {
		'user-agent': 'https://github.com/derhuerst/generate-db-shop-urls'
	}
	if (cookies) headers.cookie = formatCookies(cookies)

	const res = await fetch(target, {
		cache: 'no-store',
		redirect: 'follow',
		headers
	})
	if (!res.ok) {
		const err = new Error('response not ok: ' + res.status)
		err.response = res
		throw err
	}

	const raw = await res.buffer()
	let data
	const c = ct.parse(res.headers.get('content-type'))
	if (c.parameters && c.parameters.charset) {
		data = decode(raw, c.parameters.charset)
	} else {
		data = raw.toString('utf8')
	}

	return {
		data,
		// todo: parse cookies and use them in the next request
		cookies: parseCookies(res),
	}
}

module.exports = request
