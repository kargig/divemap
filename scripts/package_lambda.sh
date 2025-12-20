#!/bin/bash
#
# Package Lambda function for email notification processor
#
# This script packages the Lambda function with its dependencies and email templates.
# Based on instructions in terraform/DEPLOY.md section 3.
#
# Usage:
#   From project root:
#     ./scripts/package_lambda.sh [--deploy] [--region REGION]
#   From terraform directory:
#     ../scripts/package_lambda.sh [--deploy] [--region REGION]
#
# Options:
#   --deploy    Automatically deploy the package to AWS Lambda after packaging
#   --region    AWS region (default: eu-central-1)
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DEPLOY=false
REGION="eu-central-1"
PACKAGE_DIR="lambda_package"
ZIP_FILE="lambda_email_processor.zip"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --deploy)
      DEPLOY=true
      shift
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--deploy] [--region REGION]"
      exit 1
      ;;
  esac
done

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Script can be run from project root or terraform directory
# If run from terraform directory, adjust paths
if [[ -f "$SCRIPT_DIR/lambda.tf" ]]; then
  # Running from terraform directory
  TERRAFORM_DIR="$SCRIPT_DIR"
elif [[ ! -f "$TERRAFORM_DIR/lambda.tf" ]]; then
  echo -e "${RED}Error: This script must be run from the project root or terraform/ directory${NC}"
  echo "Usage: ./scripts/package_lambda.sh [--deploy]"
  echo "   or: cd terraform && ../scripts/package_lambda.sh [--deploy]"
  exit 1
fi

# Check required directories exist
if [[ ! -d "$BACKEND_DIR/lambda" ]]; then
  echo -e "${RED}Error: Lambda directory not found: $BACKEND_DIR/lambda${NC}"
  exit 1
fi

if [[ ! -d "$BACKEND_DIR/app/services" ]]; then
  echo -e "${RED}Error: Services directory not found: $BACKEND_DIR/app/services${NC}"
  exit 1
fi

if [[ ! -d "$BACKEND_DIR/app/templates/emails" ]]; then
  echo -e "${RED}Error: Email templates directory not found: $BACKEND_DIR/app/templates/emails${NC}"
  exit 1
fi

# Check required files exist
if [[ ! -f "$BACKEND_DIR/lambda/email_processor.py" ]]; then
  echo -e "${RED}Error: Lambda function not found: $BACKEND_DIR/lambda/email_processor.py${NC}"
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/app/services/email_service.py" ]]; then
  echo -e "${RED}Error: Email service not found: $BACKEND_DIR/app/services/email_service.py${NC}"
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/app/services/ses_service.py" ]]; then
  echo -e "${RED}Error: SES service not found: $BACKEND_DIR/app/services/ses_service.py${NC}"
  exit 1
fi

echo -e "${GREEN}Packaging Lambda function...${NC}"
echo ""

# Clean up any existing package directory and zip file
echo -e "${YELLOW}Cleaning up old package files...${NC}"
rm -rf "$TERRAFORM_DIR/$PACKAGE_DIR"
rm -f "$TERRAFORM_DIR/$ZIP_FILE"

# Create temporary directory for packaging
echo -e "${YELLOW}Creating package directory...${NC}"
mkdir -p "$TERRAFORM_DIR/$PACKAGE_DIR"
cd "$TERRAFORM_DIR/$PACKAGE_DIR"

