/**
 * ErrorValidator.ts
 *
 * Validates JSON:API v1.1 error object structure compliance.
 * Based on specification: https://jsonapi.org/format/1.1/#errors
 */

import { isValidUrl, getUrlValidationError } from '../utils/UrlValidator.js'
import { validateMemberName } from './ResourceValidator.js'

interface ValidationError {
  test: string
  message: string
  context?: string
}

interface ValidationWarning {
  test: string
  message: string
  context?: string
}

interface ValidationDetail {
  test: string
  status: 'passed' | 'failed' | 'warning'
  message: string
  context?: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  details: ValidationDetail[]
}

/**
 * Validates the errors member structure
 * @param errors - The errors value to validate
 * @returns Validation result with success/failure and details
 */
export function validateErrorsMember(errors: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Step 1: Validate that errors is an array
  if (!Array.isArray(errors)) {
    results.valid = false
    results.errors.push({
      test: 'Errors Member Structure',
      message: 'Errors member must be an array'
    })
    return results
  }

  // Step 2: Validate array is not empty
  if (errors.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Errors Member Structure',
      message: 'Errors array cannot be empty'
    })
    return results
  }

  results.details.push({
    test: 'Errors Member Structure',
    status: 'passed',
    message: `Errors is valid array with ${errors.length} error object(s)`
  })

  // Step 3: Validate each error object in the array
  let allErrorsValid = true
  errors.forEach((errorObj: unknown, index: number) => {
    const errorValidation = validateErrorObject(errorObj, `errors[${index}]`)
    results.details.push(...errorValidation.details)
    if (!errorValidation.valid) {
      allErrorsValid = false
      results.errors.push(...errorValidation.errors)
    }
    if (errorValidation.warnings) {
      results.warnings.push(...errorValidation.warnings)
    }
  })

  if (!allErrorsValid) {
    results.valid = false
  }

  return results
}

/**
 * Validates a single error object for JSON:API compliance
 * @param errorObj - The error object to validate
 * @param context - Context for error messages (e.g., "errors[0]")
 * @returns Validation result with success/failure and details
 */
export function validateErrorObject(errorObj: unknown, context: string = 'error'): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Step 1: Basic structure validation
  if (errorObj === null || errorObj === undefined) {
    results.valid = false
    results.errors.push({
      test: 'Error Object Structure',
      context,
      message: 'Error object cannot be null or undefined'
    })
    return results
  }

  if (typeof errorObj !== 'object' || Array.isArray(errorObj)) {
    results.valid = false
    results.errors.push({
      test: 'Error Object Structure',
      context,
      message: 'Error object must be an object'
    })
    return results
  }

  const errorObject = errorObj as Record<string, unknown>

  results.details.push({
    test: 'Error Object Structure',
    status: 'passed',
    context,
    message: 'Error object has valid basic structure'
  })

  // Step 2: Validate allowed members only
  const allowedMembers = ['id', 'links', 'status', 'code', 'title', 'detail', 'source', 'meta']
  const presentMembers = Object.keys(errorObject)
  const additionalMembers = presentMembers.filter(member => !allowedMembers.includes(member))

  if (additionalMembers.length > 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Object Additional Members',
      context,
      message: `Error object contains additional members not allowed by JSON:API spec: ${additionalMembers.join(', ')}`
    })
  } else {
    results.details.push({
      test: 'Error Object Additional Members',
      status: 'passed',
      context,
      message: 'Error object contains only allowed members'
    })
  }

  // Step 3: Validate optional members when present

  // Validate 'id' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'id')) {
    const idValidation = validateErrorIdMember(errorObject.id, context)
    results.details.push(...idValidation.details)
    if (!idValidation.valid) {
      results.valid = false
      results.errors.push(...idValidation.errors)
    }
  }

  // Validate 'links' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'links')) {
    const linksValidation = validateErrorLinksMember(errorObject.links, context)
    results.details.push(...linksValidation.details)
    if (!linksValidation.valid) {
      results.valid = false
      results.errors.push(...linksValidation.errors)
    }
  }

  // Validate 'status' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'status')) {
    const statusValidation = validateErrorStatusMember(errorObject.status, context)
    results.details.push(...statusValidation.details)
    if (!statusValidation.valid) {
      results.valid = false
      results.errors.push(...statusValidation.errors)
    }
  }

  // Validate 'code' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'code')) {
    const codeValidation = validateErrorCodeMember(errorObject.code, context)
    results.details.push(...codeValidation.details)
    if (!codeValidation.valid) {
      results.valid = false
      results.errors.push(...codeValidation.errors)
    }
  }

  // Validate 'title' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'title')) {
    const titleValidation = validateErrorTitleMember(errorObject.title, context)
    results.details.push(...titleValidation.details)
    if (!titleValidation.valid) {
      results.valid = false
      results.errors.push(...titleValidation.errors)
    }
  }

  // Validate 'detail' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'detail')) {
    const detailValidation = validateErrorDetailMember(errorObject.detail, context)
    results.details.push(...detailValidation.details)
    if (!detailValidation.valid) {
      results.valid = false
      results.errors.push(...detailValidation.errors)
    }
  }

  // Validate 'source' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'source')) {
    const sourceValidation = validateErrorSourceMember(errorObject.source, context)
    results.details.push(...sourceValidation.details)
    if (!sourceValidation.valid) {
      results.valid = false
      results.errors.push(...sourceValidation.errors)
    }
  }

  // Validate 'meta' member
  if (Object.prototype.hasOwnProperty.call(errorObject, 'meta')) {
    const metaValidation = validateErrorMetaMember(errorObject.meta, context)
    results.details.push(...metaValidation.details)
    if (!metaValidation.valid) {
      results.valid = false
      results.errors.push(...metaValidation.errors)
    }
  }

  return results
}

