# **Technical Design Document: Scuba Dive Site & Center Review Platform**

## **1\. Introduction**

This document outlines the technical design for a Python-based web application, with future mobile application compatibility, dedicated to scuba diving site and center reviews. The platform will allow users to rate dive sites, find detailed information about them, discover diving centers and their offerings, view upcoming dive trips, and log their personal dives with detailed information.

## **2\. Goals**

* Provide a comprehensive database of scuba diving sites with rich multimedia content and practical information.  
* Enable users to rate dive sites and diving centers.  
* Facilitate user interaction through comments on rated entities (for eponymous users).  
* Offer a directory of scuba diving centers, including pricing and associated dive sites.  
* Implement a system for parsing dive store newsletters to extract and display upcoming dive trip information on an interactive map.  
* Provide contact mechanisms for users to book dives with centers.  
* Enable users to log and track their personal dives with detailed information.
* Allow users to claim ownership of diving centers with admin approval.
* Design for scalability and future expansion to a mobile application.
* Implement secure authentication with Google OAuth for enhanced user experience.

## **3\. Functional Requirements**

### **3.1. User Management**

* User registration and authentication (email/password, Google OAuth).  
* User profiles (displaying user's ratings, comments, dives).  
* Password reset functionality.
* Google OAuth integration for secure authentication.

### **3.2. Dive Site Management**

* **Add/Edit Dive Site (Admin/Moderator Functionality):**  
  * Name, description.  
  * Location (GPS coordinates, address).  
  * Access instructions (shore, boat details).  
  * Example photos and videos (upload and display).  
  * Difficulty level.  
  * Marine life encountered (optional, could be free text or predefined tags).  
  * Safety information.
  * Alternative names/aliases for URL routing.
* **View Dive Site:**  
  * Display all aforementioned details.  
  * Average user rating.  
  * List of associated diving centers that visit this site.  
  * User comments (eponymous users only).
  * List of dives logged at this site.
* **Rate Dive Site:**  
  * Score from 1 to 10\.  
  * One rating per user per site.
* **URL Routing:**
  * Access dive sites via `/dive-sites/dive-site-name` or `/dive-sites/alias`
  * Fallback to ID-based routing for compatibility.

### **3.3. Diving Center Management**

* **Add/Edit Diving Center (Admin/Moderator Functionality):**  
  * Name, description.  
  * Contact information (email, phone, website).  
  * Location.  
  * List of dive sites they visit.  
    * Dive cost per site (with multi-currency support).
  * Scuba gear rental costs (full set, individual items) with currency selection.
  * Tank rental costs (per type/size) with currency selection.  
* **View Diving Center:**  
  * Display all aforementioned details.  
  * Average user rating.  
  * List of dive sites they visit with costs.  
  * User comments (eponymous users only).  
* **Rate Diving Center:**  
  * Score from 1 to 10\.  
  * One rating per user per center.
* **Diving Center Ownership:**
  * Users can claim ownership of a diving center.
  * Admins must approve ownership claims.
  * Admins can directly assign users as diving center owners.
  * Approved owners can edit their diving center details regardless of admin status.

### **3.4. Dive Logging System**

* **Create/Edit Dive (User Functionality):**
  * Link to existing dive site or create new dive site.
  * Dive information (text form for detailed description).
  * Dive plan media upload (PDF, JPG, PNG).
  * Max depth (in meters/feet).
  * Average depth (in meters/feet).
  * Gas bottles used (type, size, pressure).
  * Suit type used (Wet suit, Dry suit, Shortie).
  * Difficulty level (Beginner, Intermediate, Advanced, Expert).
  * Visibility rating (1 to 10).
  * User rating (1 to 10).
  * Media upload/links (pictures, videos, external links).
  * Tags (using same categories as dive sites).
  * Date and time of dive.
  * Duration of dive.
* **View Dive:**
  * Display all dive information.
  * Link to associated dive site.
  * Media gallery for dive plan, photos, videos, and external links.
  * Tag display.
  * User can edit their own dives.
* **Dive Management:**
  * Users can view all their logged dives.
  * Search and filter dives by various criteria.
  * Export dive logs.
  * Media management (upload, delete, organize).

### **3.5. Comments**

* Users can leave comments on dive sites and diving centers.  
* Only eponymous users (logged-in users with a verified identity/profile name) can leave comments.  
* Comments are associated with the user and the rated entity.  
* Comments can be edited/deleted by the original author or by administrators.

### **3.6. Newsletter Parsing & Dive Trip Display**

* **Newsletter Upload/Submission (Admin Functionality):**  
  * Mechanism to upload or submit dive store newsletters (e.g., email attachment, direct text paste).  
* **Automated Parsing:**  
  * Identify diving centers.  
  * Identify dive sites.  
  * Extract dates and times of scheduled dives.  
* **Map Integration:**  
  * Display parsed dive trips on an interactive map (e.g., Google Maps, OpenStreetMap).  
  * Markers for dive sites showing upcoming trips.  
  * Clicking a marker reveals details: dive center, date, time, cost (if available).  
* **Booking/Contact:**  
  * Link to dive center's email or phone number for booking.

### **3.7. Search and Filtering**

* Search dive sites by name, location, difficulty.  
* Search diving centers by name, location, associated dive sites.  
* Search dives by various criteria (depth, date, location, tags).
* Filter dive sites/centers by average rating.

### **3.8. Multi-Currency Support System**

* **Supported Currencies**: 10 major world currencies (USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD)
* **Default Currency**: Euro (€) is the default currency for all cost fields
* **Currency Display**: Proper formatting with currency symbols and flags
* **Flexible Input**: Users can submit costs in any supported currency

### **3.9. Database Migration System**

* **Alembic Integration**: All database schema changes must use Alembic for version control
* **Automatic Migration Execution**: Migrations run automatically before application startup
* **Environment Compatibility**: Supports both development and Docker environments
* **Health Checks**: Database availability verification before migration execution
* **Rollback Support**: Full migration history with downgrade capabilities
* **Currency Validation**: 3-letter ISO currency code validation
* **Database Storage**: Currency fields with indexes for performance
* **API Integration**: All cost-related endpoints support currency
* **Frontend Utility**: Comprehensive currency formatting and selection functions

### **3.10. Admin Management System**

* **Mass Operations**: Bulk delete functionality for admin management pages
* **User Management**: Complete user CRUD with role assignment and status control
* **Tag Management**: Comprehensive tag system with usage statistics
* **Safety Features**: Protection against deleting used tags and self-deletion
* **Diving Center Ownership Management**: Approve/deny ownership claims and assign owners

## **4\. Non-Functional Requirements**

* **Performance:**  
  * Fast page load times (under 2 seconds for most pages).  
  * Efficient database queries.  
* **Scalability:**  
  * Ability to handle increasing user traffic and data volume.  
  * Support for future mobile application integration.  
* **Security:**  
  * User authentication and authorization (JWT + Google OAuth).
  * Protection against common web vulnerabilities (XSS, CSRF, SQL injection).  
  * Data encryption (especially for user credentials).  
  * Secure Google OAuth token verification.
* **Maintainability:**  
  * Clean, modular, and well-documented codebase.  
  * Easy to deploy and update.  
* **Usability:**  
  * Intuitive user interface for both web and future mobile applications.  
  * Responsive design for various screen sizes.
  * Enhanced toast notifications and layout improvements.
* **Reliability:**  
  * High availability of the platform.  
  * Robust error handling and logging.

## **5\. Architecture**

The application will follow a microservices-oriented or a well-separated monolithic architecture, with a clear distinction between frontend, backend, and database layers.

### **5.1. High-Level Architecture Diagram**

\+-------------------+           \+-------------------+           \+-------------------+  
|                   |           |                   |           |                   |  
|   User Devices    | \<-------\> |    Load Balancer  | \<-------\> |    Web Servers    |  
| (Web Browser/App) |           |                   |           | (Nginx/Gunicorn)  |  
|                   |           |                   |           |                   |  
\+-------------------+           \+-------------------+           \+-------------------+  
                                         |  
                                         | HTTP/HTTPS  
                                         V  
                             \+-----------------------+  
                             |                       |  
                             |      Backend API      |  
                             |   (Python/FastAPI)    |  
                             |                       |  
                             \+-----------------------+  
                                         |  
                       \+---------------------------------------+  
                       |                                       |  
                       | Database Connection Pool              |  
                       V                                       V  
             \+-------------------+                 \+-------------------+  
             |                   |                 |                   |  
             |  MySQL DB    |                 |  Redis Cache      |  
             | (Main Data Store) |                 | (Session/Caching) |  
             |                   |                 |                   |  
             \+-------------------+                 \+-------------------+  
                                         |  
                                         V  
                             \+-----------------------+  
                             |                       |  
                             |   Asynchronous Tasks  |  
                             |     (Celery/RabbitMQ) |  
                             | (e.g., Newsletter Parsing) |  
                             \+-----------------------+

### **5.2. Component Breakdown**

#### **5.2.1. Frontend**

* **Technology:** React (for web application) / React Native (for future mobile application).  
* **Key Features:**  
  * User-friendly interface for browsing, searching, rating, and commenting.  
  * Interactive map display for dive trips.  
  * Responsive design.  
  * Communication with the backend via RESTful API calls.
  * Google OAuth integration with Google Identity Services.
  * Mass delete functionality for admin management.
  * Dive logging interface with comprehensive media upload capabilities (photos, videos, external links).
  * Diving center ownership management interface.

#### **5.2.2. Backend (API)**

* **Language:** Python  
* **Framework:** FastAPI (chosen for its high performance, modern features, and automatic OpenAPI/Swagger documentation generation).  
* **Key Services/Modules:**  
  * **User Service:** Handles user registration, login, authentication (JWT + Google OAuth), profile management.  
  * **Dive Site Service:** CRUD operations for dive sites, rating logic, comment management, URL routing.  
  * **Diving Center Service:** CRUD operations for diving centers, rating logic, comment management, association with dive sites and pricing, ownership management.  
  * **Dive Service:** CRUD operations for user dives, media upload handling, dive statistics, external link management.
  * **Google OAuth Service:** Token verification and user management for Google authentication.
  * **Newsletter Parsing Service:**  
    * Receives newsletter content.  
    * Utilizes NLP techniques (e.g., SpaCy, NLTK) or rule-based parsing to extract entities (dive center names, dive site names, dates).  
    * Requires a mapping between recognized entities and database IDs.  
    * Queues parsing tasks for asynchronous processing (Celery).  
  * **Search Service:** Implements full-text search and filtering capabilities.  
  * **Image/Video Upload Service:** Handles secure storage and retrieval of multimedia content (e.g., integration with cloud storage like CloudFlare R2, AWS S3 or Google Cloud Storage).  
* **Web Server Gateway Interface (WSGI):** Gunicorn (production-ready WSGI server for Python).  
* **Reverse Proxy:** Nginx (for serving static files, load balancing, SSL termination, and proxying requests to Gunicorn).

#### **5.2.3. Database**

* **Type:** Relational Database  
* **System:** MySQL (chosen for its robustness, reliability, rich feature set, and strong support for spatial data if needed for advanced mapping).
* **Migration System:** Alembic for version-controlled database schema changes
* **Schema (Conceptual):**  
  * users table:  
    * id (PK)  
    * username  
    * email (unique)  
    * password\_hash  
    * google\_id (unique, nullable) - NEW FIELD
    * created\_at  
    * updated\_at  
    * is\_admin (boolean)  
    * is\_moderator (boolean)  
  * dive\_sites table:  
    * id (PK)  
    * name  
    * description  
    * latitude  
    * longitude  
    * access\_instructions  
    * difficulty\_level  
    * created\_at  
    * updated\_at  
    * alternative\_names (JSON array for URL routing)
  * site\_media table:  
    * id (PK)  
    * dive\_site\_id (FK to dive\_sites)  
    * media\_type (e.g., 'photo', 'video')  
    * url (link to stored media)  
    * description (optional)  
  * site\_ratings table:  
    * id (PK)  
    * dive\_site\_id (FK to dive\_sites)  
    * user\_id (FK to users)  
    * score (1-10)  
    * created\_at  
  * site\_comments table:  
    * id (PK)  
    * dive\_site\_id (FK to dive\_sites)  
    * user\_id (FK to users)  
    * comment\_text  
    * created\_at  
    * updated\_at  
  * diving\_centers table:  
    * id (PK)  
    * name  
    * description  
    * email  
    * phone  
    * website  
    * latitude  
    * longitude  
    * created\_at  
    * updated\_at  
    * owner\_id (FK to users, nullable) - NEW FIELD
    * ownership\_status (enum: 'unclaimed', 'claimed', 'approved') - NEW FIELD
  * center\_ratings table:  
    * id (PK)  
    * diving\_center\_id (FK to diving\_centers)  
    * user\_id (FK to users)  
    * score (1-10)  
    * created\_at  
  * center\_comments table:  
    * id (PK)  
    * diving\_center\_id (FK to diving\_centers)  
    * user\_id (FK to users)  
    * comment\_text  
    * created\_at  
    * updated\_at  
  * center\_dive\_sites (junction table for many-to-many relationship):  
    * id (PK)  
    * diving\_center\_id (FK to diving\_centers)  
    * dive\_site\_id (FK to dive\_sites)  
    * dive\_cost  
  * gear\_rental\_costs table:  
    * id (PK)  
    * diving\_center\_id (FK to diving\_centers)  
    * item\_name (e.g., "Full Set", "BCD", "Regulator", "12L Tank")  
    * cost  
  * dives table: - NEW TABLE
    * id (PK)
    * user\_id (FK to users)
    * dive\_site\_id (FK to dive\_sites, nullable)
    * dive\_information (text)
    * max\_depth (decimal)
    * average\_depth (decimal)
    * gas\_bottles\_used (text)
    * suit\_type (enum: 'wet_suit', 'dry_suit', 'shortie')
    * difficulty\_level (enum: 'beginner', 'intermediate', 'advanced', 'expert')
    * visibility\_rating (1-10)
    * user\_rating (1-10)
    * dive\_date (date)
    * dive\_time (time)
    * duration (integer, minutes)
    * created\_at
    * updated\_at
  * dive\_media table: - NEW TABLE
    * id (PK)
    * dive\_id (FK to dives)
    * media\_type (enum: 'dive_plan', 'photo', 'video', 'external_link')
    * url (link to stored media or external URL)
    * description (optional)
    * title (optional, for external links)
    * thumbnail\_url (optional, for external links)
  * dive\_tags table: - NEW TABLE
    * id (PK)
    * dive\_id (FK to dives)
    * tag\_id (FK to tags)
  * parsed\_dive\_trips table:  
    * id (PK)  
    * diving\_center\_id (FK to diving\_centers)  
    * dive\_site\_id (FK to dive\_sites)  
    * trip\_date (Date)  
    * trip\_time (Time \- optional)  
    * source\_newsletter\_id (FK to newsletters table, if storing raw newsletters)  
    * extracted\_at  
  * newsletters table (optional, for storing raw newsletters for auditing/re-parsing):  
    * id (PK)  
    * content (text blob)  
    * received\_at

#### **5.2.4. Caching**

* **Technology:** Redis (for session management, frequently accessed data like average ratings, and rate limiting).

#### **5.2.5. Asynchronous Task Queue**

* **Technology:** Celery with RabbitMQ (broker).  
* **Purpose:** Offload long-running tasks like newsletter parsing, image processing, and sending notifications to background workers to avoid blocking the main API.

#### **5.2.6. Object Storage**

* **Technology:** AWS S3, Google Cloud Storage, or a self-hosted MinIO instance.  
* **Purpose:** Store large binary objects like photos, videos, and dive plan PDFs, keeping them separate from the main database.

## **6\. API Endpoints (Conceptual)**

* /api/v1/auth/register (POST)  
* /api/v1/auth/login (POST)  
* /api/v1/auth/google-login (POST) - NEW ENDPOINT
* /api/v1/users/{user\_id} (GET, PUT)  
* /api/v1/dive-sites (GET, POST)  
* /api/v1/dive-sites/{site\_id} (GET, PUT, DELETE)  
* /api/v1/dive-sites/{site\_id}/rate (POST)  
* /api/v1/dive-sites/{site\_id}/comments (GET, POST)  
* /api/v1/dive-sites/search (GET)  
* /api/v1/dive-sites/by-name/{name} (GET) - NEW ENDPOINT
* /api/v1/diving-centers (GET, POST)  
* /api/v1/diving-centers/{center\_id} (GET, PUT, DELETE)  
* /api/v1/diving-centers/{center\_id}/rate (POST)  
* /api/v1/diving-centers/{center\_id}/comments (GET, POST)  
* /api/v1/diving-centers/search (GET)
* /api/v1/diving-centers/{center_id}/gear-rental (GET, POST) - Supports currency
* /api/v1/dive-sites/{site_id}/diving-centers (GET, POST) - Supports currency  
* /api/v1/diving-centers/{center_id}/claim (POST) - NEW ENDPOINT
* /api/v1/diving-centers/{center_id}/approve-ownership (POST) - NEW ENDPOINT
* /api/v1/dives (GET, POST) - NEW ENDPOINT
* /api/v1/dives/{dive_id} (GET, PUT, DELETE) - NEW ENDPOINT
* /api/v1/dives/{dive_id}/media (GET, POST, DELETE) - NEW ENDPOINT
* /api/v1/dives/{dive_id}/media/{media_id} (GET, PUT, DELETE) - NEW ENDPOINT
* /api/v1/dives/search (GET) - NEW ENDPOINT
* /api/v1/admin/newsletters/parse (POST \- upload newsletter, trigger parsing)  
* /api/v1/dive-trips (GET \- retrieve parsed trips for map)  
* /api/v1/media/upload (POST \- for image/video uploads)

## **7\. Technologies & Tools**

* **Backend:**  
  * Python 3.x  
  * FastAPI  
  * Pydantic (for data validation)  
  * SQLAlchemy (ORM for database interaction)  
  * Alembic (for database migrations)  
  * Gunicorn  
  * Nginx  
  * Celery  
  * RabbitMQ  
  * MySQL  
  * Redis  
  * Requests (for external API calls if any)  
  * Pillow (for image processing \- resizing, compression)  
  * SpaCy / NLTK (for NLP in newsletter parsing)
  * Google Auth (for OAuth verification) - NEW
* **Frontend:**  
  * React / React Native  
  * Redux / Zustand / React Query (for state management and data fetching)  
  * OpenLayers (for interactive maps)  
  * Axios (for API calls)
  * Google Identity Services (for OAuth) - NEW
* **DevOps & Deployment:**  
  * Docker / Docker Compose (for local development and deployment)  
  * Kubernetes (for container orchestration in production \- long-term)  
  * CI/CD Pipeline (e.g., GitLab CI/CD, GitHub Actions)  
  * Terraform (for infrastructure as code \- long-term)  
  * Prometheus / Grafana (for monitoring)  
  * Sentry (for error tracking)  
* **Version Control:** Git  
* **Documentation:** OpenAPI/Swagger UI (generated by FastAPI)

## **8\. Future Considerations**

* **Mobile Application:** Leverage React Native for cross-platform mobile development, reusing a significant portion of the frontend logic.  
* **Advanced Search:** Implement more sophisticated search capabilities (e.g., fuzzy search, spatial search).  
* **Social Features:** User following, sharing dive sites/trips.  
* **AI/ML for Newsletter Parsing:** Improve parsing accuracy and adaptability using machine learning models trained on various newsletter formats.  
* **Personalized Recommendations:** Suggest dive sites or centers based on user preferences and past activity.  
* **Booking Integration:** Direct booking functionality with diving centers (requires integration with their booking systems, potentially via APIs).  
* **User-Generated Content Review Workflow:** For comments and ratings to prevent abuse.  
* **Internationalization (i18n):** Support for multiple languages.
* **Additional OAuth Providers:** Facebook, GitHub, etc.
* **Dive Statistics and Analytics:** Advanced dive logging analytics and statistics.
* **Dive Buddy System:** Connect divers and share dive experiences.

## **9\. Implementation Phases (High-Level)**

### **Phase 1: Core MVP (Minimum Viable Product)**

* Basic User Management (registration, login, profile).  
* CRUD for Dive Sites (Admin only initially).  
* View Dive Sites (with all details).  
* Interactive map display of dive sites.  
* User Rating for Dive Sites.  
* Basic Search and Filtering for Dive Sites.  
* Deployment to a staging environment.

### **Phase 2: Diving Centers & Comments**

* CRUD for Diving Centers (Admin only initially).  
* View Diving Centers (with details, associated sites, pricing).
* Diving centers also have a location and appear on the dive map using a different icon.
* User Rating for Diving Centers.  
* Eponymous User Comments on Dive Sites and Diving Centers.  
* Basic Search and Filtering for Diving Centers.

### **Phase 3: Newsletter Parsing & Map**

* Admin interface for newsletter upload.  
* Initial implementation of newsletter parsing logic.  
* Populate parsed\_dive\_trips table.  
* Interactive map display of dive trips.  
* Contact details for booking (email/phone).

### **Phase 4: Dive Logging System**

* CRUD for user dives with comprehensive dive information.
* Media upload for dive plans and photos.
* Dive statistics and analytics.
* Search and filter dives by various criteria.
* Integration with dive sites and tags.

### **Phase 5: Diving Center Ownership**

* User claiming system for diving centers.
* Admin approval workflow for ownership claims.
* Owner editing capabilities for diving center details.
* Ownership management interface for admins.

### **Phase 6: URL Routing & Enhanced Features**

* URL routing for dive sites by name/alias.
* Enhanced search and filtering capabilities.
* Performance optimizations and scaling.
* Mobile application development.

### **Phase 7: Refinement & Scaling**

* Performance optimizations (caching, query tuning).  
* Robust error handling and logging.  
* Security enhancements.  
* CI/CD pipeline setup.  
* Scalable deployment infrastructure (Docker/Kubernetes).  
* User-friendly UI/UX improvements.

### **Phase 8: Mobile Application (Future)**

* Design and development of the React Native mobile application.  
* Adaptation of existing frontend components.  
* Mobile-specific features (e.g., location services for "dives near me").

## **10\. Security Considerations**

* **Authentication:** JWT (JSON Web Tokens) for stateless authentication + Google OAuth.  
* **Authorization:** Role-based access control (RBAC) to distinguish between regular users, administrators, and moderators.  
* **Password Hashing:** Use strong, industry-standard hashing algorithms (e.g., bcrypt) with salts.  
* **Input Validation:** Sanitize and validate all user inputs to prevent injection attacks (SQL injection, XSS).  
* **CORS:** Properly configure Cross-Origin Resource Sharing.  
* **HTTPS:** Enforce HTTPS for all communication.  
* **Rate Limiting:** Protect against brute-force attacks and API abuse.  
* **Secret Management:** Securely store API keys and sensitive credentials (e.g., environment variables, dedicated secret management services).  
* **Regular Security Audits:** Conduct periodic vulnerability assessments and penetration testing.
* **Google OAuth Security:** Secure token verification with Google's servers.
* **Media Upload Security:** Validate file types and sizes, scan for malware.

## **11\. Error Handling and Logging**

* Implement centralized error logging (e.g., using Sentry, ELK stack).  
* Provide meaningful error messages to the client without exposing sensitive internal details.  
* Log sufficient information for debugging (request details, stack traces, timestamps).  
* Graceful degradation for external service failures.

## **12\. Testing Infrastructure**

### **12.1 Testing Strategy**

* **Automated Testing:** Comprehensive test suite for backend API endpoints using Pytest.
* **Frontend Validation:** Automated scripts to validate frontend functionality and catch regressions.
* **Data Type Safety:** Validation of API response types and frontend data handling.
* **Regression Prevention:** Automated testing to prevent common frontend errors.

### **12.2 Testing Tools**

* **Backend Testing:** Pytest with fixtures for isolated test database and authentication.
* **Frontend Validation:** Node.js scripts for API health checks and data type validation.
* **Regression Testing:** Automated scripts to test common issues like data type mismatches.
* **Manual Testing:** Comprehensive checklist for user experience validation.

### **12.3 Test Categories**

#### **A. Backend API Testing**
* Unit tests for all API endpoints (auth, users, dive sites, diving centers, dives)
* Integration tests for database operations
* Authentication and authorization testing
* Error handling and edge case testing
* Google OAuth testing

#### **B. Frontend Validation**
* Data type validation (lat/lng as strings, ratings as numbers)
* API endpoint connectivity testing
* Common error prevention (array safety, type conversion)
* User interface functionality testing
* Google OAuth integration testing

#### **C. Regression Prevention**
* Automated testing for common frontend errors
* Data type safety validation
* API parameter filtering testing
* Cross-browser compatibility testing

### **12.4 Testing Commands**

```bash
# Backend tests
cd backend && python -m pytest

# Frontend validation
node validate_frontend.js

# Regression testing
node test_regressions.js
```

## **13\. Current Implementation Status**

### **13.1 Completed Features**

#### **Phase 1: Core MVP ✅ COMPLETED**
* ✅ Basic User Management (registration, login, profile)
* ✅ CRUD for Dive Sites (Admin only initially)
* ✅ View Dive Sites (with all details)
* ✅ Interactive map display of dive sites
* ✅ User Rating for Dive Sites
* ✅ Basic Search and Filtering for Dive Sites
* ✅ Deployment to a staging environment

#### **Phase 2: Diving Centers & Comments ✅ COMPLETED**
* ✅ CRUD for Diving Centers (Admin only initially)
* ✅ View Diving Centers (with details, associated sites, pricing)
* ✅ Diving centers appear on the dive map using different icons
* ✅ User Rating for Diving Centers
* ✅ Eponymous User Comments on Dive Sites and Diving Centers
* ✅ Basic Search and Filtering for Diving Centers
* ✅ Comprehensive Add/Edit functionality for dive sites and diving centers
* ✅ Media management for dive sites (photos and videos)
* ✅ Gear rental cost management for diving centers
* ✅ Enhanced dive site details (address, marine life, safety information)
* ✅ Rating display improvements (numeric format instead of stars)
* ✅ Edit functionality for admin/moderator users

#### **Phase 3: Newsletter Parsing & Map 🔄 IN PROGRESS**
* 🔄 Admin interface for newsletter upload
* 🔄 Initial implementation of newsletter parsing logic
* 🔄 Populate parsed_dive_trips table
* 🔄 Interactive map display of dive trips
* 🔄 Contact details for booking (email/phone)

#### **Phase 4: Refinement & Scaling ✅ COMPLETED**
* ✅ Performance optimizations (caching, query tuning)
* ✅ Robust error handling and logging
* ✅ Security enhancements
* ✅ Comprehensive testing infrastructure
* ✅ Scalable deployment infrastructure (Docker)
* ✅ User-friendly UI/UX improvements

### **13.2 Recent Enhancements**

#### **Google OAuth Authentication ✅ COMPLETED**
* ✅ Complete OAuth 2.0 integration with Google Identity Services
* ✅ Backend token verification with Google's servers
* ✅ Automatic user creation and account linking
* ✅ Frontend Google Sign-In buttons
* ✅ Environment configuration and setup guide
* ✅ Security features (rate limiting, error handling)

#### **Mass Delete Functionality ✅ COMPLETED**
* ✅ Bulk operations for all admin management pages
* ✅ Safety features (protection against deleting used tags and self-deletion)
* ✅ Confirmation dialogs with item names
* ✅ Visual feedback (loading states, success/error messages)
* ✅ Responsive design for all screen sizes

#### **Toast Notification Enhancements ✅ COMPLETED**
* ✅ Notifications appear below navbar to prevent navigation blocking
* ✅ Reduced duration to 500ms for quicker disappearance
* ✅ Proper z-index management with navbar
* ✅ Responsive design for all screen sizes

#### **Layout Improvements ✅ COMPLETED**
* ✅ Fixed navbar with proper z-index
* ✅ Adjusted content spacing to account for fixed navbar
* ✅ Text wrapping to prevent horizontal scrollbars
* ✅ Increased container width for better content display

#### **Testing Infrastructure ✅ COMPLETED**
* ✅ Comprehensive backend test suite with Pytest
* ✅ Frontend validation scripts for regression prevention
* ✅ Data type safety testing and validation
* ✅ Automated testing for common frontend errors

#### **User Experience Improvements ✅ COMPLETED**
* ✅ Rating display changed from stars to numeric format (X.X/10)
* ✅ Enhanced dive site details with comprehensive information
* ✅ Improved search and filtering with parameter validation
* ✅ Better error handling and loading states

#### **Admin Functionality ✅ COMPLETED**
* ✅ Comprehensive edit forms for dive sites and diving centers
* ✅ Media management for dive sites
* ✅ Gear rental cost management for diving centers
* ✅ Protected routes for admin/moderator users

#### **Data Type Safety ✅ COMPLETED**
* ✅ Fixed latitude/longitude type conversion issues
* ✅ Improved array safety checks
* ✅ API parameter filtering to prevent 422 errors
* ✅ Comprehensive error prevention guidelines

#### **Tag Management System ✅ COMPLETED**
* ✅ Comprehensive tag/label system for dive sites
* ✅ Tag display in dive site details page
* ✅ Multiple tag selection in edit forms with checkboxes
* ✅ Bulk tag operations (add/remove all tags at once)
* ✅ Create new tags functionality for admins/moderators
* ✅ Efficient tag management with proper state handling

#### **Map UI and Zoom Management ✅ COMPLETED**
* ✅ Interactive map display with OpenLayers integration
* ✅ Different icons for dive sites and diving centers
* ✅ Zoom level debugging indicator for optimal zoom configuration
* ✅ Map counter box positioned at bottom-left for better UX
* ✅ Configurable maximum zoom level (currently set to 18)
* ✅ Smart zoom behavior: keeps zoom 5 levels before maximum for context
* ✅ Real-time zoom level tracking and display
* ✅ Map fit behavior optimization for single vs multiple site selection

### **13.3 Technical Improvements**

#### **Frontend Enhancements ✅ COMPLETED**
* ✅ Centralized API client with Axios
* ✅ React Query for efficient data fetching
* ✅ Comprehensive error boundaries and loading states
* ✅ Responsive design with Tailwind CSS
* ✅ Google OAuth integration with Google Identity Services

#### **Backend Enhancements ✅ COMPLETED**
* ✅ FastAPI with automatic OpenAPI documentation
* ✅ SQLAlchemy ORM with proper relationships
* ✅ JWT authentication with role-based access control
* ✅ Comprehensive API validation with Pydantic
* ✅ Google OAuth token verification

#### **DevOps & Deployment ✅ COMPLETED**
* ✅ Docker Compose for local development
* ✅ MySQL database with proper schema
* ✅ Nginx reverse proxy configuration
* ✅ Automated testing and validation scripts

#### **Admin Management System ✅ COMPLETED**
* ✅ Comprehensive admin dashboard with multiple management sections
* ✅ Tag management with dive site count display
* ✅ User management with role and status control
* ✅ User approval system (new users disabled by default)
* ✅ Admin-only user creation, editing, and deletion
* ✅ Role-based access control (User, Moderator, Admin)
* ✅ User status management (enabled/disabled)
* ✅ Mass delete functionality with safety features

#### **User Registration and Approval System ✅ COMPLETED**
* ✅ New users created with enabled=False by default
* ✅ Admin approval required for account activation
* ✅ Google OAuth integration for secure authentication
* ✅ Registration success message with approval notice
* ✅ Disabled users blocked from accessing protected endpoints
* ✅ User-friendly approval workflow

### **13.4 Recent Bug Fixes**

#### **Google OAuth Implementation ✅ COMPLETED**
* ✅ Fixed ModuleNotFoundError for Google packages
* ✅ Successfully added google_id field to users table
* ✅ Fixed dependency conflicts with pyasn1
* ✅ Rebuilt Docker containers with new dependencies

#### **Frontend Linting Issues ✅ COMPLETED**
* ✅ Fixed missing icon imports (X, Loader, Save)
* ✅ Fixed useEffect dependency warnings with useCallback
* ✅ Removed unused navigate imports
* ✅ Fixed all ESLint errors and warnings

#### **Layout and UX Issues ✅ COMPLETED**
* ✅ Fixed toast notifications appearing behind navbar
* ✅ Prevented horizontal scrollbars with text wrapping
* ✅ Proper z-index management for fixed navbar
* ✅ Improved container width and spacing

#### **API Serialization Issues ✅ COMPLETED**
* ✅ Fixed dive sites API tag serialization causing 500 errors
* ✅ Updated AvailableTag model field mapping (removed non-existent 'category' field)
* ✅ Fixed Pydantic response validation errors for dive sites endpoint
* ✅ Proper tag dictionary serialization in all dive site endpoints

#### **Schema Validation Updates ✅ COMPLETED**
* ✅ Added 'expert' difficulty level support to all dive site schemas
* ✅ Updated difficulty level patterns in DiveSiteBase, DiveSiteUpdate, and DiveSiteSearchParams
* ✅ Fixed query parameter validation for difficulty level filtering

#### **Frontend Create Pages ✅ COMPLETED**
* ✅ Added missing CreateDiveSite.js component with comprehensive form
* ✅ Added missing CreateDivingCenter.js component with comprehensive form
* ✅ Added proper React Router routes for create pages
* ✅ Implemented form validation and error handling
* ✅ Added proper navigation and user experience features

#### **Authentication and Docker Issues ✅ COMPLETED**
* ✅ Resolved admin login issues with updated password requirements
* ✅ Fixed slowapi import errors in containerized environment
* ✅ Updated admin password to meet new security requirements
* ✅ Rebuilt Docker images to include latest dependencies

#### **Testing and Validation ✅ COMPLETED**
* ✅ Updated test data to include 'expert' difficulty level
* ✅ Fixed test tag data to match actual model fields
* ✅ Added comprehensive API response validation tests
* ✅ Improved error handling and logging for debugging

### **13.5 Planned Features**

#### **Phase 4: Dive Logging System 🔄 PLANNED**
* 🔄 CRUD for user dives with comprehensive dive information
* 🔄 Media upload for dive plans, photos, videos, and external links
* 🔄 Media management (upload, delete, organize, external link handling)
* 🔄 Dive statistics and analytics
* 🔄 Search and filter dives by various criteria
* 🔄 Integration with dive sites and tags
* 🔄 Remove gas tanks necessary and dive plans from dive sites
* 🔄 Add alternative names/aliases to dive sites for URL routing

#### **Phase 5: Diving Center Ownership 🔄 PLANNED**
* 🔄 User claiming system for diving centers
* 🔄 Admin approval workflow for ownership claims
* 🔄 Owner editing capabilities for diving center details
* 🔄 Ownership management interface for admins

#### **Phase 6: URL Routing & Enhanced Features 🔄 PLANNED**
* 🔄 URL routing for dive sites by name/alias
* 🔄 Enhanced search and filtering capabilities
* 🔄 Performance optimizations and scaling
* 🔄 Mobile application development
