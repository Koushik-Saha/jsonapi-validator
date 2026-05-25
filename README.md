# JSON:API Validator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive JSON:API v1.1 specification validator implemented as a single-page application that acts as a client to test any JSON:API implementation. This tool helps developers and organizations verify that their APIs correctly implement the JSON:API specification by generating conformant requests and validating responses.

## Overview

The JSON:API Validator is designed as a standalone client application that can test any JSON:API implementation regardless of the backend technology (Go, Node.js, Python, etc.). The validator provides:

- **Client-Side Testing**: Acts as a JSON:API client that generates conformant requests
- **Response Validation**: Validates API responses against the JSON:API v1.1 specification  
- **Multi-Step Workflow Testing**: Performs comprehensive CRUD operations to validate complete JSON:API behavior
- **Cross-Platform Compatibility**: Works with any JSON:API implementation via HTTP requests

## Features

The JSON:API Validator is a comprehensive tool available both as a web application and command-line interface, providing complete JSON:API v1.1 specification validation.

### Core Capabilities

- **Dual Interface Options**
  - **Web Application**: React-based SPA with real-time validation UI
  - **Command-Line Interface**: Scriptable CLI for CI/CD pipelines
  - Both interfaces use the same powerful validation engine

- **Single-Page Application Interface**
  - Web-based UI for configuring and running JSON:API tests
  - Real-time validation results with detailed error reporting
  - Support for multiple HTTP methods (GET, POST, PUT, PATCH, DELETE)
  - Authentication support (Bearer tokens, API keys, Basic auth)
  - Custom header management for complex API requirements

- **Command-Line Interface (CLI)**
  - Validate JSON:API endpoints from the terminal
  - Perfect for CI/CD pipelines and automated testing
  - Multiple output formats (human-readable, JSON, verbose)
  - All authentication methods supported
  - Exit codes for integration with build systems

- **Comprehensive Validation Engine**
  - Document structure validation (data, errors, meta, links, included, jsonapi)
  - Resource object validation with type/id requirements
  - Error object structure and HTTP status alignment
  - Content-Type and media type parameter validation
  - Query parameter validation (include, fields, sort, pagination)
  - Relationship structure validation

- **Advanced Reporting Features**
  - Detailed validation results with expandable sections
  - Export capabilities (JSON, Markdown, PDF formats)
  - Suggestions for fixing validation issues
  - Performance metrics and request/response details

## Getting Started

### Prerequisites

- Node.js 20 or later
- Modern web browser

### Installation and Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/CrisisTextLine/jsonapi-validator.git
   cd jsonapi-validator
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Start the Application**
   ```bash
   # Start both validator and mock server
   npm start
   
   # Or start individually
   npm run dev          # Validator app only (http://localhost:3000)
   npm run mock-server  # Mock server only (http://localhost:3001)
   ```

4. **Open the Validator**
   Navigate to http://localhost:3000 in your browser

### Using the Validator

1. **Configure Your API Endpoint**
   - Enter your JSON:API endpoint URL (e.g., `https://api.example.com/posts`)
   - Select HTTP method (GET, POST, PUT, PATCH, DELETE)
   - Configure authentication if required (Bearer token, API key, Basic auth)
   - Add custom headers as needed

2. **Run Validation**
   - Click "Start Validation" to test your endpoint
   - View comprehensive results showing compliance status
   - Export results in JSON, Markdown, or PDF format

3. **Test with Mock Server**
   - Use the included mock server for testing: `http://localhost:3001/api/articles`
   - Try invalid endpoints to test error detection: `http://localhost:3001/api/invalid/no-jsonapi`

### Using the CLI

The JSON:API Validator includes a powerful command-line interface for automated testing and CI/CD integration.

#### Installation

**Local Usage (from project directory):**
```bash
node cli.js <url> [options]
```

**Global Installation:**
```bash
npm install -g
jsonapi-validator <url> [options]
```

#### Basic Usage

**Validate an endpoint:**
```bash
node cli.js https://api.example.com/articles
```

**Output:**
```
🔍 Validating JSON:API endpoint: https://api.example.com/articles

✅ Validation Completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passed:   96
  Failed:   7
  Warnings: 1
  Total:    104

Resource Objects
────────────────
  ⚠ Media Type Parameters
     Content-Type contains unknown parameters: charset
```

#### CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--method <method>` | HTTP method (GET, POST, PATCH, etc.) | `--method POST` |
| `--auth-type <type>` | Authentication: none, bearer, apiKey, basic | `--auth-type bearer` |
| `--token <token>` | Bearer token for authentication | `--token abc123` |
| `--api-key <key>` | API key for authentication | `--api-key xyz789` |
| `--username <user>` | Username for basic auth | `--username admin` |
| `--password <pass>` | Password for basic auth | `--password secret` |
| `--body <json>` | Request body as JSON string | `--body '{"data":{...}}'` |
| `--json` | Output results as JSON | `--json` |
| `--verbose` | Show detailed validation output | `--verbose` |
| `--help` | Show help message | `--help` |

#### Examples

**Bearer Token Authentication:**
```bash
node cli.js https://api.example.com/articles \
  --auth-type bearer \
  --token YOUR_TOKEN_HERE
```

**POST Request with Body:**
```bash
node cli.js https://api.example.com/articles \
  --method POST \
  --body '{"data":{"type":"articles","attributes":{"title":"New Article"}}}'
```

**JSON Output for CI/CD:**
```bash
# Returns JSON and exits with code 1 if validation fails
node cli.js https://api.example.com/articles --json > results.json
echo $?  # Check exit code
```

**Basic Authentication:**
```bash
node cli.js https://api.example.com/articles \
  --auth-type basic \
  --username myuser \
  --password mypass
```

**Verbose Output for Debugging:**
```bash
node cli.js https://api.example.com/articles --verbose
```

#### Exit Codes

The CLI uses standard exit codes for easy integration with scripts:
- `0`: Validation completed successfully (no failures)
- `1`: Validation failed or error occurred

**Example CI/CD Integration:**
```bash
#!/bin/bash
# Validate API endpoint in CI/CD pipeline

if node cli.js https://api.example.com/articles --json; then
  echo "✅ API validation passed"
else
  echo "❌ API validation failed"
  exit 1
fi
```

## Architecture Overview

## Architecture Overview

### Application Structure

```
src/
├── components/                    # React UI components
│   ├── ConfigForm.tsx            # API endpoint configuration form
│   ├── TestRunner.tsx            # Test execution controller  
│   ├── ResultsPanel.tsx          # Basic validation results display
│   └── EnhancedResultsPanel.tsx  # Advanced results with export features
├── validators/                    # JSON:API validation logic
│   ├── DocumentValidator.ts      # Document structure validation
│   ├── ResourceValidator.ts      # Resource object validation
│   ├── ErrorValidator.ts         # Error response validation
│   ├── QueryValidator.ts         # Query parameter validation
│   ├── PaginationValidator.ts    # Pagination validation
│   └── [8 more validators...]    # Comprehensive validation suite
├── utils/                        # Core utilities
│   ├── ValidationService.ts      # Main validation orchestration
│   ├── ValidationReporter.ts     # Report formatting and export
│   ├── ApiClient.ts              # HTTP request client
│   └── UrlValidator.ts           # URL validation utilities
├── App.tsx                       # Main application component
└── main.tsx                      # Application entry point
```

### Mock Server for Testing

The included mock server (`mock-server/`) provides:
- Compliant JSON:API v1.1 endpoints for testing
- Sample data for articles, people, and comments
- Both valid and intentionally invalid endpoints
- Support for query parameters, relationships, and CRUD operations

### Technology Stack

- **Frontend**: React 19.1.1 with Vite 7.1.5 build system
- **Build System**: SWC for fast TypeScript/JavaScript compilation
- **Type Safety**: TypeScript with strict mode enabled
- **Validation**: Custom JSON:API v1.1 compliance engine
- **Mock Server**: Express.js with CORS support
- **Code Quality**: ESLint with React plugins
- **Testing**: Vitest (unit/integration) + Playwright (E2E)

### TypeScript Support

The project includes comprehensive TypeScript support for type-safe development:

**Features:**
- ✅ Strict TypeScript configuration
- ✅ Fast compilation with SWC compiler
- ✅ Mixed JavaScript/TypeScript codebase support
- ✅ Comprehensive type definitions for JSON:API structures
- ✅ IDE autocomplete and inline documentation
- ✅ Compile-time error detection

