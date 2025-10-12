"""
Route Export Service

Handles exporting dive routes to various formats (GPX, KML).
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Any, Optional
from xml.dom import minidom

from app.models import DiveRoute, DiveSite


class RouteExportService:
    """Service for exporting dive routes to various formats"""
    
    def __init__(self):
        pass
    
    def export_to_gpx(self, route: DiveRoute, dive_site: Optional[DiveSite] = None) -> str:
        """Export route to GPX format"""
        
        # Create GPX root element
        gpx = ET.Element("gpx")
        gpx.set("version", "1.1")
        gpx.set("creator", "Divemap")
        gpx.set("xmlns", "http://www.topografix.com/GPX/1/1")
        gpx.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        gpx.set("xsi:schemaLocation", "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd")
        
        # Add metadata
        metadata = ET.SubElement(gpx, "metadata")
        name_elem = ET.SubElement(metadata, "name")
        name_elem.text = route.name
        desc_elem = ET.SubElement(metadata, "desc")
        desc_elem.text = route.description or f"Route: {route.name}"
        time_elem = ET.SubElement(metadata, "time")
        time_elem.text = route.created_at.isoformat() + "Z"
        
        # Add dive site as waypoint if available
        if dive_site:
            wpt = ET.SubElement(gpx, "wpt")
            wpt.set("lat", str(dive_site.latitude))
            wpt.set("lon", str(dive_site.longitude))
            name_elem = ET.SubElement(wpt, "name")
            name_elem.text = f"Dive Site: {dive_site.name}"
            desc_elem = ET.SubElement(wpt, "desc")
            desc_elem.text = f"Dive site for route: {route.name}"
            sym_elem = ET.SubElement(wpt, "sym")
            sym_elem.text = "Diving"
        
        # Process route data
        if route.route_data and route.route_data.get('features'):
            for feature in route.route_data['features']:
                geometry = feature.get('geometry', {})
                properties = feature.get('properties', {})
                
                if geometry.get('type') == 'LineString':
                    # Create track for LineString
                    trk = ET.SubElement(gpx, "trk")
                    name_elem = ET.SubElement(trk, "name")
                    name_elem.text = properties.get('name', f"{route.name} - {properties.get('segmentType', 'Unknown')}")
                    desc_elem = ET.SubElement(trk, "desc")
                    desc_elem.text = properties.get('description', f"Route segment: {properties.get('segmentType', 'Unknown')}")
                    
                    # Add track segments
                    trkseg = ET.SubElement(trk, "trkseg")
                    coordinates = geometry.get('coordinates', [])
                    
                    for coord in coordinates:
                        trkpt = ET.SubElement(trkseg, "trkpt")
                        trkpt.set("lat", str(coord[1]))  # GPX uses lat,lon order
                        trkpt.set("lon", str(coord[0]))
                        
                        # Add elevation if available
                        if len(coord) > 2:
                            ele_elem = ET.SubElement(trkpt, "ele")
                            ele_elem.text = str(coord[2])
                
                elif geometry.get('type') == 'Point':
                    # Create waypoint for Point
                    wpt = ET.SubElement(gpx, "wpt")
                    coordinates = geometry.get('coordinates', [])
                    if coordinates:
                        wpt.set("lat", str(coordinates[1]))
                        wpt.set("lon", str(coordinates[0]))
                        
                        name_elem = ET.SubElement(wpt, "name")
                        name_elem.text = properties.get('name', f"{route.name} - Waypoint")
                        desc_elem = ET.SubElement(wpt, "desc")
                        desc_elem.text = properties.get('description', f"Waypoint: {properties.get('segmentType', 'Unknown')}")
                        
                        # Add elevation if available
                        if len(coordinates) > 2:
                            ele_elem = ET.SubElement(wpt, "ele")
                            ele_elem.text = str(coordinates[2])
                
                elif geometry.get('type') == 'Polygon':
                    # Create track for Polygon (use outer ring)
                    trk = ET.SubElement(gpx, "trk")
                    name_elem = ET.SubElement(trk, "name")
                    name_elem.text = properties.get('name', f"{route.name} - {properties.get('segmentType', 'Unknown')} Area")
                    desc_elem = ET.SubElement(trk, "desc")
                    desc_elem.text = properties.get('description', f"Area: {properties.get('segmentType', 'Unknown')}")
                    
                    # Add track segments
                    trkseg = ET.SubElement(trk, "trkseg")
                    coordinates = geometry.get('coordinates', [])
                    
                    # Use outer ring of polygon
                    if coordinates and len(coordinates) > 0:
                        outer_ring = coordinates[0]
                        for coord in outer_ring:
                            trkpt = ET.SubElement(trkseg, "trkpt")
                            trkpt.set("lat", str(coord[1]))
                            trkpt.set("lon", str(coord[0]))
                            
                            # Add elevation if available
                            if len(coord) > 2:
                                ele_elem = ET.SubElement(trkpt, "ele")
                                ele_elem.text = str(coord[2])
        
        # Convert to pretty XML string
        rough_string = ET.tostring(gpx, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ")
    
    def export_to_kml(self, route: DiveRoute, dive_site: Optional[DiveSite] = None) -> str:
        """Export route to KML format"""
        
        # Create KML root element
        kml = ET.Element("kml")
        kml.set("xmlns", "http://www.opengis.net/kml/2.2")
        
        # Create Document
        document = ET.SubElement(kml, "Document")
        
        # Add document metadata
        name_elem = ET.SubElement(document, "name")
        name_elem.text = route.name
        desc_elem = ET.SubElement(document, "description")
        desc_elem.text = route.description or f"Route: {route.name}"
        
        # Add dive site as Placemark if available
        if dive_site:
            placemark = ET.SubElement(document, "Placemark")
            name_elem = ET.SubElement(placemark, "name")
            name_elem.text = f"Dive Site: {dive_site.name}"
            desc_elem = ET.SubElement(placemark, "description")
            desc_elem.text = f"Dive site for route: {route.name}"
            
            point = ET.SubElement(placemark, "Point")
            coordinates_elem = ET.SubElement(point, "coordinates")
            coordinates_elem.text = f"{dive_site.longitude},{dive_site.latitude},0"
        
        # Process route data
        if route.route_data and route.route_data.get('features'):
            for i, feature in enumerate(route.route_data['features']):
                geometry = feature.get('geometry', {})
                properties = feature.get('properties', {})
                
                placemark = ET.SubElement(document, "Placemark")
                name_elem = ET.SubElement(placemark, "name")
                name_elem.text = properties.get('name', f"{route.name} - Segment {i+1}")
                desc_elem = ET.SubElement(placemark, "description")
                desc_elem.text = properties.get('description', f"Route segment: {properties.get('segmentType', 'Unknown')}")
                
                # Set style based on segment type
                style_elem = ET.SubElement(placemark, "styleUrl")
                segment_type = properties.get('segmentType', 'unknown')
                style_elem.text = f"#{segment_type}_style"
                
                if geometry.get('type') == 'LineString':
                    # Create LineString
                    linestring = ET.SubElement(placemark, "LineString")
                    coordinates_elem = ET.SubElement(linestring, "coordinates")
                    
                    coordinates = geometry.get('coordinates', [])
                    coord_strings = []
                    for coord in coordinates:
                        coord_strings.append(f"{coord[0]},{coord[1]},{coord[2] if len(coord) > 2 else 0}")
                    coordinates_elem.text = " ".join(coord_strings)
                
                elif geometry.get('type') == 'Point':
                    # Create Point
                    point = ET.SubElement(placemark, "Point")
                    coordinates_elem = ET.SubElement(point, "coordinates")
                    
                    coordinates = geometry.get('coordinates', [])
                    if coordinates:
                        coord = coordinates[0]
                        coordinates_elem.text = f"{coord[0]},{coord[1]},{coord[2] if len(coord) > 2 else 0}"
                
                elif geometry.get('type') == 'Polygon':
                    # Create Polygon
                    polygon = ET.SubElement(placemark, "Polygon")
                    outer_boundary = ET.SubElement(polygon, "outerBoundaryIs")
                    linear_ring = ET.SubElement(outer_boundary, "LinearRing")
                    coordinates_elem = ET.SubElement(linear_ring, "coordinates")
                    
                    coordinates = geometry.get('coordinates', [])
                    if coordinates and len(coordinates) > 0:
                        outer_ring = coordinates[0]
                        coord_strings = []
                        for coord in outer_ring:
                            coord_strings.append(f"{coord[0]},{coord[1]},{coord[2] if len(coord) > 2 else 0}")
                        coordinates_elem.text = " ".join(coord_strings)
        
        # Add styles for different segment types
        self._add_kml_styles(document)
        
        # Convert to pretty XML string
        rough_string = ET.tostring(kml, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ")
    
    def _add_kml_styles(self, document: ET.Element) -> None:
        """Add KML styles for different route segment types"""
        
        # Define colors for different segment types
        colors = {
            'walk': 'ff00ff00',    # Green
            'swim': 'ff0000ff',    # Blue  
            'scuba': 'ffff0000',   # Red
            'line': 'ffffff00',    # Yellow
            'unknown': 'ff808080'  # Gray
        }
        
        for segment_type, color in colors.items():
            style = ET.SubElement(document, "Style")
            style.set("id", f"{segment_type}_style")
            
            line_style = ET.SubElement(style, "LineStyle")
            color_elem = ET.SubElement(line_style, "color")
            color_elem.text = color
            width_elem = ET.SubElement(line_style, "width")
            width_elem.text = "3"
            
            poly_style = ET.SubElement(style, "PolyStyle")
            color_elem = ET.SubElement(poly_style, "color")
            color_elem.text = color + "80"  # Add transparency
            fill_elem = ET.SubElement(poly_style, "fill")
            fill_elem.text = "1"
            outline_elem = ET.SubElement(poly_style, "outline")
            outline_elem.text = "1"
    
    def get_export_formats(self) -> List[Dict[str, str]]:
        """Get list of available export formats"""
        return [
            {
                "format": "gpx",
                "name": "GPX",
                "description": "GPS Exchange Format - compatible with most GPS devices and mapping software",
                "mime_type": "application/gpx+xml",
                "file_extension": ".gpx"
            },
            {
                "format": "kml",
                "name": "KML",
                "description": "Keyhole Markup Language - compatible with Google Earth and Google Maps",
                "mime_type": "application/vnd.google-earth.kml+xml",
                "file_extension": ".kml"
            }
        ]
