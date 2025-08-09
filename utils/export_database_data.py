#!/usr/bin/env python3
"""
Script to export current database data for inclusion in init.sql
Run this script to generate INSERT statements for all current data.
"""

import os
import sys
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the path
sys.path.append('backend')

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap")

def escape_sql_string(s):
    """Escape a string for SQL insertion"""
    if s is None:
        return 'NULL'
    # Escape single quotes and backslashes
    s = str(s).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"

def export_data():
    """Export all current data from the database"""

    # Create engine and session
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("-- Current Database Data Export")
    print("-- Generated for init.sql")
    print()

    try:
        # Export users
        print("-- Users")
        users = session.execute(text("SELECT * FROM users"))
        for user in users:
            google_id_value = escape_sql_string(user.google_id) if user.google_id else 'NULL'
            diving_cert_value = escape_sql_string(user.diving_certification) if hasattr(user, 'diving_certification') and user.diving_certification else 'NULL'
            number_of_dives_value = user.number_of_dives if hasattr(user, 'number_of_dives') else 0

            print(f"INSERT INTO users (id, username, email, password_hash, google_id, created_at, updated_at, is_admin, is_moderator, enabled, diving_certification, number_of_dives) VALUES ({user.id}, {escape_sql_string(user.username)}, {escape_sql_string(user.email)}, {escape_sql_string(user.password_hash)}, {google_id_value}, {escape_sql_string(user.created_at)}, {escape_sql_string(user.updated_at)}, {1 if user.is_admin else 0}, {1 if user.is_moderator else 0}, {1 if user.enabled else 0}, {diving_cert_value}, {number_of_dives_value});")
        print()

        # Export dive sites
        print("-- Dive Sites")
        dive_sites = session.execute(text("SELECT * FROM dive_sites"))
        for site in dive_sites:
            description_value = escape_sql_string(site.description)
            latitude_value = site.latitude if site.latitude else 'NULL'
            longitude_value = site.longitude if site.longitude else 'NULL'
            address_value = escape_sql_string(site.address)
            access_instructions_value = escape_sql_string(site.access_instructions)
            dive_plans_value = escape_sql_string(site.dive_plans)
            gas_tanks_necessary_value = escape_sql_string(site.gas_tanks_necessary)
            difficulty_level_value = escape_sql_string(site.difficulty_level)
            marine_life_value = escape_sql_string(site.marine_life)
            safety_information_value = escape_sql_string(site.safety_information)
            max_depth_value = site.max_depth if site.max_depth else 'NULL'
            # Note: alternative_names field has been deprecated and replaced by dive_site_aliases table
            # The aliases are now stored in a separate table and exported below
            alternative_names_value = "NULL"
            country_value = escape_sql_string(site.country)
            region_value = escape_sql_string(site.region)

            print(f"INSERT INTO dive_sites (id, name, description, latitude, longitude, address, access_instructions, dive_plans, gas_tanks_necessary, difficulty_level, marine_life, safety_information, max_depth, alternative_names, country, region, view_count, created_at, updated_at) VALUES ({site.id}, {escape_sql_string(site.name)}, {description_value}, {latitude_value}, {longitude_value}, {address_value}, {access_instructions_value}, {dive_plans_value}, {gas_tanks_necessary_value}, {difficulty_level_value}, {marine_life_value}, {safety_information_value}, {max_depth_value}, {alternative_names_value}, {country_value}, {region_value}, {site.view_count}, {escape_sql_string(site.created_at)}, {escape_sql_string(site.updated_at)});")
        print()

        # Export diving centers
        print("-- Diving Centers")
        diving_centers = session.execute(text("SELECT * FROM diving_centers"))
        for center in diving_centers:
            description_value = escape_sql_string(center.description)
            email_value = escape_sql_string(center.email)
            phone_value = escape_sql_string(center.phone)
            website_value = escape_sql_string(center.website)
            latitude_value = center.latitude if center.latitude else 'NULL'
            longitude_value = center.longitude if center.longitude else 'NULL'

            print(f"INSERT INTO diving_centers (id, name, description, email, phone, website, latitude, longitude, view_count, created_at, updated_at) VALUES ({center.id}, {escape_sql_string(center.name)}, {description_value}, {email_value}, {phone_value}, {website_value}, {latitude_value}, {longitude_value}, {center.view_count}, {escape_sql_string(center.created_at)}, {escape_sql_string(center.updated_at)});")
        print()

        # Export available tags
        print("-- Available Tags")
        tags = session.execute(text("SELECT * FROM available_tags"))
        for tag in tags:
            description_value = escape_sql_string(tag.description)
            created_by_value = tag.created_by if tag.created_by else 'NULL'

            print(f"INSERT INTO available_tags (id, name, description, created_by, created_at) VALUES ({tag.id}, {escape_sql_string(tag.name)}, {description_value}, {created_by_value}, {escape_sql_string(tag.created_at)});")
        print()

        # Export dive site tags
        print("-- Dive Site Tags")
        dive_site_tags = session.execute(text("SELECT * FROM dive_site_tags"))
        for tag in dive_site_tags:
            print(f"INSERT INTO dive_site_tags (id, dive_site_id, tag_id, created_at) VALUES ({tag.id}, {tag.dive_site_id}, {tag.tag_id}, {escape_sql_string(tag.created_at)});")
        print()

        # Export dive site aliases
        print("-- Dive Site Aliases")
        dive_site_aliases = session.execute(text("SELECT * FROM dive_site_aliases"))
        for alias in dive_site_aliases:
            print(f"INSERT INTO dive_site_aliases (id, dive_site_id, alias, created_at) VALUES ({alias.id}, {alias.dive_site_id}, {escape_sql_string(alias.alias)}, {escape_sql_string(alias.created_at)});")
        print()

        # Export site media
        print("-- Site Media")
        site_media = session.execute(text("SELECT * FROM site_media"))
        for media in site_media:
            description_value = escape_sql_string(media.description)

            print(f"INSERT INTO site_media (id, dive_site_id, media_type, url, description, created_at) VALUES ({media.id}, {media.dive_site_id}, {escape_sql_string(media.media_type)}, {escape_sql_string(media.url)}, {description_value}, {escape_sql_string(media.created_at)});")
        print()

        # Export site ratings
        print("-- Site Ratings")
        site_ratings = session.execute(text("SELECT * FROM site_ratings"))
        for rating in site_ratings:
            print(f"INSERT INTO site_ratings (id, dive_site_id, user_id, score, created_at) VALUES ({rating.id}, {rating.dive_site_id}, {rating.user_id}, {rating.score}, {escape_sql_string(rating.created_at)});")
        print()

        # Export site comments
        print("-- Site Comments")
        site_comments = session.execute(text("SELECT * FROM site_comments"))
        for comment in site_comments:
            print(f"INSERT INTO site_comments (id, dive_site_id, user_id, comment_text, created_at, updated_at) VALUES ({comment.id}, {comment.dive_site_id}, {comment.user_id}, {escape_sql_string(comment.comment_text)}, {escape_sql_string(comment.created_at)}, {escape_sql_string(comment.updated_at)});")
        print()

        # Export center ratings
        print("-- Center Ratings")
        center_ratings = session.execute(text("SELECT * FROM center_ratings"))
        for rating in center_ratings:
            print(f"INSERT INTO center_ratings (id, diving_center_id, user_id, score, created_at) VALUES ({rating.id}, {rating.diving_center_id}, {rating.user_id}, {rating.score}, {escape_sql_string(rating.created_at)});")
        print()

        # Export center comments
        print("-- Center Comments")
        center_comments = session.execute(text("SELECT * FROM center_comments"))
        for comment in center_comments:
            print(f"INSERT INTO center_comments (id, diving_center_id, user_id, comment_text, created_at, updated_at) VALUES ({comment.id}, {comment.diving_center_id}, {comment.user_id}, {escape_sql_string(comment.comment_text)}, {escape_sql_string(comment.created_at)}, {escape_sql_string(comment.updated_at)});")
        print()

        # Export center dive sites
        print("-- Center Dive Sites")
        center_dive_sites = session.execute(text("SELECT * FROM center_dive_sites"))
        for cds in center_dive_sites:
            dive_cost_value = cds.dive_cost if cds.dive_cost else 'NULL'

            print(f"INSERT INTO center_dive_sites (id, diving_center_id, dive_site_id, dive_cost, currency, created_at) VALUES ({cds.id}, {cds.diving_center_id}, {cds.dive_site_id}, {dive_cost_value}, {escape_sql_string(cds.currency)}, {escape_sql_string(cds.created_at)});")
        print()

        # Export gear rental costs
        print("-- Gear Rental Costs")
        gear_rental_costs = session.execute(text("SELECT * FROM gear_rental_costs"))
        for gear in gear_rental_costs:
            print(f"INSERT INTO gear_rental_costs (id, diving_center_id, item_name, cost, currency, created_at) VALUES ({gear.id}, {gear.diving_center_id}, {escape_sql_string(gear.item_name)}, {gear.cost}, {escape_sql_string(gear.currency)}, {escape_sql_string(gear.created_at)});")
        print()

        # Export parsed dive trips
        print("-- Parsed Dive Trips")
        parsed_dive_trips = session.execute(text("SELECT * FROM parsed_dive_trips"))
        for trip in parsed_dive_trips:
            diving_center_id_value = trip.diving_center_id if trip.diving_center_id else 'NULL'
            dive_site_id_value = trip.dive_site_id if trip.dive_site_id else 'NULL'
            trip_time_value = escape_sql_string(trip.trip_time) if trip.trip_time else 'NULL'
            source_newsletter_id_value = trip.source_newsletter_id if trip.source_newsletter_id else 'NULL'

            print(f"INSERT INTO parsed_dive_trips (id, diving_center_id, dive_site_id, trip_date, trip_time, source_newsletter_id, extracted_at) VALUES ({trip.id}, {diving_center_id_value}, {dive_site_id_value}, {escape_sql_string(trip.trip_date)}, {trip_time_value}, {source_newsletter_id_value}, {escape_sql_string(trip.extracted_at)});")
        print()

        # Export newsletters
        print("-- Newsletters")
        newsletters = session.execute(text("SELECT * FROM newsletters"))
        for newsletter in newsletters:
            print(f"INSERT INTO newsletters (id, content, received_at) VALUES ({newsletter.id}, {escape_sql_string(newsletter.content)}, {escape_sql_string(newsletter.received_at)});")
        print()

    except Exception as e:
        print(f"Error exporting data: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    export_data()