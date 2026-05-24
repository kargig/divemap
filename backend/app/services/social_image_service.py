from PIL import Image, ImageDraw, ImageFont
import io
import os
import json
from datetime import datetime

class SocialImageService:
    def __init__(self):
        # Local paths within the container (assuming /app is WORKDIR)
        self.font_paths = [
            "/app/assets/fonts/DejaVuSans-Bold.ttf",
            "/app/assets/fonts/LiberationSans-Bold.ttf",
            "./assets/fonts/DejaVuSans-Bold.ttf"
        ]
        self.default_font_path = next((p for p in self.font_paths if os.path.exists(p)), None)

    def generate(self, dive, profile_data, image_bytes, crop_params, full_url="divemap.gr"):
        """
        Generates a social media image with dive profile, metadata, and full URL.
        """
        img = Image.open(io.BytesIO(image_bytes))
        
        # Apply crop if provided
        if crop_params:
            try:
                x = float(crop_params.get('x', 0))
                y = float(crop_params.get('y', 0))
                w = float(crop_params.get('width', img.width))
                h = float(crop_params.get('height', img.height))
                img = img.crop((x, y, x + w, y + h))
            except Exception:
                pass

        # We need RGBA to support transparency for profiles and gradients
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        width, height = img.size

        # Task 3: Smooth Gradients (More transparent to see the image)
        self._draw_smooth_gradients(img, width, height)

        draw = ImageDraw.Draw(img, 'RGBA')

        # Task 2: Profile Line Drawing (Overlayed with padding)
        if profile_data:
            # Profile occupies bottom 35% but we leave 5% padding at the very bottom
            profile_area_height = height * 0.30
            y_offset = height - profile_area_height - (height * 0.05)
            self._draw_profile(draw, width, profile_area_height, y_offset, profile_data)

        # Task 3: Metadata Overlay
        self._draw_metadata(draw, dive, profile_data, width, height)

        # Task 4: Dynamic URL (Full URL)
        self._draw_url(img, width, height, full_url)
        
        # Convert back to RGB for JPEG saving
        final_img = img.convert('RGB')
        output = io.BytesIO()
        final_img.save(output, format="JPEG", quality=95)
        return output.getvalue()

    def _draw_smooth_gradients(self, img, width, height):
        """Draws semi-transparent black gradients. Reduced opacity for better visibility."""
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Top gradient (30% height, max alpha 140)
        top_grad_height = int(height * 0.3)
        for i in range(top_grad_height):
            alpha = int(140 * (1 - (i / top_grad_height)))
            draw.line([(0, i), (width, i)], fill=(0, 0, 0, alpha))
            
        # Bottom gradient (40% height, max alpha 160)
        bottom_grad_height = int(height * 0.4)
        for i in range(bottom_grad_height):
            # i goes from 0 to bottom_grad_height
            # we want alpha 0 at start of gradient (top) and 160 at end (bottom)
            alpha = int(160 * (i / bottom_grad_height))
            y = height - bottom_grad_height + i
            draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
            
        img.alpha_composite(overlay)

    def _draw_profile(self, draw, width, height, y_offset, profile_data):
        samples = profile_data.get('samples', [])
        if not samples:
            return
            
        try:
            parsed_samples = []
            for s in samples:
                t = self._parse_time(s.get('time'))
                d = self._parse_depth(s.get('depth'))
                if t is not None and d is not None:
                    parsed_samples.append({'time': t, 'depth': d})
            
            if not parsed_samples:
                return

            max_time = float(parsed_samples[-1]['time'])
            max_depth = max(float(s['depth']) for s in parsed_samples)
            if max_time <= 0: max_time = 1
            if max_depth <= 0: max_depth = 1
                
            points = []
            for s in parsed_samples:
                curr_time = float(s['time'])
                curr_depth = float(s['depth'])
                x = (curr_time / max_time) * width
                # 0 depth at y_offset, max depth at y_offset + height
                y = y_offset + ((curr_depth / max_depth) * height)
                points.append((x, y))
            
            # Area fill (Subtle blue overlay)
            fill_points = [(0, y_offset + height)] + points + [(width, y_offset + height)]
            draw.polygon(fill_points, fill=(59, 130, 246, 50))
            
            # Line Shadow (Soft dark line slightly offset)
            shadow_points = [(p[0] + 1.2, p[1] + 1.2) for p in points]
            draw.line(shadow_points, fill=(0, 0, 0, 100), width=5, joint="round")
            
            # Line (Vibrant White for maximum distinction)
            draw.line(points, fill=(255, 255, 255, 240), width=4, joint="round")
        except (ValueError, KeyError, IndexError):
            return

    def _get_font(self, size):
        if self.default_font_path:
            return ImageFont.truetype(self.default_font_path, size)
        return ImageFont.load_default()

    def _draw_metadata(self, draw, dive, profile_data, width, height):
        """Renders dive metadata at top and bottom."""
        padding = int(width * 0.04)
        aspect_ratio = width / height
        
        # --- Top Metadata ---
        # Site Name (Large, with slight shadow for pop)
        font_site = self._get_font(int(height * 0.06))
        site_name = dive.dive_site.name if dive.dive_site else "Unknown Site"
        draw.text((padding + 1, padding + 1), site_name, font=font_site, fill=(0, 0, 0, 100)) # shadow
        draw.text((padding, padding), site_name, font=font_site, fill=(255, 255, 255, 255))
        
        # Date
        font_sub = self._get_font(int(height * 0.035))
        dive_date = dive.dive_date.strftime("%d %b %Y") if hasattr(dive.dive_date, 'strftime') else str(dive.dive_date)
        y_pos = padding + int(height * 0.07)
        draw.text((padding, y_pos), dive_date, font=font_sub, fill=(220, 220, 220, 255))

        # --- Bottom Metadata (Overlaying profile) ---
        # Scale font down for narrow aspect ratios (Portrait 0.8, Story 0.56)
        metrics_multiplier = 0.026
        if aspect_ratio < 0.9: # Portrait or Story
            # Story (0.56) needs very small font to fit all metrics
            metrics_multiplier = 0.015 if aspect_ratio < 0.6 else 0.022
            
        font_metrics = self._get_font(int(height * metrics_multiplier))
        metrics = []
        
        # Duration
        if dive.duration:
            metrics.append(f"TIME: {dive.duration} min")
            
        # Max Depth
        if dive.max_depth:
            metrics.append(f"DEPTH: {float(dive.max_depth):.1f}m")
            
        # Avg Depth
        if dive.average_depth:
            metrics.append(f"AVG: {float(dive.average_depth):.1f}m")
            
        # Tanks
        if dive.gas_bottles_used:
            try:
                tanks_data = json.loads(dive.gas_bottles_used)
                if isinstance(tanks_data, list) and len(tanks_data) > 0:
                    tank_count = len(tanks_data)
                    metrics.append(f"TANKS: {tank_count}")
            except:
                pass
                
        # Temperature
        temp = None
        if profile_data and 'temperature_range' in profile_data:
            temp = profile_data['temperature_range'].get('min')
        if temp:
            metrics.append(f"TEMP: {temp}°C")
        
        metrics_str = "  |  ".join(metrics)
        metrics_y = height - padding - int(height * 0.03)
        # Draw metrics with a slight background glow for readability
        draw.text((padding, metrics_y), metrics_str, font=font_metrics, fill=(255, 255, 255, 255))

    def _draw_url(self, img, width, height, full_url):
        """Draws the full URL vertically along the right edge."""
        font_url = self._get_font(int(height * 0.022))
        url_text = full_url.replace("https://", "").replace("http://", "").upper()
        
        # Calculate text size
        left, top, right, bottom = font_url.getbbox(url_text)
        tw = right - left
        th = bottom - top
        
        # Create a transparent image for the text
        txt_img = Image.new('RGBA', (tw, th + 5), (0, 0, 0, 0))
        d = ImageDraw.Draw(txt_img)
        d.text((0, 0), url_text, font=font_url, fill=(255, 255, 255, 140))
        
        # Rotate 90 degrees counter-clockwise
        rotated_txt = txt_img.rotate(90, expand=True)
        
        # Position at right edge
        rw, rh = rotated_txt.size
        x = width - rw - int(width * 0.02)
        y = (height - rh) // 2
        
        img.alpha_composite(rotated_txt, (x, y))

    def _parse_time(self, time_val):
        """Robustly parse time value to minutes."""
        if time_val is None: return None
        if isinstance(time_val, (int, float)): return float(time_val)
        try:
            t_str = str(time_val).lower().replace('min', '').strip()
            if ':' in t_str:
                parts = t_str.split(':')
                if len(parts) == 2:
                    return int(parts[0]) + (int(parts[1]) / 60.0)
                elif len(parts) == 3:
                    return int(parts[0]) * 60 + int(parts[1]) + (int(parts[2]) / 60.0)
            return float(t_str)
        except: return None

    def _parse_depth(self, depth_val):
        """Robustly parse depth value to meters."""
        if depth_val is None: return None
        if isinstance(depth_val, (int, float)): return float(depth_val)
        try:
            d_str = str(depth_val).lower().replace('m', '').strip()
            return float(d_str)
        except: return None