**Type Definitions:**
The project includes detailed TypeScript types in `src/types/validation.ts`:
- `JsonApiDocument` - Complete JSON:API document structure
- `JsonApiResource` - Resource object with attributes/relationships
- `ValidationReport` - Validation results with metadata
- `TestConfig` - API endpoint configuration
- And many more...

**Converted Modules:**
- ✅ Utilities: `ApiClient.ts`, `UrlValidator.ts`
- ✅ Validators: `HttpStatusValidator.ts`, `RequestValidator.ts`
- 🚧 Additional validators being converted incrementally

**Type Checking:**
```bash
# Check types without emitting files
npx tsc --noEmit

# Build with type checking
npm run build
```

## JSON:API v1.1 Compliance

This validator aims for complete compliance with the [JSON:API v1.1 specification](https://jsonapi.org/format/1.1/), including:

### Document Structure Requirements
- **MUST** contain at least one of: `data`, `errors`, or `meta`
- **MUST NOT** contain both `data` and `errors` at the top level
- **MAY** contain `links`, `included`, and `jsonapi` members

### Resource Objects
- **MUST** contain `type` and `id` members (except client-generated resources)
- **MAY** contain `attributes`, `relationships`, `links`, and `meta` members
- **MUST** validate relationship object structure

### Content Negotiation
- **MUST** use `application/vnd.api+json` content type
- **MUST** respond with `415 Unsupported Media Type` for incorrect content types
- **MUST** validate media type parameters

### Query Parameters
- **MUST** support standard query parameters (`include`, `fields`, `sort`, `page`)
- **MUST** validate sparse fieldset syntax
- **MUST** validate inclusion path syntax
- **SHOULD** provide meaningful errors for malformed parameters

## Development Status

✅ **The JSON:API Validator is fully implemented and ready for use**

### Completed Features

- [x] Repository setup and documentation
- [x] React-based single-page application
- [x] Comprehensive JSON:API v1.1 validation engine
- [x] Mock server with test endpoints
- [x] Authentication support (Bearer, API Key, Basic Auth)
- [x] Custom header management
- [x] Advanced reporting with export capabilities
- [x] Build system and development workflow
- [x] ESLint code quality checks

### Available Scripts

```bash
# Installation
npm ci                    # Install dependencies (always use ci for consistency)

# Development
npm run dev               # Start development server (http://localhost:3000)
npm run mock-server       # Start mock JSON:API server (http://localhost:3001)
npm start                 # Start both validator and mock server

# Building
npm run build             # Build for production
npm run preview           # Preview production build

# Code Quality
npm run lint              # Run ESLint (must pass with 0 warnings)
npx tsc --noEmit          # Type check TypeScript

# Testing
npm test                  # Run unit tests
npm run test:unit         # Run unit tests with coverage
npm run test:integration  # Run integration tests
npm run test:e2e          # Run end-to-end tests

# CLI Tool
node cli.js <url>         # Validate JSON:API endpoint (see CLI section above)
```

## Contributing

We welcome contributions! This project is sponsored by [Crisis Text Line](https://www.crisistextline.org/).

### Getting Started

1. **Fork and Clone**: Fork this repository and clone your fork
2. **Install Dependencies**: `npm ci` 
3. **Development**: `npm start` to run both validator and mock server
4. **Linting**: `npm run lint` (must pass with 0 warnings before committing)
5. **Build**: `npm run build` to verify production build
6. **Follow Guidelines**: See `.github/copilot-instructions.md` for detailed development guidelines

### Development Workflow

- Always run `npm ci` instead of `npm install` for consistent builds
- Ensure `npm run lint` passes with zero warnings
- Test against the mock server endpoints during development
- The mock server provides both valid and invalid endpoints for comprehensive testing

### Testing the Validator

Use the included test script to verify mock server functionality:
```bash
chmod +x test-endpoints.sh
./test-endpoints.sh
```

---

## Resources

- [JSON:API Specification v1.1](https://jsonapi.org/format/1.1/)
- [JSON:API Examples](https://jsonapi.org/examples/)
- [Crisis Text Line](https://www.crisistextline.org/) - Project Sponsor

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
