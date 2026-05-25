/**
 * DocumentValidator.ts
 *
 * Validates JSON:API v1.1 top-level document structure compliance.
 * Based on specification: https://jsonapi.org/format/1.1/
 */

import { validateResourceObject, validateResourceCollection, validateMemberName } from './ResourceValidator.js'
import { validateErrorsMember } from './ErrorValidator.js'
import { isValidUrl, getUrlValidationError } from '../utils/UrlValidator.js'
import type { JsonApiDocument, JsonApiResource } from '../types/validation'

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

interface LinkObject {
  href: string
  rel?: string
  describedby?: string
  title?: string
  type?: string
  hreflang?: string | string[]
  meta?: Record<string, unknown>
}

type Link = string | LinkObject | null

interface RelationshipData {
  type: string
  id: string
}

interface RelationshipObject {
  data?: RelationshipData | RelationshipData[] | null
  links?: Record<string, unknown>
  meta?: Record<string, unknown>
}

/**
 * Validates a JSON:API document's top-level structure
 * @param response - The response object to validate
 * @returns Validation result with success/failure and details
 */
export function validateDocument(response: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Step 1: Validate that response is valid JSON (assume already parsed)
  if (response === null || response === undefined) {
    results.valid = false
    results.errors.push({
      test: 'JSON Parsing',
      message: 'Response is null or undefined'
    })
    return results
  }

  if (typeof response !== 'object') {
    results.valid = false
    results.errors.push({
      test: 'JSON Parsing',
      message: 'Response must be a JSON object'
    })
    return results
  }

  results.details.push({
    test: 'JSON Parsing',
    status: 'passed',
    message: 'Response is valid JSON object'
  })

  const doc = response as JsonApiDocument

  // Step 2: Check that top-level contains at least one of: data, errors, or meta
  const hasData = Object.prototype.hasOwnProperty.call(doc, 'data')
  const hasErrors = Object.prototype.hasOwnProperty.call(doc, 'errors')
  const hasMeta = Object.prototype.hasOwnProperty.call(doc, 'meta')

  if (!hasData && !hasErrors && !hasMeta) {
    results.valid = false
    results.errors.push({
      test: 'Required Top-Level Members',
      message: 'Document must contain at least one of: "data", "errors", or "meta"'
    })
  } else {
    results.details.push({
      test: 'Required Top-Level Members',
      status: 'passed',
      message: 'Document contains at least one required top-level member'
    })
  }

  // Step 3: Ensure data and errors are not both present
  if (hasData && hasErrors) {
    results.valid = false
    results.errors.push({
      test: 'Data and Errors Exclusivity',
      message: 'Document must not contain both "data" and "errors" at the top level'
    })
  } else {
    results.details.push({
      test: 'Data and Errors Exclusivity',
      status: 'passed',
      message: 'Document does not have both "data" and "errors" present'
    })
  }

  // Step 4: Validate data structure if present
  if (hasData) {
    const dataValidation = validateDataMember(doc.data)
    results.details.push(...dataValidation.details)
    if (!dataValidation.valid) {
      results.valid = false
      results.errors.push(...dataValidation.errors)
    }
    if (dataValidation.warnings) {
      results.warnings.push(...dataValidation.warnings)
    }
  }

  // Step 4b: Validate errors structure if present
  if (hasErrors) {
    const errorsValidation = validateErrorsMember(doc.errors) as ValidationResult
    results.details.push(...errorsValidation.details)
    if (!errorsValidation.valid) {
      results.valid = false
      results.errors.push(...errorsValidation.errors)
    }
    if (errorsValidation.warnings) {
      results.warnings.push(...errorsValidation.warnings)
    }
  }

  // Step 5: Validate optional included array and compound document rules
  const hasIncluded = Object.prototype.hasOwnProperty.call(doc, 'included')

  if (hasIncluded) {
    // First validate that included is only present when data is present
    if (!hasData) {
      results.valid = false
      results.errors.push({
        test: 'Compound Document Structure',
        message: 'Included member must not be present without data member'
      })
    } else {
      results.details.push({
        test: 'Compound Document Structure',
        status: 'passed',
        message: 'Included member is properly paired with data member'
      })
    }

    // Validate the included member structure
    const includedValidation = validateIncludedMember(doc.included)
    results.details.push(...includedValidation.details)
    if (!includedValidation.valid) {
      results.valid = false
      results.errors.push(...includedValidation.errors)
    }
    if (includedValidation.warnings) {
      results.warnings.push(...includedValidation.warnings)
    }

    // Validate compound document if both data and included are present and valid
    if (hasData && includedValidation.valid && results.valid) {
      const compoundValidation = validateCompoundDocument(doc.data, doc.included!)
      results.details.push(...compoundValidation.details)
      if (!compoundValidation.valid) {
        results.valid = false
        results.errors.push(...compoundValidation.errors)
      }
      if (compoundValidation.warnings) {
        results.warnings.push(...compoundValidation.warnings)
      }
    }
  }

  // Step 6: Validate optional links object
  if (Object.prototype.hasOwnProperty.call(doc, 'links')) {
    const linksValidation = validateLinksMember(doc.links!)
    results.details.push(...linksValidation.details)
    if (!linksValidation.valid) {
      results.valid = false
      results.errors.push(...linksValidation.errors)
    }
  }

  // Step 7: Validate optional jsonapi object
  if (Object.prototype.hasOwnProperty.call(doc, 'jsonapi')) {
    const jsonApiValidation = validateJsonApiMember(doc.jsonapi!)
    results.details.push(...jsonApiValidation.details)
    if (!jsonApiValidation.valid) {
      results.valid = false
      results.errors.push(...jsonApiValidation.errors)
    }
  }

  // Step 7b: Validate optional top-level meta object
  if (Object.prototype.hasOwnProperty.call(doc, 'meta')) {
    const metaValidation = validateTopLevelMetaMember(doc.meta!)
    results.details.push(...metaValidation.details)
    if (!metaValidation.valid) {
      results.valid = false
      results.errors.push(...metaValidation.errors)
    }
  }

  // Step 8: Check for additional top-level members beyond allowed ones
  const allowedMembers = ['data', 'errors', 'meta', 'links', 'included', 'jsonapi']
  const presentMembers = Object.keys(doc)
  const additionalMembers = presentMembers.filter(member => !allowedMembers.includes(member))

  if (additionalMembers.length > 0) {
    results.valid = false
    results.errors.push({
      test: 'Additional Top-Level Members',
      message: `Document contains additional top-level members not allowed by JSON:API spec: ${additionalMembers.join(', ')}`
    })
  } else {
    results.details.push({
      test: 'Additional Top-Level Members',
      status: 'passed',
      message: 'Document contains only allowed top-level members'
    })
  }

  return results
}

