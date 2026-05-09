import os
import orjson
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, time, timedelta
import xml.etree.ElementTree as ET
from xml.dom import minidom
from io import BytesIO

from app.models import Dive, DiveSite
from app.services.dive_profile_parser import DiveProfileParser, parse_dive_information_text

logger = logging.getLogger(__name__)

try:
    from garmin_fit_sdk import Encoder, Stream
    GARMIN_SDK_AVAILABLE = True
except ImportError:
    GARMIN_SDK_AVAILABLE = False
    logger.warning("garmin-fit-sdk not found. FIT export will be disabled.")

class DiveExportService:
    """Service for exporting dive profiles in various formats."""

    def __init__(self):
        self.parser = DiveProfileParser()

    def export_to_subsurface_xml(self, dive: Dive, profile_data: Dict[str, Any], dive_site: Optional[DiveSite] = None, tags: List[str] = None) -> str:
        """
        Export dive to Subsurface XML format.
        
        Args:
            dive: Dive model instance
            profile_data: Parsed profile dictionary
            dive_site: Associated DiveSite model instance
            tags: List of tag names
            
        Returns:
            str: Pretty-printed XML string
        """
        # Parse extra info from text block
        extra_info = parse_dive_information_text(dive.dive_information)

        # Create root
        root = ET.Element("divelog")
        root.set("program", "divemap")
        root.set("version", "3")

        # Add divesites if available
        if dive_site:
            divesites = ET.SubElement(root, "divesites")
            site = ET.SubElement(divesites, "site")
            # Generate a consistent UUID from site ID
            site.set("uuid", f"{dive_site.id:08x}")
            site.set("name", dive_site.name)
            if dive_site.latitude and dive_site.longitude:
                site.set("gps", f"{dive_site.latitude:.6f} {dive_site.longitude:.6f}")
            if dive_site.description:
                site.set("description", dive_site.description)

        # Add dives
        dives_elem = ET.SubElement(root, "dives")
        
        # Format date and time
        date_str = dive.dive_date.strftime("%Y-%m-%d")
        time_str = dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else "00:00:00"
        
        # Calculate precise duration from samples (stop at last non-zero depth)
        duration_str = f"{dive.duration or 0}:00 min"
        if 'samples' in profile_data and profile_data['samples']:
            # Find last sample with depth > 0 (Subsurface behavior)
            non_zero_samples = [s for s in profile_data['samples'] if s.get('depth', 0) > 0]
            if non_zero_samples:
                max_time = non_zero_samples[-1].get('time_minutes', 0)
                mins = int(max_time)
                secs = int(round((max_time - mins) * 60))
                if secs == 60:
                    mins += 1
                    secs = 0
                duration_str = f"{mins}:{secs:02d} min"

        dive_elem = ET.SubElement(dives_elem, "dive")
        
        # Subsurface attribute order: number, rating, visibility, sac, otu, cns, tags, divesiteid, date, time, duration
        if dive.id:
            dive_elem.set("number", str(dive.id))
        if dive.user_rating is not None:
            dive_elem.set("rating", str(max(1, round(float(dive.user_rating) / 2))))
        if dive.visibility_rating is not None:
            dive_elem.set("visibility", str(max(1, round(float(dive.visibility_rating) / 2))))
        
        if extra_info.get('sac'):
            sac_val = extra_info['sac']
            if 'l/min' not in sac_val.lower():
                s_match = re.search(r'(\d+\.?\d*)', sac_val)
                if s_match:
                    sac_val = f"{float(s_match.group(1)):.3f} l/min"
            dive_elem.set("sac", sac_val)
            
        if extra_info.get('otu'):
            o_match = re.search(r'(\d+)', extra_info['otu'])
            if o_match:
                dive_elem.set("otu", o_match.group(1))
            
        if extra_info.get('cns'):
            c_match = re.search(r'(\d+)', extra_info['cns'])
            if c_match:
                dive_elem.set("cns", f"{c_match.group(1)}%")

        if tags:
            dive_elem.set("tags", ", ".join(tags))

        if dive_site:
            dive_elem.set("divesiteid", f"{dive_site.id:08x}")

        dive_elem.set("date", date_str)
        dive_elem.set("time", time_str)
        dive_elem.set("duration", duration_str)

        # Child elements order: buddy, suit, notes, cylinder, weightsystem, divecomputer
        if extra_info.get('buddy'):
            buddy = ET.SubElement(dive_elem, "buddy")
            buddy.text = extra_info['buddy']

        if dive.suit_type:
            suit = ET.SubElement(dive_elem, "suit")
            suit.text = dive.suit_type.value

        if dive.dive_information:
            notes = ET.SubElement(dive_elem, "notes")
            notes.text = dive.dive_information

        # Add cylinders
        cyls = profile_data.get('cylinders') or profile_data.get('metadata', {}).get('cylinders')
        
        # Fallback to reconstructing from gas_bottles_used if missing from profile_data
        if not cyls and dive.gas_bottles_used:
            cyls = self._reconstruct_cylinders_from_gas_bottles(dive.gas_bottles_used)
            
        if cyls:
            for cyl in cyls:
                cylinder = ET.SubElement(dive_elem, "cylinder")
                # Specific attribute order: size, workpressure, description, start, end, o2, he, depth
                for key in ['size', 'workpressure', 'description', 'start', 'end', 'o2', 'he', 'depth']:
                    val = cyl.get(key)
                    if val is not None:
                        val_str = str(val)
                        # Remove existing units to re-format with correct precision
                        numeric_part = val_str.split()[0].replace('%', '')
                        try:
                            f_val = float(numeric_part)
                            if key == 'size':
                                val_str = f"{f_val:.1f} l"
                            elif key in ['workpressure', 'start', 'end']:
                                val_str = f"{f_val:.1f} bar"
                            elif key in ['o2', 'he']:
                                val_str = f"{f_val:.1f}%"
                            elif key == 'depth':
                                val_str = f"{f_val:.3f} m"
                        except (ValueError, IndexError):
                            pass # Keep original val_str if not numeric
                        cylinder.set(key, val_str)

        # Add weightsystem
        if extra_info.get('weights'):
            ws = ET.SubElement(dive_elem, "weightsystem")
            w_match = re.search(r'(\d+\.?\d*)', extra_info['weights'])
            if w_match:
                ws.set("weight", f"{float(w_match.group(1)):.1f} kg")
            
            # Use 'weight' as default description if nothing else is left
            desc = extra_info['weights']
            desc_clean = re.sub(r'\d+\.?\d*\s*kg', '', desc, flags=re.IGNORECASE).strip()
            if not desc_clean or desc_clean == '-':
                desc = 'weight'
            ws.set("description", desc)

        # Add divecomputer
        dc = ET.SubElement(dive_elem, "divecomputer")
        dc_model = extra_info.get('computer') or profile_data.get('model', "Divemap Export")
        dc.set("model", dc_model)
        if profile_data.get('deviceid'):
            dc.set("deviceid", profile_data['deviceid'])
        if profile_data.get('diveid'):
            dc.set("diveid", profile_data['diveid'])

        # Depth stats
        depth_elem = ET.SubElement(dc, "depth")
        if dive.max_depth:
            depth_elem.set("max", f"{float(dive.max_depth):.1f} m")
        if dive.average_depth:
            depth_elem.set("mean", f"{float(dive.average_depth):.3f} m")

        # Temperature (Water = MIN/bottom temp in Subsurface)
        temp_elem = ET.SubElement(dc, "temperature")
        if 'water_temperature' in profile_data:
            temp_elem.set("water", f"{float(profile_data['water_temperature']):.1f} C")
        elif 'temperature_range' in profile_data and profile_data['temperature_range'].get('min'):
            temp_elem.set("water", f"{float(profile_data['temperature_range']['min']):.1f} C")
        
        # Environmental Tags
        surf_p = profile_data.get('surface_pressure') or profile_data.get('surface pressure')
        if surf_p:
            surf = ET.SubElement(dc, "surface")
            surf.set("pressure", f"{float(str(surf_p).split()[0]):.3f} bar")
        
        wat_s = profile_data.get('water_salinity') or profile_data.get('water salinity')
        if wat_s:
            wat = ET.SubElement(dc, "water")
            wat.set("salinity", f"{str(wat_s).split()[0]} g/l")

        # Extra data from profile
        if 'extra_data' in profile_data:
            for key, val in profile_data['extra_data'].items():
                if key != 'Deco model':
                    ed = ET.SubElement(dc, "extradata")
                    ed.set("key", key)
                    ed.set("value", str(val))

        # Add deco model
        deco_model = extra_info.get('deco_model') or profile_data.get('extra_data', {}).get('Deco model')
        if deco_model:
            extradata = ET.SubElement(dc, "extradata")
            extradata.set("key", "Deco model")
            extradata.set("value", deco_model)

        # Events
        if 'events' in profile_data:
            for ev in profile_data['events']:
                event = ET.SubElement(dc, "event")
                event.set("time", ev.get('time', "0:00 min"))
                if ev.get('type'):
                    event.set("type", str(ev['type']))
                if ev.get('flags'):
                    event.set("flags", str(ev['flags']))
                event.set("name", ev.get('name', ""))
                if ev.get('value'):
                    event.set("value", str(ev['value']))
                
                if ev.get('name') == 'gaschange':
                    if ev.get('cylinder') is not None:
                        event.set("cylinder", str(ev['cylinder']))
                    if ev.get('o2'):
                        o2_val = str(ev['o2'])
                        if '%' not in o2_val: o2_val = f"{float(o2_val):.1f}%"
                        event.set("o2", o2_val)
                    if ev.get('he'):
                        he_val = str(ev['he'])
                        if '%' not in he_val: he_val = f"{float(he_val):.1f}%"
                        event.set("he", he_val)

        # Samples
        if 'samples' in profile_data:
            for s in profile_data['samples']:
                sample = ET.SubElement(dc, "sample")
                sample.set("time", s.get('time', f"{s.get('time_minutes', 0):.2f} min"))
                if 'depth' in s:
                    sample.set("depth", f"{float(s['depth']):.1f} m")
                if 'temperature' in s:
                    sample.set("temp", f"{float(s['temperature']):.1f} C")
                if 'pressure' in s:
                    sample.set("pressure0", f"{float(s['pressure']):.1f} bar")
                if 'cns_percent' in s and s['cns_percent'] is not None:
                    sample.set("cns", f"{int(s['cns_percent'])}%")
                if 'ndl_minutes' in s and s['ndl_minutes'] is not None:
                    m = int(s['ndl_minutes'])
                    sample.set("ndl", f"{m}:00 min")
                if 'stopdepth' in s and s['stopdepth'] is not None:
                    sample.set("stopdepth", f"{float(s['stopdepth']):.1f} m")
                if 'stoptime_minutes' in s and s['stoptime_minutes'] is not None:
                    sample.set("stoptime", f"{int(s['stoptime_minutes'])}:00 min")

        # Finalize and pretty-print with Subsurface styling
        return self._finalize_subsurface_xml(root)

    def _reconstruct_cylinders_from_gas_bottles(self, gas_bottles_used_str: str) -> List[Dict[str, Any]]:
        """Reconstruct cylinders list from the structured gas_bottles_used JSON string."""
        if not gas_bottles_used_str:
            return []
        try:
            data = orjson.loads(gas_bottles_used_str)
            cyls = []
            
            # Handle structured object with back_gas and stages
            if isinstance(data, dict):
                # Map back_gas
                if data.get('back_gas'):
                    bg = data['back_gas']
                    cyls.append(self._map_bottle_to_cylinder(bg))
                
                # Map stages
                if data.get('stages'):
                    for s in data['stages']:
                        if s:
                            cyls.append(self._map_bottle_to_cylinder(s))
            
            # Handle simple list of bottles (fallback)
            elif isinstance(data, list):
                for i, b in enumerate(data):
                    if b:
                        cyl = self._map_bottle_to_cylinder(b)
                        if 'index' not in cyl:
                            cyl['index'] = i
                        cyls.append(cyl)
                    
            return sorted(cyls, key=lambda x: x.get('index', 0))
        except Exception as e:
            logger.warning(f"Error reconstructing cylinders: {e}")
            return []

    def _map_bottle_to_cylinder(self, bottle: Dict[str, Any]) -> Dict[str, Any]:
        """Map a bottle object from gas_bottles_used to a cylinder dict."""
        res = {
            'size': f"{bottle.get('tank')} l" if bottle.get('tank') else None,
            'workpressure': bottle.get('workpressure'),
            'description': bottle.get('description'),
            'start': f"{bottle.get('start_pressure')} bar" if bottle.get('start_pressure') else None,
            'end': f"{bottle.get('end_pressure')} bar" if bottle.get('end_pressure') else None,
            'depth': bottle.get('depth'),
            'index': bottle.get('index', 0)
        }
        if bottle.get('gas'):
            res['o2'] = f"{bottle['gas'].get('o2')}%"
            res['he'] = f"{bottle['gas'].get('he')}%"
        return res

    def _finalize_subsurface_xml(self, root: ET.Element) -> str:
        """Pretty-print XML and post-process to match Subsurface style (single quotes, spacing)."""
        rough_string = ET.tostring(root, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")
        
        # 1. Remove the XML declaration line
        lines = pretty_xml.splitlines()
        if lines and lines[0].startswith('<?xml'):
            lines = lines[1:]
        
        content = "\n".join(lines).strip()
        
        # 2. Replace double quotes with single quotes for attributes
        def quote_replacer(match):
            attr_assignment = match.group(1) 
            attr_value = match.group(2)      
            safe_value = attr_value.replace("'", "&apos;")
            return f"{attr_assignment}'{safe_value}'"

        content = re.sub(r'(\s[\w:]+=)"([^"]*)"', quote_replacer, content)
        
        # 3. Add space before self-closing tags
        content = content.replace('"/>', '" />').replace("'/>", "' />")
        
        return content + "\n"

    def export_to_garmin_fit(self, dive: Dive, profile_data: Dict[str, Any]) -> bytes:
        """
        Export dive to Garmin FIT format.
        
        Args:
            dive: Dive model instance
            profile_data: Parsed profile dictionary
            
        Returns:
            bytes: FIT file binary data
        """
        if not GARMIN_SDK_AVAILABLE:
            raise RuntimeError("garmin-fit-sdk not installed")

        stream = Stream.from_buffered_writer()
        encoder = Encoder(stream)
        encoder.write_file_header()

        # 1. File ID
        file_id_mesg = {
            'type': 4,  # Activity
            'manufacturer': 1,  # Garmin (or 255 for development)
            'product': 0,
            'serial_number': dive.id or 0,
            'time_created': datetime.now()
        }
        encoder.write_mesg('file_id', file_id_mesg)

        # Combine date and time for start timestamp
        start_dt = datetime.combine(dive.dive_date, dive.dive_time or time(0, 0))
        
        # 2. Dive Summary / Session
        # In a real FIT file we would need more messages, but let's do the basics
        session_mesg = {
            'timestamp': start_dt,
            'start_time': start_dt,
            'total_elapsed_time': (dive.duration or 0) * 60,
            'total_timer_time': (dive.duration or 0) * 60,
            'max_depth': float(dive.max_depth) if dive.max_depth else 0,
            'avg_depth': float(dive.average_depth) if dive.average_depth else 0,
            'sport': 33,  # Diving
            'sub_sport': 0
        }
        encoder.write_mesg('session', session_mesg)

        # 3. Records
        if 'samples' in profile_data:
            for s in profile_data['samples']:
                # Calculate absolute timestamp
                offset_seconds = int(s.get('time_minutes', 0) * 60)
                ts = start_dt + timedelta(seconds=offset_seconds)
                
                record_mesg = {
                    'timestamp': ts,
                    'depth': float(s['depth']) if 'depth' in s else 0,
                }
                if 'temperature' in s:
                    record_mesg['temperature'] = float(s['temperature'])
                
                encoder.write_mesg('record', record_mesg)

        encoder.close()
        return stream.get_buffer()

    def export_to_suunto_json(self, dive: Dive, profile_data: Dict[str, Any]) -> bytes:
        """
        Export dive to Suunto-compatible JSON format.
        
        Args:
            dive: Dive model instance
            profile_data: Parsed profile dictionary
            
        Returns:
            bytes: JSON binary data
        """
        start_dt = datetime.combine(dive.dive_date, dive.dive_time or time(0, 0))
        
        suunto_data = {
            "header": {
                "activityId": str(dive.id),
                "startTime": start_dt.isoformat() + "Z",
                "duration": (dive.duration or 0) * 60,
                "device": {
                    "model": profile_data.get('model', "Divemap"),
                    "serialNumber": profile_data.get('deviceid', "0")
                }
            },
            "summary": {
                "maxDepth": float(dive.max_depth) if dive.max_depth else 0,
                "avgDepth": float(dive.average_depth) if dive.average_depth else 0,
            },
            "samples": []
        }
        
        if 'samples' in profile_data:
            for s in profile_data['samples']:
                suunto_data["samples"].append({
                    "time": int(s.get('time_minutes', 0) * 60),
                    "depth": float(s['depth']) if 'depth' in s else 0,
                    "temperature": float(s['temperature']) if 'temperature' in s else None
                })
                
        return orjson.dumps(suunto_data, option=orjson.OPT_INDENT_2)
