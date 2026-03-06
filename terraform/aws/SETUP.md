# Terraform AWS Credentials Setup Guide

This guide explains how to set up AWS credentials to use Terraform for deploying the Divemap notification system infrastructure.

## Prerequisites

Before you begin, ensure you have:

1. **AWS Account**: An active AWS account with billing enabled
2. **AWS CLI**: Installed and configured (optional but recommended)
3. **Terraform**: Version >= 1.0 installed
4. **IAM Permissions**: Appropriate permissions to create AWS resources

## Step 1: Create IAM User for Terraform

### Option A: Using AWS Console (Recommended for Beginners)

1. **Log in to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in with your AWS account

2. **Navigate to IAM**
   - Search for "IAM" in the top search bar
   - Click on "IAM" service

3. **Create New User**
   - Click "Users" in the left sidebar
   - Click "Create user" button
   - Enter username: `divemap-terraform-user` (or your preferred name)
   - Click "Next"

4. **Set Permissions**
   - Select "Attach policies directly"
   - For initial setup, you can attach these AWS managed policies:
     - `PowerUserAccess` (provides full access except IAM management)
     - OR create a custom policy with specific permissions (see Option B below)
   - Click "Next"

5. **Review and Create**
   - Review the user details
   - Click "Create user"

6. **Create Access Keys**
   - Click on the newly created user
   - Go to "Security credentials" tab
   - Scroll down to "Access keys" section
   - Click "Create access key"
   - Select "Command Line Interface (CLI)" as use case
   - Check the confirmation box
   - Click "Next"
   - Add description (optional): "Terraform deployment for Divemap"
   - Click "Create access key"
   - **IMPORTANT**: Copy both the Access Key ID and Secret Access Key
   - Store them securely (you won't be able to see the secret key again)

### Option B: Using AWS CLI

```bash
# Create IAM user
aws iam create-user --user-name divemap-terraform-user

# Create access key
aws iam create-access-key --user-name divemap-terraform-user
```

Save the output which contains `AccessKeyId` and `SecretAccessKey`.

## Step 2: Create Custom IAM Policy (Recommended for Production)

For better security, create a custom IAM policy with only the necessary permissions.

**Note:** This policy includes IAM user management permissions (`iam:CreateUser`, `iam:PutUserPolicy`, etc.) because Terraform needs to create a dedicated IAM user for your application backend. This is a security best practice - your application should use its own IAM user with minimal permissions, not your root AWS account credentials.

### Policy JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ServicePermissions",
      "Effect": "Allow",
      "Action": [
        "sqs:*",
        "ses:*",
        "lambda:*",
        "events:*",
        "logs:*",
        "kms:*",
        "cloudwatch:*"
      ],
      "Resource": "*",
      "Comment": "Permissions for SQS, SES, Lambda, EventBridge, KMS, and CloudWatch services"
    },
    {
      "Sid": "IAMRolePermissions",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "*",
      "Comment": "Permissions for managing IAM roles (for Lambda and EventBridge)"
    },
    {
      "Sid": "IAMUserPermissions",
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:GetUser",
        "iam:ListUsers",
        "iam:TagUser",
        "iam:UntagUser",
        "iam:PutUserPolicy",
        "iam:DeleteUserPolicy",
        "iam:GetUserPolicy",
        "iam:ListUserPolicies",
        "iam:AttachUserPolicy",
        "iam:DetachUserPolicy",
        "iam:CreateAccessKey",
        "iam:DeleteAccessKey",
        "iam:ListAccessKeys",
        "iam:UpdateAccessKey"
      ],
      "Resource": "*",
      "Comment": "Permissions for creating and managing IAM user for application backend (security best practice)"
    },
    {
      "Sid": "IAMPolicyPermissions",
      "Effect": "Allow",
      "Action": [
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions"
      ],
      "Resource": "*",
      "Comment": "Permissions for managing IAM policies"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::divemap-terraform-state/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::divemap-terraform-state"
    }
  ]
}
```

### Create Policy in AWS Console

1. Go to IAM → Policies
2. Click "Create policy"
3. Click "JSON" tab
4. Paste the policy JSON above
5. Click "Next"
6. Name it: `DivemapTerraformPolicy`
7. Click "Create policy"
8. Attach it to your IAM user (Users → Select user → Add permissions → Attach policies → Select policy)

## Step 3: Configure AWS Credentials

You have three options for providing AWS credentials to Terraform:

### Option A: AWS CLI Configuration (Recommended)

Configure AWS CLI with your credentials:

```bash
aws configure
```

You'll be prompted for:

- **AWS Access Key ID**: Your access key ID from Step 1
- **AWS Secret Access Key**: Your secret access key from Step 1
- **Default region name**: `eu-central-1` (or your preferred region)
- **Default output format**: `json` (recommended)

This creates/updates `~/.aws/credentials` and `~/.aws/config` files.

**Verify configuration:**

```bash
aws sts get-caller-identity
```

You should see your account ID and user ARN.

### Option B: Environment Variables

Set environment variables in your shell:

**Linux/macOS:**

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_DEFAULT_REGION="eu-central-1"
```