/**
 * Validates the data member structure
 * @param data - The data value to validate
 * @returns Validation result
 */
function validateDataMember(data: JsonApiResource | JsonApiResource[] | null | undefined): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // data can be:
  // - null for empty single resource
  // - Resource object for single resource
  // - Array of resource objects for collection
  // - Empty array for empty collection

  if (data === null) {
    results.details.push({
      test: 'Data Member Structure',
      status: 'passed',
      message: 'Data is null (valid for empty single resource)'
    })
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      results.details.push({
        test: 'Data Member Structure',
        status: 'passed',
        message: 'Data is empty array (valid for empty collection)'
      })
    } else {
      // Validate resource collection using comprehensive ResourceValidator
      const collectionValidation = validateResourceCollection(data, { context: 'data' }) as ValidationResult
      results.details.push(...collectionValidation.details)
      if (!collectionValidation.valid) {
        results.valid = false
        results.errors.push(...collectionValidation.errors)
      }
      if (collectionValidation.warnings) {
        results.warnings.push(...collectionValidation.warnings)
      }
    }
  } else if (typeof data === 'object') {
    // Single resource object - use comprehensive ResourceValidator
    const resourceValidation = validateResourceObject(data, { context: 'data' }) as ValidationResult
    results.details.push(...resourceValidation.details)
    if (!resourceValidation.valid) {
      results.valid = false
      results.errors.push(...resourceValidation.errors)
    }
    if (resourceValidation.warnings) {
      results.warnings.push(...resourceValidation.warnings)
    }
  } else {
    results.valid = false
    results.errors.push({
      test: 'Data Member Structure',
      message: 'Data must be null, a resource object, or an array of resource objects'
    })
  }

  return results
}

