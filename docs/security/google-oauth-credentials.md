# Google OAuth Credentials Setup Guide

This guide provides step-by-step instructions for generating `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the Divemap application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click on the project dropdown at the top of the page
   - Click "New Project"
   - Enter a project name: `divemap-oauth` (or your preferred name)
   - Click "Create"

3. **Select Your Project**
   - Make sure your new project is selected in the project dropdown

## Step 2: Enable Required APIs

**Note:** Google has reorganized their APIs. For OAuth authentication, you have a few options:

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" > "Library"

2. **Option 1: Enable Identity Toolkit API (Recommended)**
   - Search for "Identity Toolkit API"
   - This is the current API for Google Identity services
   - Click on it and then click "Enable"

3. **Option 2: Enable People API (Alternative)**
   - Search for "People API" or "Google People API"
   - This provides access to user profile information
   - If found, enable it

4. **Option 3: Skip API enabling entirely**
   - The OAuth 2.0 credentials will work without explicitly enabling these APIs
   - Google's OAuth system is available by default
   - You can proceed directly to Step 3

**Recommendation:** Enable the **Identity Toolkit API** if you find it, as it's specifically designed for authentication flows.

## Step 3: Configure OAuth Consent Screen

1. **Access OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"

2. **Choose User Type**
   - Select "External" (unless you have a Google Workspace organization)
   - Click "Create"

3. **Fill in App Information**
   - **App name**: `Divemap`
   - **User support email**: Your email address
   - **App logo**: Optional - you can upload a logo later
   - **App domain**: Leave blank for now
   - **Developer contact information**: Your email address

4. **Add Scopes**
   - Look for a section called "Scopes" or "Scopes for Google APIs"
   - You may see a button like "Add or remove scopes" or "Edit scopes"
   - Click on it to open the scopes selection
   - In the scopes selection dialog, you'll see different categories:
     - Look for "Sensitive scopes" or "Basic scopes"
     - Find and check the following scopes:
       - `openid` (OpenID Connect)
       - `email` (See your email address)
       - `profile` (See your name, profile picture, and other public info)
   - If you can't find these specific scopes, look for:
     - "Google Identity" scopes
     - "Basic profile information" scopes
     - "Email address" scopes
   - Click "Update" or "Save" to confirm your selection

5. **Add Test Users (for External apps)**
   - Click "Add users"
   - Add your email address and any other test users
   - **IMPORTANT**: Only the email addresses you add here can use the OAuth app while it's in testing
   - Click "Add"

6. **Save and Continue**
   - Click "Save and continue" through all sections
   - You can skip optional sections for now

## Step 4: Create OAuth 2.0 Credentials

1. **Navigate to Credentials**
   - Go to "APIs & Services" > "Credentials" (or "Clients" in some interfaces)
   - If you don't see "Credentials", look for "OAuth 2.0 Client IDs" directly

2. **Create OAuth 2.0 Client ID**
   - Look for "Create Credentials" or "Create OAuth 2.0 Client ID"
   - Click on it to start the creation process

3. **Configure Application Type**
   - Choose "Web application"
   - Click "Create"

4. **Set Application Details**
   - **Name**: `Divemap Web Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost
     http://localhost:8000
     https://your-production-domain.com (when ready for production)
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost
     http://localhost/
     https://your-production-domain.com (when ready for production)
     ```

5. **Create the Credentials**
   - Click "Create"
   - **IMPORTANT**: Copy both the Client ID and Client Secret immediately
   - You won't be able to see the Client Secret again after leaving this page

## Step 5: Configure Environment Variables

### Backend Configuration

1. **Copy Environment Template**
   ```bash
   cd backend
   cp env.example .env
   ```

2. **Add Google OAuth Credentials**
   Edit your `.env` file and add:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

### Frontend Configuration

1. **Copy Frontend Environment Template**
   ```bash
   cd frontend
   cp env.example .env
   ```

2. **Add Google Client ID**
   Edit your `frontend/.env` file and add:
   ```
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   ```

## Step 6: Verify Database Schema

Ensure your database has the `google_id` field in the users table. If you haven't run migrations yet:

```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python run_migrations.py
```

## Step 7: Test the Configuration

1. **Start the Backend**
   ```bash
   cd backend
   source divemap_venv/bin/activate
   export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm start
   ```

3. **Test Google OAuth**
   - Navigate to `http://localhost`
   - Go to the login or register page
   - Click "Sign in with Google"
   - Complete the OAuth flow

## Step 8: Handle Testing Mode Issues

**If you get "Access blocked: Authorization Error":**

1. **Check Test Users**
   - Go back to Google Cloud Console
   - Navigate to "APIs & Services" > "OAuth consent screen"
   - Scroll down to "Test users" section
   - Make sure your email address is listed there

2. **Add Your Email as Test User**
   - Click "Add users"
   - Add the exact email address you're using to test
   - Click "Save"

3. **Verify Email Address**
   - Make sure you're using the same email address that's listed as a test user
   - The email must match exactly (including case sensitivity)

4. **Alternative Solutions**
   - **Option A**: Use a different Google account that's added as a test user
   - **Option B**: Publish your app to production (not recommended for development)
   - **Option C**: Wait a few minutes after adding test users (changes can take time to propagate)

## Step 9: Fix 403 Error on Google Identity Services Button

**If you get a 403 error when the Google button tries to load:**

