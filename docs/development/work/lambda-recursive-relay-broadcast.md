# Implementation Plan: Recursive Relay Broadcast Notifications

## Objective
Improve system scalability and reduce operational costs by moving the "fan-out" logic for broadcast notifications from the Fly.io backend to a recursive, chunk-based AWS Lambda relay process.

## Background & Motivation
Currently, when a diving center broadcasts a message to 1,000 followers, the backend generates 1,000 separate SQS messages. This results in:
- High Fly.io compute usage while generating SQS tasks.
- 1,001 AWS Lambda invocations (1 orchestration + 1,000 deliveries).
- High SQS API request costs.

By moving to a **Recursive Relay**, we can handle 1,000 followers with roughly **10 Lambda invocations** (at 100 users per chunk) and only **one initial SQS request** from the backend.

## Proposed Solution: The "Relay Race"

Instead of the backend creating individual tasks for every user, it creates one "Baton" message. Lambda processes a small chunk of users and then "passes the baton" to the next Lambda by sending a new SQS message with an updated offset.

### Architecture Flow
1.  **Backend** sends initial SQS message: `{ type: "broadcast_relay", room_id: 80, offset: 0, limit: 100 }`.
2.  **Lambda** wakes up, calls the internal **Backend API** to fetch recipients in the range `[0, 100]`.
3.  **Lambda** sends 100 notifications concurrently (using `asyncio`).
4.  **Lambda** checks if there are more recipients. If yes, it sends a **new SQS message** to the same queue: `{ type: "broadcast_relay", room_id: 80, offset: 100, limit: 100 }`.
5.  **Lambda** exits cleanly.

## Implementation Steps

### Step 0: Setup
- Create a new git branch `feature/lambda-recursive-relay`.
- Write this plan to `docs/development/work/lambda-recursive-relay-broadcast.md`.

### Step 1: Backend - Internal Paginated API
Add a new internal endpoint to `backend/app/routers/notifications.py` that returns target data for a broadcast.

- **Endpoint:** `GET /api/v1/notifications/internal/broadcast-targets/{room_id}`
- **Query Params:** `offset` (int), `limit` (int)
- **Security:** Guarded by `verify_lambda_api_key`.
- **Logic:**
  - Query `UserChatRoomMember` for active members (excluding sender).
  - Join with `User` and `NotificationPreference` (category: `user_chat_message`).
  - Join with `PushSubscription`.
  - Apply pagination using `.offset(offset).limit(limit)`.
- **Response Schema:**
  ```json
  {
    "targets": [
      {
        "user_id": 123,
        "email": "user@example.com",
        "should_email": true,
        "should_push": true,
        "push_subscriptions": [ ... ]
      }
    ],
    "has_more": true,
    "total_remaining": 850
  }
  ```

### Step 2: Backend - Update Orchestration
Modify `backend/app/routers/diving_centers.py` to stop the backend-side fan-out.

- In `broadcast_trip_to_followers` and `broadcast_text_to_followers`:
  - Replace the loop that calls `notification_service.notify_chat_message`.
  - Send **one** SQS message using `sqs_service.send_broadcast_relay_task(...)`.

### Step 3: Lambda - Recursive Handler
Update `backend/lambda/email_processor.py` to handle the relay logic.

- **New Task Handler:** `process_broadcast_relay`.
- **Async Execution:** Use `asyncio.gather` with a semaphore to process the 100 recipients concurrently.
- **Recursion:** If `has_more` is true, the Lambda uses `boto3` to put the next chunk's message back into SQS.

## Scaling & Safety
- **Timeout Protection:** Chunks of 100 ensure the Lambda finishes in <5 seconds, well below the standard 30s-60s timeout.
- **Memory Safety:** Chunks prevent large JSON payloads from bloating Lambda RAM.
- **Error Isolation:** If one chunk of 100 fails, only that chunk is retried by SQS, not the entire 1,000-user broadcast.
- **Infinite Loop Guard:** Implement a `max_offset` check or `max_depth` counter to prevent runaway recursion in case of logic bugs.

## Verification Plan
1. **Unit Test:** Verify the internal paginated API returns correct counts and offsets.
2. **Integration Test:** Mock the Push/Email services and verify that the Lambda correctly sends the "next baton" message to SQS.
3. **Large Scale Test:** Create 200 test users and verify that the broadcast triggers 2 Lambda chunks of 100.