/**
 * Validates the included member
 * @param included - The included value to validate
 * @returns Validation result
 */
function validateIncludedMember(included: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (!Array.isArray(included)) {
    results.valid = false
    results.errors.push({
      test: 'Included Member Structure',
      message: 'Included member must be an array'
    })
    return results
  }

  if (included.length === 0) {
    results.warnings.push({
      test: 'Included Member Structure',
      message: 'Included array is empty - consider omitting if no included resources'
    })
  }

  // Validate each resource in included array using comprehensive ResourceValidator
  const collectionValidation = validateResourceCollection(included as JsonApiResource[], { context: 'included' }) as ValidationResult
  results.details.push(...collectionValidation.details)
  if (!collectionValidation.valid) {
    results.valid = false
    results.errors.push(...collectionValidation.errors)
  }
  if (collectionValidation.warnings) {
    results.warnings.push(...collectionValidation.warnings)
  }

  return results
}

/**
 * Validates compound document rules - linkage, duplicates, and circular references
 * @param data - The primary data (resource object, array of resources, or null)
 * @param included - The included resources array
 * @returns Validation result
 */
function validateCompoundDocument(
  data: JsonApiResource | JsonApiResource[] | null | undefined,
  included: JsonApiResource[]
): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Skip most validation if data is null, but check for orphaned included resources
  if (data === null) {
    if (included.length > 0) {
      results.valid = false
      results.errors.push({
        test: 'Resource Linkage',
        message: `All ${included.length} included resources are orphaned when data is null`
      })
    } else {
      results.details.push({
        test: 'Compound Document Validation',
        status: 'passed',
        message: 'No compound document validation needed (data is null and included is empty)'
      })
    }
    return results
  }

  // Skip validation if included is empty
  if (!Array.isArray(included) || included.length === 0) {
    results.details.push({
      test: 'Compound Document Validation',
      status: 'passed',
      message: 'No compound document validation needed (included is empty)'
    })
    return results
  }

  // Step 1: Check for duplicate resources in included array
  const duplicateValidation = validateNoDuplicatesInIncluded(included)
  results.details.push(...duplicateValidation.details)
  if (!duplicateValidation.valid) {
    results.valid = false
    results.errors.push(...duplicateValidation.errors)
  }

  // Step 2: Validate that all included resources are referenced from primary data
  const linkageValidation = validateResourceLinkage(data, included)
  results.details.push(...linkageValidation.details)
  if (!linkageValidation.valid) {
    results.valid = false
    results.errors.push(...linkageValidation.errors)
  }
  if (linkageValidation.warnings) {
    results.warnings.push(...linkageValidation.warnings)
  }

  // Step 3: Check for circular references
  const circularRefValidation = validateNoCircularReferences(data, included)
  results.details.push(...circularRefValidation.details)
  if (!circularRefValidation.valid) {
    results.valid = false
    results.errors.push(...circularRefValidation.errors)
  }

  return results
}

/**
 * Validates the links member
 * @param links - The links value to validate
 * @returns Validation result
 */
function validateLinksMember(links: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof links !== 'object' || links === null) {
    results.valid = false
    results.errors.push({
      test: 'Links Member Structure',
      message: 'Links member must be an object'
    })
    return results
  }

  const linksObj = links as Record<string, Link>
  const linkKeys = Object.keys(linksObj)
  let allLinksValid = true

  // Common pagination link names for document-level links
  const paginationLinks = ['first', 'last', 'prev', 'next', 'self', 'related']

  for (const linkName of linkKeys) {
    const linkValue = linksObj[linkName]!
    const context = `links.${linkName}`

    // Validate the link value (string, link object, or null)
    const linkValidation = validateDocumentLinkValue(linkValue, context, linkName)
    results.details.push(...linkValidation.details)
    if (!linkValidation.valid) {
      allLinksValid = false
      results.errors.push(...linkValidation.errors)
    }
  }

  if (allLinksValid) {
    const knownLinks = linkKeys.filter(key => paginationLinks.includes(key))
    const customLinks = linkKeys.filter(key => !paginationLinks.includes(key))

    let message = `Links object contains ${linkKeys.length} valid link(s)`
    if (knownLinks.length > 0) {
      message += ` (includes: ${knownLinks.join(', ')})`
    }
    if (customLinks.length > 0) {
      message += ` (custom links: ${customLinks.join(', ')})`
    }

    results.details.push({
      test: 'Links Member Structure',
      status: 'passed',
      message
    })
  } else {
    results.valid = false
  }

  return results
}

