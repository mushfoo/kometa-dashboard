# Kometa Dashboard - Claude Code Project Context

## Project Overview

**Kometa Dashboard** is a web-based GUI that makes Kometa's powerful media library automation accessible to non-technical users while preserving advanced capabilities for power users.

**Architecture:** Next.js application with TypeScript, file-based storage, and smart polling for real-time updates.

## Architectural Decisions

### Technology Stack

- **Frontend:** React 18 + TypeScript + Next.js 15 (App Router)
- **Styling:** Tailwind CSS + Lucide React icons
- **State Management:** React Query (server state) + Zustand (client state)
- **UI Components:** Custom components with responsive design
- **Layout:** Mobile-first responsive layout with sidebar navigation
- **Theming:** Dark/light/system theme support with localStorage persistence
- **API:** Next.js API routes (`/app/api/`)
- **Storage:** File-based JSON storage (no database for MVP)
- **Real-time:** Smart polling + Server-Sent Events (SSE)
- **Integration:** Python subprocess calls to Kometa engine

### Key Architectural Patterns

1. **File-First Storage:** All configuration, settings, and history stored in JSON files
2. **API-First Design:** All data operations go through API routes
3. **Component-Driven Development:** Reusable UI components with Storybook
4. **Atomic File Operations:** All file writes use temp files + rename for safety
5. **Progressive Enhancement:** Works without JavaScript for basic functionality

## Development Standards

### Code Style Guidelines

- **TypeScript Strict Mode:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **No `any` types allowed** - all types must be properly defined
- **Functional Components:** Use function declarations, not arrow functions for components
- **Named Exports:** Prefer named exports over default exports (except for pages)
- **File Naming:** kebab-case for files, PascalCase for components
- **Import Order:** External libraries → internal modules → relative imports

### Testing Standards

- **>90% Test Coverage:** Maintain above 90% coverage for all business logic
- **Test-Driven Development:** Write tests alongside feature implementation
- **Testing Strategy:**
  - Unit tests: All business logic and utility functions
  - Integration tests: All API endpoints and database operations
  - Component tests: All React components with user interactions
  - E2E tests: Critical user flows (setup, collection creation, monitoring)

### Component Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (dashboard)/       # Dashboard route group
│   │   ├── dashboard/     # Dashboard page
│   │   ├── config/        # Configuration page
│   │   ├── collections/   # Collections page
│   │   ├── logs/         # Logs page
│   │   ├── operations/   # Operations page
│   │   └── layout.tsx    # Dashboard layout
│   ├── layout.tsx        # Root layout with providers
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/            # Reusable UI components
│   ├── layout/           # Layout components (Header, Sidebar, Layout)
│   ├── navigation/       # Navigation components (Breadcrumbs)
│   ├── providers/        # React Query and app providers
│   ├── ui/               # Base UI components
│   └── forms/            # Form components (future)
├── lib/                  # Utility functions and services
├── hooks/                # Custom React hooks (useAppState)
├── stores/               # Zustand stores (settings, config)
├── types/                # TypeScript type definitions
└── __tests__/            # Test files
```

## Integration Patterns

### Kometa Subprocess Integration

```typescript
// Pattern for subprocess operations
const kometaService = {
  async runOperation(config: KometaConfig): Promise<OperationResult> {
    // 1. Validate configuration
    // 2. Write config to temp file
    // 3. Spawn Kometa subprocess
    // 4. Stream logs via SSE
    // 5. Monitor progress
    // 6. Return results
  },
};
```

### File Storage Patterns

```typescript
// Pattern for atomic file operations
async function writeConfigFile(config: KometaConfig): Promise<void> {
  const tempFile = `${configPath}.tmp`;
  await fs.writeFile(tempFile, yaml.stringify(config));
  await fs.rename(tempFile, configPath);
  await createBackup(configPath);
}
```

### API Route Structure

```typescript
// Standard API route pattern
export async function GET(request: Request): Promise<Response> {
  try {
    // 1. Validate request
    // 2. Perform operation
    // 3. Return typed response
  } catch (error) {
    return NextResponse.json({ error: 'Message' }, { status: 500 });
  }
}
```

## Task Management Workflow

### Development Process

Follow the systematic approach defined in `planning/tasks/detailed-task-breakdown.md`:

1. **Check Task Status:** Always check the task breakdown file before starting work
2. **One Sub-task at a Time:** Complete each `[ ]` checkbox sequentially
3. **Update Progress:** Mark `[x]` immediately after finishing each sub-task
4. **Track Files:** Add all created/modified files to "Relevant Files" section
5. **Quality Gates:** Each task has test criteria that must pass before completion
6. **Commit Strategy:** One commit per completed parent task

### Git Workflow

- **Foundations Branch:** Use `foundations` branch for all setup tasks (Day 1)
- **Feature Branches:** Create feature branches for major components after foundations
- **Commit Messages:** Format: "Complete Task X.X: [Task Description]"
- **Pull Requests:** Create PR after completing each day's work

### File Tracking Protocol

Update `planning/tasks/detailed-task-breakdown.md` after each sub-task:

- Add new files to "Created Files" section with purpose description
- Add modified files to "Modified Files" section
- Keep the tracking current for project organization

## Commands and Scripts

### Development Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run storybook    # Start Storybook component library on http://localhost:6006
```

