'use strict'

const qs = require('querystring')

const showDetails = (isReturn) => {
	// todo: nr of results
	const ids = isReturn ? [
		'C2-0', 'C2-1', 'C2-2', 'C2-3'
	] : [
		'C0-0', 'C0-1', 'C0-2'
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
