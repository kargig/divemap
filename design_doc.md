# **Technical Design Document: Scuba Dive Site & Center Review Platform**

## **1\. Introduction**

This document outlines the technical design for a Python-based web application, with future mobile application compatibility, dedicated to scuba diving site and center reviews. The platform will allow users to rate dive sites, find detailed information about them, discover diving centers and their offerings, and view upcoming dive trips.

## **2\. Goals**

* Provide a comprehensive database of scuba diving sites with rich multimedia content and practical information.  
* Enable users to rate dive sites and diving centers.  
* Facilitate user interaction through comments on rated entities (for eponymous users).  
* Offer a directory of scuba diving centers, including pricing and associated dive sites.  
* Implement a system for parsing dive store newsletters to extract and display upcoming dive trip information on an interactive map.  
* Provide contact mechanisms for users to book dives with centers.  
* Design for scalability and future expansion to a mobile application.

## **3\. Functional Requirements**

### **3.1. User Management**

* User registration and authentication (email/password, social login \- optional in initial phase).  
* User profiles (displaying user's ratings, comments).  
* Password reset functionality.

### **3.2. Dive Site Management**

* **Add/Edit Dive Site (Admin/Moderator Functionality):**  
  * Name, description.  
  * Location (GPS coordinates, address).  
  * Access instructions (shore, boat details).  
  * Example photos and videos (upload and display).  
  * Dive plans (text, downloadable files \- e.g., PDF).  
  * Recommended gas tanks.  
  * Difficulty level.  
  * Marine life encountered (optional, could be free text or predefined tags).  
  * Safety information.  
* **View Dive Site:**  
  * Display all aforementioned details.  
  * Average user rating.  
  * List of associated diving centers that visit this site.  
  * User comments (eponymous users only).  
* **Rate Dive Site:**  
  * Score from 1 to 10\.  
  * One rating per user per site.

### **3.3. Diving Center Management**

* **Add/Edit Diving Center (Admin/Moderator Functionality):**  
  * Name, description.  
  * Contact information (email, phone, website).  
  * Location.  
  * List of dive sites they visit.  
  * Dive cost per site.  
  * Scuba gear rental costs (full set, individual items).  
  * Tank rental costs (per type/size).  
* **View Diving Center:**  
  * Display all aforementioned details.  
  * Average user rating.  
  * List of dive sites they visit with costs.  
  * User comments (eponymous users only).  
* **Rate Diving Center:**  
  * Score from 1 to 10\.  
  * One rating per user per center.

### **3.4. Comments**

* Users can leave comments on dive sites and diving centers.  
* Only eponymous users (logged-in users with a verified identity/profile name) can leave comments.  
* Comments are associated with the user and the rated entity.  
* Comments can be edited/deleted by the original author or by administrators.

### **3.5. Newsletter Parsing & Dive Trip Display**

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

### **3.6. Search and Filtering**

* Search dive sites by name, location, difficulty.  
* Search diving centers by name, location, associated dive sites.  
* Filter dive sites/centers by average rating.

## **4\. Non-Functional Requirements**

* **Performance:**  
  * Fast page load times (under 2 seconds for most pages).  
  * Efficient database queries.  
* **Scalability:**  
  * Ability to handle increasing user traffic and data volume.  
  * Support for future mobile application integration.  
* **Security:**  
  * User authentication and authorization.  
  * Protection against common web vulnerabilities (XSS, CSRF, SQL injection).  
  * Data encryption (especially for user credentials).  
* **Maintainability:**  
  * Clean, modular, and well-documented codebase.  
  * Easy to deploy and update.  
* **Usability:**  
  * Intuitive user interface for both web and future mobile applications.  
  * Responsive design for various screen sizes.  
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

#### **5.2.2. Backend (API)**

* **Language:** Python  
* **Framework:** FastAPI (chosen for its high performance, modern features, and automatic OpenAPI/Swagger documentation generation).  
* **Key Services/Modules:**  
  * **User Service:** Handles user registration, login, authentication (JWT), profile management.  
  * **Dive Site Service:** CRUD operations for dive sites, rating logic, comment management.  
  * **Diving Center Service:** CRUD operations for diving centers, rating logic, comment management, association with dive sites and pricing.  
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
* **Schema (Conceptual):**  
  * users table:  
    * id (PK)  
    * username  
    * email (unique)  
    * password\_hash  
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
    * dive\_plans (text or link to file)  
    * gas\_tanks\_necessary  
    * difficulty\_level  
    * created\_at  
    * updated\_at  
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
* /api/v1/users/{user\_id} (GET, PUT)  
* /api/v1/dive-sites (GET, POST)  
* /api/v1/dive-sites/{site\_id} (GET, PUT, DELETE)  
* /api/v1/dive-sites/{site\_id}/rate (POST)  
* /api/v1/dive-sites/{site\_id}/comments (GET, POST)  
* /api/v1/dive-sites/search (GET)  
* /api/v1/diving-centers (GET, POST)  
* /api/v1/diving-centers/{center\_id} (GET, PUT, DELETE)  
* /api/v1/diving-centers/{center\_id}/rate (POST)  
* /api/v1/diving-centers/{center\_id}/comments (GET, POST)  
* /api/v1/diving-centers/search (GET)  
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
* **Frontend:**  
  * React / React Native  
  * Redux / Zustand / React Query (for state management and data fetching)  
  * Mapbox GL JS / Leaflet / Google Maps API (for interactive maps)  
  * Axios (for API calls)  
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

### **Phase 4: Refinement & Scaling**

* Performance optimizations (caching, query tuning).  
* Robust error handling and logging.  
* Security enhancements.  
* CI/CD pipeline setup.  
* Scalable deployment infrastructure (Docker/Kubernetes).  
* User-friendly UI/UX improvements.

### **Phase 5: Mobile Application (Future)**

* Design and development of the React Native mobile application.  
* Adaptation of existing frontend components.  
* Mobile-specific features (e.g., location services for "dives near me").

## **10\. Security Considerations**

* **Authentication:** JWT (JSON Web Tokens) for stateless authentication.  
* **Authorization:** Role-based access control (RBAC) to distinguish between regular users, administrators, and moderators.  
* **Password Hashing:** Use strong, industry-standard hashing algorithms (e.g., bcrypt) with salts.  
* **Input Validation:** Sanitize and validate all user inputs to prevent injection attacks (SQL injection, XSS).  
* **CORS:** Properly configure Cross-Origin Resource Sharing.  
* **HTTPS:** Enforce HTTPS for all communication.  
* **Rate Limiting:** Protect against brute-force attacks and API abuse.  
* **Secret Management:** Securely store API keys and sensitive credentials (e.g., environment variables, dedicated secret management services).  
* **Regular Security Audits:** Conduct periodic vulnerability assessments and penetration testing.

## **11\. Error Handling and Logging**

* Implement centralized error logging (e.g., using Sentry, ELK stack).  
* Provide meaningful error messages to the client without exposing sensitive internal details.  
* Log sufficient information for debugging (request details, stack traces, timestamps).  
* Graceful degradation for external service failures.
