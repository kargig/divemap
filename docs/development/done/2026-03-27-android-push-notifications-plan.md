# Android (TWA) Push Notifications Implementation Plan

**Status:** Planning
**Created:** 2026-03-27
**Target Platform:** Android (Bubblewrap TWA) & Modern Web Browsers

## 1. Overview & Challenge

We need to inform users who have installed the Divemap Android app (and users on the web) when:
1. They receive a new chat message from a buddy.
2. A new dive site is added in their area of interest.

**The Challenge:** The existing notification architecture relies on HTTP Polling (every 30 seconds) while the app is *open*. When the app is closed or in the background, polling stops. To wake up the phone and show a system notification, we need a Push mechanism.

---

## 2. Senior Architectural Design (Decoupled & Stateless)

To ensure maximum reliability on a "scale-to-zero" infrastructure (Fly.io) and prevent thundering herd issues on the API, we use a **Stateless Lambda / Pre-Hydrated Queue** pattern.

### Clarification on Encryption & Data Flow
There are two distinct layers of encryption in this pipeline to ensure security and performance:
1. **AWS KMS (Infrastructure Encryption):** The Fly.io backend constructs the generic notification text (e.g., "New message from George") and sends it to AWS SQS along with the user's browser keys (`p256dh`, `auth`). While this payload is generated as plaintext in Python, it is transmitted over HTTPS and **encrypted at rest inside SQS using AWS KMS**.
2. **Web Push ECE (Payload Encryption):** When the AWS Lambda picks up the SQS message, it must forward the notification to Google/Mozilla. The Web Push standard *requires* the payload to be encrypted so the push providers cannot read the contents. The Lambda uses `pywebpush` to encrypt the generic text using the user's `p256dh` key, creating an unreadable blob that is sent to Google.

By letting Fly.io pass the unencrypted notification text to SQS, we offload the CPU-heavy Web Push encryption math to AWS Lambda, keeping the Fly.io web server lightning fast.

### The Decoupled Data Flow:
**CRITICAL PRIVACY RULE:** We must *never* send the actual decrypted chat message content to SQS or the Push Provider. The payload must strictly be generic (e.g., "You have a new message from a buddy") to prevent lock-screen shoulder surfing and protect the integrity of the chat encryption subsystem.

```text
┌────────┐      ┌────────────────┐      ┌─────────┐      ┌────────────┐      ┌─────────────┐      ┌──────────┐
│ User A │      │ Fly.io Backend │      │ AWS SQS │      │ AWS Lambda │      │ Push Server │      │ User B   │
│        │      │ (FastAPI & DB) │      │ (KMS)   │      │(pywebpush) │      │ (FCM/Apple) │      │ (Phone)  │
└───┬────┘      └───────┬────────┘      └────┬────┘      └─────┬──────┘      └──────┬──────┘      └────┬─────┘
    │ 1. Send Message   │                    │                 │                    │                  │
    ├──────────────────►│                    │                 │                    │                  │
    │                   │ 2. Store Encrypted │                 │                    │                  │
    │                   │    Chat in MySQL   │                 │                    │                  │
    │                   ├─┐                  │                 │                    │                  │
    │                   │<┘                  │                 │                    │                  │
    │                   │ 3. Fetch User B's  │                 │                    │                  │
    │                   │    Push Subs       │                 │                    │                  │
    │                   ├─┐                  │                 │                    │                  │
    │                   │<┘                  │                 │                    │                  │
    │                   │ 4. Craft GENERIC   │                 │                    │                  │
    │                   │    Payload (No PII)│                 │                    │                  │
    │                   │    "New Message!"  │                 │                    │                  │
    │                   ├─┐                  │                 │                    │                  │
    │                   │<┘                  │                 │                    │                  │
    │                   │ 5. Send generic    │                 │                    │                  │
    │                   │    text + pub keys │                 │                    │                  │
    │                   ├───────────────────►│                 │                    │                  │
    │                   │                    │ 6. Trigger      │                    │                  │
    │                   │                    ├────────────────►│                    │                  │
    │                   │                    │                 │ 7. Encrypt generic │                  │
    │                   │                    │                 │    text via        │                  │
    │                   │                    │                 │    pywebpush (ECE) │                  │
    │                   │                    │                 ├─┐                  │                  │
    │                   │                    │                 │<┘                  │                  │
    │                   │                    │                 │ 8. Send ECE blob   │                  │
    │                   │                    │                 ├───────────────────►│                  │
    │                   │                    │                 │                    │ 9. Push ECE blob │
    │                   │                    │                 │                    ├─────────────────►│
    │                   │                    │                 │                    │                  │ 10. SW Decrypts
    │                   │                    │                 │                    │                  │     & Shows Alert
    │                   │                    │                 │                    │                  ├─┐
    │                   │                    │                 │                    │                  │<┘
```

