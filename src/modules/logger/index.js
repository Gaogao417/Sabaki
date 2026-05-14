/**
 * Logger module barrel export.
 *
 * @module logger
 */

export {createLoggerService} from './LoggerService.js'
export {formatTimestamp, toSource} from './logFormatting.js'
export {createWinstonWriter} from './winstonWriter.js'
export {safeSerialize} from './safeSerialize.js'

/**
 * @typedef {Object} LogEntry
 * @property {number} time     — epoch ms
 * @property {'debug'|'info'|'warn'|'error'} level
 * @property {string} source   — dot-separated e.g. 'engine.attached'
 * @property {string} message
 * @property {unknown} [data]
 */
