-- Divemap Database Initialization Script

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS divemap;
USE divemap;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    is_moderator BOOLEAN DEFAULT FALSE,
    INDEX idx_email (email),
    INDEX idx_username (username)
);

-- Dive sites table
CREATE TABLE IF NOT EXISTS dive_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    access_instructions TEXT,
    dive_plans TEXT,
    gas_tanks_necessary TEXT,
    difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    marine_life TEXT,
    safety_information TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_difficulty (difficulty_level),
    INDEX idx_location (latitude, longitude)
);

-- Site media table
CREATE TABLE IF NOT EXISTS site_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dive_site_id INT NOT NULL,
    media_type ENUM('photo', 'video') NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE CASCADE,
    INDEX idx_site_id (dive_site_id)
);

-- Site ratings table
CREATE TABLE IF NOT EXISTS site_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dive_site_id INT NOT NULL,
    user_id INT NOT NULL,
    score INT NOT NULL CHECK (score >= 1 AND score <= 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_site_rating (user_id, dive_site_id),
    INDEX idx_site_id (dive_site_id),
    INDEX idx_user_id (user_id)
);

-- Site comments table
CREATE TABLE IF NOT EXISTS site_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dive_site_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_site_id (dive_site_id),
    INDEX idx_user_id (user_id)
);

-- Diving centers table
CREATE TABLE IF NOT EXISTS diving_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_location (latitude, longitude)
);

-- Center ratings table
CREATE TABLE IF NOT EXISTS center_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diving_center_id INT NOT NULL,
    user_id INT NOT NULL,
    score INT NOT NULL CHECK (score >= 1 AND score <= 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_center_rating (user_id, diving_center_id),
    INDEX idx_center_id (diving_center_id),
    INDEX idx_user_id (user_id)
);

-- Center comments table
CREATE TABLE IF NOT EXISTS center_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diving_center_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_center_id (diving_center_id),
    INDEX idx_user_id (user_id)
);

-- Center dive sites junction table
CREATE TABLE IF NOT EXISTS center_dive_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diving_center_id INT NOT NULL,
    dive_site_id INT NOT NULL,
    dive_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id) ON DELETE CASCADE,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE CASCADE,
    UNIQUE KEY unique_center_site (diving_center_id, dive_site_id),
    INDEX idx_center_id (diving_center_id),
    INDEX idx_site_id (dive_site_id)
);

-- Gear rental costs table
CREATE TABLE IF NOT EXISTS gear_rental_costs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diving_center_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id) ON DELETE CASCADE,
    INDEX idx_center_id (diving_center_id)
);

-- Parsed dive trips table
CREATE TABLE IF NOT EXISTS parsed_dive_trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diving_center_id INT,
    dive_site_id INT,
    trip_date DATE NOT NULL,
    trip_time TIME,
    source_newsletter_id INT,
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id) ON DELETE SET NULL,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id) ON DELETE SET NULL,
    INDEX idx_trip_date (trip_date),
    INDEX idx_center_id (diving_center_id),
    INDEX idx_site_id (dive_site_id)
);

-- Newsletters table
CREATE TABLE IF NOT EXISTS newsletters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content LONGTEXT NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_received_at (received_at)
);

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (username, email, password_hash, is_admin) 
VALUES ('admin', 'admin@divemap.com', '$2b$12$GDFsVWKY8LXDG9o4EIgvr.g5V2tSkrMD9QcZl0JKxVVSRbh.skEoe', TRUE);

-- Insert some sample dive sites
INSERT IGNORE INTO dive_sites (name, description, latitude, longitude, access_instructions, difficulty_level) VALUES
('Great Barrier Reef - Outer Reef', 'One of the most famous dive sites in the world, featuring vibrant coral reefs and diverse marine life.', -16.5, 145.67, 'Accessible by boat from Cairns. Multiple operators available.', 'intermediate'),
('Blue Hole - Belize', 'A circular sinkhole with crystal clear water and impressive stalactite formations.', 17.316, -87.535, 'Boat access from Ambergris Caye or Caye Caulker.', 'advanced'),
('Silfra Fissure - Iceland', 'Dive between two continental plates in crystal clear glacial water.', 64.255, -21.115, 'Located in Thingvellir National Park. Guided tours required.', 'intermediate'),
('SS Thistlegorm - Egypt', 'Famous WWII shipwreck in the Red Sea with abundant marine life.', 27.812, 33.921, 'Boat access from Sharm El Sheikh or Hurghada.', 'advanced'),
('Manta Ray Night Dive - Hawaii', 'Night dive with manta rays in their natural feeding grounds.', 19.642, -155.996, 'Boat access from Kona. Night dive experience required.', 'expert');

-- Insert some sample diving centers
INSERT IGNORE INTO diving_centers (name, description, email, phone, website, latitude, longitude) VALUES
('Cairns Dive Center', 'Professional diving center offering trips to the Great Barrier Reef. PADI certified instructors and modern equipment.', 'info@cairnsdivecenter.com', '+61 7 4031 1111', 'www.cairnsdivecenter.com', -16.92, 145.77),
('Belize Diving Adventures', 'Specialized in Blue Hole and barrier reef diving. Experienced guides and small group tours.', 'dive@belizediving.com', '+501 226 2015', 'www.belizediving.com', 17.92, -87.96),
('Iceland Dive Tours', 'Unique diving experiences in Iceland including Silfra fissure. Dry suit diving specialists.', 'info@icelanddivetours.is', '+354 555 1234', 'www.icelanddivetours.is', 64.15, -21.95),
('Red Sea Diving Center', 'Premier diving center in Sharm El Sheikh. Access to famous wrecks and coral reefs.', 'dive@redseadiving.com', '+20 69 360 1234', 'www.redseadiving.com', 27.91, 34.33),
('Hawaii Ocean Adventures', 'Specialized in manta ray night dives and Hawaiian marine life encounters.', 'aloha@hawaiioceanadventures.com', '+1 808 555 0123', 'www.hawaiioceanadventures.com', 19.64, -155.99); 