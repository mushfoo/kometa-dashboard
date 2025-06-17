# Kometa Dashboard

[![CI](https://github.com/mushfoo/kometa-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/mushfoo/kometa-dashboard/actions/workflows/ci.yml)
[![PR Title Check](https://github.com/mushfoo/kometa-dashboard/actions/workflows/pr-title-check.yml/badge.svg)](https://github.com/mushfoo/kometa-dashboard/actions/workflows/pr-title-check.yml)

A modern web-based GUI for Kometa media library automation, making powerful media collection management accessible to non-technical users.

## Features

- **Intuitive Configuration**: Visual interface for Kometa setup and configuration
- **Real-time Monitoring**: Live operation tracking and log streaming
- **Collection Builder**: Visual collection creation with smart filtering
- **API Key Management**: Secure storage and testing of third-party service keys
- **Responsive Design**: Mobile-first layout with collapsible sidebar
- **Dark/Light Themes**: Automatic system theme detection with manual override
- **Real-time Status**: System health monitoring with visual indicators
- **File-based Storage**: No database required, uses local JSON and YAML files

## Architecture

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, React Query, and Zustand
- **State Management**: React Query for server state, Zustand for client state
- **UI Components**: Lucide React icons, responsive Tailwind layouts
- **Backend**: Next.js API routes with file-based storage
- **Real-time**: Server-Sent Events (SSE) and smart polling
- **Testing**: Jest with >90% coverage requirement
- **Quality**: ESLint, Prettier, Husky pre-commit hooks

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)

### Getting Started

```bash
# Clone and install
npm install

# Start development server
npm run dev

# Run tests
npm run test
npm run test:coverage

# Build for production
npm run build
```

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run storybook` - Start Storybook

### Docker Development

```bash
docker-compose up
```

## Project Structure

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
│   └── page.tsx          # Home page
├── components/            # Reusable UI components
│   ├── layout/           # Layout components (Header, Sidebar, Layout)
│   ├── navigation/       # Navigation components (Breadcrumbs)
│   ├── providers/        # React Query and app providers
│   └── ui/               # Base UI components
├── lib/                  # Services and utilities
├── hooks/                # Custom React hooks (useAppState)
├── stores/               # Zustand stores (settings, config)
├── types/                # TypeScript definitions
└── __tests__/            # Test files
```

## Contributing

1. Fork the repository
2. Create a feature branch from `main`
3. Follow the established task breakdown in `planning/tasks/`
4. Ensure tests pass and coverage remains >90%
5. Submit a pull request with descriptive title

### Commit Convention

- `Complete Task X.X: Description` - For task completion
- `Fix: Description` - Bug fixes
- `Add: Description` - New features
- `Update: Description` - Enhancements

## License

MIT License - see LICENSE file for details