1.  **FastAPI (Fly.io):** A message arrives. FastAPI is already awake. It immediately queries the MySQL DB for the recipient's `push_subscriptions`.
2.  **FastAPI (Fly.io):** It constructs a pre-hydrated payload for each device containing only generic text.
    *   *Decoupling:* The payload includes the `endpoint`, `p256dh`, and `auth` keys alongside the generic notification text.
3.  **AWS SQS:** FastAPI drops these individual device-level messages into SQS (protected by KMS).
4.  **AWS Lambda:** The Lambda wakes up. It reads the pre-hydrated message from SQS, uses `pywebpush` to perform the Web Push encryption, and fires the encrypted blob directly at Google/Mozilla.
    *   **Zero Database Calls:** Lambda **does not** call the Backend API to fetch user keys or push endpoints.
5.  **Database Hygiene:** If Lambda gets a `410 Gone` or `404 Not Found` from the push provider (indicating the user uninstalled the app or revoked permission), it immediately calls an internal backend API endpoint (`PUT /api/v1/notifications/internal/push-subscriptions/{id}/fail`). The backend increments the `fail_count` and automatically deletes the token if the count reaches 10.

---

## 3. Junior vs. Senior Developer Mindset

### How a Junior Developer approaches this:
1. **UX:** Asks for notification permissions the exact second the user opens the app, leading to high rejection.
2. **Double-Network Latency:** Sends only an ID in the push. The phone wakes up, sees the ID, then has to wake up the Fly.io backend to fetch the actual text. This results in "Loading..." notifications.
3. **Database Throttling:** Makes the Lambda call the API for every single notification, triggering rate limits during bulk alerts (e.g., new dive site).
4. **Lambda Deployment:** Zips their local python environment and uploads it to AWS, causing `ImportError` on Amazon Linux because C-bound libraries (`orjson`, `cryptography`) weren't compiled for the correct OS architecture.

### How a Senior Developer approaches this:
1. **Contextual UX:** Prompts for permissions only after the user logs in or visits the Chat Inbox using a "soft" UI banner.
2. **Payload Hydration:** Puts the final notification text into the push payload (encrypted via Web Push standard) so the notification appears **instantly** without the phone talking to Divemap servers.
3. **Infrastructure Isolation:** Keeps the Lambda stateless for sending. The Lambda doesn't need to query the DB for keys, making it faster and more resilient.
4. **Retry Logic:** Implements a fail-count of 10 before deleting subscriptions to handle flaky Mozilla/Chrome push service transients.
5. **Deterministic Builds:** Uses an official AWS Linux Docker container (`public.ecr.aws/sam/build-python3.11`) in a bash script to compile the Lambda `.zip` file, guaranteeing 100% binary compatibility in production.

---

## 4. Implementation Steps

### Operator Checklist: Infrastructure Setup (Required)
Before deploying code, the system operator must generate and distribute the VAPID keys.

