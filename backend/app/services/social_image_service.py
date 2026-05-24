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

        # Task 2: Profile Line Drawing (Overlayed with padding)
        if profile_data:
            # Profile area starts immediately after the axis line (2% padding)
            profile_x_start = width * 0.02
            profile_area_width = width - profile_x_start - (width * 0.02) # 2% right margin
            profile_area_height = height * 0.28
            # Move profile down to sit halfway between previous position and metrics row (9% bottom margin)
            y_offset = height - profile_area_height - (height * 0.09)
            self._draw_profile(img, profile_area_width, profile_area_height, y_offset, profile_x_start, profile_data)

        # We need a new draw object if alpha_composite was used
        draw = ImageDraw.Draw(img, 'RGBA')

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
            alpha = int(160 * (i / bottom_grad_height))
            y = height - bottom_grad_height + i
            draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
            
        img.alpha_composite(overlay)

    def _draw_profile(self, img, width, height, y_offset, x_offset, profile_data):
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
                x = x_offset + (curr_time / max_time) * width
                # 0 depth at y_offset, max depth at y_offset + height
                y = y_offset + ((curr_depth / max_depth) * height)
                points.append((x, y))
            
            # --- 1. Area fill with Gradient ---
            # Create a dedicated layer for the profile fill
            bottom_y = y_offset + height
            fill_points = [(x_offset, bottom_y)] + points + [(x_offset + width, bottom_y)]
            
            # Create mask from the polygon
            mask = Image.new('L', img.size, 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.polygon(fill_points, fill=255)
            
            # Create gradient layer
            grad_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            grad_draw = ImageDraw.Draw(grad_layer)
            
            for y in range(int(y_offset), int(bottom_y + 1)):
                if y >= img.height: continue
                # rel_y: 0 at top, 1 at bottom
                rel_y = (y - y_offset) / height
                # Gradient: subtle blue fade (15 to 85 alpha)
                alpha = int(15 + (70 * rel_y))
                grad_draw.line([(0, y), (img.width, y)], fill=(59, 130, 246, alpha))
            
            # Composite the masked gradient onto the main image
            final_fill = Image.new('RGBA', img.size, (0, 0, 0, 0))
            final_fill.paste(grad_layer, (0, 0), mask=mask)
            img.alpha_composite(final_fill)
            
            # --- 2. Draw depth axis (Overlayed) ---
            draw = ImageDraw.Draw(img, 'RGBA')
            self._draw_depth_axis(draw, x_offset, y_offset, height, max_depth)
            
            # --- 3. Draw lines on top ---
            # Line Shadow (Soft dark line slightly offset)
            shadow_points = [(p[0] + 1.2, p[1] + 1.2) for p in points]
            draw.line(shadow_points, fill=(0, 0, 0, 100), width=5, joint="round")
            
            # Line (Vibrant White for maximum distinction)
            draw.line(points, fill=(255, 255, 255, 240), width=4, joint="round")
        except (ValueError, KeyError, IndexError):
            return

    def _draw_depth_axis(self, draw, x_offset, y_offset, height, max_depth):
        """Draws a vertical depth axis on the left with overlaid labels."""
        # Axis line - sitting directly at the start of the profile
        line_x = x_offset
        draw.line([(line_x, y_offset), (line_x, y_offset + height)], fill=(255, 255, 255, 100), width=1)
        
        font_axis = self._get_font(int(height * 0.09))
        
        # Ticks and labels (0m and Max Depth) to the RIGHT of the line, OVERLAYING the profile
        text_x = line_x + 5
        
        # 0m label
        draw.text((text_x, y_offset), "0m", font=font_axis, fill=(255, 255, 255, 200), anchor="lt")
        
        # Max Depth label
        max_depth_str = f"{float(max_depth):.0f}m"
        draw.text((text_x, y_offset + height), max_depth_str, font=font_axis, fill=(255, 255, 255, 200), anchor="ls")

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
        # Move higher than center to avoid overlap with profile line
        y = (height - rh) // 2 - int(height * 0.08)
        
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
