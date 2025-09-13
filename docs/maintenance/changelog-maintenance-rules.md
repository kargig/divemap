# Changelog Maintenance Rules

This document outlines the rules and guidelines for maintaining the Divemap
project changelog following the [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/) standard.

## Table of Contents

1. [Changelog Format Standards](#changelog-format-standards)
2. [Commit Analysis Guidelines](#commit-analysis-guidelines)
3. [Change Categorization](#change-categorization)
4. [Version Management](#version-management)
5. [Documentation Requirements](#documentation-requirements)
6. [Quality Standards](#quality-standards)
7. [Maintenance Workflow](#maintenance-workflow)

## Changelog Format Standards

### File Structure

- **File Name**: `docs/maintenance/changelog.md`
- **Format**: Markdown with consistent structure
- **Encoding**: UTF-8 with LF line endings
- **Location**: Always in `docs/maintenance/` directory

### Header Format

```markdown
# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the
Divemap application.
```

### Version Entry Format

```markdown
## [Version Number] - YYYY-MM-DD

### 🚀 Major Features
- **Feature Name**: Description of the feature
- **Technical Details**: Implementation specifics
- **User Impact**: How this affects users

### 🔧 API Changes
- **Endpoint Changes**: API modifications
- **Schema Updates**: Data structure changes
- **Breaking Changes**: Any breaking modifications

### 🐛 Bug Fixes
- **Issue Description**: What was broken
- **Solution**: How it was fixed
- **Impact**: User experience improvements

### 🗄️ Database Changes
- **Schema Updates**: Table structure changes
- **Migration Details**: Migration file information
- **Data Impact**: How existing data is affected

### 🎨 Frontend Changes
- **UI Improvements**: User interface changes
- **Component Updates**: React component modifications
- **User Experience**: UX enhancements

### ⚙️ Backend Changes
- **Service Updates**: Backend service modifications
- **Performance**: Performance improvements
- **Security**: Security enhancements

### 📚 Documentation Updates
- **New Documentation**: Added documentation
- **Updated Guides**: Modified documentation
- **API Documentation**: API reference updates

### 🔒 Security Enhancements
- **Security Fixes**: Security improvements
- **Authentication**: Auth system changes
- **Authorization**: Permission updates

### 🚀 Infrastructure Changes
- **Deployment**: Deployment improvements
- **Docker**: Container updates
- **Nginx**: Proxy configuration changes
```

## Commit Analysis Guidelines

### Commit Selection Criteria

- **Include**: All commits that affect user-facing functionality
- **Include**: All commits that change API behavior
- **Include**: All commits that modify database schema
- **Include**: All commits that improve security
- **Include**: All commits that enhance performance
- **Include**: All commits that fix critical bugs

### Commit Exclusion Criteria

- **Exclude**: Documentation-only commits (unless major)
- **Exclude**: Minor formatting changes
- **Exclude**: Test-only commits
- **Exclude**: CI/CD configuration changes (unless user-impacting)

### Commit Analysis Process

1. **Review Commit Message**: Understand the purpose and scope
2. **Analyze Changed Files**: Identify affected components
3. **Assess User Impact**: Determine if users will notice changes
4. **Categorize Changes**: Apply appropriate change categories
5. **Write Clear Descriptions**: Use user-friendly language

## Change Categorization

### 🚀 Major Features

- New functionality that users can interact with
- Significant improvements to existing features
- New pages, components, or major UI changes
- New API endpoints or major API enhancements

### 🔧 API Changes

- New API endpoints
- Modified request/response formats
- New query parameters or filters
- Rate limiting changes
- Authentication method updates

### 🐛 Bug Fixes

- Issues that prevented normal operation
- UI bugs that affected user experience
- Performance problems that caused delays
- Security vulnerabilities that were patched

### 🗄️ Database Changes

- New tables or columns
- Modified table structures
- New indexes or constraints
- Data migration information
- Schema optimization changes

### 🎨 Frontend Changes

- UI/UX improvements
- Component refactoring
- Responsive design updates
- Accessibility improvements
- Performance optimizations

### ⚙️ Backend Changes

- Service architecture changes
- Performance improvements
- Security enhancements
- Error handling improvements
- Logging and monitoring updates

### 📚 Documentation Updates

- New user guides
- Updated API documentation
- New development guides
- Improved troubleshooting sections

### 🔒 Security Enhancements

- New security features
- Security vulnerability fixes
- Authentication improvements
- Authorization rule updates
- Rate limiting enhancements

### 🚀 Infrastructure Changes

- Deployment improvements
- Docker container updates
- Nginx configuration changes
- Environment variable updates
- Performance monitoring additions

## Version Management

### Version Numbering

- **Format**: Use semantic versioning (MAJOR.MINOR.PATCH)
- **Major**: Breaking changes or major new features
- **Minor**: New features or significant improvements
- **Patch**: Bug fixes and minor improvements

### Release Dates

- **Format**: YYYY-MM-DD (ISO 8601)
- **Accuracy**: Use actual release date, not commit date
- **Consistency**: Always include date with version

### Version Ordering

- **Latest First**: Most recent version at the top
- **Chronological**: Order by release date (newest first)
- **Unreleased Section**: Track upcoming changes at the top

## Documentation Requirements

### Change Description Standards

- **User-Focused**: Write for end users, not developers
- **Clear Language**: Use simple, understandable terms
- **Specific Details**: Include relevant technical information
- **Impact Statement**: Explain how changes affect users

### Technical Details

- **File Changes**: List major files that were modified
- **API Endpoints**: Include new or changed endpoints
- **Database Changes**: Reference migration files
- **Configuration**: Note environment variable changes

### User Impact

- **What Changed**: Clear description of the change
- **Why It Matters**: Explanation of benefits
- **How to Use**: Instructions for new features
- **Breaking Changes**: Clear warnings about compatibility

## Quality Standards

### Content Quality

- **Accuracy**: All information must be factually correct
- **Completeness**: Include all relevant changes
- **Clarity**: Use clear, concise language
- **Consistency**: Maintain consistent formatting and style

### Formatting Standards

- **Markdown**: Use proper markdown syntax
- **Emojis**: Use appropriate emojis for categories
- **Lists**: Use consistent list formatting
- **Headers**: Use proper header hierarchy

### Review Process

- **Self-Review**: Review your own changes before committing
- **Peer Review**: Have another team member review changes
- **User Testing**: Verify that descriptions are user-friendly
- **Accuracy Check**: Ensure all technical details are correct

## Maintenance Workflow

### Regular Updates

- **Frequency**: Update after each significant commit or release
- **Scope**: Include all changes since last update
- **Quality**: Maintain high standards for all entries
- **Consistency**: Follow established patterns and formats

### Update Process

1. **Analyze Commits**: Review all commits since last update
2. **Categorize Changes**: Apply appropriate categories
3. **Write Descriptions**: Create clear, user-friendly descriptions
4. **Review Content**: Check for accuracy and completeness
5. **Update File**: Add new entries to changelog
6. **Verify Format**: Ensure proper markdown formatting
7. **Commit Changes**: Save updates to version control

### Maintenance Checklist

- [ ] All significant commits are included
- [ ] Changes are properly categorized
- [ ] Descriptions are user-friendly
- [ ] Technical details are accurate
- [ ] Formatting is consistent
- [ ] File structure is maintained
- [ ] Version numbers are correct
- [ ] Dates are accurate
- [ ] No duplicate entries exist
- [ ] All links work correctly

## Best Practices

### Writing Guidelines

- **Be Specific**: Avoid vague descriptions like "improved performance"
- **Focus on Users**: Explain what users will experience
- **Include Context**: Provide enough detail to understand the change
- **Use Active Voice**: Write in present tense with active verbs

### Organization Guidelines

- **Logical Grouping**: Group related changes together
- **Clear Categories**: Use consistent category names
- **Proper Hierarchy**: Maintain logical information flow
- **Easy Navigation**: Make information easy to find

### Maintenance Guidelines

- **Regular Updates**: Don't let changes accumulate
- **Quality Over Quantity**: Better to have fewer, better entries
- **User Perspective**: Always consider the user's point of view
- **Technical Accuracy**: Ensure all technical details are correct

## Compliance Requirements

### Keep a Changelog Standards

- **Human-Focused**: Write for humans, not machines
- **Version Entries**: Include entry for every version
- **Change Types**: Group same types of changes together
- **Linkable Versions**: Make versions and sections linkable
- **Latest First**: Put latest version at the top
- **Release Dates**: Display release date of each version
- **Semantic Versioning**: Mention if you follow semantic versioning

### Project-Specific Requirements

- **File Location**: Always in `docs/maintenance/changelog.md`
- **Markdown Format**: Use consistent markdown formatting
- **Emoji Categories**: Use appropriate emojis for visual organization
- **Technical Details**: Include relevant technical information
- **User Impact**: Focus on user experience and benefits

## Related Documentation

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) - Official guidelines
- [Semantic Versioning](https://semver.org/) - Version numbering standards
- [Markdown Guide](https://www.markdownguide.org/) - Markdown formatting
- [API Documentation](../development/api.md) - API reference
- [Development Guide](../development/README.md) - Development procedures