1. **Generate VAPID Keys:** These are the public/private keypair used to sign your push notifications. You only need to generate these **once** for the entire project.
   Run this in your terminal:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Distribute the Public Key (Frontend):**
   - Add the resulting Public Key to `frontend/.env` as `VITE_VAPID_PUBLIC_KEY="<public_key>"`.
   - Update your CI/CD or Fly.io build secrets to inject `VITE_VAPID_PUBLIC_KEY` during the frontend build process.
3. **Distribute the Private Key (Backend/AWS):**
   - The Private Key is highly sensitive. It must be provided to the AWS Lambda function.
   - Add the Private Key to your `terraform/aws/terraform.tfvars` file (or your Terraform Cloud workspace variables):
     ```hcl
     vapid_private_key = "<private_key>"
     vapid_admin_email = "mailto:admin@divemap.gr"
     ```
   - Update `terraform/aws/lambda.tf` to pass these new variables into the Lambda `environment { variables = { ... } }` block.
   - Run `terraform apply` to push the new secrets to AWS.
4. **Deploy the Lambda:**
   - Because `pywebpush` and its dependencies (`cryptography`) require Amazon Linux C-bindings, you must use the provided build script.
   - Run: `./scripts/package_lambda.sh --deploy`

   **Note on Registration:** One of the primary advantages of this VAPID-based architecture is that you **do not need to register** for a Google Firebase (FCM) account or any other third-party dashboard. Your VAPID keys act as your self-signed "ID card" that Google and Mozilla's push servers automatically trust.

### Phase 1: Database & Schema
1. **Create Schema:** `0046_add_push_subscriptions.py`
   ```sql
   CREATE TABLE push_subscriptions (
       id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT NOT NULL,
       endpoint VARCHAR(2048) NOT NULL,
       p256dh VARCHAR(255) NOT NULL,
       auth VARCHAR(255) NOT NULL,
       fail_count INT DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   ```

### Phase 1.5: The Explicit Permission Grant (Crucial UX)
**Important Note:** The creation and storage of the `endpoint`, `p256dh`, and `auth` keys in the database **does not happen automatically** just because the user installs the Android app or visits the website.

Due to strict browser privacy rules (which govern Bubblewrap TWAs), the user **must explicitly grant permission** before the browser will generate these keys.
1. **The "Soft" Prompt:** We will *not* trigger the native permission popup on first launch (which leads to high rejection rates). Instead, we will place a clear UI element (e.g., a "Enable Push Notifications" button in the Chat Inbox or Profile Settings).
2. **The Key Generation:** When the user taps this button, the native browser permission dialog appears ("Allow Divemap to send notifications?").
3. **The Storage:** Only after the user taps "Allow" will the browser generate the unique cryptographic keys for that specific device. The React frontend immediately sends these keys to the `POST /api/v1/notifications/push/subscribe` endpoint.
4. **Multi-Device Support:** If a user logs in on their phone *and* their laptop, they must grant permission on both. The database will store two separate `push_subscription` rows, and notifications will be delivered to both devices simultaneously.

### Phase 2: Backend & Lambda Integration
1. **Update SQS Payload:** Update `backend/app/services/notification_service.py` to fetch subscriptions and hydration data.
2. **AWS Lambda Update:**
   - Add `pywebpush` dependency.
   - Implement `webpush.webpush()` using the pre-hydrated data from SQS.
   - Handle `410 Gone` by logging to the cleanup queue.

### Phase 3: Frontend Service Worker
1. **Update `vite.config.mjs`:** Switch to `strategies: 'injectManifest'`.
2. **Write `frontend/src/sw.js`:**
   - Listen for `push` event.
   - Show notification immediately from `event.data.json()`.
   - Implement `notificationclick` for deep-linking to chat rooms or dive sites.

### Phase 4: UX & Permissions
1. **Soft Prompt:** Create a "Device Notifications" toggle in Profile settings.
2. **TWA Deep Link Testing:** Verify that clicking a notification on Android opens the TWA and routes to the correct internal React path.