/**
 * Validates a single document-level link value
 * @param link - The link value to validate
 * @param context - Context for error messages
 * @param linkName - Name of the link being validated
 * @returns Validation result
 */
function validateDocumentLinkValue(link: Link, context: string, linkName: string): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (link === null) {
    results.details.push({
      test: 'Document Link Value',
      status: 'passed',
      context,
      message: 'Link value is null (valid for indicating no link available)'
    })
    return results
  }

  if (typeof link === 'string') {
    if (link.length === 0) {
      results.valid = false
      results.errors.push({
        test: 'Document Link Value',
        context,
        message: 'Link string cannot be empty'
      })
    } else {
      // Validate URL format
      if (!isValidUrl(link)) {
        const urlError = getUrlValidationError(link)
        results.valid = false
        results.errors.push({
          test: 'Document Link URL Format',
          context,
          message: urlError || 'Document link URL format is invalid'
        })
      } else {
        results.details.push({
          test: 'Document Link Value',
          status: 'passed',
          context,
          message: `Document link "${linkName}" URL format is valid`
        })
      }
    }
  } else if (typeof link === 'object' && !Array.isArray(link)) {
    const linkObj = link as LinkObject

    // Link object must have href member
    if (!Object.prototype.hasOwnProperty.call(linkObj, 'href')) {
      results.valid = false
      results.errors.push({
        test: 'Document Link Object Structure',
        context,
        message: 'Document link object must have an "href" member'
      })
    } else if (typeof linkObj.href !== 'string' || linkObj.href.length === 0) {
      results.valid = false
      results.errors.push({
        test: 'Document Link Object Structure',
        context,
        message: 'Document link object "href" must be a non-empty string'
      })
    } else {
      // Validate href URL format
      if (!isValidUrl(linkObj.href)) {
        const urlError = getUrlValidationError(linkObj.href)
        results.valid = false
        results.errors.push({
          test: 'Document Link Object URL Format',
          context,
          message: urlError || 'Document link object "href" URL format is invalid'
        })
      } else {
        results.details.push({
          test: 'Document Link Object Structure',
          status: 'passed',
          context,
          message: `Document link "${linkName}" href URL format is valid`
        })
      }
    }

    // Validate optional meta member
    if (Object.prototype.hasOwnProperty.call(linkObj, 'meta')) {
      if (typeof linkObj.meta !== 'object' || linkObj.meta === null || Array.isArray(linkObj.meta)) {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Meta',
          context,
          message: 'Document link object "meta" must be an object'
        })
      } else {
        // Validate meta member names follow JSON:API naming conventions
        const metaKeys = Object.keys(linkObj.meta)
        for (const metaName of metaKeys) {
          const nameValidation = validateMemberName(metaName, `${context}.meta.${metaName}`) as ValidationResult
          results.details.push(...nameValidation.details)
          if (!nameValidation.valid) {
            results.valid = false
            results.errors.push(...nameValidation.errors)
          }
        }

        results.details.push({
          test: 'Document Link Object Meta',
          status: 'passed',
          context,
          message: `Document link "${linkName}" meta structure is valid`
        })
      }
    }

    // Validate optional JSON:API v1.1 link object members
    const validLinkMembers = ['href', 'rel', 'describedby', 'title', 'type', 'hreflang', 'meta']

    // Validate 'rel' member if present
    if (Object.prototype.hasOwnProperty.call(linkObj, 'rel')) {
      if (typeof linkObj.rel !== 'string' || linkObj.rel.length === 0) {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Rel',
          context,
          message: 'Link object "rel" must be a non-empty string'
        })
      } else {
        results.details.push({
          test: 'Document Link Object Rel',
          status: 'passed',
          context,
          message: `Link rel type is valid: "${linkObj.rel}"`
        })
      }
    }

    // Validate 'describedby' member if present
    if (Object.prototype.hasOwnProperty.call(linkObj, 'describedby')) {
      if (typeof linkObj.describedby !== 'string' || !isValidUrl(linkObj.describedby)) {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Describedby',
          context,
          message: 'Link object "describedby" must be a valid URL'
        })
      } else {
        results.details.push({
          test: 'Document Link Object Describedby',
          status: 'passed',
          context,
          message: 'Link describedby URL is valid'
        })
      }
    }

    // Validate 'title' member if present
    if (Object.prototype.hasOwnProperty.call(linkObj, 'title')) {
      if (typeof linkObj.title !== 'string' || linkObj.title.length === 0) {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Title',
          context,
          message: 'Link object "title" must be a non-empty string'
        })
      } else {
        results.details.push({
          test: 'Document Link Object Title',
          status: 'passed',
          context,
          message: `Link title is valid: "${linkObj.title}"`
        })
      }
    }

    // Validate 'type' member if present
    if (Object.prototype.hasOwnProperty.call(linkObj, 'type')) {
      if (typeof linkObj.type !== 'string' || linkObj.type.length === 0) {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Type',
          context,
          message: 'Link object "type" must be a non-empty string (media type)'
        })
      } else {
        // Basic media type validation
        if (!linkObj.type.includes('/')) {
          results.warnings.push({
            test: 'Document Link Object Type',
            context,
            message: `Link type "${linkObj.type}" should be a valid media type (e.g., "application/json")`
          })
        } else {
          results.details.push({
            test: 'Document Link Object Type',
            status: 'passed',
            context,
            message: `Link media type is valid: "${linkObj.type}"`
          })
        }
      }
    }

    // Validate 'hreflang' member if present
    if (Object.prototype.hasOwnProperty.call(linkObj, 'hreflang')) {
      if (typeof linkObj.hreflang === 'string') {
        // Single language tag
        if (!isValidLanguageTag(linkObj.hreflang)) {
          results.warnings.push({
            test: 'Document Link Object Hreflang',
            context,
            message: `Link hreflang "${linkObj.hreflang}" should be a valid language tag (e.g., "en", "en-US")`
          })
        } else {
          results.details.push({
            test: 'Document Link Object Hreflang',
            status: 'passed',
            context,
            message: `Link hreflang is valid: "${linkObj.hreflang}"`
          })
        }
      } else if (Array.isArray(linkObj.hreflang)) {
        // Array of language tags
        let allValid = true
        linkObj.hreflang.forEach(lang => {
          if (typeof lang !== 'string' || !isValidLanguageTag(lang)) {
            allValid = false
          }
        })
        if (!allValid) {
          results.warnings.push({
            test: 'Document Link Object Hreflang',
            context,
            message: 'Link hreflang array should contain valid language tags'
          })
        } else {
          results.details.push({
            test: 'Document Link Object Hreflang',
            status: 'passed',
            context,
            message: `Link hreflang array is valid: [${linkObj.hreflang.join(', ')}]`
          })
        }
      } else {
        results.valid = false
        results.errors.push({
          test: 'Document Link Object Hreflang',
          context,
          message: 'Link object "hreflang" must be a string or array of strings'
        })
      }
    }

    // Check for additional members beyond allowed ones
    const linkKeys = Object.keys(linkObj)
    const additionalMembers = linkKeys.filter(key => !validLinkMembers.includes(key))

    if (additionalMembers.length > 0) {
      results.valid = false
      results.errors.push({
        test: 'Document Link Object Additional Members',
        context,
        message: `Document link object contains additional members not allowed: ${additionalMembers.join(', ')}. Allowed members: ${validLinkMembers.join(', ')}`
      })
    } else if (results.valid) {
      results.details.push({
        test: 'Document Link Object Structure',
        status: 'passed',
        context,
        message: `Document link "${linkName}" object structure is valid`
      })
    }
  } else {
    results.valid = false
    results.errors.push({
      test: 'Document Link Value',
      context,
      message: 'Document link must be a string, link object, or null'
    })
  }

  return results
}

