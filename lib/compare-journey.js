'use strict'

const debug = require('debug')('generate-db-shop-urls')
const isRoughlyEqual = require('is-roughly-equal')
const slugg = require('slugg')

const compareLegStations = (queryLeg, resultLeg, prop) => {
	const queryS = queryLeg[prop]
	const resultS = resultLeg[prop]
	if (queryS.id && resultS.id) return queryS.id === resultS.id
	if (
		queryS.station && queryS.station.id &&
		resultS.station && resultS.station.id
	) return queryS.station.id === resultS.station.id
	return slugg(queryS.name) === slugg(resultS.name)
}

const compareJourney = (outbound, returning, j, isReturn) => {
	const q = isReturn ? returning : outbound
	// see public-transport/friendly-public-transport-format#4
	// todo: what about non-walking, non-public-transport legs?
	const qLegs = q.legs.filter(l => l.mode !== 'walking')
	const jLegs = j.legs.filter(l => l.mode !== 'walking')
	if (qLegs.length !== jLegs.length) return false
	const l = jLegs.length

	// todo: DRY with find-hafas-data-in-another-hafas/match-journey-leg
	for (let i = 0; i < l; i++) {
		const qLeg = qLegs[i] // from the query
		const jLeg = jLegs[i] // parsed from the DB shop response

		// compare origin id
		if (!compareLegStations(qLeg, jLeg, 'origin')) {
			debug('leg', i, 'non-matching origins', qLeg, jLeg)
			return false
		}

		// compare destination id
		if (!compareLegStations(qLeg, jLeg, 'destination')) {
			debug('leg', i, 'non-matching destinations', qLeg, jLeg)
			return false
		}

		if (!isRoughlyEqual(1000, +new Date(qLeg.plannedDeparture), +new Date(jLeg.plannedDeparture))) {
			debug('leg', i, 'non-matching departures', qLeg, jLeg)
			return false
		}
		if (!isRoughlyEqual(1000, +new Date(qLeg.plannedArrival), +new Date(jLeg.plannedArrival))) {
			debug('leg', i, 'non-matching arrivals', qLeg, jLeg)
			return false
		}

		if (
			qLeg.departurePlatform && jLeg.departurePlatform
			&& qLeg.departurePlatform !== jLeg.departurePlatform
		) {
			debug('leg', i, 'non-matching departure platforms', qLeg, jLeg)
			return false
		}
		if (
			qLeg.arrivalPlatform && jLeg.arrivalPlatform
			&& qLeg.arrivalPlatform !== jLeg.arrivalPlatform
		) {
			debug('leg', i, 'non-matching arrival platforms', qLeg, jLeg)
			return false
		}

		if (!jLeg.lines.find((l) => {
			// todo: DRY with pan-european-public-transport/lib/db.js
			const jName = slugg(l.name).replace(/-+/, '')
			const qName = slugg(qLeg.line.name).replace(/-+/, '')
			return jName === qName
		})) {
			debug('leg', i, 'non-matching lines', qLeg, jLeg)
			return false
		}
	}

	let qTotal = q.price.amount
	if (isReturn) qTotal += outbound.price.amount
	if (qTotal && (j.price.amount || j.discount.amount)) {
		const jTotal = Math.min(j.price.amount || Infinity, j.discount.amount || Infinity)
		// todo: does the HAFAS mobile API return cheaper prices?
		if (jTotal > qTotal) {
			debug('matched journey too expensive', jTotal, qTotal)
			return false
		}
	}

	return true
}

module.exports = compareJourney