**Windows (PowerShell):**

```powershell
$env:AWS_ACCESS_KEY_ID="your-access-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret-access-key"
$env:AWS_DEFAULT_REGION="eu-central-1"
```

**Windows (CMD):**

```cmd
set AWS_ACCESS_KEY_ID=your-access-key-id
set AWS_SECRET_ACCESS_KEY=your-secret-access-key
set AWS_DEFAULT_REGION=eu-central-1
```

### Option C: AWS Credentials File (Manual)

Create/edit `~/.aws/credentials` file:

```ini
[default]
aws_access_key_id = your-access-key-id
aws_secret_access_key = your-secret-access-key
```

Create/edit `~/.aws/config` file:

```ini
[default]
region = eu-central-1
output = json
```

**File locations:**

- Linux/macOS: `~/.aws/credentials` and `~/.aws/config`
- Windows: `C:\Users\YourUsername\.aws\credentials` and `C:\Users\YourUsername\.aws\config`

## Step 4: Verify Terraform Can Access AWS

Test that Terraform can authenticate:

```bash
cd terraform
terraform init
terraform plan
```

If you see an error about credentials, double-check your configuration.

## Step 5: Additional AWS Setup

For SES email address verification and production access, follow the SES section
in `DEPLOY.md` (see **"Verify SES Sender Email"**). That document walks you
through verifying the sender address, understanding sandbox vs production mode,
and recommended DNS/domain configuration for production.

## Security Best Practices

1. **Never commit credentials to Git**
   - `.gitignore` already excludes `terraform.tfvars` and credential files
   - Never commit `~/.aws/credentials` or environment variables

2. **Use IAM Roles for EC2/ECS/Lambda** (if applicable)
   - Instead of access keys, use IAM roles when running Terraform from AWS services

3. **Rotate Access Keys Regularly**
   - Create new keys every 90 days
   - Delete old keys after confirming new ones work

4. **Use Least Privilege Principle**
   - Only grant permissions needed for Terraform operations
   - Use the custom policy (Option B) instead of PowerUserAccess when possible

5. **Enable MFA for IAM User** (if using console access)
   - Add multi-factor authentication for extra security

6. **Monitor Access**
   - Enable CloudTrail to log all API calls
   - Set up alerts for unusual activity

## Troubleshooting

### Error: "No valid credential sources found"

**Solution:** Ensure credentials are configured using one of the methods above.

```bash
# Verify AWS CLI can access AWS
aws sts get-caller-identity

# If that works, Terraform should too
terraform init
```

### Error: "Access Denied" or "UnauthorizedOperation"

**Solution:** Your IAM user doesn't have sufficient permissions. Check:

1. IAM policies attached to your user
2. Ensure custom policy includes all required actions
3. Verify you're using the correct AWS account

### Error: "Region not found" or "Invalid region"

**Solution:** Ensure you're using a valid AWS region. For this project, use `eu-central-1` (Frankfurt).

### Error: "SES email not verified"

**Solution:** Verify your email address in SES Console before deploying (see
SES section in `DEPLOY.md`).

## Next Steps

After setting up credentials:

1. **Configure Terraform Variables**

   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

2. **Initialize Terraform**

   ```bash
   terraform init
   ```

3. **Review Plan**

   ```bash
   terraform plan
   ```

4. **Deploy Infrastructure**

   ```bash
   terraform apply
   ```

5. **Read Main README**
   - See `README.md` for high-level overview
   - See `DEPLOY.md` for detailed deployment instructions after credentials are configured

## Additional Resources

- [AWS IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [Terraform AWS Provider Authentication](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication)
- [AWS SES Getting Started](https://docs.aws.amazon.com/ses/latest/dg/getting-started.html)

## Support

If you encounter issues:

1. Check AWS CloudTrail logs for API call errors
2. Verify IAM permissions are correct
3. Ensure you're in the correct AWS region (`eu-central-1`)
4. Check Terraform error messages for specific guidance
