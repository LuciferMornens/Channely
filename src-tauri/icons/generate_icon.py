#!/usr/bin/env python3
"""Generate the Channely app icon - 1024x1024 PNG.

Design: A circular gradient (purple→blue) background with a stylized "C" 
that has sparkle/magic accents, conveying AI-powered text improvement.
"""

from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 1024
CENTER = SIZE // 2
RADIUS = SIZE // 2 - 40  # 472px radius, with 40px padding

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def draw_4point_star(draw, cx, cy, outer_r, inner_r, color, rotation=0):
    """Draw a 4-pointed star (sparkle)."""
    points = []
    for i in range(8):
        angle = rotation + i * math.pi / 4
        r = outer_r if i % 2 == 0 else inner_r
        px = cx + r * math.cos(angle - math.pi / 2)
        py = cy + r * math.sin(angle - math.pi / 2)
        points.append((px, py))
    draw.polygon(points, fill=color)

def create_icon():
    # --- 1. Circular gradient background ---
    color_top_left = (124, 58, 237)     # violet-600
    color_bottom_right = (59, 130, 246) # blue-500

    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    
    for y in range(SIZE):
        for x in range(SIZE):
            dx = x - CENTER
            dy = y - CENTER
            dist = math.sqrt(dx * dx + dy * dy)
            if dist > RADIUS + 1:
                continue
            
            t = (x / SIZE) * 0.6 + (y / SIZE) * 0.4
            t = max(0, min(1, t))
            color = lerp_color(color_top_left, color_bottom_right, t)
            
            # Anti-aliased edge
            if dist > RADIUS - 1:
                alpha = max(0, min(255, int(255 * (RADIUS + 1 - dist) / 2)))
            else:
                alpha = 255
            
            img.putpixel((x, y), color + (alpha,))

    # --- 2. Subtle highlight for depth ---
    overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    highlight_cx = CENTER - RADIUS * 0.35
    highlight_cy = CENTER - RADIUS * 0.35
    highlight_r = RADIUS * 0.8
    
    for y in range(SIZE):
        for x in range(SIZE):
            dx = x - CENTER
            dy = y - CENTER
            if math.sqrt(dx*dx + dy*dy) > RADIUS:
                continue
            hdx = x - highlight_cx
            hdy = y - highlight_cy
            highlight_dist = math.sqrt(hdx*hdx + hdy*hdy)
            if highlight_dist < highlight_r:
                t = 1 - (highlight_dist / highlight_r)
                alpha = int(35 * t * t)
                overlay.putpixel((x, y), (255, 255, 255, alpha))
    
    img = Image.alpha_composite(img, overlay)

    # --- 3. Draw "C" using filled shapes (no line artifacts) ---
    c_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(c_layer)
    
    c_cx, c_cy = CENTER - 20, CENTER + 10
    c_outer_r = int(RADIUS * 0.55)   # 260
    c_inner_r = int(RADIUS * 0.33)   # 156
    
    # Draw filled outer circle
    c_draw.ellipse(
        [c_cx - c_outer_r, c_cy - c_outer_r, c_cx + c_outer_r, c_cy + c_outer_r],
        fill=(255, 255, 255, 240)
    )
    # Cut out inner circle (donut shape)
    c_draw.ellipse(
        [c_cx - c_inner_r, c_cy - c_inner_r, c_cx + c_inner_r, c_cy + c_inner_r],
        fill=(0, 0, 0, 0)
    )
    
    # Cut out a wedge on the right to make it a "C"
    # Opening from -50° to +50° (right side)
    # We'll draw a triangle/polygon that covers the opening
    wedge_angle_top = math.radians(-50)
    wedge_angle_bot = math.radians(50)
    wedge_reach = c_outer_r + 20  # extend past the circle
    
    wedge_points = [
        (c_cx, c_cy),  # center
        (c_cx + wedge_reach * math.cos(wedge_angle_top), c_cy + wedge_reach * math.sin(wedge_angle_top)),
        (c_cx + wedge_reach * 1.2, c_cy),  # far right middle
        (c_cx + wedge_reach * math.cos(wedge_angle_bot), c_cy + wedge_reach * math.sin(wedge_angle_bot)),
    ]
    c_draw.polygon(wedge_points, fill=(0, 0, 0, 0))
    
    # Add rounded caps at the C endpoints
    cap_r = (c_outer_r - c_inner_r) // 2  # half the stroke width
    mid_r = (c_outer_r + c_inner_r) / 2   # midline radius
    
    for angle_deg in [-50, 50]:
        angle_rad = math.radians(angle_deg)
        cap_x = c_cx + mid_r * math.cos(angle_rad)
        cap_y = c_cy + mid_r * math.sin(angle_rad)
        c_draw.ellipse(
            [cap_x - cap_r, cap_y - cap_r, cap_x + cap_r, cap_y + cap_r],
            fill=(255, 255, 255, 240)
        )
    
    img = Image.alpha_composite(img, c_layer)

    # --- 4. Sparkle / magic stars ---
    sparkle_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(sparkle_layer)
    
    # Main sparkle - near the top-right opening of the C
    spark_x = c_cx + mid_r * 0.95
    spark_y = c_cy - mid_r * 0.85
    draw_4point_star(s_draw, spark_x, spark_y,
                     outer_r=70, inner_r=17,
                     color=(255, 255, 255, 255), rotation=math.radians(15))
    
    # Medium sparkle - right side
    spark2_x = c_cx + mid_r * 1.35
    spark2_y = c_cy - mid_r * 0.25
    draw_4point_star(s_draw, spark2_x, spark2_y,
                     outer_r=40, inner_r=10,
                     color=(255, 255, 255, 235), rotation=math.radians(0))
    
    # Small sparkle - top
    spark3_x = c_cx + mid_r * 0.5
    spark3_y = c_cy - mid_r * 1.25
    draw_4point_star(s_draw, spark3_x, spark3_y,
                     outer_r=24, inner_r=6,
                     color=(255, 255, 255, 215), rotation=math.radians(10))
    
    # Tiny dot accents
    dots = [
        (c_cx + mid_r * 1.15, c_cy - mid_r * 1.05, 8),
        (c_cx + mid_r * 1.45, c_cy - mid_r * 0.65, 6),
        (c_cx + mid_r * 0.25, c_cy - mid_r * 1.35, 5),
    ]
    for dx, dy, r in dots:
        s_draw.ellipse([dx - r, dy - r, dx + r, dy + r], fill=(255, 255, 255, 185))
    
    img = Image.alpha_composite(img, sparkle_layer)

    # --- 5. Subtle drop shadow ---
    shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        [CENTER - RADIUS + 2, CENTER - RADIUS + 6,
         CENTER + RADIUS + 2, CENTER + RADIUS + 6],
        fill=(0, 0, 0, 30)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
    
    final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    final = Image.alpha_composite(final, shadow)
    final = Image.alpha_composite(final, img)
    
    output_path = '/Volumes/ExternalSSD/channely/src-tauri/icons/source-1024.png'
    final.save(output_path, 'PNG')
    print(f"Icon saved to {output_path}")
    print(f"Size: {final.size}")

if __name__ == '__main__':
    create_icon()
