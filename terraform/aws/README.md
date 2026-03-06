## Terraform Infrastructure for Divemap Notification System

This directory contains the Terraform configuration for the **email notification
infrastructure** used by Divemap.

At a high level, it provisions:

- **SQS queue + dead-letter queue** for email notification tasks
- **Lambda function** that reads from SQS and sends emails via **SES**
- **SES configuration** for outgoing mail
- **EventBridge rules** for scheduled digests (daily/weekly)
- **IAM roles and policies**, plus a **dedicated IAM user** for the Divemap
  backend
- **KMS key** for encrypting SQS messages
- **CloudWatch log groups** for Lambda logs

### Key design choices

- The Lambda **does not connect directly to the database**.
- Instead, it calls the backend API:
  - `GET /api/v1/notifications/internal/{id}` – fetch notification data
  - `PUT /api/v1/notifications/internal/{id}/mark-email-sent` – mark as sent
- Authentication is done via an **API key** sent as `X-API-Key`.
- If the backend is behind **Cloudflare**, firewall rules must be configured to allow Lambda requests (see `DEPLOY.md` section 6.5).

This keeps database access centralized in the backend and simplifies the Lambda
code.

---

## Which document should I read?

- **`SETUP.md`**
  - Use this first if your AWS account / IAM users are **not yet prepared**.
  - Explains how to create the **Terraform IAM user/role** and required
    permissions.

- **`DEPLOY.md`**
  - Use this once credentials and IAM are ready.
  - Step-by-step guide for:
    - Filling `terraform.tfvars`
    - Running `terraform init/plan/apply`
    - Packaging and uploading Lambda
    - Configuring backend `.env` and SES
    - Creating and wiring the API key for Lambda
    - Testing, monitoring, and destroying the infra

In short:

- **New admin / fresh AWS account** → read `SETUP.md` then `DEPLOY.md`.
- **Returning admin who already has Terraform access** → go straight to
  `DEPLOY.md`.

---

## Inputs and outputs (quick reference)

**Inputs (from you):**

- AWS region (default: `eu-central-1`)
- Backend API URL (publicly reachable by Lambda)
- SES sender email (must be verified)
- Frontend URL (for links in emails)
- Strong API key value for Lambda (or use a database-backed API key)

**Outputs (from Terraform):**

- `sqs_queue_url` – main queue for notifications
- `lambda_function_name` – Lambda that sends emails
- `app_iam_user_name` – IAM user for the backend application
- `backend_api_url` – as configured

See `DEPLOY.md` for the exact commands that consume these values.

---

## Safety and security notes

- Never use **root AWS credentials** in Terraform or in the backend.
- Always use the **dedicated Terraform IAM user/role** described in
  `SETUP.md`.
- The backend should use the **application IAM user** created by Terraform,
  never the Terraform user or root.
- Store secrets only in `.env`, AWS Secrets Manager, or Parameter Store – not in
  git.

For full details, follow the flow: `SETUP.md` → `DEPLOY.md`.
