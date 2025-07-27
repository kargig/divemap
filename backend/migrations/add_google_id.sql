-- Migration: Add google_id field to users table
-- Date: 2024-01-XX

ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_users_google_id ON users(google_id); 