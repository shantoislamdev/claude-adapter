# Contributing to Claude Adapter

Thank you for your interest in contributing to Claude Adapter! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Contributing to Claude Adapter](#contributing-to-claude-adapter)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Development Setup](#development-setup)
  - [Making Changes](#making-changes)
    - [Project Structure](#project-structure)
    - [Development Workflow](#development-workflow)
  - [Testing](#testing)
    - [Running Tests](#running-tests)
    - [Writing Tests](#writing-tests)
  - [Pull Request Process](#pull-request-process)
    - [PR Checklist](#pr-checklist)
  - [Style Guide](#style-guide)
    - [TypeScript](#typescript)
    - [Naming Conventions](#naming-conventions)
    - [Code Formatting](#code-formatting)
  - [Questions?](#questions)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

---

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git

### Development Setup

1. **Fork the repository**
   
   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-adapter.git
   cd claude-adapter
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Making Changes

### Project Structure

```
claude-adapter/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # Library exports
│   ├── types/              # TypeScript type definitions
│   ├── converters/         # Request/response converters
│   ├── server/             # Express proxy server
│   └── utils/              # Utility functions
├── tests/                  # Test files
└── package.json
```

### Development Workflow

1. **Run in development mode**
   ```bash
   npm run dev
   ```

2. **Run tests continuously**
   ```bash
   npm test -- --watch
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

---

## Testing

All changes must include appropriate tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/request.test.ts
```

### Writing Tests

- Place tests in the `tests/` directory
- Name test files with `.test.ts` suffix
- Follow existing test patterns and conventions

---

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features or bug fixes
3. **Run the full test suite** and ensure all tests pass
4. **Update CHANGELOG.md** with your changes
5. **Submit the PR** with a clear description

### PR Checklist

- [ ] Code follows the style guide
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No lint errors

---

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit type annotations for function parameters and returns
- Use interfaces for object shapes

### Naming Conventions

| Type       | Convention  | Example                |
| ---------- | ----------- | ---------------------- |
| Files      | kebab-case  | `request-converter.ts` |
| Functions  | camelCase   | `convertRequest()`     |
| Classes    | PascalCase  | `ProxyServer`          |
| Interfaces | PascalCase  | `AdapterConfig`        |
| Constants  | UPPER_SNAKE | `DEFAULT_PORT`         |

### Code Formatting

We use Prettier for code formatting:

```bash
npm run format
```

---

## Questions?

If you have questions, please [open an issue](https://github.com/shantoislamdev/claude-adapter/issues) or reach out to the maintainers.

Thank you for contributing! 🙏
