/** 
 * A time duration.
 * 
 * JavaScript uses milliseconds in most (but not all) places.
 * I've found it helpful to be able to multiply by a unit, so it's clear what's going on.
 * 
 * @typedef  {number} Duration
 */
/** @type {Duration} */
const Millisecond = 1
/** @type {Duration} */
const Second = 1000 * Millisecond
/** @type {Duration} */
const Minute = 60 * Second
/** @type {Duration} */
const Hour = 60 * Minute

export {Millisecond, Second, Minute, Hour}
