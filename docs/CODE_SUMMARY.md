# Unity Voice Learning Platform - Code Summary

This document provides a technical overview of the Unity Voice Learning Platform codebase, focusing on key components, architecture decisions, and implementation details.

## Database Connection Architecture

### Connection Pooling

The platform uses a connection pool to efficiently manage database connections:

```typescript
// apps/api/src/lib/db.ts
let pool: mysql.Pool | null = null;
```

Key features:
- Connection retry logic with configurable attempts
- Graceful fallback mechanisms when connections fail
- Timeout handling for unresponsive database connections
- Diagnostic logging for connection troubleshooting

### Database Diagnostics

The database diagnostic system performs step-by-step tests to identify connection issues:

1. **Host Reachability**: Tests DNS resolution and socket connection
2. **Credentials Verification**: Validates user/password combinations
3. **SSL Configuration**: Tests SSL/TLS settings if enabled
4. **Connection Pool Testing**: Validates pool creation
5. **Query Execution**: Tests basic query functionality

The diagnostics are accessible via:
- API endpoint `/api/diagnostics/db`
- CLI tool `diagnoseDb.ts`
- Programmatic API for integration testing

### Environment Variable Auditing

The platform includes tools to detect inconsistencies in database configuration between services:

```typescript
// Audit environment variables across projects
export async function auditEnvironmentVariables(): Promise<{
  api: Record<string, string | undefined>;
  web: Record<string, string | undefined>;
  identical: boolean;
  mismatches: string[];
}>
```

This helps identify configuration drift that could cause connection issues.

## Error Resilience

### Multi-Source Word Retrieval

The word retrieval system implements a cascading fallback strategy:

```typescript
// Try backend API first
// If that fails, try local database
// If that fails, try generating with OpenAI
// If all else fails, use mock data
```

This ensures users always receive content, even if some services are unavailable.

### Safe Database Access

The platform provides multiple database access methods with varying error behavior:

```typescript
// Standard pool access that throws on failure
export async function getDbPool(): Promise<mysql.Pool>

// Safe version that returns null instead of throwing
export async function getSafeDbPool(): Promise<mysql.Pool | null>
```

This allows developers to choose the appropriate error handling strategy for each use case.

## API Implementation

### API Routes

The platform exposes RESTful API endpoints for:

- Authentication (login, registration)
- Word management (retrieval, saving)
- Task management (creation, completion)
- User progress tracking
- Diagnostics and health checks

### Middleware

The API employs middleware for:

- Authentication via JWT
- Request logging
- Error handling
- Cross-Origin Resource Sharing (CORS)

## Frontend Implementation

### Data Fetching

The frontend implements a robust data fetching strategy:

- Primary API calls with timeouts
- Error handling with appropriate user feedback
- Automatic retries for transient failures
- Fallback to alternative data sources
- Graceful UI degradation when services are unavailable

### Authentication Flow

User authentication is implemented with JWT:

1. User submits credentials
2. Server validates and returns JWT
3. Token is stored in local storage
4. Token is included in subsequent API requests
5. Token expiration is handled with refresh mechanisms

## Development & Deployment

### Local Development

The platform supports local development with:
- Hot reloading for frontend and backend
- Environment variable management
- Diagnostic tools for troubleshooting

### Deployment Considerations

For production deployment:
- Configure appropriate database connection pools
- Set up monitoring for database health
- Implement proper SSL/TLS for database connections
- Configure environment variables for production settings 