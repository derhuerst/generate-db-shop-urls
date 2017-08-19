'use strict'

const isRoughlyEqual = require('is-roughly-equal')
const slugg = require('slugg')

const min = 60 * 1000

const compareJourney = (q, j, isReturn) => {
	const jLegs = j.legs
	const {departure, arrival, legs, price} = q[isReturn ? 'return' : 'outbound']
	// todo: filter walking
	if (legs.length !== jLegs.length) return false
	const l = jLegs.length - 1

	// todo: isReturn, price

	for (let i = 0; i < l; i++) {
		const leg = legs[i] // from the query
		const jLeg = jLegs[i] // parsed from the DB shop response

		if (!(
			(leg.origin.id + '') === jLeg.origin.id
			&& (leg.destination.id + '') === jLeg.destination.id
		)) return false

		if (!(
			isRoughlyEqual(3 * min, +leg.start, +new Date(jLeg.departure))
			&& isRoughlyEqual(3 * min, +leg.end, +new Date(jLeg.arrival))
		)) return false

		if (
			leg.origin.platform
			&& jLeg.departurePlatform
			&& leg.origin.platform !== jLeg.departurePlatform
		) return false

		if (
			leg.destination.platform
			&& jLeg.arrivalPlatform
			&& leg.destination.platform !== jLeg.arrivalPlatform
		) return false

		if (!jLeg.lines.find((l) => {
			const jName = slugg(l.name.replace(/\s+/, ''))
			const qName = slugg(leg.product.name.replace(/\s+/, ''))
			return jName === qName
		})) return false
	}

	if (price.amount && (j.price.amount || j.discount.amount)) {
		const jPrice = Math.min(j.price.amount || Infinity, j.discount.amount || Infinity)
		return jPrice <= price.amount
	}

	return true
}

module.exports = compareJourney
