'use strict'

const isRoughlyEqual = require('is-roughly-equal')
const slugg = require('slugg')

const min = 60 * 1000

const compareJourney = (q, j, isReturn) => {
	if (q.legs.length !== j.legs.length) return false
	const l = j.legs.length - 1

	// todo: isReturn, price

	for (let i = 0; i < l; i++) {
		const qLeg = q.legs[i]
		const jLeg = j.legs[i]

		if (!(
			(qLeg.from.id + '') === jLeg.origin.id
			&& (qLeg.to.id + '') === jLeg.destination.id
			&& isRoughlyEqual(3 * min, +q.departure, +new Date(j.legs[0].departure))
			&& isRoughlyEqual(3 * min, +q.arrival, +new Date(j.legs[l].arrival))
		)) return false

		if (
			qLeg.from.platform
			&& jLeg.departurePlatform
			&& qLeg.from.platform !== jLeg.departurePlatform
		) return false

		if (
			qLeg.to.platform
			&& jLeg.arrivalPlatform
			&& qLeg.to.platform !== jLeg.arrivalPlatform
		) return false

		if (!jLeg.lines.find((l) => {
			const jName = slugg(l.name.replace(/\s+/, ''))
			const qName = slugg(qLeg.product.name.replace(/\s+/, ''))
			return jName === qName
		})) return false
	}

	if (q.price.amount && (j.price.amount || j.discount.amount)) {
		const jPrice = Math.min(j.price.amount || Infinity, j.discount.amount || Infinity)
		return jPrice <= q.price.amount
	}

	return true
}

module.exports = compareJourney
