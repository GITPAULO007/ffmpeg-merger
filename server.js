const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.send('FFmpeg Merger OK'));

app.post('/merge', async (req, res) => {
  const { videoUrl, audioBase64 } = req.body;

  if (!videoUrl || !audioBase64) {
    return res.status(400).json({ error: 'Faltan videoUrl o audioBase64' });
  }

  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
  const audioPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);

  try {
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

    fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-map 0:v:0',
          '-map 1:a:0',
          '-c:v copy',
          '-c:a aac',
          '-shortest'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outputBuffer = fs.readFileSync(outputPath);
    const outputBase64 = outputBuffer.toString('base64');

    [videoPath, audioPath, outputPath].forEach(f => {
      try { fs.unlinkSync(f); } catch(e) {}
    });

    res.json({ success: true, videoBase64: outputBase64 });

  } catch (error) {
    [videoPath, audioPath, outputPath].forEach(f => {
      try { fs.unlinkSync(f); } catch(e) {}
    });
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
