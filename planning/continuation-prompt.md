# Kometa Dashboard - Continuation Prompt for Claude Code

Use this prompt when starting a new Claude Code session to continue development on the Kometa Dashboard project.

---

You are working on the Kometa Dashboard project, a Next.js web application for managing Kometa media library automation.

## Project Overview

This is an ongoing development project with systematic task completion. Your role is to continue development from where the previous session left off.

## Getting Started

1. **Check Current Status**: First, read these key files to understand the current state:

   - `planning/tasks/detailed-task-breakdown.md` - Complete task breakdown with progress tracking
   - `CLAUDE.md` - Project context, architecture decisions, and development standards
   - Current git branch and recent commits to understand what's been completed

2. **Identify Next Tasks**: Look for the next incomplete tasks in the detailed task breakdown. Tasks are marked with `[ ]` (pending), `[x]` (completed), or may be marked as in_progress.

3. **Use Task Management**: Always use the TodoRead and TodoWrite tools to track your progress:
   - Read current todos at the start
   - Update todos as you work
   - Mark tasks complete only when fully finished

## Development Workflow

- **Git Strategy**:
  - **NEVER commit or merge directly to main branch**
  - **ALWAYS create a new feature branch** for each task or set of related changes
  - Create feature branches from main: `git checkout -b feature/task-name`
  - Commit after each parent task completion on the feature branch
  - Create pull requests to merge feature branches into main
- **Code Quality**: All code must pass ESLint, Prettier, TypeScript strict mode, and testing requirements
- **Testing**: Maintain >90% test coverage, write tests before or alongside implementation
- **Architecture**: Follow file-based storage approach (no database), Next.js API routes, smart polling + SSE

## Key Project Principles

- **No Authentication**: Simplified MVP approach, auth moved to Phase 2
- **File-based Storage**: JSON files with atomic writes, no database dependency
- **Test-Driven Development**: Jest + React Testing Library with comprehensive coverage
- **Component Documentation**: Storybook for all UI components
- **Code Quality**: Automated linting, formatting, and pre-commit hooks

## Important Notes

- **Repository**: https://github.com/mushfoo/kometa-dashboard
- **Architecture**: Next.js 15, TypeScript strict mode, Tailwind CSS, file-based storage
- **Systematic Approach**: Follow the established task breakdown structure and commit patterns

## ⚠️ CRITICAL: Git Workflow Requirements

**NEVER work directly on the main branch. ALWAYS:**

1. **Create a feature branch first**: `git checkout -b feature/task-description`
2. **Make all commits on the feature branch**
3. **Create a pull request** when the task is complete
4. **Let the CI/CD pipeline validate** the changes before merging

**This ensures:**

- Code quality through automated CI checks
- Proper code review process
- Protection of the main branch stability
- Consistent development workflow

Start by reading the task breakdown file and current git status to determine exactly where to continue development.
