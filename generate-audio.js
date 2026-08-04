const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 读取故事点数据
const dataPath = path.join(__dirname, 'data', 'points.js');
const dataContent = fs.readFileSync(dataPath, 'utf-8');

// 去掉开头的 const GUIDE_DATA = 和结尾的 ;
const jsonContent = dataContent
  .replace(/^const\s+GUIDE_DATA\s*=\s*/, '')
  .replace(/;\s*$/, '');

const data = JSON.parse(jsonContent);
let points = data.points;

// 支持指定生成某些点：node generate-audio.js p14 p15 p17
const targetIds = process.argv.slice(2);
if (targetIds.length > 0) {
  points = points.filter(p => targetIds.includes(p.id));
}

const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// 使用美佳音色（用户指定的四个之一，macOS 自带）
const voice = 'Meijia';

console.log(`开始生成 ${points.length} 个故事点的音频文件...`);
console.log(`使用音色：${voice}`);

points.forEach((point, index) => {
  // 兼容新 cards 结构和旧单卡片结构
  const cards = point.cards && point.cards.length > 0 ? point.cards : [point];

  cards.forEach((card, cardIndex) => {
    const audioFile = card.audio || `${point.id}.mp3`;
    // 只处理本 point id 相关的音频文件，避免生成外部链接
    if (!audioFile.startsWith('audio/') && !audioFile.startsWith(point.id)) {
      return;
    }
    const text = `${card.title || point.title || ''}。${card.summary || point.summary || ''}。${card.story || point.story || ''}`;
    const mp3FileName = audioFile.replace(/^audio\//, '');
    const mp3Path = path.join(audioDir, mp3FileName);
    const aiffPath = path.join(audioDir, mp3FileName.replace(/\.mp3$/, '.aiff'));

    try {
      // 生成 AIFF
      execSync(`say -v "${voice}" ${JSON.stringify(text)} -o "${aiffPath}"`, {
        timeout: 60000
      });

      // 转换为 MP3
      execSync(`ffmpeg -y -i "${aiffPath}" -ar 22050 -ac 1 -b:a 48k "${mp3Path}"`, {
        timeout: 60000,
        stdio: 'ignore'
      });

      // 删除临时 AIFF
      fs.unlinkSync(aiffPath);

      const stats = fs.statSync(mp3Path);
      console.log(`[${index + 1}/${points.length} ${cardIndex + 1}/${cards.length}] ${point.id} ${card.title || point.title || ''} → ${mp3FileName} — ${(stats.size / 1024).toFixed(1)} KB`);
    } catch (err) {
      console.error(`生成失败: ${point.id} ${card.title || point.title || ''}`, err.message);
    }
  });
});

console.log('音频生成完成。');
console.log(`音频文件保存在: ${audioDir}`);
