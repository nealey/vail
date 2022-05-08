/** 
 * A time duration.
 * 
 * JavaScript uses milliseconds in most (but not all) places.
 * I've found it helpful to be able to multiply by a unit, so it's clear what's going on.
 * 
 * @typedef  {number} Duration
 */

/** @type {Duration} */
export const Millisecond = 1

/** @type {Duration} */
export const Second = 1000 * Millisecond

/** @type {Duration} */
export const Minute = 60 * Second

/** @type {Duration} */
export const Hour = 60 * Minute
