/**
 * ValidationService.ts
 *
 * Service that coordinates API requests and validation
 */

import { makeRequest } from '../utils/ApiClient.js'
import { validateDocument } from '../validators/DocumentValidator.js'
import { validateSparseFieldsets, validateFieldsetSyntax } from '../validators/QueryValidator.js'
import { validateQueryParameters } from '../validators/QueryParameterValidator.js'
import { validatePagination } from '../validators/PaginationValidator.js'
import { validateHttpStatus } from '../validators/HttpStatusValidator.js'
import { validateRequestDocument } from '../validators/RequestValidator.js'
import { validateJsonApiObjectExtended } from '../validators/JsonApiObjectValidator.js'
import { validateContentNegotiation } from '../validators/ContentNegotiationValidator.js'
import { validateUrlStructure } from '../validators/UrlStructureValidator.js'
import { createComprehensiveReport } from '../utils/ValidationReporter.js'
import type { ValidationTest, ValidationReport, JsonApiDocument, TestConfig } from '../types/validation.js'

/**
 * Extended test config with optional fields for compatibility
 */
export interface ExtendedTestConfig {
  apiUrl: string
  httpMethod: string
  requestBody?: string | object
  readOnlyFields?: string[]
  customHeaders?: Record<string, string> | Array<{ key: string; value: string }>
  authToken?: string
  authType?: 'none' | 'bearer' | 'apiKey' | 'basic'
  authCredentials?: {
    token?: string
    key?: string
    username?: string
    password?: string
  }
}

/**
 * Internal validation results object (before comprehensive report)
 */
interface InternalValidationResults {
  timestamp: string
  endpoint: string
  method: string
  status: 'completed' | 'error'
  httpStatus?: number
  contentType?: string
  error?: string
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
  details: ValidationTest[]
  duration?: string
}

/**
 * Query parameters from URL
 */
interface QueryParams {
  [key: string]: string
}

/**
 * Runs comprehensive JSON:API validation on an endpoint
 * @param config - Test configuration
 * @returns Validation results
 */