# Copy Lambda function code
echo -e "${YELLOW}Copying Lambda function code...${NC}"
cp -r "$BACKEND_DIR/lambda"/* .

# Copy email service and templates from backend
echo -e "${YELLOW}Copying email services and templates...${NC}"
mkdir -p app/services app/templates/emails
cp "$BACKEND_DIR/app/services/email_service.py" app/services/
cp "$BACKEND_DIR/app/services/ses_service.py" app/services/
cp -r "$BACKEND_DIR/app/templates/emails"/* app/templates/emails/

# Verify required files were copied
if [[ ! -f "email_processor.py" ]]; then
  echo -e "${RED}Error: email_processor.py not found in package${NC}"
  exit 1
fi

if [[ ! -f "app/services/email_service.py" ]]; then
  echo -e "${RED}Error: email_service.py not found in package${NC}"
  exit 1
fi

if [[ ! -f "app/services/ses_service.py" ]]; then
  echo -e "${RED}Error: ses_service.py not found in package${NC}"
  exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
  echo -e "${RED}Error: pip or pip3 not found. Please install Python pip.${NC}"
  exit 1
fi

# Use pip3 if available, otherwise pip
PIP_CMD="pip3"
if ! command -v pip3 &> /dev/null; then
  PIP_CMD="pip"
fi

# Install dependencies (only boto3 and jinja2 are needed)
echo -e "${YELLOW}Installing dependencies (boto3, jinja2)...${NC}"
$PIP_CMD install boto3 jinja2 -t . --quiet

# Verify dependencies were installed
if [[ ! -d "boto3" ]] || [[ ! -d "jinja2" ]]; then
  echo -e "${RED}Error: Dependencies not installed correctly${NC}"
  exit 1
fi

# Create zip file (from inside package directory to avoid directory prefix)
echo -e "${YELLOW}Creating zip file...${NC}"
zip -r "$TERRAFORM_DIR/$ZIP_FILE" . -q
cd "$TERRAFORM_DIR"

# Get package size
PACKAGE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo -e "${GREEN}Package created: $ZIP_FILE (${PACKAGE_SIZE})${NC}"

# Verify package contents (check that files are at root level, not in lambda_package/)
echo -e "${YELLOW}Verifying package contents...${NC}"
if unzip -l "$ZIP_FILE" | grep -q "^[[:space:]]*[0-9]*[[:space:]]*.*email_processor.py$" || unzip -l "$ZIP_FILE" | grep -q "[[:space:]]email_processor.py$"; then
  echo -e "${GREEN}✓ email_processor.py found at root level${NC}"
else
  echo -e "${RED}✗ email_processor.py not found at root level in package${NC}"
  echo "Package structure:"
  unzip -l "$ZIP_FILE" | head -10
  exit 1
fi

if unzip -l "$ZIP_FILE" | grep -q "app/services/email_service.py"; then
  echo -e "${GREEN}✓ email_service.py found${NC}"
else
  echo -e "${RED}✗ email_service.py not found in package${NC}"
  exit 1
fi

if unzip -l "$ZIP_FILE" | grep -q "app/services/ses_service.py"; then
  echo -e "${GREEN}✓ ses_service.py found${NC}"
else
  echo -e "${RED}✗ ses_service.py not found in package${NC}"
  exit 1
fi

if unzip -l "$ZIP_FILE" | grep -q "boto3"; then
  echo -e "${GREEN}✓ boto3 found${NC}"
else
  echo -e "${RED}✗ boto3 not found in package${NC}"
  exit 1
fi

if unzip -l "$ZIP_FILE" | grep -q "jinja2"; then
  echo -e "${GREEN}✓ jinja2 found${NC}"
else
  echo -e "${RED}✗ jinja2 not found in package${NC}"
  exit 1
fi

# Verify package structure is correct (no lambda_package/ prefix)
if unzip -l "$ZIP_FILE" | grep -q "^[[:space:]]*[0-9]*[[:space:]]*.*lambda_package/"; then
  echo -e "${RED}✗ Error: Package contains lambda_package/ directory prefix${NC}"
  echo "Files should be at root level, not inside lambda_package/"
  exit 1
fi

# Clean up temporary directory
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf "$TERRAFORM_DIR/$PACKAGE_DIR"

echo ""
echo -e "${GREEN}✓ Lambda package created successfully!${NC}"
echo ""

# Deploy to AWS if requested
if [[ "$DEPLOY" == "true" ]]; then
  echo -e "${YELLOW}Deploying to AWS Lambda...${NC}"
  
  # Check if terraform is initialized and has outputs
  if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: terraform command not found${NC}"
    exit 1
  fi
  
  cd "$TERRAFORM_DIR"
  
  # Get Lambda function name from Terraform output
  if ! LAMBDA_NAME=$(terraform output -raw lambda_function_name 2>/dev/null); then
    echo -e "${RED}Error: Could not get Lambda function name from Terraform output${NC}"
    echo "Make sure Terraform is initialized and the infrastructure is deployed."
    echo "Run: cd terraform && terraform init && terraform apply"
    exit 1
  fi
  
  echo "Lambda function name: $LAMBDA_NAME"
  
  # Check if AWS CLI is available
  if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found${NC}"
    exit 1
  fi
  
  # Update Lambda function code
  echo -e "${YELLOW}Uploading package to AWS Lambda...${NC}"
  if aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" \
    --output json > /dev/null; then
    echo -e "${GREEN}✓ Lambda function updated successfully!${NC}"
    echo ""
    echo "To verify the deployment:"
    echo "  aws lambda get-function --function-name \"$LAMBDA_NAME\" --region $REGION"
  else
    echo -e "${RED}✗ Failed to update Lambda function${NC}"
    exit 1
  fi
else
  echo "To deploy the package to AWS Lambda, run:"
  echo "  ./scripts/package_lambda.sh --deploy"
  echo ""
  echo "Or manually:"
  echo "  cd terraform"
  echo "  LAMBDA_NAME=\$(terraform output -raw lambda_function_name)"
  echo "  aws lambda update-function-code \\"
  echo "    --function-name \"\$LAMBDA_NAME\" \\"
  echo "    --zip-file fileb://$ZIP_FILE \\"
  echo "    --region $REGION"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