1. **Check Frontend Environment Variables**
   ```bash
   cd frontend
   cat .env
   ```
   - Verify `VITE_GOOGLE_CLIENT_ID` is set correctly
   - Make sure it matches your Google Cloud Console Client ID exactly

2. **Verify Google Cloud Console Configuration**
   - Go to Google Cloud Console > "APIs & Services" > "Credentials"
   - Click on your OAuth 2.0 Client ID
   - Check that `http://localhost` is in "Authorized JavaScript origins"
   - Check that `http://127.0.0.1` is also added (if you're using 127.0.0.1)

3. **Add Missing Origins**
   - In Google Cloud Console, edit your OAuth 2.0 Client ID
   - Add these to "Authorized JavaScript origins":
     ```
     http://localhost
     http://127.0.0.1
     https://localhost
     https://127.0.0.1
     ```

4. **Clear Browser Cache**
   - Clear browser cache and cookies
   - Try in an incognito/private window
   - Restart your browser

5. **Restart Development Servers**
   ```bash
   # Stop both frontend and backend servers
   # Then restart them
   cd frontend && npm start
   cd backend && python -m uvicorn app.main:app --reload
   ```

## Troubleshooting

### Common Issues and Solutions

1. **"Invalid Client ID" Error**
   - Verify the Client ID is exactly the same in both frontend and backend
   - Check that you're using the correct project in Google Cloud Console
   - Ensure the domain is authorized in the OAuth consent screen

2. **"Can't find scopes" Error**
   - The scopes section might be in a different location
   - Look for "Scopes for Google APIs" or "OAuth scopes"
   - Try scrolling down on the OAuth consent screen page
   - The scopes might be automatically included for basic OAuth apps
   - If you can't find scopes, the basic ones (`openid`, `email`, `profile`) are often included by default

3. **"Can't find Credentials section" Error**
   - Google has reorganized the interface
   - Look for "OAuth 2.0 Client IDs" directly in the sidebar
   - Or search for "Credentials" in the search bar
   - The interface might show "Clients" instead of "Credentials"
   - Try going to "APIs & Services" and look for any credential-related options

2. **"Redirect URI Mismatch" Error**
   - Verify the redirect URI in Google Cloud Console matches your application URL
   - For development, ensure `http://localhost` is in the authorized origins
   - Check that there are no trailing slashes causing mismatches

3. **"Google Identity Services Not Loaded" Error**
   - Check that `VITE_GOOGLE_CLIENT_ID` is set in your frontend `.env` file
   - Verify the Google Identity script is loading in the browser
   - Check browser console for JavaScript errors
   - Note: The service is now called "Google Identity" rather than "Google Identity Services"

4. **"Token Verification Failed" Error**
   - Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in backend `.env`
   - Verify the Client ID matches between frontend and backend
   - Check that the Google Cloud project is active

5. **"Access blocked: Authorization Error" Error**
   - This happens when your app is in "Testing" mode
   - **Solution 1**: Add your email to test users in OAuth consent screen
   - **Solution 2**: Publish your app to production (not recommended for development)
   - **Solution 3**: Use a different Google account that's added as a test user
   - Check that you're using the same email address that's listed as a test user

6. **"403 Error on Google Identity Services Button" Error**
   - This happens when the Google button fails to load
   - **Solution 1**: Check that `VITE_GOOGLE_CLIENT_ID` is set correctly in frontend `.env`
   - **Solution 2**: Verify the Client ID matches exactly between frontend and backend
   - **Solution 3**: Check that the domain is authorized in Google Cloud Console
   - **Solution 4**: Clear browser cache and cookies
   - **Solution 5**: Try in an incognito/private browser window

5. **Database Errors**
   - Ensure the `google_id` column exists in the users table
   - Run migrations if needed: `python run_migrations.py`

### Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use different credentials for development and production
   - Regularly rotate your Client Secrets

2. **Google Cloud Console**
   - Monitor OAuth usage in the Google Cloud Console
   - Set up alerts for unusual activity
   - Regularly review authorized domains and redirect URIs

3. **Production Deployment**
   - Update authorized origins and redirect URIs for production domains
   - Use HTTPS for all production URLs
   - Set up proper CORS configuration

## Production Setup

When deploying to production:

1. **Update Google Cloud Console**
   - Add your production domain to authorized origins
   - Add production redirect URIs
   - Remove development URLs if not needed

2. **Update Environment Variables**
   - Set production environment variables
   - Use production Google OAuth credentials

3. **Security Considerations**
   - Enable HTTPS for all production URLs
   - Set up proper CORS headers
   - Monitor OAuth usage and errors

## Verification Checklist

Before going live, verify:

- [ ] Google Cloud project is active
- [ ] OAuth consent screen is configured
- [ ] OAuth 2.0 credentials are created
- [ ] Authorized origins include your domains
- [ ] Redirect URIs are configured correctly
- [ ] Environment variables are set in both frontend and backend
- [ ] Database has the `google_id` column
- [ ] OAuth flow works in development
- [ ] Production domains are added to Google Cloud Console
- [ ] HTTPS is enabled for production

## Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Review backend logs for authentication errors
3. Verify all environment variables are set correctly
4. Ensure Google Cloud Console configuration is correct
5. Test with a fresh browser session
6. Check that cookies and local storage are not interfering

## Related Documentation

- [OAuth Setup Guide](./oauth-setup.md)
- [Security Documentation](../README.md)
- [Development Setup](../development/README.md)