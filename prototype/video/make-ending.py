"""生成视频收尾图：黑底 + Insight Asset OS v1.0 + GitHub URL"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
img = Image.new('RGB', (W, H), (10, 14, 26))  # 深蓝黑底

# 加载字体
try:
    title_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 64)
    url_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 32)
    sub_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 24)
except Exception:
    title_font = ImageFont.load_default()
    url_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()

draw = ImageDraw.Draw(img)

# 标题
title = 'Insight Asset OS v1.0'
bbox = draw.textbbox((0, 0), title, font=title_font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((W - tw) / 2, H / 2 - 80), title, fill='white', font=title_font)

# 副标
sub = 'github.com/shadow-vincent/insight-os'
bbox = draw.textbbox((0, 0), sub, font=url_font)
sw, sh = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((W - sw) / 2, H / 2 + 20), sub, fill=(141, 160, 192), font=url_font)

# 副副标
tag = 'Free Download — macOS Desktop'
bbox = draw.textbbox((0, 0), tag, font=sub_font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((W - tw) / 2, H / 2 + 80), tag, fill=(100, 119, 163), font=sub_font)

img.save('/Users/vincent/Documents/insight-os/prototype/video/ending-source.png', 'PNG')
print('saved')
