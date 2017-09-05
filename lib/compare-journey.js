'use strict'

const isRoughlyEqual = require('is-roughly-equal')
const slugg = require('slugg')

const min = 60 * 1000

const compareLegStations = (queryLeg, resultLeg, prop) => {
	const queryS = queryLeg[prop]
	const resultS = resultLeg[prop]
	if (queryS.id && resultS.id) return (queryS.id + '') === resultS.id
	return slugg(queryS.name) === slugg(resultS.name)
}

const compareJourney = ({outbound, returning}, j, isReturn) => {
	const q = isReturn ? returning : outbound
	// see public-transport/friendly-public-transport-format#4
	// todo: what about non-walking, non-public-transport legs?
	const qLegs = q.legs.filter(l => l.mode !== 'walking')
	const jLegs = j.legs.filter(l => l.mode !== 'walking')
	if (qLegs.length !== jLegs.length) return false
	const l = jLegs.length - 1

	for (let i = 0; i < l; i++) {
		const qLeg = qLegs[i] // from the query
		const jLeg = jLegs[i] // parsed from the DB shop response

		// compare origin id
		if (!compareLegStations(qLeg, jLeg, 'origin')) return false

		// compare destination id
		if (!compareLegStations(qLeg, jLeg, 'destination')) return false

		if (!(
			isRoughlyEqual(3 * min, +new Date(qLeg.departure), +new Date(jLeg.departure))
			&& isRoughlyEqual(3 * min, +new Date(qLeg.arrival), +new Date(jLeg.arrival))
		)) return false

		if (
			qLeg.origin.platform
			&& jLeg.departurePlatform
			&& qLeg.origin.platform !== jLeg.departurePlatform
		) return false

		if (
			qLeg.destination.platform
			&& jLeg.arrivalPlatform
			&& qLeg.destination.platform !== jLeg.arrivalPlatform
		) return false

		if (!jLeg.lines.find((l) => {
			const jName = slugg(l.name).replace(/-+/, '')
			const qName = slugg(qLeg.line.name).replace(/-+/, '')
			return jName === qName
		})) return false
	}

	let qTotal = q.price.amount
	if (isReturn) qTotal += outbound.price.amount
	if (qTotal && (j.price.amount || j.discount.amount)) {
		const jTotal = Math.min(j.price.amount || Infinity, j.discount.amount || Infinity)
		// todo: does the HAFAS mobile API return cheaper prices?
		if (jTotal > qTotal) return false
	}

	return true
}

module.exports = compareJourney
