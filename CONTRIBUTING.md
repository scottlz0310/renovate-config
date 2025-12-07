# Contributing to renovate-config

Thank you for your interest in contributing to this Renovate configuration repository!

## How to Contribute

### Reporting Issues

If you find a bug or have a suggestion for improvement:

1. Check if the issue already exists in the [Issues](https://github.com/scottlz0310/renovate-config/issues) section
2. If not, create a new issue with a clear description
3. Include examples of the configuration that's causing problems (if applicable)

### Adding or Improving Presets

#### Language-specific Presets

If you want to add support for a new language or improve an existing language preset:

1. Fork this repository
2. Create a new file in `presets/languages/` (e.g., `presets/languages/java.json`)
3. Follow the existing preset structure:
   - Include `$schema` for validation
   - Add a clear description
   - Use `packageRules` to define language-specific behavior
   - Group related dependencies
4. Validate your configuration:
   ```bash
   npm install
   npx renovate-config-validator presets/languages/your-file.json
   ```
5. Add an example in `examples/` directory
6. Update `package.json` to include your preset in the `renovate-config` section
7. Update both `README.md` and `README.en.md` with documentation

#### Project-specific Presets

To add a new project-specific adjustment preset:

1. Create a file in `presets/projects/` (e.g., `presets/projects/aggressive.json`)
2. Focus on specific behaviors (auto-merge, scheduling, grouping, etc.)
3. Validate the configuration
4. Add examples of usage
5. Update documentation

### Configuration Guidelines

When creating or modifying presets:

1. **Use semantic commit types**: Set appropriate `semanticCommitType` and `semanticCommitScope`
2. **Group related updates**: Use `groupName` to combine related package updates
3. **Set reasonable schedules**: Use `schedule` to avoid overwhelming CI/CD
4. **Be conservative with auto-merge**: Only enable for low-risk updates
5. **Add descriptions**: Always include a `description` field

### Validation

All configuration files must pass validation:

```bash
# Install dependencies
npm install

# Validate all files
for file in $(find . -name "*.json" -not -path '*/node_modules/*'); do
  npx renovate-config-validator "$file"
done
```

### Testing

Before submitting:

1. Validate your JSON files
2. Test in a real project if possible
3. Check that the documentation is accurate
4. Ensure examples are correct

### Pull Request Process

1. Fork the repository
2. Create a new branch: `git checkout -b feature/my-new-preset`
3. Make your changes
4. Validate all configurations
5. Update documentation
6. Commit with clear messages
7. Push to your fork
8. Create a Pull Request with:
   - Clear description of changes
   - Motivation for the changes
   - Testing done

### Code Style

- Use 2 spaces for indentation in JSON files
- Keep lines under 120 characters when possible
- Sort keys alphabetically within objects (when it makes sense)
- Use meaningful names for groups and scopes

## Development Setup

```bash
# Clone the repository
git clone https://github.com/scottlz0310/renovate-config.git
cd renovate-config

# Install dependencies
npm install

# Validate configurations
npm run validate  # (if script is added)
```

## Questions?

If you have questions, feel free to:

- Open an issue for discussion
- Check the [Renovate documentation](https://docs.renovatebot.com/)
- Look at existing presets for examples

Thank you for contributing!
