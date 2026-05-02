# Contributing to TaskFlow

Thank you for your interest in contributing to TaskFlow!

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/todo-tencent-hy3.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` to check for lint errors
- Run `npm run format` to format code
- Run `npm run typecheck` to check TypeScript types
- Pre-commit hooks will automatically lint and format staged files

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process or auxiliary tool changes

Example: `feat: add task filtering by priority`

## Pull Request Process

1. Ensure your code passes linting and type checking
2. Update documentation if needed
3. Add a clear description of the changes
4. Link any related issues

## Running Tests

```bash
npm test
```

## Questions?

Feel free to open an issue for any questions or suggestions.