/**
 * Validates the jsonapi member
 * @param jsonapi - The jsonapi value to validate
 * @returns Validation result
 */
function validateJsonApiMember(jsonapi: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof jsonapi !== 'object' || jsonapi === null) {
    results.valid = false
    results.errors.push({
      test: 'JSON:API Version Object Structure',
      message: 'JSON:API member must be an object'
    })
    return results
  }

  const jsonApiObj = jsonapi as { version?: string; meta?: Record<string, unknown> }

  // Check for additional members beyond allowed ones
  const allowedMembers = ['version', 'meta']
  const presentMembers = Object.keys(jsonApiObj)
  const additionalMembers = presentMembers.filter(member => !allowedMembers.includes(member))

  if (additionalMembers.length > 0) {
    results.valid = false
    results.errors.push({
      test: 'JSON:API Version Object Additional Members',
      message: `JSON:API object contains additional members not allowed by spec: ${additionalMembers.join(', ')}. Only "version" and "meta" are allowed`
    })
  } else {
    results.details.push({
      test: 'JSON:API Version Object Additional Members',
      status: 'passed',
      message: 'JSON:API object contains only allowed members'
    })
  }

  // Check for version if present
  if (Object.prototype.hasOwnProperty.call(jsonApiObj, 'version')) {
    if (typeof jsonApiObj.version !== 'string') {
      results.valid = false
      results.errors.push({
        test: 'JSON:API Version String Format',
        message: 'JSON:API version must be a string'
      })
    } else {
      // Validate supported version values
      const supportedVersions = ['1.0', '1.1']
      if (!supportedVersions.includes(jsonApiObj.version)) {
        results.valid = false
        results.errors.push({
          test: 'JSON:API Version Value',
          message: `JSON:API version "${jsonApiObj.version}" is not supported. Supported versions: ${supportedVersions.join(', ')}`
        })
      } else {
        results.details.push({
          test: 'JSON:API Version Value',
          status: 'passed',
          message: `JSON:API version "${jsonApiObj.version}" is supported`
        })
      }
    }
  } else {
    results.details.push({
      test: 'JSON:API Version Value',
      status: 'passed',
      message: 'JSON:API object present (version not specified - optional per spec)'
    })
  }

  // Validate optional meta object
  if (Object.prototype.hasOwnProperty.call(jsonApiObj, 'meta')) {
    const metaValidation = validateJsonApiMetaMember(jsonApiObj.meta!)
    results.details.push(...metaValidation.details)
    if (!metaValidation.valid) {
      results.valid = false
      results.errors.push(...metaValidation.errors)
    }
  }

  return results
}

