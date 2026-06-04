// ── Simple validation helpers (stand-in for zod while sandbox restricts npm) ──

export interface ValidationSchema<T> {
  parse(data: unknown): T
}

export class ValidationError extends Error {
  statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Assert a value is a non-empty string */
export function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new ValidationError(`${field}: must be a non-empty string`)
  }
  return val.trim()
}

/** Assert a value is an optional string */
export function assertOptionalString(val: unknown, field: string): string | undefined {
  if (val === undefined || val === null || val === '') return undefined
  return assertString(val, field)
}

/** Assert a value is a positive integer */
export function assertInt(val: unknown, field: string): number {
  const n = Number(val)
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`${field}: must be a positive integer`)
  }
  return n
}

/** Assert a value is an optional positive integer */
export function assertOptionalInt(val: unknown, field: string): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  return assertInt(val, field)
}

/** Assert a value is a number (float allowed) */
export function assertNumber(val: unknown, field: string): number {
  const n = Number(val)
  if (isNaN(n)) {
    throw new ValidationError(`${field}: must be a number`)
  }
  return n
}

/** Assert a value is a valid date string (ISO 8601 or date-only) */
export function assertDateString(val: unknown, field: string): string {
  if (typeof val !== 'string') {
    throw new ValidationError(`${field}: must be a date string`)
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${field}: invalid date`)
  }
  return val
}

/** Assert a value is an optional date string */
export function assertOptionalDateString(val: unknown, field: string): string | undefined {
  if (val === undefined || val === null || val === '') return undefined
  return assertDateString(val, field)
}

/** Assert a value is a boolean */
export function assertBoolean(val: unknown, field: string): boolean {
  if (typeof val !== 'boolean') {
    throw new ValidationError(`${field}: must be a boolean`)
  }
  return val
}

/** Assert a value is one of the allowed options */
export function assertOneOf<T extends string>(val: unknown, options: readonly T[], field: string): T {
  const str = assertString(val, field)
  if (!options.includes(str as T)) {
    throw new ValidationError(`${field}: must be one of [${options.join(', ')}]`)
  }
  return str as T
}

/** Assert a value is optional oneOf */
export function assertOptionalOneOf<T extends string>(val: unknown, options: readonly T[], field: string): T | undefined {
  if (val === undefined || val === null || val === '') return undefined
  return assertOneOf(val, options, field)
}

/** Assert a value is a plain object (not array, not null) */
export function assertObject(val: unknown, field: string): Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new ValidationError(`${field}: must be a non-null object`)
  }
  return val as Record<string, unknown>
}