export async function runValidation(config: ExtendedTestConfig): Promise<ValidationReport> {
  const startTime = Date.now()

  // Initialize results object early to avoid reference errors
  const results: InternalValidationResults = {
    timestamp: new Date().toISOString(),
    endpoint: config.apiUrl,
    method: config.httpMethod,
    status: 'completed',
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    },
    details: []
  }

  try {
    // Extract query parameters from URL for validation
    let queryParams: QueryParams = {}
    try {
      const url = new URL(config.apiUrl)
      queryParams = Object.fromEntries(url.searchParams.entries())
    } catch {
      // If URL parsing fails, we'll continue without query parameter validation
    }

    // Step 1: Validate query parameter syntax (before making request)
    const queryValidation = validateFieldsetSyntax(queryParams)

    // Step 3: Validate URL structure
    const urlValidation = validateUrlStructure(config.apiUrl)

    // Add URL structure validation results
    results.details.push(...urlValidation.details)
    urlValidation.errors.forEach(error => {
      results.details.push({
        test: error.test,
        status: 'failed',
        message: error.message
      })
      results.summary.failed++
    })
    urlValidation.warnings.forEach(warning => {
      results.details.push({
        test: warning.test,
        status: 'warning',
        message: warning.message
      })
      results.summary.warnings++
    })
    urlValidation.details.forEach(detail => {
      if (detail.status === 'passed') {
        results.summary.passed++
      }
    })

    // Step 4: Validate request body if present
    // Note: Currently only validates for POST/PATCH with request body
    // GET requests don't have request bodies to validate
    if (['POST', 'PUT', 'PATCH'].includes(config.httpMethod) && config.requestBody) {
      try {
        const requestBody = typeof config.requestBody === 'string'
          ? JSON.parse(config.requestBody)
          : config.requestBody

        const requestValidation = validateRequestDocument(requestBody, config.httpMethod, {
          readOnlyFields: config.readOnlyFields || []
        })

        // Add request validation results
        results.details.push(...requestValidation.details)
        requestValidation.errors.forEach((error: { test: string; message: string }) => {
          results.details.push({
            test: error.test,
            status: 'failed',
            message: error.message
          })
          results.summary.failed++
        })
        requestValidation.warnings.forEach((warning: { test: string; message: string }) => {
          results.details.push({
            test: warning.test,
            status: 'warning',
            message: warning.message
          })
          results.summary.warnings++
        })
        requestValidation.details.forEach(detail => {
          if (detail.status === 'passed') {
            results.summary.passed++
          }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.details.push({
          test: 'Request Body Parsing',
          status: 'failed',
          message: `Failed to parse request body as JSON: ${errorMessage}`
        })
        results.summary.failed++
      }
    }

    // Step 5: Make the API request
    const response = await makeRequest(config as unknown as TestConfig)

    if (!response.success) {
      const errorResults: InternalValidationResults = {
        timestamp: new Date().toISOString(),
        endpoint: config.apiUrl,
        method: config.httpMethod,
        status: 'error',
        error: `Request failed: ${response.error}`,
        summary: {
          total: 0,
          passed: 0,
          failed: 1,
          warnings: 0
        },
        details: [{
          test: 'HTTP Request',
          status: 'failed',
          message: response.error || 'Unknown error'
        }]
      }
      return createComprehensiveReport(errorResults) as ValidationReport
    }

    // Update results with response information after successful request
    results.httpStatus = response.status
    results.contentType = response.headers['content-type'] || 'unknown'

    // Add query parameter validation results
    results.details.push(...queryValidation.details)
    queryValidation.errors.forEach(error => {
      results.details.push({
        test: error.test,
        status: 'failed',
        message: error.message
      })
      results.summary.failed++
    })
    queryValidation.warnings.forEach(warning => {
      results.details.push({
        test: warning.test,
        status: 'warning',
        message: warning.message
      })
      results.summary.warnings++
    })
    queryValidation.details.forEach(detail => {
      if (detail.status === 'passed') {
        results.summary.passed++
      }
    })

    // Step 6: Validate content negotiation
    const contentNegotiationValidation = validateContentNegotiation(response.headers, {
      validateContentType: true,
      validateAccept: false // We validate the response Content-Type, not request Accept
    })

    // Add content negotiation validation results
    results.details.push(...contentNegotiationValidation.details)
    contentNegotiationValidation.errors.forEach(error => {
      results.details.push({
        test: error.test,
        status: 'failed',
        message: error.message
      })
      results.summary.failed++
    })
    contentNegotiationValidation.warnings.forEach(warning => {
      results.details.push({
        test: warning.test,
        status: 'warning',
        message: warning.message
      })
      results.summary.warnings++
    })
    contentNegotiationValidation.details.forEach(detail => {
      if (detail.status === 'passed') {
        results.summary.passed++
      }
    })

    // Step 7: Check JSON parsing
    if (response.parseError) {
      results.details.push({
        test: 'JSON Parsing',
        status: 'failed',
        message: response.parseError
      })
      results.summary.failed++
    } else {
      results.details.push({
        test: 'JSON Parsing',
        status: 'passed',
        message: 'Response is valid JSON'
      })
      results.summary.passed++
    }

    // Step 8: Validate HTTP status code
    const statusValidation = validateHttpStatus(response.status, config.httpMethod, response.data as JsonApiDocument | null)

    // Add HTTP status validation results
    results.details.push(...statusValidation.details)

    // Add any errors
    statusValidation.errors.forEach(error => {
      results.details.push({
        test: error.test,
        status: 'failed',
        message: error.message
      })
      results.summary.failed++
    })

    // Add any warnings
    statusValidation.warnings.forEach(warning => {
      results.details.push({
        test: warning.test,
        status: 'warning',
        message: warning.message
      })
      results.summary.warnings++
    })

    // Count passed tests from status validation
    statusValidation.details.forEach(detail => {
      if (detail.status === 'passed') {
        results.summary.passed++
      }
    })

    // Step 9: Validate query parameters
    const queryParamValidation = validateQueryParameters(config.apiUrl, response.data)

    // Add query parameter validation results
    results.details.push(...queryParamValidation.details)

    // Add any errors
    queryParamValidation.errors.forEach(error => {
      results.details.push({
        test: error.test,
        status: 'failed',
        message: error.message
      })
      results.summary.failed++
    })

    // Add any warnings
    queryParamValidation.warnings.forEach(warning => {
      results.details.push({
        test: warning.test,
        status: 'warning',
        message: warning.message
      })
      results.summary.warnings++
    })

    // Count passed tests from query parameter validation
    queryParamValidation.details.forEach(detail => {
      if (detail.status === 'passed') {
        results.summary.passed++
      }
    })

    // Step 10: Validate document structure (if JSON parsed successfully)
    if (!response.parseError && response.data !== null) {
      const documentValidation = validateDocument(response.data)

      // Add document validation results
      results.details.push(...documentValidation.details)

      // Add any errors
      documentValidation.errors.forEach(error => {
        results.details.push({
          test: error.test,
          status: 'failed',
          message: error.message
        })
        results.summary.failed++
      })

      // Add any warnings
      documentValidation.warnings.forEach(warning => {
        results.details.push({
          test: warning.test,
          status: 'warning',
          message: warning.message
        })
        results.summary.warnings++
      })

      // Count passed tests from document validation
      documentValidation.details.forEach(detail => {
        if (detail.status === 'passed') {
          results.summary.passed++
        }
      })

      // Step 10b: Enhanced JSON:API object validation
      if (response.data && typeof response.data === 'object' && response.data !== null && 'jsonapi' in response.data) {
        const jsonApiData = response.data as JsonApiDocument
        const jsonApiObjectValidation = validateJsonApiObjectExtended(jsonApiData.jsonapi)

        // Add JSON:API object validation results
        results.details.push(...jsonApiObjectValidation.details)
        jsonApiObjectValidation.errors.forEach(error => {
          results.details.push({
            test: error.test,
            status: 'failed',
            message: error.message
          })
          results.summary.failed++
        })
        jsonApiObjectValidation.warnings.forEach(warning => {
          results.details.push({
            test: warning.test,
            status: 'warning',
            message: warning.message
          })
          results.summary.warnings++
        })
        jsonApiObjectValidation.details.forEach(detail => {
          if (detail.status === 'passed') {
            results.summary.passed++
          }
        })
      }

      // Step 11: Validate sparse fieldsets (if response has data and query parameters exist)
      if (response.data && Object.keys(queryParams).length > 0) {
        const fieldsetValidation = validateSparseFieldsets(response.data, queryParams)

        // Add sparse fieldset validation results
        results.details.push(...fieldsetValidation.details)

        // Add any errors
        fieldsetValidation.errors.forEach((error: { test: string; message: string }) => {
          results.details.push({
            test: error.test,
            status: 'failed',
            message: error.message
          })
          results.summary.failed++
        })

        // Add any warnings
        fieldsetValidation.warnings.forEach((warning: { test: string; message: string }) => {
          results.details.push({
            test: warning.test,
            status: 'warning',
            message: warning.message
          })
          results.summary.warnings++
        })

        // Count passed tests from fieldset validation
        fieldsetValidation.details.forEach(detail => {
          if (detail.status === 'passed') {
            results.summary.passed++
          }
        })
      }

      // Step 12: Validate pagination (if response has data array)
      if (response.data && Array.isArray(response.data)) {
        const paginationValidation = validatePagination(response.data, config.apiUrl, queryParams)

        // Add pagination validation results (filter out 'skipped' status items)
        const validDetails = paginationValidation.details.filter((d: { status: string }) => d.status !== 'skipped') as ValidationTest[]
        results.details.push(...validDetails)

        // Add any errors
        paginationValidation.errors.forEach((error: { test: string; message: string }) => {
          results.details.push({
            test: error.test,
            status: 'failed',
            message: error.message
          })
          results.summary.failed++
        })

        // Add any warnings
        paginationValidation.warnings.forEach((warning: { test: string; message: string }) => {
          results.details.push({
            test: warning.test,
            status: 'warning',
            message: warning.message
          })
          results.summary.warnings++
        })

        // Count passed tests from pagination validation
        paginationValidation.details.forEach(detail => {
          if (detail.status === 'passed') {
            results.summary.passed++
          }
        })
      }
    }

    // Calculate totals
    results.summary.total = results.summary.passed + results.summary.failed + results.summary.warnings

    // Add execution time
    const duration = Date.now() - startTime
    results.duration = `${duration}ms`

    // Create comprehensive report
    const comprehensiveReport = createComprehensiveReport(results) as ValidationReport

    return comprehensiveReport

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorResults: InternalValidationResults = {
      timestamp: new Date().toISOString(),
      endpoint: config.apiUrl,
      method: config.httpMethod,
      status: 'error',
      error: `Validation failed: ${errorMessage}`,
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        warnings: 0
      },
      details: [{
        test: 'Validation Process',
        status: 'failed',
        message: errorMessage
      }]
    }

    // Create comprehensive report for error case too
    return createComprehensiveReport(errorResults) as ValidationReport
  }
}
