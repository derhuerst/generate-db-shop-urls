'use strict'

const qs = require('querystring')
const {fetch} = require('fetch-ponyfill')({Promise: require('pinkie-promise')})
const ct = require('content-type')
const {decode} = require('iconv-lite')

const parseCookies = (res) => {
	const cookies = Object.create(null)
	res.headers.forEach((value, name) => {
		if (name !== 'set-cookie') return
		// console.error(name, value, cookie.parse(value))
		// Object.assign(cookies, cookie.parse(value))
		const v = value.split(';')[0]
		Object.assign(cookies, qs.parse(v, ';'))
	})
	return cookies
}

const formatCookies = (cookies) => qs.stringify(cookies, '; ')

const request = (endpoint, query, cookies) => {
	const target = query ? endpoint + '?' + qs.stringify(query) : endpoint

	const headers = {
		'user-agent': 'https://github.com/derhuerst/generate-db-shop-urls'
	}
	if (cookies) headers.cookie = formatCookies(cookies)

	return fetch(target, {
		cache: 'no-store',
		redirect: 'follow',
		headers
	})
	.then((res) => {
		if (!res.ok) throw new Error('response not ok: ' + res.status)

		// todo: parse cookies and use them in the next request
		const cookies = parseCookies(res)

		return res.buffer()
		.then((raw) => raw.toString('utf8'))
	})
}

module.exports = request