/**
 * Validates the meta member within jsonapi object
 * @param meta - The meta value to validate
 * @returns Validation result
 */
function validateJsonApiMetaMember(meta: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    results.valid = false
    results.errors.push({
      test: 'JSON:API Meta Member',
      message: 'JSON:API "meta" must be an object'
    })
    return results
  }

  const metaObj = meta as Record<string, unknown>
  const metaKeys = Object.keys(metaObj)

  // Validate each meta member name follows JSON:API naming conventions
  for (const metaName of metaKeys) {
    const nameValidation = validateMemberName(metaName, `jsonapi.meta.${metaName}`) as ValidationResult
    results.details.push(...nameValidation.details)
    if (!nameValidation.valid) {
      results.valid = false
      results.errors.push(...nameValidation.errors)
    }
  }

  results.details.push({
    test: 'JSON:API Meta Member',
    status: 'passed',
    message: `JSON:API meta object contains ${metaKeys.length} metadata field(s)`
  })

  return results
}

/**
 * Validates the top-level meta member
 * @param meta - The meta value to validate
 * @returns Validation result
 */
function validateTopLevelMetaMember(meta: unknown): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    results.valid = false
    results.errors.push({
      test: 'Top-Level Meta Member',
      message: 'Top-level "meta" must be an object'
    })
    return results
  }

  const metaObj = meta as Record<string, unknown>
  const metaKeys = Object.keys(metaObj)

  // Validate each meta member name follows JSON:API naming conventions
  for (const metaName of metaKeys) {
    const nameValidation = validateMemberName(metaName, `meta.${metaName}`) as ValidationResult
    results.details.push(...nameValidation.details)
    if (!nameValidation.valid) {
      results.valid = false
      results.errors.push(...nameValidation.errors)
    }
  }

  results.details.push({
    test: 'Top-Level Meta Member',
    status: 'passed',
    message: `Top-level meta object contains ${metaKeys.length} metadata field(s)`
  })

  return results
}

