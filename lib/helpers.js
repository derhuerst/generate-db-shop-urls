'use strict'

const qs = require('querystring')

// This helper generates the crazy query format that the DB shop uses.
// It is url-encoded, with custom delimiters, and a very verbose way
// of specifying for which part of the journey to return how many details.

// The first number after `C` seems to stand for outbound/returning direction.
// The second number (e.g. `-1`) seems to stand for the index in the list of
// proposed journeys.
const showDetails = (isReturn) => {
	// todo: nr of results
	const ids = isReturn ? [
		'C2-0', 'C2-1', 'C2-2', 'C2-3', 'C2-4'
	] : [
		'C0-0', 'C0-1', 'C0-2', 'C0-3', 'C0-4'
	]

	return ids
	.map((id) => {
		return 'CONNECTION$' + id + '!' + qs.stringify({
			id,
			HwaiConId: id,
			HwaiDetailStatus: 'details',
			HwaiMoreDetailStatus: 'stInfo'
		}, '!')
	})
	.join(';')
}

module.exports = {showDetails}