### Project-Specific Commands

```bash
# Type checking
npx tsc --noEmit

# Format code
npx prettier --write .

# Check for unused dependencies
npx depcheck
```

## Storage System Architecture

### Directory Structure

```
storage/
├── configs/           # Configuration backups
├── settings/          # Application settings
├── history/           # Operation history
├── templates/         # Collection templates
└── keys/             # Encrypted API keys
```

### File Naming Conventions

- Configuration backups: `config-YYYY-MM-DD-HH-mm-ss.yml`
- Settings files: `settings.json`, `user-preferences.json`
- History files: `operations-YYYY-MM.json`
- API keys: `{service}-key.enc`

## API Route Structure

### Endpoint Organization

```
/api/
├── status/           # System health checks
├── config/           # Configuration management
│   └── validate/     # Configuration validation
├── keys/             # API key management
│   └── [service]/    # Service-specific operations
├── operations/       # Operation control
│   ├── start/        # Start operations
│   └── stop/         # Stop operations
├── logs/             # Log access
└── stream/           # SSE streaming
```

### Response Patterns

All API responses follow consistent patterns:

```typescript
// Success response
{ data: T, message?: string }

// Error response
{ error: string, details?: unknown }

// List response
{ data: T[], total: number, page?: number }
```

## Security Guidelines

### Input Validation

- **All user inputs** must be validated using Zod schemas
- **File paths** must be validated to prevent directory traversal
- **YAML content** must be parsed safely to prevent code injection
- **API keys** must be encrypted at rest using built-in crypto module

### File Access

- **Atomic operations:** Use temp files + rename for all writes
- **Permission checks:** Validate file access before operations
- **Backup strategy:** Automatic backups before any destructive operations
- **Path validation:** Ensure all paths stay within project boundaries

## Performance Requirements

### Response Time Targets

- Configuration changes: <2 seconds
- Collection preview: <3 seconds for 2000+ items
- Log polling: <5% CPU usage
- Memory usage: <512MB for GUI components

### Optimization Strategies

- **Code splitting:** Lazy load heavy components (Monaco Editor)
- **API caching:** Cache frequently accessed data with React Query
- **File watching:** Efficient file system monitoring
- **Bundle optimization:** Tree shaking and compression

## Error Handling Standards

### Error Categories

1. **Validation Errors:** User input validation failures
2. **File System Errors:** File access, permission, or corruption issues
3. **Process Errors:** Kometa subprocess failures
4. **Network Errors:** API rate limits or connectivity issues

### Error Response Format

```typescript
interface ErrorResponse {
  error: string; // User-friendly message
  code?: string; // Error code for programmatic handling
  details?: unknown; // Technical details for debugging
  timestamp: string; // ISO timestamp
}
```

## Monitoring and Observability

### Logging Strategy

- **Structured logging:** Use Winston with JSON format
- **Log levels:** DEBUG, INFO, WARNING, ERROR
- **Log rotation:** Daily rotation with 7-day retention
- **Error tracking:** Capture and categorize all errors

### Metrics Collection

- **Operation timing:** Track all operation durations
- **File operation metrics:** Monitor file I/O performance
- **Memory usage:** Track memory consumption patterns
- **API response times:** Monitor endpoint performance

---

## Quick Start for Development

1. **Check current task:** `cat planning/tasks/detailed-task-breakdown.md | grep "\[ \]" | head -1`
2. **Update task progress:** Mark completed sub-tasks as `[x]`
3. **Add new files:** Update "Relevant Files" section
4. **Run tests:** `npm run test:coverage` before committing
5. **Commit completed task:** Use format "Complete Task X.X: [Description]"

This context file should be referenced before starting any development work to ensure consistency with established patterns and standards.
