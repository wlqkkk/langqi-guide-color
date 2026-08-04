import json
import re
import subprocess
import os
import sys
from pathlib import Path

# 读取故事点数据
data_path = Path(__file__).parent / 'data' / 'points.js'
content = data_path.read_text(encoding='utf-8')

# 去掉开头的 const GUIDE_DATA = 和结尾的 ;
json_content = re.sub(r'^const\s+GUIDE_DATA\s*=\s*', '', content).strip()
if json_content.endswith(';'):
    json_content = json_content[:-1]

data = json.loads(json_content)
points = data['points']

# 支持指定生成某些点：python generate-edge-tts.py p14 p15
target_ids = sys.argv[1:]
if target_ids:
    points = [p for p in points if p['id'] in target_ids]

# 输出目录
audio_dir = Path(__file__).parent / 'audio'
audio_dir.mkdir(exist_ok=True)

# 音色选择
# 推荐：zh-CN-XiaoxiaoNeural（晓晓，女声，自然）
# 其他可选：zh-CN-XiaoyiNeural, zh-CN-YunjianNeural, zh-CN-YunxiNeural, zh-CN-YunyangNeural
VOICE = 'zh-CN-XiaoxiaoNeural'

total_cards = sum(len(p.get('cards', [p])) for p in points)
print(f'开始用 edge-tts 音色 {VOICE} 生成 {total_cards} 个卡片音频...')

count = 0
for idx, point in enumerate(points, 1):
    cards = point.get('cards') if point.get('cards') else [point]

    for card_index, card in enumerate(cards, 1):
        audio_file = card.get('audio') or f"{point['id']}.mp3"
        # 只处理本 point id 相关的音频文件
        if not (audio_file.startswith('audio/') or audio_file.startswith(point['id'])):
            continue
        output_file_name = audio_file.replace('audio/', '')
        output_file = audio_dir / output_file_name

        title = card.get('title') or point.get('title', '')
        summary = card.get('summary') or point.get('summary', '')
        story = card.get('story') or point.get('story', '')
        text = f"{title}。{summary}。{story}"

        count += 1
        try:
            # 先用 edge-tts 生成临时 MP3
            temp_file = audio_dir / f'_tmp_{output_file_name}'
            subprocess.run(
                ['edge-tts', '--voice', VOICE, '--text', text, '--write-media', str(temp_file)],
                check=True,
                timeout=120,
                capture_output=True
            )

            # 用 ffmpeg 重新编码，加入 seek 支持
            subprocess.run(
                ['ffmpeg', '-y', '-i', str(temp_file), '-codec:a', 'libmp3lame', '-q:a', '4', '-ar', '24000', '-ac', '1', str(output_file)],
                check=True,
                timeout=60,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            # 删除临时文件
            temp_file.unlink(missing_ok=True)

            size_kb = output_file.stat().st_size / 1024
            print(f'[{count}/{total_cards}] {point["id"]} {title} → {output_file_name} — {size_kb:.1f} KB')
        except subprocess.CalledProcessError as e:
            print(f'生成失败: {point["id"]} {title}')
            print(e.stderr.decode('utf-8', errors='ignore') if e.stderr else '')
        except Exception as e:
            print(f'生成失败: {point["id"]} {title} — {e}')

print('音频生成完成。')
print(f'文件保存在: {audio_dir}')
print(f'当前音色: {VOICE}')
print('')
print('如需更换音色，修改脚本中的 VOICE 变量后重新运行。')
