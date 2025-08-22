# Google OAuth Setup Guide

This guide will help you set up Google OAuth for the Divemap application.

## Prerequisites

1. A Google account
2. Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API and Google Identity Services

## Step 2: Configure OAuth Consent Screen

1. In Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "Divemap"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (your email addresses)
6. Save and continue

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Set the following:
   - Name: "Divemap Web Client"
   - Authorized JavaScript origins:
     - `http://localhost` (for development)
     - `https://your-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost` (for development)
     - `https://your-domain.com` (for production)
5. Click "Create"
6. Copy the Client ID and Client Secret

## Step 4: Configure Environment Variables

### Backend Configuration

1. Copy `env.example` to `.env` in the backend directory
2. Add your Google OAuth credentials:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

### Frontend Configuration

1. Copy `frontend/env.example` to `frontend/.env`
2. Add your Google Client ID:
   ```
   REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
   ```

## Step 5: Database Migration

Run the database migration to add the `google_id` field:

```sql
-- Run this in your MySQL database
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_users_google_id ON users(google_id);
```

## Step 6: Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Step 7: Test the Implementation

1. Start the backend server
2. Start the frontend development server
3. Navigate to the login or register page
4. You should see a "Sign in with Google" button
5. Test the Google OAuth flow

## Troubleshooting

### Common Issues

1. **"Invalid Client ID" error**
   - Verify the Client ID is correct in both frontend and backend
   - Check that the domain is authorized in Google Cloud Console

2. **"Redirect URI mismatch" error**
   - Ensure the redirect URI in Google Cloud Console matches your application URL
   - For development, use `http://localhost`

3. **"Google Identity Services not loaded" error**
   - Check that the Google Client ID is set in the frontend environment
   - Verify the Google Identity Services script is loading

4. **Database errors**
   - Ensure the `google_id` column exists in the users table
   - Run the migration script if needed

### Security Notes

1. Never commit your `.env` files to version control
2. Use different Client IDs for development and production
3. Regularly rotate your Client Secrets
4. Monitor OAuth usage in Google Cloud Console

## Production Deployment

1. Update the authorized origins and redirect URIs in Google Cloud Console
2. Set the production environment variables
3. Ensure HTTPS is enabled for production
4. Update the frontend API URL to point to your production backend

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the backend logs for authentication errors
3. Verify all environment variables are set correctly
4. Ensure the Google Cloud Console configuration is correct