/**
 * Validates the 'id' member of an error object
 * @param id - The id value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorIdMember(id: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof id !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error ID Member',
      context,
      message: 'Error id must be a string'
    })
  } else if (id.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error ID Member',
      context,
      message: 'Error id cannot be empty string'
    })
  } else {
    results.details.push({
      test: 'Error ID Member',
      status: 'passed',
      context,
      message: `Error id is valid string: "${id}"`
    })
  }

  return results
}

/**
 * Validates the 'links' member of an error object
 * @param links - The links value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorLinksMember(links: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof links !== 'object' || links === null || Array.isArray(links)) {
    results.valid = false
    results.errors.push({
      test: 'Error Links Member',
      context,
      message: 'Error links must be an object'
    })
    return results
  }

  const linksObject = links as Record<string, unknown>

  // Validate 'about' link (most common for errors)
  if (Object.prototype.hasOwnProperty.call(linksObject, 'about')) {
    const aboutValidation = validateErrorLinkValue(linksObject.about, `${context}.links.about`)
    results.details.push(...aboutValidation.details)
    if (!aboutValidation.valid) {
      results.valid = false
      results.errors.push(...aboutValidation.errors)
    }
  }

  // Allow other link types but validate their structure
  const linkKeys = Object.keys(linksObject)
  for (const linkName of linkKeys) {
    if (linkName !== 'about') {
      const linkValidation = validateErrorLinkValue(linksObject[linkName], `${context}.links.${linkName}`)
      results.details.push(...linkValidation.details)
      if (!linkValidation.valid) {
        results.valid = false
        results.errors.push(...linkValidation.errors)
      }
    }
  }

  if (results.valid) {
    results.details.push({
      test: 'Error Links Member',
      status: 'passed',
      context,
      message: `Error links object contains ${linkKeys.length} valid link(s)`
    })
  }

  return results
}

/**
 * Validates a single link value in an error object
 * @param link - The link value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorLinkValue(link: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof link === 'string') {
    if (link.length === 0) {
      results.valid = false
      results.errors.push({
        test: 'Error Link Value',
        context,
        message: 'Error link string cannot be empty'
      })
    } else {
      // Validate URL format
      if (!isValidUrl(link)) {
        const urlError = getUrlValidationError(link)
        results.valid = false
        results.errors.push({
          test: 'Error Link URL Format',
          context,
          message: urlError || 'Error link URL format is invalid'
        })
      } else {
        results.details.push({
          test: 'Error Link Value',
          status: 'passed',
          context,
          message: 'Error link URL format is valid'
        })
      }
    }
  } else if (typeof link === 'object' && link !== null && !Array.isArray(link)) {
    const linkObject = link as Record<string, unknown>

    // Link object must have href member
    if (!Object.prototype.hasOwnProperty.call(linkObject, 'href')) {
      results.valid = false
      results.errors.push({
        test: 'Error Link Object Structure',
        context,
        message: 'Error link object must have an "href" member'
      })
    } else if (typeof linkObject.href !== 'string' || linkObject.href.length === 0) {
      results.valid = false
      results.errors.push({
        test: 'Error Link Object Structure',
        context,
        message: 'Error link object "href" must be a non-empty string'
      })
    } else {
      // Validate href URL format
      if (!isValidUrl(linkObject.href)) {
        const urlError = getUrlValidationError(linkObject.href)
        results.valid = false
        results.errors.push({
          test: 'Error Link Object URL Format',
          context,
          message: urlError || 'Error link object "href" URL format is invalid'
        })
      } else {
        results.details.push({
          test: 'Error Link Object Structure',
          status: 'passed',
          context,
          message: 'Error link href URL format is valid'
        })
      }
    }

    // Validate optional meta member
    if (Object.prototype.hasOwnProperty.call(linkObject, 'meta')) {
      if (typeof linkObject.meta !== 'object' || linkObject.meta === null || Array.isArray(linkObject.meta)) {
        results.valid = false
        results.errors.push({
          test: 'Error Link Object Meta',
          context,
          message: 'Error link object "meta" must be an object'
        })
      } else {
        // Validate meta member names follow JSON:API naming conventions
        const metaKeys = Object.keys(linkObject.meta as Record<string, unknown>)
        for (const metaName of metaKeys) {
          const nameValidation = validateMemberName(metaName, `${context}.meta.${metaName}`) as ValidationResult
          results.details.push(...nameValidation.details)
          if (!nameValidation.valid) {
            results.valid = false
            results.errors.push(...nameValidation.errors)
          }
        }

        results.details.push({
          test: 'Error Link Object Meta',
          status: 'passed',
          context,
          message: 'Error link meta structure is valid'
        })
      }
    }

    // Check for additional members beyond href and meta
    const linkKeys = Object.keys(linkObject)
    const allowedMembers = ['href', 'meta']
    const additionalMembers = linkKeys.filter(key => !allowedMembers.includes(key))

    if (additionalMembers.length > 0) {
      results.valid = false
      results.errors.push({
        test: 'Error Link Object Additional Members',
        context,
        message: `Error link object contains additional members not allowed: ${additionalMembers.join(', ')}. Only "href" and "meta" are allowed`
      })
    }
  } else {
    results.valid = false
    results.errors.push({
      test: 'Error Link Value',
      context,
      message: 'Error link must be a string or link object'
    })
  }

  return results
}

/**
 * Validates the 'status' member of an error object
 * @param status - The status value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorStatusMember(status: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof status !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error Status Member',
      context,
      message: 'Error status must be a string (HTTP status code)'
    })
  } else if (status.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Status Member',
      context,
      message: 'Error status cannot be empty string'
    })
  } else if (!/^\d{3}$/.test(status)) {
    results.valid = false
    results.errors.push({
      test: 'Error Status Member',
      context,
      message: `Error status must be a 3-digit HTTP status code string, got: "${status}"`
    })
  } else {
    results.details.push({
      test: 'Error Status Member',
      status: 'passed',
      context,
      message: `Error status is valid HTTP status code: "${status}"`
    })
  }

  return results
}

/**
 * Validates the 'code' member of an error object
 * @param code - The code value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorCodeMember(code: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof code !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error Code Member',
      context,
      message: 'Error code must be a string'
    })
  } else if (code.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Code Member',
      context,
      message: 'Error code cannot be empty string'
    })
  } else {
    results.details.push({
      test: 'Error Code Member',
      status: 'passed',
      context,
      message: `Error code is valid: "${code}"`
    })
  }

  return results
}

/**
 * Validates the 'title' member of an error object
 * @param title - The title value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorTitleMember(title: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof title !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error Title Member',
      context,
      message: 'Error title must be a string'
    })
  } else if (title.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Title Member',
      context,
      message: 'Error title cannot be empty string'
    })
  } else {
    results.details.push({
      test: 'Error Title Member',
      status: 'passed',
      context,
      message: `Error title is valid: "${title}"`
    })
  }

  return results
}

/**
 * Validates the 'detail' member of an error object
 * @param detail - The detail value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorDetailMember(detail: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof detail !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error Detail Member',
      context,
      message: 'Error detail must be a string'
    })
  } else if (detail.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Detail Member',
      context,
      message: 'Error detail cannot be empty string'
    })
  } else {
    results.details.push({
      test: 'Error Detail Member',
      status: 'passed',
      context,
      message: `Error detail is valid: "${detail}"`
    })
  }

  return results
}

/**
 * Validates the 'source' member of an error object
 * @param source - The source value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorSourceMember(source: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    results.valid = false
    results.errors.push({
      test: 'Error Source Member',
      context,
      message: 'Error source must be an object'
    })
    return results
  }

  const sourceObject = source as Record<string, unknown>
  const sourceKeys = Object.keys(sourceObject)
  const allowedMembers = ['pointer', 'parameter']
  const additionalMembers = sourceKeys.filter(key => !allowedMembers.includes(key))

  if (additionalMembers.length > 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Source Additional Members',
      context,
      message: `Error source contains additional members not allowed: ${additionalMembers.join(', ')}. Only "pointer" and "parameter" are allowed`
    })
  }

  // Validate that at least one of pointer or parameter is present
  const hasPointer = Object.prototype.hasOwnProperty.call(sourceObject, 'pointer')
  const hasParameter = Object.prototype.hasOwnProperty.call(sourceObject, 'parameter')

  if (!hasPointer && !hasParameter) {
    results.valid = false
    results.errors.push({
      test: 'Error Source Structure',
      context,
      message: 'Error source must contain at least one of "pointer" or "parameter" members'
    })
  }

  // Validate 'pointer' member if present
  if (hasPointer) {
    const pointerValidation = validateJsonPointer(sourceObject.pointer, `${context}.source.pointer`)
    results.details.push(...pointerValidation.details)
    if (!pointerValidation.valid) {
      results.valid = false
      results.errors.push(...pointerValidation.errors)
    }
  }

  // Validate 'parameter' member if present
  if (hasParameter) {
    const parameterValidation = validateErrorSourceParameter(sourceObject.parameter, `${context}.source.parameter`)
    results.details.push(...parameterValidation.details)
    if (!parameterValidation.valid) {
      results.valid = false
      results.errors.push(...parameterValidation.errors)
    }
  }

  if (results.valid && additionalMembers.length === 0) {
    const membersList: string[] = []
    if (hasPointer) membersList.push('pointer')
    if (hasParameter) membersList.push('parameter')

    results.details.push({
      test: 'Error Source Member',
      status: 'passed',
      context,
      message: `Error source object structure is valid (contains: ${membersList.join(', ')})`
    })
  }

  return results
}

/**
 * Validates a JSON Pointer according to RFC 6901
 * @param pointer - The pointer value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateJsonPointer(pointer: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof pointer !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'JSON Pointer',
      context,
      message: 'JSON Pointer must be a string'
    })
    return results
  }

  // JSON Pointer must start with '/' or be empty string
  if (pointer !== '' && !pointer.startsWith('/')) {
    results.valid = false
    results.errors.push({
      test: 'JSON Pointer Format',
      context,
      message: 'JSON Pointer must start with "/" or be empty string'
    })
    return results
  }

  // Validate escape sequences: ~0 (represents ~) and ~1 (represents /)
  // Any ~ must be followed by 0 or 1, and ~ at end of string is invalid
  const invalidEscapes = pointer.match(/~[^01]|~$/g)
  if (invalidEscapes) {
    results.valid = false
    results.errors.push({
      test: 'JSON Pointer Escaping',
      context,
      message: `JSON Pointer contains invalid escape sequences: ${invalidEscapes.join(', ')}. Only ~0 and ~1 are allowed`
    })
    return results
  }

  results.details.push({
    test: 'JSON Pointer',
    status: 'passed',
    context,
    message: `JSON Pointer format is valid: "${pointer}"`
  })

  return results
}

/**
 * Validates the 'parameter' member of an error source object
 * @param parameter - The parameter value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorSourceParameter(parameter: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof parameter !== 'string') {
    results.valid = false
    results.errors.push({
      test: 'Error Source Parameter',
      context,
      message: 'Error source parameter must be a string'
    })
  } else if (parameter.length === 0) {
    results.valid = false
    results.errors.push({
      test: 'Error Source Parameter',
      context,
      message: 'Error source parameter cannot be empty string'
    })
  } else {
    results.details.push({
      test: 'Error Source Parameter',
      status: 'passed',
      context,
      message: `Error source parameter is valid: "${parameter}"`
    })
  }

  return results
}

/**
 * Validates the 'meta' member of an error object
 * @param meta - The meta value to validate
 * @param context - Context for error messages
 * @returns Validation result
 */
function validateErrorMetaMember(meta: unknown, context: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    results.valid = false
    results.errors.push({
      test: 'Error Meta Member',
      context,
      message: 'Error meta must be an object'
    })
  } else {
    const metaObject = meta as Record<string, unknown>
    const metaKeys = Object.keys(metaObject)

    // Validate each meta member name follows JSON:API naming conventions
    for (const metaName of metaKeys) {
      const nameValidation = validateMemberName(metaName, `${context}.meta.${metaName}`) as ValidationResult
      results.details.push(...nameValidation.details)
      if (!nameValidation.valid) {
        results.valid = false
        results.errors.push(...nameValidation.errors)
      }
    }

    results.details.push({
      test: 'Error Meta Member',
      status: 'passed',
      context,
      message: `Error meta object structure is valid (${metaKeys.length} properties)`
    })
  }

  return results
}