/**
 * Validates that there are no duplicate resources in the included array
 * @param included - The included resources array
 * @returns Validation result
 */
function validateNoDuplicatesInIncluded(included: JsonApiResource[]): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  const seenResources = new Set<string>()
  const duplicates: Array<{ type: string; id: string; index: number }> = []

  for (let i = 0; i < included.length; i++) {
    const resource = included[i]
    if (resource && typeof resource === 'object' && resource.type && resource.id) {
      const resourceKey = `${resource.type}:${resource.id}`
      if (seenResources.has(resourceKey)) {
        duplicates.push({ type: resource.type, id: resource.id, index: i })
      } else {
        seenResources.add(resourceKey)
      }
    }
  }

  if (duplicates.length > 0) {
    results.valid = false
    duplicates.forEach(dup => {
      results.errors.push({
        test: 'Included Resource Duplicates',
        message: `Duplicate resource found in included array: ${dup.type}:${dup.id} at index ${dup.index}`
      })
    })
  } else {
    results.details.push({
      test: 'Included Resource Duplicates',
      status: 'passed',
      message: `No duplicate resources found in included array (${included.length} unique resources)`
    })
  }

  return results
}

/**
 * Validates that all included resources are referenced from the primary data
 * @param data - The primary data (resource object, array, or null)
 * @param included - The included resources array
 * @returns Validation result
 */
function validateResourceLinkage(
  data: JsonApiResource | JsonApiResource[] | null | undefined,
  included: JsonApiResource[]
): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Get all resource identifiers referenced from primary data
  const referencedResources = extractReferencedResources(data)

  // Create set of included resource identifiers
  const includedResources = new Set<string>()
  included.forEach(resource => {
    if (resource && typeof resource === 'object' && resource.type && resource.id) {
      includedResources.add(`${resource.type}:${resource.id}`)
    }
  })

  // Find orphaned resources (included but not referenced)
  const orphanedResources: Array<{ type: string; id: string }> = []
  includedResources.forEach(resourceKey => {
    if (!referencedResources.has(resourceKey)) {
      const parts = resourceKey.split(':')
      const type = parts[0] || ''
      const id = parts.slice(1).join(':') || ''
      orphanedResources.push({ type, id })
    }
  })

  // Find missing resources (referenced but not included)
  const missingResources: Array<{ type: string; id: string }> = []
  referencedResources.forEach(resourceKey => {
    if (!includedResources.has(resourceKey)) {
      const parts = resourceKey.split(':')
      const type = parts[0] || ''
      const id = parts.slice(1).join(':') || ''
      missingResources.push({ type, id })
    }
  })

  // Report orphaned resources as errors
  if (orphanedResources.length > 0) {
    results.valid = false
    orphanedResources.forEach(resource => {
      results.errors.push({
        test: 'Resource Linkage',
        message: `Orphaned included resource: ${resource.type}:${resource.id} is not referenced from primary data`
      })
    })
  }

  // Report missing resources as warnings (they might be intentionally omitted)
  if (missingResources.length > 0) {
    missingResources.forEach(resource => {
      results.warnings.push({
        test: 'Resource Linkage',
        message: `Referenced resource ${resource.type}:${resource.id} is not included in compound document`
      })
    })
  }

  if (orphanedResources.length === 0 && missingResources.length === 0) {
    results.details.push({
      test: 'Resource Linkage',
      status: 'passed',
      message: `Perfect linkage: all ${included.length} included resources are referenced from primary data`
    })
  } else if (orphanedResources.length === 0) {
    results.details.push({
      test: 'Resource Linkage',
      status: 'passed',
      message: `No orphaned resources found (${missingResources.length} referenced resources not included)`
    })
  }

  return results
}

/**
 * Extracts all resource identifiers referenced from relationships in primary data
 * @param data - The primary data (resource object, array, or null)
 * @returns Set of resource identifiers in format "type:id"
 */
