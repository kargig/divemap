# GitHub Actions

This document describes the GitHub Actions workflows used in the Divemap project.

## Table of Contents

1. [Backend Tests Workflow](#backend-tests-workflow)
2. [Workflow Triggers](#workflow-triggers)
3. [Environment Setup](#environment-setup)
4. [Test Execution](#test-execution)
5. [Coverage Reports](#coverage-reports)
6. [Troubleshooting](#troubleshooting)

## Backend Tests Workflow

The backend tests workflow (`backend-tests.yml`) automatically runs when backend code changes are detected. This ensures that all backend changes are properly tested before merging.

### Workflow Features

- **Automatic Triggering**: Runs on PR creation and commits to main/master branches
- **Path Filtering**: Only runs when backend files are modified
- **Virtual Environment**: Uses Python virtual environment for isolation
- **Dependency Caching**: Caches pip dependencies for faster builds
- **Service Containers**: Provides Redis service for testing
- **Coverage Reporting**: Generates and uploads test coverage reports
- **Artifact Upload**: Saves test results and coverage reports as artifacts

## Workflow Triggers

The workflow is triggered by:

1. **Pull Requests**: When a PR is created or updated targeting `main` or `master` branches
2. **Direct Pushes**: When code is pushed directly to `main` or `master` branches
3. **Path Changes**: Only when files in the `backend/` directory or the workflow file itself are modified

### Trigger Configuration

```yaml
on:
  pull_request:
    branches: [ main, master ]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-tests.yml'
  push:
    branches: [ main, master ]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-tests.yml'
```

## Environment Setup

The workflow sets up a complete testing environment:

### Python Environment

- **Python Version**: 3.11
- **Virtual Environment**: Created in `backend/divemap_venv/`
- **Dependencies**: Installed from `backend/requirements.txt`
- **PYTHONPATH**: Configured for proper module resolution

### Service Containers

Currently, no external services are required for testing as the backend uses SQLite for testing and doesn't require Redis in the test environment.

### Environment Variables

```bash
DATABASE_URL=sqlite:///./test.db
SECRET_KEY=test-secret-key-for-ci
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

## Test Execution

The workflow executes tests using the following steps:

1. **Checkout Code**: Clones the repository
2. **Setup Python**: Installs Python 3.11
3. **Cache Dependencies**: Uses GitHub Actions cache for pip packages
4. **Install Dependencies**: Creates virtual environment and installs requirements
5. **Setup Environment**: Configures environment variables
6. **Run Tests**: Executes pytest with coverage reporting

### Test Command

```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/runner/work/divemap/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python -m pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=html --cov-report=xml
```

## Coverage Reports

The workflow generates multiple coverage report formats:

- **Terminal Output**: Shows missing lines in terminal
- **HTML Report**: Detailed coverage report in HTML format
- **XML Report**: Coverage data in XML format for external tools

### Coverage Upload

- **Codecov Integration**: Uploads coverage to Codecov service using `CODECOV_TOKEN` secret
- **Artifact Storage**: Saves coverage reports as workflow artifacts
- **Failure Handling**: Coverage upload doesn't fail the workflow
- **Directory Scanning**: Automatically finds coverage files in the backend directory

## Troubleshooting

### Common Issues

#### 1. Virtual Environment Issues

**Problem**: ModuleNotFoundError during test execution

**Solution**: Ensure PYTHONPATH is correctly set:
```bash
export PYTHONPATH="/path/to/venv/lib/python3.11/site-packages:$PYTHONPATH"
```

#### 2. Service Connection Issues

**Problem**: Tests fail due to external service connection errors

**Solution**: Currently, no external services are required for testing. If Redis or other services are added in the future, ensure they are properly configured in the workflow.

#### 3. Dependency Installation Issues

**Problem**: Package installation fails

**Solution**: Clear cache and reinstall:
```bash
pip cache purge
pip install -r requirements.txt --no-cache-dir
```

#### 4. Test Database Issues

**Problem**: SQLite database conflicts

**Solution**: Ensure tests use isolated SQLite databases:
```python
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
```

#### 5. Codecov Upload Issues

**Problem**: Coverage upload fails with "No coverage reports found"

**Solution**:
1. Ensure `CODECOV_TOKEN` secret is set in repository settings
2. Verify coverage files are generated in the correct directory
3. Check that pytest-cov is properly installed and configured
4. Ensure the `directory` parameter points to the correct location

**Debugging Steps**:
```bash
# Check if coverage files exist
ls -la backend/coverage.xml
ls -la backend/htmlcov/

# Verify pytest-cov installation
pip list | grep coverage
```

### Debugging Steps

1. **Check Workflow Logs**: Review the complete workflow execution logs
2. **Verify Environment**: Ensure all environment variables are set correctly
3. **Test Locally**: Run the same commands locally to reproduce issues
4. **Check Dependencies**: Verify all required packages are in requirements.txt
5. **Service Health**: Confirm Redis service is running and accessible

### Performance Optimization

- **Dependency Caching**: Uses GitHub Actions cache for pip packages
- **Parallel Execution**: Tests run in parallel where possible
- **Lightweight Setup**: No external services required for testing
- **Artifact Cleanup**: Automatically cleans up test artifacts

## Related Documentation

- [Testing Strategy](../TESTING_STRATEGY.md)
- [Backend Development](./README.md)
- [Database Migrations](../maintenance/migrations.md)
- [API Documentation](./api.md)

## Maintenance

### Updating the Workflow

1. **Python Version**: Update `python-version` in setup-python action
2. **Dependencies**: Update `requirements.txt` for new packages
3. **Environment Variables**: Add new variables as needed
4. **Service Containers**: Add new services if required

### Monitoring

- **Workflow Status**: Check Actions tab in GitHub repository
- **Coverage Trends**: Monitor Codecov dashboard for coverage trends
- **Performance**: Track workflow execution times
- **Failures**: Review failed workflow runs for patterns

### Best Practices

1. **Keep Dependencies Updated**: Regularly update requirements.txt
2. **Test Locally First**: Always test changes locally before pushing
3. **Monitor Coverage**: Maintain high test coverage
4. **Review Logs**: Check workflow logs for optimization opportunities
5. **Document Changes**: Update this documentation when workflow changes