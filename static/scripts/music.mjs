/**
 * @file Musical notes and frequencies
 */

/** One half step in equal temperament */
const semitone = Math.pow(2, 1/12)
const ln_semitone = Math.log(semitone)
const A4_note = 69
const A4_freq = 440
const Cn1_note = 0
const Cn1_freq = A4_freq / Math.pow(semitone, A4_note)

const note_names = [
    "C",
    "C♯",
    "D",
    "E♭",
    "E",
    "F",
    "F♯",
    "G",
    "A♭",
    "A",
    "B♭",
    "B",
]

/**
 * Convert a MIDI note to a frequency
 * 
 * @param {Number} note MIDI note number
 * @returns {Number} Frequency (Hz)
 */
function MIDINoteFrequency(note) {
    return Cn1_freq * Math.pow(semitone, note)
}

/**
 * Return closest matching MIDI note to a frequency
 * 
 * @param {Number} frequency Frequency (Hz)
 * @returns {Number} Closest MIDI note
 */
function FrequencyMIDINote(frequency) {
    return Math.round(Math.log(frequency/Cn1_freq) / ln_semitone)
}

function MIDINoteName(note) {
    let octave = Math.floor(note / 12) - 1
    return note_names[note % 12] + octave   
}

export {
    MIDINoteFrequency,
    FrequencyMIDINote,
    MIDINoteName,
}