function extractReferencedResources(data: JsonApiResource | JsonApiResource[] | null | undefined): Set<string> {
  const references = new Set<string>()

  if (data === null || data === undefined) {
    return references
  }

  const resources = Array.isArray(data) ? data : [data]

  resources.forEach(resource => {
    if (resource && typeof resource === 'object' && resource.relationships) {
      Object.values(resource.relationships as Record<string, RelationshipObject>).forEach((relationship) => {
        if (relationship && relationship.data) {
          const relData = Array.isArray(relationship.data) ? relationship.data : [relationship.data]
          relData.forEach((rel) => {
            if (rel && rel.type && rel.id) {
              references.add(`${rel.type}:${rel.id}`)
            }
          })
        }
      })
    }
  })

  return references
}

/**
 * Validates that there are no circular references in compound documents
 * Note: In JSON:API, bidirectional relationships are normal and allowed.
 * This validation primarily serves as informational analysis rather than strict validation.
 * @param data - The primary data
 * @param included - The included resources array
 * @returns Validation result
 */
function validateNoCircularReferences(
  data: JsonApiResource | JsonApiResource[] | null | undefined,
  included: JsonApiResource[]
): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: []
  }

  // Create a map of all resources (primary + included) for reference lookup
  const allResources = new Map<string, JsonApiResource>()

  // Add primary data resources
  if (data !== null && data !== undefined) {
    const primaryResources = Array.isArray(data) ? data : [data]
    primaryResources.forEach(resource => {
      if (resource && typeof resource === 'object' && resource.type && resource.id) {
        allResources.set(`${resource.type}:${resource.id}`, resource)
      }
    })
  }

  // Add included resources
  included.forEach(resource => {
    if (resource && typeof resource === 'object' && resource.type && resource.id) {
      allResources.set(`${resource.type}:${resource.id}`, resource)
    }
  })

  // Analyze relationship structure for informational purposes
  const relationshipCount = analyzeRelationshipStructure(allResources)

  results.details.push({
    test: 'Circular References',
    status: 'passed',
    message: `Relationship structure analyzed: ${allResources.size} resources with ${relationshipCount.total} relationships (${relationshipCount.bidirectional} bidirectional). Bidirectional relationships are normal in JSON:API.`
  })

  return results
}

/**
 * Analyzes relationship structure in compound documents for informational purposes
 * @param allResources - Map of all resources (primary + included)
 * @returns Analysis results with counts
 */
function analyzeRelationshipStructure(allResources: Map<string, JsonApiResource>): { total: number; bidirectional: number } {
  let totalRelationships = 0
  let bidirectionalCount = 0
  const relationships = new Set<string>()

  for (const [resourceKey, resource] of allResources) {
    if (resource.relationships) {
      Object.values(resource.relationships as Record<string, RelationshipObject>).forEach((relationship) => {
        if (relationship && relationship.data) {
          const relData = Array.isArray(relationship.data) ? relationship.data : [relationship.data]
          relData.forEach((rel) => {
            if (rel && rel.type && rel.id) {
              const relKey = `${rel.type}:${rel.id}`
              const relationshipPair = `${resourceKey}->${relKey}`
              const reverseRelationshipPair = `${relKey}->${resourceKey}`

              relationships.add(relationshipPair)
              totalRelationships++

              // Check if reverse relationship exists
              if (relationships.has(reverseRelationshipPair)) {
                bidirectionalCount++
              }
            }
          })
        }
      })
    }
  }

  return {
    total: totalRelationships,
    bidirectional: Math.floor(bidirectionalCount / 2) // Each bidirectional pair is counted twice
  }
}

/**
 * Helper function to validate language tags according to BCP 47
 * @param langTag - Language tag to validate
 * @returns True if valid language tag format
 */
function isValidLanguageTag(langTag: string): boolean {
  if (!langTag || typeof langTag !== 'string') return false

  // Basic BCP 47 language tag validation
  // Simplified regex for common patterns: language[-script][-region][-variant]
  const langTagRegex = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|[0-9]{3})?(-[a-zA-Z0-9]{5,8}|-[0-9][a-zA-Z0-9]{3})*$/
  return langTagRegex.test(langTag)
}
