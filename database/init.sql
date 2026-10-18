-- MySQL dump 10.13  Distrib 8.4.6, for Linux (x86_64)
--
-- Host: localhost    Database: divemap
-- ------------------------------------------------------
-- Server version	8.4.6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alembic_version`
--

DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `api_keys`
--

DROP TABLE IF EXISTS `api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `key_hash` varchar(255) NOT NULL,
  `description` text,
  `created_by_user_id` int DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_api_keys_key_hash` (`key_hash`),
  KEY `created_by_user_id` (`created_by_user_id`),
  KEY `idx_api_key_hash` (`key_hash`),
  KEY `idx_api_key_active` (`is_active`),
  KEY `idx_api_key_expires` (`expires_at`),
  KEY `ix_api_keys_id` (`id`),
  CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_audit_logs`
--

DROP TABLE IF EXISTS `auth_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `success` tinyint(1) DEFAULT '1',
  `details` text,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `auth_audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5243 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `available_tags`
--

DROP TABLE IF EXISTS `available_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `available_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_available_tags_name` (`name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `available_tags_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `center_comments`
--

DROP TABLE IF EXISTS `center_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `center_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `comment_text` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_center_comments_diving_center_id` (`diving_center_id`),
  KEY `ix_center_comments_id` (`id`),
  KEY `ix_center_comments_user_id` (`user_id`),
  CONSTRAINT `center_comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `center_comments_ibfk_2` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `center_dive_sites`
--

DROP TABLE IF EXISTS `center_dive_sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `center_dive_sites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `dive_site_id` int NOT NULL,
  `dive_cost` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_center_dive_sites_currency` (`currency`),
  KEY `ix_center_dive_sites_dive_site_id` (`dive_site_id`),
  KEY `ix_center_dive_sites_diving_center_id` (`diving_center_id`),
  KEY `ix_center_dive_sites_id` (`id`),
  CONSTRAINT `center_dive_sites_ibfk_2` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_dive_sites_ibfk_3` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `center_diver_medical_approvals`
--

DROP TABLE IF EXISTS `center_diver_medical_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `center_diver_medical_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int NOT NULL,
  `approved_by_user_id` int DEFAULT NULL,
  `physician_name` varchar(255) DEFAULT NULL,
  `physician_clinic` varchar(255) DEFAULT NULL,
  `approval_notes` text,
  `approved_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uix_center_user_medical_approval` (`diving_center_id`,`user_id`),
  KEY `ix_center_diver_medical_approvals_id` (`id`),
  KEY `ix_center_diver_medical_approvals_diving_center_id` (`diving_center_id`),
  KEY `ix_center_diver_medical_approvals_user_id` (`user_id`),
  KEY `ix_center_diver_medical_approvals_approved_by_user_id` (`approved_by_user_id`),
  CONSTRAINT `center_diver_medical_approvals_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_diver_medical_approvals_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_diver_medical_approvals_ibfk_3` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `center_media`
--

DROP TABLE IF EXISTS `center_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `center_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `media_type` enum('photo','video','dive_plan','external_link') NOT NULL,
  `url` varchar(500) NOT NULL,
  `description` text,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `medium_url` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_center_media_diving_center_id` (`diving_center_id`),
  KEY `ix_center_media_id` (`id`),
  KEY `ix_center_media_user_id` (`user_id`),
  CONSTRAINT `center_media_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_media_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `center_ratings`
--

DROP TABLE IF EXISTS `center_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `center_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int NOT NULL,
  `score` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_center_ratings_diving_center_id` (`diving_center_id`),
  KEY `ix_center_ratings_id` (`id`),
  KEY `ix_center_ratings_user_id` (`user_id`),
  CONSTRAINT `center_ratings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_ratings_ibfk_2` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `center_ratings_chk_1` CHECK (((`score` >= 1) and (`score` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `certification_levels`
--

DROP TABLE IF EXISTS `certification_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certification_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_organization_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `max_depth` varchar(50) DEFAULT NULL,
  `gases` varchar(255) DEFAULT NULL,
  `tanks` varchar(255) DEFAULT NULL,
  `prerequisites` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `deco_time_limit` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_certification_levels_diving_organization_id` (`diving_organization_id`),
  KEY `ix_certification_levels_id` (`id`),
  CONSTRAINT `certification_levels_ibfk_1` FOREIGN KEY (`diving_organization_id`) REFERENCES `diving_organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_feedback`
--

DROP TABLE IF EXISTS `chat_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `message_id` varchar(50) DEFAULT NULL,
  `query` text,
  `response` text,
  `rating` tinyint(1) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `comments` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `debug_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_chat_feedback_id` (`id`),
  KEY `ix_chat_feedback_message_id` (`message_id`),
  KEY `ix_chat_feedback_user_id` (`user_id`),
  CONSTRAINT `chat_feedback_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(50) NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `debug_data` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tokens_input` int DEFAULT NULL,
  `tokens_output` int DEFAULT NULL,
  `tokens_cached` int DEFAULT NULL,
  `tokens_total` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_chat_messages_id` (`id`),
  KEY `ix_chat_messages_session_id` (`session_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=365 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_sessions`
--

DROP TABLE IF EXISTS `chat_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_sessions` (
  `id` varchar(50) NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_chat_sessions_id` (`id`),
  KEY `ix_chat_sessions_user_id` (`user_id`),
  CONSTRAINT `chat_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `difficulty_levels`
--

DROP TABLE IF EXISTS `difficulty_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `difficulty_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `label` varchar(100) NOT NULL,
  `order_index` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `label` (`label`),
  UNIQUE KEY `ix_difficulty_levels_code` (`code`),
  KEY `ix_difficulty_levels_id` (`id`),
  KEY `ix_difficulty_levels_order_index` (`order_index`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_buddies`
--

DROP TABLE IF EXISTS `dive_buddies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_buddies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `_dive_buddy_uc` (`dive_id`,`user_id`),
  KEY `ix_dive_buddies_dive_id` (`dive_id`),
  KEY `ix_dive_buddies_id` (`id`),
  KEY `ix_dive_buddies_user_id` (`user_id`),
  CONSTRAINT `dive_buddies_ibfk_1` FOREIGN KEY (`dive_id`) REFERENCES `dives` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dive_buddies_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_media`
--

DROP TABLE IF EXISTS `dive_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_id` int NOT NULL,
  `media_type` enum('photo','video','dive_plan','external_link') NOT NULL,
  `url` varchar(500) NOT NULL,
  `description` text,
  `title` varchar(255) DEFAULT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `medium_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `dive_id` (`dive_id`),
  KEY `ix_dive_media_id` (`id`),
  CONSTRAINT `dive_media_ibfk_1` FOREIGN KEY (`dive_id`) REFERENCES `dives` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_routes`
--

DROP TABLE IF EXISTS `dive_routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_routes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `created_by` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `route_data` json NOT NULL,
  `route_type` enum('scuba','walk','swim') NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `deleted_by` (`deleted_by`),
  KEY `ix_dive_routes_dive_site_id` (`dive_site_id`),
  KEY `ix_dive_routes_created_by` (`created_by`),
  KEY `ix_dive_routes_deleted_at` (`deleted_at`),
  KEY `ix_dive_routes_id` (`id`),
  CONSTRAINT `dive_routes_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `dive_routes_ibfk_2` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `dive_routes_ibfk_3` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_aliases`
--

DROP TABLE IF EXISTS `dive_site_aliases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_aliases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `alias` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `_dive_site_alias_uc` (`dive_site_id`,`alias`),
  KEY `ix_dive_site_aliases_alias` (`alias`),
  KEY `ix_dive_site_aliases_id` (`id`),
  KEY `ix_dive_site_aliases_dive_site_id` (`dive_site_id`),
  CONSTRAINT `dive_site_aliases_ibfk_1` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_edit_requests`
--

DROP TABLE IF EXISTS `dive_site_edit_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_edit_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `requested_by_id` int DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL,
  `edit_type` enum('site_data','media_addition','media_update','media_deletion','tag_addition','tag_removal','center_association','center_removal') NOT NULL,
  `proposed_data` json NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reviewed_by_id` (`reviewed_by_id`),
  KEY `ix_dive_site_edit_requests_dive_site_id` (`dive_site_id`),
  KEY `ix_dive_site_edit_requests_id` (`id`),
  KEY `ix_dive_site_edit_requests_requested_by_id` (`requested_by_id`),
  KEY `ix_dive_site_edit_requests_status` (`status`),
  CONSTRAINT `dive_site_edit_requests_ibfk_1` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dive_site_edit_requests_ibfk_2` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `dive_site_edit_requests_ibfk_3` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_list_collaborators`
--

DROP TABLE IF EXISTS `dive_site_list_collaborators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_list_collaborators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `list_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'editor',
  `show_on_profile` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_list_collaborator` (`list_id`,`user_id`),
  KEY `ix_dive_site_list_collaborators_id` (`id`),
  KEY `ix_dive_site_list_collaborators_list_id` (`list_id`),
  KEY `ix_dive_site_list_collaborators_user_id` (`user_id`),
  CONSTRAINT `dive_site_list_collaborators_ibfk_1` FOREIGN KEY (`list_id`) REFERENCES `dive_site_lists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dive_site_list_collaborators_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_list_items`
--

DROP TABLE IF EXISTS `dive_site_list_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_list_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `list_id` int NOT NULL,
  `dive_site_id` int NOT NULL,
  `notes` text,
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_list_dive_site` (`list_id`,`dive_site_id`),
  KEY `dive_site_id` (`dive_site_id`),
  KEY `ix_dive_site_list_items_id` (`id`),
  CONSTRAINT `dive_site_list_items_ibfk_1` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dive_site_list_items_ibfk_2` FOREIGN KEY (`list_id`) REFERENCES `dive_site_lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_lists`
--

DROP TABLE IF EXISTS `dive_site_lists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `description` text,
  `is_public` tinyint(1) NOT NULL DEFAULT '1',
  `show_on_profile` tinyint(1) NOT NULL DEFAULT '1',
  `system_type` varchar(50) DEFAULT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_dive_site_lists_id` (`id`),
  KEY `ix_dive_site_lists_slug` (`slug`),
  CONSTRAINT `dive_site_lists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_site_tags`
--

DROP TABLE IF EXISTS `dive_site_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_site_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_dive_site_tags_dive_site_id` (`dive_site_id`),
  KEY `ix_dive_site_tags_tag_id` (`tag_id`),
  CONSTRAINT `dive_site_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `available_tags` (`id`),
  CONSTRAINT `dive_site_tags_ibfk_3` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=344 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_sites`
--

DROP TABLE IF EXISTS `dive_sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_sites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `access_instructions` text,
  `marine_life` text,
  `safety_information` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `max_depth` decimal(6,3) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `difficulty_id` int DEFAULT NULL,
  `shore_direction` decimal(5,2) DEFAULT NULL,
  `shore_direction_confidence` enum('high','medium','low') DEFAULT NULL,
  `shore_direction_method` varchar(50) DEFAULT NULL,
  `shore_direction_distance_m` decimal(8,2) DEFAULT NULL,
  `media_order` json DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `location` point NOT NULL /*!80003 SRID 4326 */,
  `status` enum('approved','pending','rejected') NOT NULL DEFAULT 'approved',
  PRIMARY KEY (`id`),
  KEY `ix_dive_sites_country` (`country`),
  KEY `ix_dive_sites_region` (`region`),
  KEY `fk_dive_sites_created_by_users` (`created_by`),
  KEY `ix_dive_sites_difficulty_id` (`difficulty_id`),
  KEY `ix_dive_sites_id` (`id`),
  KEY `ix_dive_sites_name` (`name`),
  KEY `ix_dive_sites_deleted_at` (`deleted_at`),
  KEY `ix_dive_sites_status` (`status`),
  SPATIAL KEY `idx_dive_sites_location` (`location`),
  CONSTRAINT `dive_sites_ibfk_1` FOREIGN KEY (`difficulty_id`) REFERENCES `difficulty_levels` (`id`),
  CONSTRAINT `fk_dive_sites_created_by_users` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=185 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dive_tags`
--

DROP TABLE IF EXISTS `dive_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dive_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dive_id` (`dive_id`),
  KEY `tag_id` (`tag_id`),
  KEY `ix_dive_tags_id` (`id`),
  CONSTRAINT `dive_tags_ibfk_1` FOREIGN KEY (`dive_id`) REFERENCES `dives` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dive_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `available_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diver_medical_records`
--

DROP TABLE IF EXISTS `diver_medical_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diver_medical_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_unit_item_id` varchar(36) NOT NULL,
  `user_id` int DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'PENDING',
  `encrypted_dek` text NOT NULL,
  `encrypted_answers` blob NOT NULL,
  `physician_clearance_file_path` varchar(500) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `audit_signature_hash` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_by_user_id` int DEFAULT NULL,
  `cleared_at` datetime DEFAULT NULL,
  `cleared_reason` text,
  `cleared_physician_name` varchar(255) DEFAULT NULL,
  `cleared_physician_clinic` varchar(255) DEFAULT NULL,
  `modified_by_user_id` int DEFAULT NULL,
  `modified_at` datetime DEFAULT NULL,
  `modification_reason` text,
  `modification_history` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_diver_medical_records_item_id` (`booking_unit_item_id`),
  UNIQUE KEY `ix_diver_medical_records_booking_unit_item_id` (`booking_unit_item_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_diver_medical_records_id` (`id`),
  KEY `ix_diver_medical_records_cleared_by_user_id` (`cleared_by_user_id`),
  KEY `ix_diver_medical_records_modified_by_user_id` (`modified_by_user_id`),
  CONSTRAINT `diver_medical_records_ibfk_1` FOREIGN KEY (`booking_unit_item_id`) REFERENCES `octo_booking_unit_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `diver_medical_records_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_diver_medical_records_cleared_by_user` FOREIGN KEY (`cleared_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_diver_medical_records_modified_by_user` FOREIGN KEY (`modified_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dives`
--

DROP TABLE IF EXISTS `dives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dives` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `dive_site_id` int DEFAULT NULL,
  `dive_information` text,
  `max_depth` decimal(6,3) DEFAULT NULL,
  `average_depth` decimal(6,3) DEFAULT NULL,
  `gas_bottles_used` text,
  `suit_type` enum('wet_suit','dry_suit','shortie') DEFAULT NULL,
  `visibility_rating` int DEFAULT NULL,
  `user_rating` int DEFAULT NULL,
  `dive_date` date NOT NULL,
  `dive_time` time DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `name` varchar(255) DEFAULT NULL,
  `is_private` tinyint(1) DEFAULT '0',
  `view_count` int NOT NULL DEFAULT '0',
  `diving_center_id` int DEFAULT NULL,
  `profile_xml_path` varchar(500) DEFAULT NULL,
  `profile_sample_count` int DEFAULT NULL,
  `profile_max_depth` decimal(6,3) DEFAULT NULL,
  `profile_duration_minutes` int DEFAULT NULL,
  `selected_route_id` int DEFAULT NULL,
  `difficulty_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_dives_id` (`id`),
  KEY `fk_dives_diving_center_id` (`diving_center_id`),
  KEY `ix_dives_selected_route_id` (`selected_route_id`),
  KEY `ix_dives_difficulty_id` (`difficulty_id`),
  KEY `dive_site_id` (`dive_site_id`),
  CONSTRAINT `dives_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `dives_ibfk_4` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dives_difficulty_id` FOREIGN KEY (`difficulty_id`) REFERENCES `difficulty_levels` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dives_diving_center_id` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dives_selected_route_id` FOREIGN KEY (`selected_route_id`) REFERENCES `dive_routes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=171 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_booking_settings`
--

DROP TABLE IF EXISTS `diving_center_booking_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_booking_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `is_booking_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `default_currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `payment_mode` varchar(30) NOT NULL DEFAULT 'PAY_ON_ARRIVAL',
  `deposit_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `default_agency_bundle` varchar(50) NOT NULL DEFAULT 'UNIVERSAL_DMSC',
  `preferred_unit_system` varchar(10) NOT NULL DEFAULT 'METRIC',
  `preferred_shoe_system` varchar(10) NOT NULL DEFAULT 'EU',
  `hold_duration_minutes` int NOT NULL DEFAULT '20',
  `briefing_lead_hours` int NOT NULL DEFAULT '24',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rental_equipment_pricing` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_center_booking_settings_center_id` (`diving_center_id`),
  UNIQUE KEY `ix_diving_center_booking_settings_diving_center_id` (`diving_center_id`),
  KEY `ix_diving_center_booking_settings_id` (`id`),
  CONSTRAINT `diving_center_booking_settings_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_chat_settings`
--

DROP TABLE IF EXISTS `diving_center_chat_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_chat_settings` (
  `diving_center_id` int NOT NULL,
  `auto_greeting` text,
  `quick_replies` json DEFAULT NULL,
  PRIMARY KEY (`diving_center_id`),
  CONSTRAINT `diving_center_chat_settings_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_followers`
--

DROP TABLE IF EXISTS `diving_center_followers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_followers` (
  `user_id` int NOT NULL,
  `diving_center_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`diving_center_id`),
  KEY `diving_center_id` (`diving_center_id`),
  CONSTRAINT `diving_center_followers_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `diving_center_followers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_managers`
--

DROP TABLE IF EXISTS `diving_center_managers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_managers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uix_center_manager` (`diving_center_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_diving_center_managers_id` (`id`),
  CONSTRAINT `diving_center_managers_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `diving_center_managers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_organizations`
--

DROP TABLE IF EXISTS `diving_center_organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `diving_organization_id` int NOT NULL,
  `is_primary` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_diving_center_organizations_diving_center_id` (`diving_center_id`),
  KEY `ix_diving_center_organizations_diving_organization_id` (`diving_organization_id`),
  CONSTRAINT `diving_center_organizations_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `diving_center_organizations_ibfk_2` FOREIGN KEY (`diving_organization_id`) REFERENCES `diving_organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_center_vessels`
--

DROP TABLE IF EXISTS `diving_center_vessels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_center_vessels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `registration_number` varchar(100) DEFAULT NULL,
  `port_of_registry` varchar(100) DEFAULT NULL,
  `call_sign` varchar(50) DEFAULT NULL,
  `licensed_capacity` int NOT NULL DEFAULT '12',
  `has_emergency_oxygen` tinyint(1) NOT NULL DEFAULT '1',
  `has_first_aid_kit` tinyint(1) NOT NULL DEFAULT '1',
  `has_vhf_radio` tinyint(1) NOT NULL DEFAULT '1',
  `has_lifejackets` tinyint(1) NOT NULL DEFAULT '1',
  `has_liferaft` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_diving_center_vessels_id` (`id`),
  KEY `ix_diving_center_vessels_diving_center_id` (`diving_center_id`),
  CONSTRAINT `diving_center_vessels_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_centers`
--

DROP TABLE IF EXISTS `diving_centers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_centers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `view_count` int NOT NULL DEFAULT '0',
  `owner_id` int DEFAULT NULL,
  `ownership_status` enum('unclaimed','claimed','approved','denied') NOT NULL DEFAULT 'unclaimed',
  `country` varchar(100) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `address` text,
  `location` point NOT NULL /*!80003 SRID 4326 */,
  `logo_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  KEY `ix_diving_centers_country` (`country`),
  KEY `ix_diving_centers_region` (`region`),
  KEY `ix_diving_centers_city` (`city`),
  KEY `ix_diving_centers_id` (`id`),
  KEY `ix_diving_centers_name` (`name`),
  CONSTRAINT `diving_centers_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=214 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `diving_organizations`
--

DROP TABLE IF EXISTS `diving_organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diving_organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `acronym` varchar(20) NOT NULL,
  `website` varchar(255) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `description` text,
  `country` varchar(100) DEFAULT NULL,
  `founded_year` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `view_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_diving_organizations_acronym` (`acronym`),
  UNIQUE KEY `ix_diving_organizations_name` (`name`),
  KEY `ix_diving_organizations_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_config`
--

DROP TABLE IF EXISTS `email_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `smtp_host` varchar(255) NOT NULL,
  `smtp_port` int NOT NULL DEFAULT '587',
  `use_starttls` tinyint(1) NOT NULL DEFAULT '1',
  `smtp_username` varchar(255) NOT NULL,
  `smtp_password` varchar(500) NOT NULL,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(255) NOT NULL DEFAULT 'Divemap',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_email_config_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_verification_tokens`
--

DROP TABLE IF EXISTS `email_verification_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verification_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_email_verification_tokens_token` (`token`),
  KEY `idx_email_verification_token` (`token`),
  KEY `idx_email_verification_user` (`user_id`),
  KEY `idx_email_verification_expires` (`expires_at`),
  KEY `ix_email_verification_tokens_id` (`id`),
  KEY `ix_email_verification_tokens_user_id` (`user_id`),
  CONSTRAINT `email_verification_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gear_rental_costs`
--

DROP TABLE IF EXISTS `gear_rental_costs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gear_rental_costs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `cost` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_gear_rental_costs_currency` (`currency`),
  KEY `ix_gear_rental_costs_diving_center_id` (`diving_center_id`),
  KEY `ix_gear_rental_costs_id` (`id`),
  CONSTRAINT `gear_rental_costs_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `newsletters`
--

DROP TABLE IF EXISTS `newsletters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `newsletters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content` longtext NOT NULL,
  `received_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_newsletters_received_at` (`received_at`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `category` varchar(50) NOT NULL,
  `enable_website` tinyint(1) NOT NULL DEFAULT '1',
  `enable_email` tinyint(1) NOT NULL DEFAULT '0',
  `frequency` varchar(20) NOT NULL DEFAULT 'immediate',
  `area_filter` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `enable_push` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_category` (`user_id`,`category`),
  KEY `ix_notification_preferences_category` (`category`),
  KEY `ix_notification_preferences_id` (`id`),
  KEY `ix_notification_preferences_user_id` (`user_id`),
  CONSTRAINT `notification_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `category` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `link_url` varchar(500) DEFAULT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  `email_sent` tinyint(1) NOT NULL DEFAULT '0',
  `email_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_unread` (`user_id`,`is_read`,`created_at`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `ix_notifications_category` (`category`),
  KEY `ix_notifications_id` (`id`),
  KEY `ix_notifications_user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=322 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_availability_slots`
--

DROP TABLE IF EXISTS `octo_availability_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_availability_slots` (
  `id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `option_id` varchar(36) NOT NULL,
  `vessel_id` int DEFAULT NULL,
  `assigned_guide_user_ids` json DEFAULT NULL,
  `start_datetime` datetime NOT NULL,
  `end_datetime` datetime NOT NULL,
  `seats_total` int NOT NULL,
  `seats_available` int NOT NULL,
  `is_closed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `vessel_id` (`vessel_id`),
  KEY `ix_octo_availability_slots_product_id` (`product_id`),
  KEY `ix_octo_availability_slots_option_id` (`option_id`),
  KEY `ix_octo_availability_slots_start_datetime` (`start_datetime`),
  CONSTRAINT `octo_availability_slots_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `octo_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_availability_slots_ibfk_2` FOREIGN KEY (`option_id`) REFERENCES `octo_options` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_availability_slots_ibfk_3` FOREIGN KEY (`vessel_id`) REFERENCES `diving_center_vessels` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_booking_unit_items`
--

DROP TABLE IF EXISTS `octo_booking_unit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_booking_unit_items` (
  `id` varchar(36) NOT NULL,
  `booking_uuid` varchar(36) NOT NULL,
  `unit_id` varchar(36) NOT NULL,
  `user_id` int DEFAULT NULL,
  `diver_full_name` varchar(255) NOT NULL,
  `diver_email` varchar(255) DEFAULT NULL,
  `diver_phone` varchar(50) DEFAULT NULL,
  `diver_nationality` varchar(100) DEFAULT NULL,
  `passport_number` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `certification_agency` varchar(50) DEFAULT NULL,
  `certification_level` varchar(100) DEFAULT NULL,
  `certification_number` varchar(100) DEFAULT NULL,
  `total_logged_dives` int NOT NULL DEFAULT '0',
  `date_of_last_dive` date DEFAULT NULL,
  `selected_tank_id` varchar(20) DEFAULT '12',
  `selected_gas_mix_id` varchar(20) DEFAULT 'air',
  `equipment_sizing` json DEFAULT NULL,
  `waiver_id` varchar(100) DEFAULT NULL,
  `waivers_complete` tinyint(1) NOT NULL DEFAULT '0',
  `signed_waiver_path` varchar(500) DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `onboard_checkin_status` tinyint(1) NOT NULL DEFAULT '0',
  `claim_token_hash` varchar(64) DEFAULT NULL,
  `claim_status` varchar(30) NOT NULL DEFAULT 'CLAIMED',
  `claim_invited_at` datetime DEFAULT NULL,
  `claim_completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_octo_booking_unit_items_claim_token_hash` (`claim_token_hash`),
  KEY `unit_id` (`unit_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_octo_booking_unit_items_booking_uuid` (`booking_uuid`),
  CONSTRAINT `octo_booking_unit_items_ibfk_1` FOREIGN KEY (`booking_uuid`) REFERENCES `octo_bookings` (`uuid`) ON DELETE CASCADE,
  CONSTRAINT `octo_booking_unit_items_ibfk_2` FOREIGN KEY (`unit_id`) REFERENCES `octo_units` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_booking_unit_items_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_bookings`
--

DROP TABLE IF EXISTS `octo_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_bookings` (
  `uuid` varchar(36) NOT NULL,
  `diving_center_id` int NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `option_id` varchar(36) NOT NULL,
  `availability_id` varchar(36) NOT NULL,
  `user_id` int DEFAULT NULL,
  `contact_full_name` varchar(255) DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'ON_HOLD',
  `utc_hold_expiration` datetime DEFAULT NULL,
  `payment_mode` varchar(30) NOT NULL DEFAULT 'PAY_ON_ARRIVAL',
  `payment_status` varchar(30) NOT NULL DEFAULT 'PENDING_AT_CHECKIN',
  `total_amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `booking_notes` text,
  `cancellation_reason` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `access_token_hash` varchar(64) DEFAULT NULL,
  `access_token_expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`uuid`),
  KEY `product_id` (`product_id`),
  KEY `option_id` (`option_id`),
  KEY `availability_id` (`availability_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_octo_bookings_diving_center_id` (`diving_center_id`),
  KEY `ix_octo_bookings_status` (`status`),
  KEY `ix_octo_bookings_access_token_hash` (`access_token_hash`),
  CONSTRAINT `octo_bookings_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_bookings_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `octo_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_bookings_ibfk_3` FOREIGN KEY (`option_id`) REFERENCES `octo_options` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_bookings_ibfk_4` FOREIGN KEY (`availability_id`) REFERENCES `octo_availability_slots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_bookings_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_options`
--

DROP TABLE IF EXISTS `octo_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_options` (
  `id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `meeting_time` time NOT NULL,
  `departure_time` time NOT NULL,
  `duration_minutes` int NOT NULL DEFAULT '240',
  `max_capacity` int NOT NULL DEFAULT '12',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `ix_octo_options_product_id` (`product_id`),
  CONSTRAINT `octo_options_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `octo_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_products`
--

DROP TABLE IF EXISTS `octo_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_products` (
  `id` varchar(36) NOT NULL,
  `diving_center_id` int NOT NULL,
  `dive_site_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `product_type` varchar(50) NOT NULL DEFAULT 'GUIDED_BOAT_TRIP',
  `agency_code` varchar(50) DEFAULT NULL,
  `waiver_bundle_id` varchar(50) NOT NULL DEFAULT 'dmsc_recreational',
  `min_certification_level_id` int DEFAULT NULL,
  `min_logged_dives` int NOT NULL DEFAULT '0',
  `max_depth_meters` decimal(5,2) DEFAULT NULL,
  `min_participants` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dives_count` int NOT NULL DEFAULT '2',
  PRIMARY KEY (`id`),
  KEY `min_certification_level_id` (`min_certification_level_id`),
  KEY `ix_octo_products_diving_center_id` (`diving_center_id`),
  KEY `ix_octo_products_dive_site_id` (`dive_site_id`),
  CONSTRAINT `octo_products_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `octo_products_ibfk_2` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE SET NULL,
  CONSTRAINT `octo_products_ibfk_3` FOREIGN KEY (`min_certification_level_id`) REFERENCES `certification_levels` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `octo_units`
--

DROP TABLE IF EXISTS `octo_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `octo_units` (
  `id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `unit_type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `retail_price` decimal(10,2) NOT NULL,
  `net_price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `ix_octo_units_product_id` (`product_id`),
  CONSTRAINT `octo_units_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `octo_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ownership_requests`
--

DROP TABLE IF EXISTS `ownership_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ownership_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int NOT NULL,
  `user_id` int NOT NULL,
  `request_status` enum('unclaimed','claimed','approved','denied') NOT NULL,
  `request_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `processed_date` datetime DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  `reason` text,
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `processed_by` (`processed_by`),
  KEY `ix_ownership_requests_id` (`id`),
  KEY `ix_ownership_requests_diving_center_id` (`diving_center_id`),
  KEY `ix_ownership_requests_user_id` (`user_id`),
  KEY `ix_ownership_requests_request_status` (`request_status`),
  KEY `ix_ownership_requests_request_date` (`request_date`),
  CONSTRAINT `ownership_requests_ibfk_1` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ownership_requests_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ownership_requests_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `parsed_dive_trips`
--

DROP TABLE IF EXISTS `parsed_dive_trips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parsed_dive_trips` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diving_center_id` int DEFAULT NULL,
  `trip_date` date NOT NULL,
  `trip_time` time DEFAULT NULL,
  `source_newsletter_id` int DEFAULT NULL,
  `extracted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `trip_duration` int DEFAULT NULL,
  `trip_price` decimal(10,2) DEFAULT NULL,
  `trip_currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `group_size_limit` int DEFAULT NULL,
  `current_bookings` int NOT NULL DEFAULT '0',
  `trip_description` text,
  `special_requirements` text,
  `trip_status` enum('scheduled','confirmed','cancelled','completed') NOT NULL DEFAULT 'scheduled',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `trip_difficulty_id` int DEFAULT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  `octo_slot_id` varchar(36) DEFAULT NULL,
  `is_bookable` tinyint(1) NOT NULL DEFAULT '0',
  `different_rental_price` tinyint(1) NOT NULL DEFAULT '1',
  `custom_rental_price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_parsed_dive_trips_trip_currency` (`trip_currency`),
  KEY `ix_parsed_dive_trips_trip_status` (`trip_status`),
  KEY `ix_parsed_dive_trips_diving_center_id` (`diving_center_id`),
  KEY `ix_parsed_dive_trips_id` (`id`),
  KEY `ix_parsed_dive_trips_trip_date` (`trip_date`),
  KEY `ix_parsed_dive_trips_trip_difficulty_id` (`trip_difficulty_id`),
  KEY `source_newsletter_id` (`source_newsletter_id`),
  KEY `ix_parsed_dive_trips_octo_slot_id` (`octo_slot_id`),
  CONSTRAINT `fk_parsed_dive_trips_octo_slot_id` FOREIGN KEY (`octo_slot_id`) REFERENCES `octo_availability_slots` (`id`) ON DELETE SET NULL,
  CONSTRAINT `parsed_dive_trips_ibfk_1` FOREIGN KEY (`trip_difficulty_id`) REFERENCES `difficulty_levels` (`id`),
  CONSTRAINT `parsed_dive_trips_ibfk_2` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `parsed_dive_trips_ibfk_3` FOREIGN KEY (`source_newsletter_id`) REFERENCES `newsletters` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=343 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `parsed_dives`
--

DROP TABLE IF EXISTS `parsed_dives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parsed_dives` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trip_id` int NOT NULL,
  `dive_site_id` int DEFAULT NULL,
  `dive_number` int NOT NULL,
  `dive_time` time DEFAULT NULL,
  `dive_duration` int DEFAULT NULL,
  `dive_description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_parsed_dives_trip_id` (`trip_id`),
  KEY `ix_parsed_dives_dive_site_id` (`dive_site_id`),
  CONSTRAINT `parsed_dives_ibfk_1` FOREIGN KEY (`trip_id`) REFERENCES `parsed_dive_trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `parsed_dives_ibfk_2` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=256 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_password_reset_tokens_token_hash` (`token_hash`),
  KEY `idx_password_reset_expires` (`expires_at`),
  KEY `idx_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_user` (`user_id`),
  KEY `ix_password_reset_tokens_id` (`id`),
  KEY `ix_password_reset_tokens_user_id` (`user_id`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `token_prefix` varchar(16) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_personal_access_tokens_token_hash` (`token_hash`),
  KEY `idx_pat_active` (`is_active`),
  KEY `idx_pat_expires` (`expires_at`),
  KEY `idx_pat_prefix` (`token_prefix`),
  KEY `idx_pat_token_hash` (`token_hash`),
  KEY `idx_pat_user_id` (`user_id`),
  KEY `ix_personal_access_tokens_id` (`id`),
  KEY `ix_personal_access_tokens_token_prefix` (`token_prefix`),
  KEY `ix_personal_access_tokens_user_id` (`user_id`),
  CONSTRAINT `personal_access_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `push_subscriptions`
--

DROP TABLE IF EXISTS `push_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `endpoint` varchar(2048) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `fail_count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_push_subscriptions_id` (`id`),
  KEY `ix_push_subscriptions_user_id` (`user_id`),
  CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` varchar(255) NOT NULL,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_revoked` tinyint(1) DEFAULT '0',
  `device_info` text,
  `ip_address` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `route_analytics`
--

DROP TABLE IF EXISTS `route_analytics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `route_analytics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `route_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `interaction_type` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `referrer` varchar(500) DEFAULT NULL,
  `session_id` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `extra_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_route_analytics_id` (`id`),
  KEY `ix_route_analytics_route_id` (`route_id`),
  KEY `ix_route_analytics_user_id` (`user_id`),
  KEY `ix_route_analytics_interaction_type` (`interaction_type`),
  KEY `ix_route_analytics_session_id` (`session_id`),
  KEY `ix_route_analytics_created_at` (`created_at`),
  CONSTRAINT `route_analytics_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `dive_routes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `route_analytics_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=511 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_settings_key` (`key`),
  KEY `ix_settings_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `short_links`
--

DROP TABLE IF EXISTS `short_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `short_links` (
  `id` varchar(10) NOT NULL,
  `original_url` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_short_links_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_comments`
--

DROP TABLE IF EXISTS `site_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment_text` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_site_comments_dive_site_id` (`dive_site_id`),
  KEY `ix_site_comments_id` (`id`),
  KEY `ix_site_comments_user_id` (`user_id`),
  CONSTRAINT `site_comments_ibfk_2` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE,
  CONSTRAINT `site_comments_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_media`
--

DROP TABLE IF EXISTS `site_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `media_type` enum('photo','video') NOT NULL,
  `url` varchar(500) NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `medium_url` varchar(500) DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_site_media_dive_site_id` (`dive_site_id`),
  KEY `ix_site_media_id` (`id`),
  KEY `ix_site_media_user_id` (`user_id`),
  CONSTRAINT `fk_site_media_user_id_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `site_media_ibfk_1` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_ratings`
--

DROP TABLE IF EXISTS `site_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dive_site_id` int NOT NULL,
  `user_id` int NOT NULL,
  `score` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_site_ratings_dive_site_id` (`dive_site_id`),
  KEY `ix_site_ratings_id` (`id`),
  KEY `ix_site_ratings_user_id` (`user_id`),
  CONSTRAINT `site_ratings_ibfk_4` FOREIGN KEY (`dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE CASCADE,
  CONSTRAINT `site_ratings_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `site_ratings_chk_1` CHECK (((`score` >= 1) and (`score` <= 5)))
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trip_briefings`
--

DROP TABLE IF EXISTS `trip_briefings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trip_briefings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `availability_id` varchar(36) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'DRAFT_PENDING_REVIEW',
  `active_dive_site_id` int DEFAULT NULL,
  `meeting_notes` text,
  `site_profile_notes` text,
  `hazards_and_safety_notes` text,
  `marine_life_highlights` json DEFAULT NULL,
  `weather_forecast_data` json DEFAULT NULL,
  `crew_manifest` json DEFAULT NULL,
  `emergency_action_plan` json DEFAULT NULL,
  `contingency_notes` text,
  `compiled_pdf_path` varchar(500) DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `dispatched_by_user_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `availability_id` (`availability_id`),
  UNIQUE KEY `ix_trip_briefings_availability_id` (`availability_id`),
  KEY `active_dive_site_id` (`active_dive_site_id`),
  KEY `dispatched_by_user_id` (`dispatched_by_user_id`),
  KEY `ix_trip_briefings_id` (`id`),
  KEY `ix_trip_briefings_status` (`status`),
  CONSTRAINT `trip_briefings_ibfk_1` FOREIGN KEY (`availability_id`) REFERENCES `octo_availability_slots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `trip_briefings_ibfk_2` FOREIGN KEY (`active_dive_site_id`) REFERENCES `dive_sites` (`id`) ON DELETE SET NULL,
  CONSTRAINT `trip_briefings_ibfk_3` FOREIGN KEY (`dispatched_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unsubscribe_tokens`
--

DROP TABLE IF EXISTS `unsubscribe_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unsubscribe_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` datetime DEFAULT NULL,
  `previous_preferences` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_unsubscribe_tokens_token` (`token`),
  UNIQUE KEY `ix_unsubscribe_tokens_user_id` (`user_id`),
  KEY `idx_unsubscribe_token` (`token`),
  KEY `idx_unsubscribe_user` (`user_id`),
  KEY `idx_unsubscribe_expires` (`expires_at`),
  KEY `ix_unsubscribe_tokens_id` (`id`),
  CONSTRAINT `unsubscribe_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_certifications`
--

DROP TABLE IF EXISTS `user_certifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_certifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `diving_organization_id` int NOT NULL,
  `certification_level` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `certification_level_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_user_certifications_diving_organization_id` (`diving_organization_id`),
  KEY `ix_user_certifications_id` (`id`),
  KEY `ix_user_certifications_user_id` (`user_id`),
  KEY `ix_user_certifications_certification_level_id` (`certification_level_id`),
  CONSTRAINT `fk_user_certifications_certification_level_id` FOREIGN KEY (`certification_level_id`) REFERENCES `certification_levels` (`id`),
  CONSTRAINT `user_certifications_ibfk_1` FOREIGN KEY (`diving_organization_id`) REFERENCES `diving_organizations` (`id`),
  CONSTRAINT `user_certifications_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_chat_messages`
--

DROP TABLE IF EXISTS `user_chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int DEFAULT NULL,
  `content` blob NOT NULL,
  `is_edited` tinyint(1) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `message_type` varchar(50) NOT NULL DEFAULT 'TEXT',
  `room_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `ix_user_chat_messages_id` (`id`),
  KEY `idx_chat_messages_room_updated` (`room_id`,`updated_at`),
  CONSTRAINT `fk_user_chat_messages_room_id` FOREIGN KEY (`room_id`) REFERENCES `user_chat_rooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_chat_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_chat_room_members`
--

DROP TABLE IF EXISTS `user_chat_room_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_chat_room_members` (
  `user_id` int NOT NULL,
  `role` varchar(20) NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at` datetime DEFAULT NULL,
  `last_read_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `room_id` varchar(36) NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`room_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_user_chat_room_members_room_id` FOREIGN KEY (`room_id`) REFERENCES `user_chat_rooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_chat_room_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_chat_rooms`
--

DROP TABLE IF EXISTS `user_chat_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_chat_rooms` (
  `is_group` tinyint(1) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `encrypted_dek` text NOT NULL,
  `created_by_id` int DEFAULT NULL,
  `last_activity_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diving_center_id` int DEFAULT NULL,
  `is_broadcast` tinyint(1) NOT NULL,
  `business_status` enum('UNREAD','READ','RESOLVED') NOT NULL,
  `last_responded_by_id` int DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `created_by_id` (`created_by_id`),
  KEY `diving_center_id` (`diving_center_id`),
  KEY `last_responded_by_id` (`last_responded_by_id`),
  KEY `ix_user_chat_rooms_id` (`id`),
  CONSTRAINT `user_chat_rooms_ibfk_1` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_chat_rooms_ibfk_2` FOREIGN KEY (`diving_center_id`) REFERENCES `diving_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_chat_rooms_ibfk_3` FOREIGN KEY (`last_responded_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_friendships`
--

DROP TABLE IF EXISTS `user_friendships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_friendships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `friend_id` int NOT NULL,
  `status` varchar(20) NOT NULL,
  `initiator_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `_user_friendship_uc` (`user_id`,`friend_id`),
  KEY `initiator_id` (`initiator_id`),
  KEY `ix_user_friendships_friend_id` (`friend_id`),
  KEY `ix_user_friendships_id` (`id`),
  KEY `ix_user_friendships_user_id` (`user_id`),
  CONSTRAINT `user_friendships_ibfk_1` FOREIGN KEY (`friend_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_friendships_ibfk_2` FOREIGN KEY (`initiator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_friendships_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_gear_profiles`
--

DROP TABLE IF EXISTS `user_gear_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_gear_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT 'Default',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `preferred_unit_system` varchar(10) NOT NULL DEFAULT 'METRIC',
  `preferred_shoe_system` varchar(10) NOT NULL DEFAULT 'EU',
  `height_cm` int DEFAULT NULL,
  `weight_kg` int DEFAULT NULL,
  `shoe_size_eu` decimal(3,1) DEFAULT NULL,
  `wetsuit_gender` varchar(10) DEFAULT NULL,
  `wetsuit_size` varchar(10) DEFAULT NULL,
  `wetsuit_thickness` varchar(10) DEFAULT '5mm',
  `bcd_size` varchar(10) DEFAULT NULL,
  `fin_type` varchar(20) DEFAULT 'OPEN_HEEL',
  `regulator_fitting` varchar(10) DEFAULT 'DIN',
  `preferred_tank_id` varchar(20) DEFAULT '12',
  `preferred_gas_mix_id` varchar(20) DEFAULT 'air',
  `estimated_lead_kg` decimal(4,1) DEFAULT NULL,
  `has_own_dive_computer` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_smb` tinyint(1) NOT NULL DEFAULT '0',
  `insurance_provider` varchar(100) DEFAULT NULL,
  `insurance_policy_number` varchar(100) DEFAULT NULL,
  `insurance_expiry_date` date DEFAULT NULL,
  `emergency_contact_name` varchar(255) DEFAULT NULL,
  `emergency_contact_phone` varchar(50) DEFAULT NULL,
  `emergency_contact_relation` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `has_own_mask` tinyint(1) NOT NULL DEFAULT '1',
  `has_own_wetsuit` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_regulator` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_bcd` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_fins` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_boots` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_torch` tinyint(1) NOT NULL DEFAULT '0',
  `has_own_lead_weights` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_gear_profiles_user_name` (`user_id`,`name`),
  KEY `ix_user_gear_profiles_id` (`id`),
  KEY `ix_user_gear_profiles_user_id` (`user_id`),
  CONSTRAINT `user_gear_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_medical_profiles`
--

DROP TABLE IF EXISTS `user_medical_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_medical_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `status` varchar(30) NOT NULL,
  `encrypted_dek` text NOT NULL,
  `encrypted_answers` blob NOT NULL,
  `physician_certificate_url` varchar(500) DEFAULT NULL,
  `completed_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `audit_signature_hash` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `ix_user_medical_profiles_id` (`id`),
  KEY `ix_user_medical_profiles_user_id` (`user_id`),
  CONSTRAINT `user_medical_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_social_links`
--

DROP TABLE IF EXISTS `user_social_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_social_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `platform` varchar(50) NOT NULL,
  `url` varchar(500) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `_user_platform_uc` (`user_id`,`platform`),
  KEY `ix_user_social_links_id` (`id`),
  KEY `ix_user_social_links_user_id` (`user_id`),
  CONSTRAINT `user_social_links_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `is_moderator` tinyint(1) NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `number_of_dives` int NOT NULL DEFAULT '0',
  `avatar_url` varchar(500) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `turnstile_verified_at` datetime DEFAULT NULL,
  `buddy_visibility` varchar(20) NOT NULL DEFAULT 'public',
  `last_notification_check` datetime DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `email_verified_at` datetime DEFAULT NULL,
  `email_notifications_opted_out` tinyint(1) NOT NULL DEFAULT '0',
  `email_opt_out_at` datetime DEFAULT NULL,
  `last_accessed_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `avatar_type` varchar(20) DEFAULT 'google',
  `google_avatar_url` varchar(500) DEFAULT NULL,
  `facebook_id` varchar(255) DEFAULT NULL,
  `facebook_avatar_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_email` (`email`),
  UNIQUE KEY `ix_users_username` (`username`),
  UNIQUE KEY `ix_users_google_id` (`google_id`),
  UNIQUE KEY `ix_users_facebook_id` (`facebook_id`),
  KEY `ix_users_id` (`id`),
  KEY `ix_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wind_data_cache`
--

DROP TABLE IF EXISTS `wind_data_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wind_data_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(255) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `target_datetime` datetime DEFAULT NULL,
  `wind_data` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `last_accessed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_wind_data_cache_cache_key` (`cache_key`),
  KEY `idx_wind_cache_expires_at` (`expires_at`),
  KEY `idx_wind_cache_lat_lon_datetime` (`latitude`,`longitude`,`target_datetime`),
  KEY `idx_wind_cache_last_accessed_at` (`last_accessed_at`),
  KEY `ix_wind_data_cache_created_at` (`created_at`),
  KEY `ix_wind_data_cache_expires_at` (`expires_at`),
  KEY `ix_wind_data_cache_id` (`id`),
  KEY `ix_wind_data_cache_last_accessed_at` (`last_accessed_at`),
  KEY `ix_wind_data_cache_latitude` (`latitude`),
  KEY `ix_wind_data_cache_longitude` (`longitude`),
  KEY `ix_wind_data_cache_target_datetime` (`target_datetime`)
) ENGINE=InnoDB AUTO_INCREMENT=101356 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'divemap'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-15 13:49:48

-- MySQL dump 10.13  Distrib 8.4.6, for Linux (x86_64)
--
-- Host: localhost    Database: divemap
-- ------------------------------------------------------
-- Server version	8.4.6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `alembic_version`
--

LOCK TABLES `alembic_version` WRITE;
/*!40000 ALTER TABLE `alembic_version` DISABLE KEYS */;
INSERT INTO `alembic_version` VALUES ('0105');
/*!40000 ALTER TABLE `alembic_version` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `difficulty_levels`
--

LOCK TABLES `difficulty_levels` WRITE;
/*!40000 ALTER TABLE `difficulty_levels` DISABLE KEYS */;
INSERT INTO `difficulty_levels` VALUES (1,'OPEN_WATER','Open Water',1),(2,'ADVANCED_OPEN_WATER','Advanced Open Water',2),(3,'DEEP_NITROX','Deep/Nitrox',3),(4,'TECHNICAL_DIVING','Technical Diving',4);
/*!40000 ALTER TABLE `difficulty_levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `diving_organizations`
--

LOCK TABLES `diving_organizations` WRITE;
/*!40000 ALTER TABLE `diving_organizations` DISABLE KEYS */;
INSERT INTO `diving_organizations` VALUES (1,'Professional Association of Diving Instructors','PADI','https://www.padi.com','https://www.padi.com/themes/custom/bootstrap_padi/public/images/logo_padi_dark.svg','PADI is the world\'s leading scuba diver training organization, with more than 6,600 PADI Dive Centers and Resorts worldwide.','United States',1966,'2025-07-29 18:03:16','2025-07-29 21:41:45',0),(2,'Scuba Schools International','SSI','https://www.divessi.com','https://my.divessi.com/assets/corporate/ssi-logo.png','SSI is a global diving organization that provides training, certification, and educational materials for divers, dive instructors, and dive centers.','United States',1970,'2025-07-29 18:03:16','2025-12-29 21:51:11',3),(3,'Global Underwater Explorers','GUE','https://www.gue.com','https://www.gue.com/sites/default/files/GUE-logo_new.png','GUE is a non-profit organization dedicated to the exploration and conservation of the underwater world through research, education, and exploration.','United States',1998,'2025-07-29 18:03:16','2025-12-29 21:51:28',0),(4,'Rebreather Association of International Divers','RAID','https://diveraid.com/','https://raid-wp-media.s3.eu-west-2.amazonaws.com/wp-content/uploads/2025/03/17193852/cropped-mobile-logo.png','RAID is a global diving training organization that offers comprehensive diver education programs from beginner to technical levels.','United Kingdom',2007,'2025-07-29 18:03:16','2025-12-29 21:52:40',0),(5,'Confédération Mondiale des Activités Subaquatiques','CMAS','https://www.cmas.org','https://www.cmas.org/images/cmas_logo_st.svg','CMAS is the World Underwater Federation, an international organization that promotes underwater activities including scuba diving.','France',1959,'2025-07-29 18:03:16','2025-12-29 21:53:18',0),(6,'Technical Diving International','TDI','https://www.tdisdi.com','https://upload.wikimedia.org/wikipedia/en/e/ee/TDI.JPG','TDI is a professional diving organization that specializes in technical diving education and certification.','United States',1994,'2025-07-29 18:03:16','2025-12-29 21:54:04',0),(7,'National Association of Underwater Instructors','NAUI','https://www.naui.org','https://nauiwebsitestorage.blob.core.windows.net/media/2024/05/naui-logo.png','NAUI is a non-profit diving organization that provides training and certification for divers and diving professionals.','United States',1960,'2025-07-29 18:03:16','2025-12-29 21:54:35',0),(8,'British Sub-Aqua Club','BSAC','https://www.bsac.com','https://www.bsac.com/themes/bsac/gfx/logos/bsac-logo.png','BSAC is the UK\'s leading diving club and the sport\'s National Governing Body, providing training and support for divers.','United Kingdom',1953,'2025-07-29 18:03:16','2025-12-29 21:54:52',0),(9,'Scuba Diving International','SDI','https://www.tdisdi.com/sdi','https://upload.wikimedia.org/wikipedia/en/1/13/SDI.JPG','SDI is a recreational diving training organization that offers comprehensive diver education programs.','United States',1999,'2025-07-29 18:03:16','2025-12-29 21:55:24',0),(10,'International Association of Nitrox and Technical Divers','IANTD','https://www.iantd.com','https://www.iantd.com/images/logo/2025-iantd-logo-tm.png','IANTD is a technical diving training organization that specializes in advanced diving techniques and equipment.','United States',1985,'2025-07-29 18:03:16','2025-12-29 21:55:39',0),(11,'American Nitrox Divers International','ANDI','https://andihq.com/','https://andihq.com/wp-content/uploads/2022/04/safeair_logo_trans.gif','ANDI International (ANDI) is one of the world’s fastest growing diver training agencies. ANDI began by specializing in training programs for Enriched Air Nitrox ( SafeAir ) diving. As a natural evolution from SafeAir®, ANDI developed training programs for what has now become known as Technical diving and Closed Circuit Rebreather systems. To meet the demands of our international network of training facilities, in 1999 ANDI introduced a unique methodology for training entry-level divers with the ANDI Open Water Sport Diver program.','United Kingdom',1988,'2025-10-07 11:05:51','2025-12-29 23:35:01',0);
/*!40000 ALTER TABLE `diving_organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `certification_levels`
--

LOCK TABLES `certification_levels` WRITE;
/*!40000 ALTER TABLE `certification_levels` DISABLE KEYS */;
INSERT INTO `certification_levels` VALUES (1,1,'Discover Scuba Diving (DSD)','Recreational Track','12m (40ft)','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(2,1,'Scuba Diver','Recreational Track','12m (40ft)','Air','Single','direct supervision','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(3,1,'Open Water Diver (OWD)','Recreational Track','18m (60ft)','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(4,1,'Advanced Open Water Diver (AOWD)','Recreational Track','30m (100ft)','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(5,1,'Rescue Diver','Recreational Track','30m (100ft)','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(6,1,'Master Scuba Diver','Recreational Track',NULL,NULL,NULL,'Rescue + 5 Specialties + 50 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(7,1,'Divemaster','Professional Track',NULL,NULL,'Single','Rescue Diver + 40 dives (60 to certify)','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(8,1,'Open Water Scuba Instructor (OWSI)','Professional Track',NULL,NULL,NULL,'Divemaster + 100 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(9,1,'Master Scuba Diver Trainer (MSDT)','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(10,1,'IDC Staff Instructor','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(11,1,'Master Instructor','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(12,1,'Course Director','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(13,1,'Tec 40','Technical Track (Tecrec)','40m','Air/Nitrox up to 50% for deco','Double + 1 stage (optional)','PADI Advanced Open Water Diver + PADI Rescue Diver recommended + PADI Enriched Air Diver + PADI Deep Diver or proof of 10 dives to 30 metres/100 feet or deeper + 30 logged dives + 18 years old','2025-12-29 16:59:25','2026-01-07 16:37:34','10 minutes'),(14,1,'Tec 45','Technical Track (Tecrec)','45m','Air/Nitrox up to 100% O2 for deco','Double + 1 stage','PADI Tec 40 Diver + PADI Rescue Diver (Proof of CPR/First Aid training within the previous two years required) + Minimum of 50 logged dives, with at least 10 dives deeper than 30 metres/100 feet + 18 years old','2025-12-29 16:59:25','2026-01-07 16:34:33','Unlimited (gas limited)'),(15,1,'Tec 50','Technical Track (Tecrec)','50m','Air/Nitrox up to 100% O2 for deco','Double + 2 stages','PADI Tec 45 Diver + PADI Rescue Diver + Minimum of 100 logged dives or 75 hours + 18 years old','2025-12-29 16:59:25','2026-01-07 16:35:09','Unlimited (gas limited)'),(16,1,'Tec Trimix 65','Technical Track (Tecrec)','65m','Trimix (min 18% O2)','Double + 2+ stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(17,1,'Tec Trimix Diver','Technical Track (Tecrec)','Beyond 65m (limit set by training, often 90m+)',NULL,'Double + 3+ stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(18,1,'Enriched Air Diver (Nitrox)','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(19,1,'Deep Diver','Specialties','40m',NULL,'Single + Pony/Stage recommended',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(20,1,'Wreck Diver','Specialties',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(21,1,'Sidemount Diver','Specialties',NULL,NULL,'2 Sidemount',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(22,1,'Dry Suit Diver','Specialties',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(23,1,'Self-Reliant Diver','Specialties',NULL,NULL,'Single + Pony or Doubles','Min 100 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(24,1,'Cavern Diver','Specialties',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(25,1,'Ice Diver','Specialties',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(26,2,'Try Scuba','Recreational Track','12m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(27,2,'Scuba Diver','Recreational Track','12m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(28,2,'Open Water Diver (OWD)','Recreational Track','18m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(29,2,'Advanced Open Water Diver','Recreational Track','30m (Intro to 5 specialties)','Air/Nitrox','Single','','2025-12-29 16:59:25','2026-03-03 14:20:02',''),(30,2,'Diver Stress & Rescue','Recreational Track',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(31,2,'Master Diver','Recreational Track',NULL,NULL,NULL,'Stress & Rescue + 4 Specialties + 50 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(32,2,'Dive Guide','Professional Track',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(33,2,'Divemaster','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(34,2,'Assistant Instructor','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(35,2,'Open Water Instructor','Professional Track',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(36,2,'XR Nitrox','Extended Range (Xr) / Technical','40m','Nitrox up to 100%','Single + Pony or Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','15 minutes'),(37,2,'Extended Range','Extended Range (Xr) / Technical','45m','Air/Nitrox up to 100%','Double + 1 stage',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','25 minutes'),(38,2,'Technical Extended Range','Extended Range (Xr) / Technical','50m (60m with Trimix)','Normoxic Trimix / Nitrox / O2','Double + 2 stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(39,2,'Hypoxic Trimix','Extended Range (Xr) / Technical','100m','Hypoxic Trimix / multiple stages','Double + 3+ stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(40,2,'XR Sidemount','Extended Range (Xr) / Technical',NULL,NULL,'2+ Sidemount',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(41,2,'XR Cavern / Cave / Wreck','Extended Range (Xr) / Technical',NULL,NULL,'Double/Sidemount + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(42,2,'Deep Diving','Specialties','18-40m',NULL,'Single','Open Water Diver, Min age 15','2025-12-29 16:59:25','2025-12-29 23:35:00','No decompression'),(43,2,'Enriched Air Nitrox','Specialties',NULL,'Up to 40% O2','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(44,2,'Navigation','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(45,2,'Night & Limited Visibility','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(46,2,'Wreck Diving','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(47,2,'Dry Suit Diving','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(48,2,'Waves, Tides & Currents','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(49,2,'Search & Recovery','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(50,2,'Perfect Buoyancy','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(51,2,'Computer Diving','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(52,2,'Photo & Video','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(53,2,'Ecology Programs','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(54,3,'Fundamentals (Rec Pass)','General','21m','Nitrox 32%','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(55,3,'Fundamentals (Tec Pass)','General',NULL,'Nitrox 32%','Double + Canister Light',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(56,3,'Recreational 1','General','21m','Nitrox 32%','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(57,3,'Recreational 2','General','30m','Triox 30/30','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(58,3,'Recreational 3','General','39m','Normoxic Trimix (Triox 21/35)','Double','Limited deco (15 min)','2025-12-29 16:59:25','2025-12-29 16:59:25','15 minutes (unadjusted)'),(59,3,'Technical Diver 1','Technical Track','51m','Normoxic Trimix 21/35 or 18/45','Double + 1 stage','Min 100 dives','2025-12-29 16:59:25','2025-12-29 16:59:25','30 minutes (unadjusted)'),(60,3,'Technical Diver 2','Technical Track','75m','Hypoxic Trimix','Double + 2+ stages','Min 25 dives at Tech 1 level','2025-12-29 16:59:25','2025-12-29 16:59:25','60 minutes (unadjusted)'),(61,3,'Technical Diver 3','Technical Track','Beyond 75m','Hypoxic Trimix','Double + 3+ stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(62,3,'Cave Diver 1','Cave Track','30m','Nitrox 32%','Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(63,3,'Cave Diver 2','Cave Track',NULL,'Nitrox 32%','Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(64,3,'Cave Diver 3','Cave Track',NULL,'Nitrox 32% + Stages','Double + Stages/CCR',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(65,3,'Doubles Primer','Specialized Courses / Primers',NULL,NULL,'Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(66,3,'Drysuit Primer','Specialized Courses / Primers',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(67,3,'DPV 1','Specialized Courses / Primers',NULL,NULL,'Double','Min 75 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(68,3,'DPV 2','Specialized Courses / Primers',NULL,NULL,'Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(69,3,'Documentation Diver','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(70,3,'Photogrammetry Diver','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(71,3,'Scientific Diver','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(72,3,'Gas Blender','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(73,3,'Navigation Diver','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(74,3,'Rescue Primer','Specialized Courses / Primers',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(75,3,'Triox Primer','Specialized Courses / Primers',NULL,'Triox 30/30','Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(76,6,'Intro to Tech','General','23m',NULL,'Double/Sidemount',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(77,6,'Advanced Nitrox Diver','General','40m','up to 100% O2','Single + Stage or Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','No decompression'),(78,6,'Decompression Procedures Diver','General','45m',NULL,'Double + Stage',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (gas limited)'),(79,6,'Extended Range Diver','General','55m','Air or Nitrox','Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (gas limited)'),(80,6,'Trimix Diver','General','60m','Normoxic Trimix','Double + 2 Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(81,6,'Advanced Trimix Diver','General','100m','Hypoxic Trimix','Double + 3+ Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(82,6,'Helitrox Diver','General','45m','Helium Mixes','Double + Stage',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(83,6,'CCR Air Diluent / Decompression / Mixed Gas / Hypoxic','General','40m-100m',NULL,'CCR + Bailouts',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(84,6,'Advanced Wreck','General',NULL,NULL,'Double/Sidemount + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(85,6,'Cavern / Cave / Full Cave','General',NULL,NULL,'Double/Sidemount + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(86,6,'Technical Sidemount','General',NULL,NULL,'2+ Sidemount',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(87,9,'Open Water Scuba Diver','General','18m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(88,9,'Advanced Adventure Diver','General','30m (5 specialties intro)','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(89,9,'Rescue Diver','General',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(90,9,'Master Scuba Diver','General',NULL,NULL,'Single','4 specialties + 50 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(91,9,'Solo Diver','Specialties',NULL,NULL,'Single + Pony or Double','Min 100 dives','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(92,9,'Computer Nitrox','Specialties',NULL,'Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(93,9,'Deep Diver','Specialties','40m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(94,9,'Wreck Diver','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(95,9,'Navigation','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(96,9,'Dry Suit','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(97,9,'Search and Recovery','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(98,9,'Night / Limited Visibility','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(99,9,'Underwater Video / Still Photography','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(100,9,'Full Face Mask','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(101,7,'Scuba Diver','General','18m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(102,7,'Advanced Scuba Diver','General','40m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(103,7,'Rescue Scuba Diver','General',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(104,7,'Master Scuba Diver','General',NULL,NULL,'Single','Advanced recreational skills','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(105,7,'Underwater Environment','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(106,7,'Deep Diving','Specialties','40m',NULL,'Single + Pony',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(107,7,'Wreck Diving','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(108,7,'Night Diving','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(109,7,'Search and Recovery','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(110,7,'Training for specialized equipment (Sidemount, Drysuit)','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(111,7,'Technical Tracks','Technical',NULL,NULL,'Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(112,8,'Ocean Diver','General','20m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(113,8,'Sports Diver','General','35m','Air/Nitrox','Single','Progression from 20m','2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (subject to planning)'),(114,8,'Dive Leader','General','50m','Air/Nitrox','Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (subject to planning)'),(115,8,'Advanced Diver','General',NULL,NULL,'Single/Double + Stages','Advanced planning/management','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(116,8,'First Class Diver','General',NULL,NULL,'Single/Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(117,8,'Boat Handling / Chartwork & Position Fixing','Skill Development Courses (SDCs)',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(118,8,'Marine Life Identification / Underwater Photography','Skill Development Courses (SDCs)',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(119,8,'First Aid for Divers / Oxygen Administration','Skill Development Courses (SDCs)',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(120,8,'Wreck Diving / Search and Recovery','Skill Development Courses (SDCs)',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(121,8,'Twin-set Diver / Accelerated Decompression','Skill Development Courses (SDCs)',NULL,NULL,'Twinset / Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(122,4,'Open Water 20','General','20m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(123,4,'Explorer 30','General','30m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(124,4,'Deep 40','General','40m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(125,4,'Master Diver','General',NULL,NULL,'Single','40 dives + specific specialties','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(126,4,'Deco 40','General','40m','up to 100% O2','Double / Single + Stage',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(127,4,'Deco 50','General','50m','Normoxic Trimix','Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(128,4,'Sidemount / Twinset','Specialties',NULL,NULL,'Sidemount/Twinset',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(129,4,'Drysuit','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(130,4,'Night / Limited Visibility','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(131,4,'Navigation','Specialties',NULL,NULL,'Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(132,4,'Wreck / Advanced Wreck','Specialties',NULL,NULL,'Single/Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(133,4,'Cave 1 / 2','Specialties',NULL,NULL,'Double/Sidemount',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(134,4,'Rebreather (CCR) Levels','Specialties','40m-100m',NULL,'CCR + Bailout',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(135,5,'One Star Diver (*)','General','20m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(136,5,'Two Star Diver (**)','General','40m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(137,5,'Three Star Diver (***)','General','56m (Rec limit)','Air/Nitrox','Double recommended',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(138,5,'Four Star Diver (****)','General',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(139,5,'Oxygen Provider','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(140,5,'Rescue','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(141,5,'Night Diving','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(142,5,'Cave Diving','Specialties',NULL,NULL,'Double + Stages','For penetration >500m','2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(143,5,'Marine Biology','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(144,5,'Underwater Archaeology','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(145,10,'Open Water','General','18m','Air','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(146,10,'Advanced Open Water','General','30m','Air/Nitrox','Single',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(147,10,'Rescue / Divemaster','General',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(148,10,'Advanced Nitrox','General','42m',NULL,'Single + Stage or Double',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','15 minutes'),(149,10,'Technical Diver','General','54m','Air/Nitrox/O2','Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (gas limited)'),(150,10,'Normoxic Trimix','General','60m','Normoxic Trimix','Double + 2 Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25','Unlimited (gas limited)'),(151,10,'Trimix Diver','General','100m','Hypoxic Trimix','Double + 3+ Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(152,10,'Deep Diver','Specialties','40m','Air',NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(153,10,'Wreck / Technical Wreck','Specialties',NULL,NULL,'Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(154,10,'Cavern / Cave','Specialties',NULL,NULL,'Double + Stages',NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(155,10,'Public Safety Diver','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(156,10,'Gas Blender','Specialties',NULL,NULL,NULL,NULL,'2025-12-29 16:59:25','2025-12-29 16:59:25',NULL),(157,2,'Decompression Diving','Specialties','40m','Air/Nitrox (up to 40% O2 for deco)','Single + Stage','Deep Diving + Nitrox 40','2025-12-29 23:35:00','2025-12-29 23:35:00','15 minutes'),(158,10,'Deep DECO Diver','General','40m','Air','Single + Stage or Double',NULL,'2025-12-29 23:35:01','2025-12-29 23:35:01','10 minutes'),(159,11,'Open Water Sport Diver (L1)','Recreational Track','18m','Air','Single',NULL,'2025-12-29 23:35:01','2025-12-29 23:35:01','No decompression'),(160,11,'Advanced Open Water Diver (L2)','Recreational Track','30m','Air/SafeAir (if qualified)','Single','OWD','2025-12-29 23:35:01','2025-12-29 23:35:01','No decompression'),(161,11,'Rescue Diver (L2)','Recreational Track','30m','Air/SafeAir','Single','AOWD + CPR','2025-12-29 23:35:01','2025-12-29 23:35:01','No decompression'),(162,11,'Limited SafeAir User (LSU) / SafeAir Diver','SafeAir (Nitrox)','40m (training dependent)','SafeAir 22-40%','Single','OWD','2025-12-29 23:35:01','2025-12-29 23:35:01','No decompression'),(163,11,'Complete SafeAir User (CSU)','SafeAir (Nitrox)','40m','SafeAir 22-50%','Single','LSU or equivalent','2025-12-29 23:35:01','2025-12-29 23:35:01','No decompression'),(164,11,'Technical SafeAir Diver (TSD) (L3)','Technical Track','40m','3 mixtures','Double + Stage','CSU + Deep + Rescue','2025-12-29 23:35:01','2025-12-29 23:35:01','30 minutes'),(165,11,'Technical Tri-Mix Diver (TTM) (L3)','Technical Track','50m','Trimix (min 16% O2)','Double + Stages','TSD','2025-12-29 23:35:01','2025-12-29 23:35:01','Unlimited (gas limited)'),(166,11,'Extended Range Diver (ERD) (L4)','Technical Track','50m','Multiple mixtures','Double + Stages','TSD or TTM','2025-12-29 23:35:01','2025-12-29 23:35:01','Unlimited (gas limited)'),(167,11,'Tri-Mix Exploration Diver (TMD) (L5)','Technical Track','100m','Hypoxic Trimix','Double + Multiple Stages','TTM/ERD','2025-12-29 23:35:01','2025-12-29 23:35:01','Unlimited (gas limited)'),(168,1,'Tec 50 (Trimix)','Technical Track (Tecrec)','50m','Air/Nitrox/Normoxic Trimix','Doubles + 2 stages','','2026-01-07 16:26:48','2026-01-07 16:27:22','Unlimited (gas limited)'),(169,1,'Tec 45 (Trimix)','Technical Track (Tecrec)','45m','Air/Nitrox up to 100%/Normoxic Trimix (<35% He)','Double + 1 stage (optional)','PADI Tec 40 Diver +  PADI Rescue Diver (Proof of CPR/First Aid training within the previous two years required) + Minimum of 50 logged dives, with at least 10 dives deeper than 30 metres/100 feet + 18 years old','2026-01-07 16:31:22','2026-01-07 16:34:20','Unlimited (gas limited)'),(170,2,'Advanced Wreck Diving','Extended Range (Xr) / Technical','','','','','2026-03-03 14:05:54','2026-03-03 14:05:54','');
/*!40000 ALTER TABLE `certification_levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'disable_diving_center_reviews','false','Disable comments and ratings for diving centers','2025-11-01 13:58:21','2025-11-01 13:59:48');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-15 13:49:48
