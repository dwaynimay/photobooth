const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// express.json is no longer the main payload handler for /save since we use multer
app.use(express.json({ limit: '50mb' }));

// Set up Multer (store files in memory so we can orchestrate the custom folder logic)
const upload = multer({ storage: multer.memoryStorage() });

// Ensure root uploads directory exists
const baseUploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(baseUploadsDir)) {
  fs.mkdirSync(baseUploadsDir);
}

// POST /save endpoint handles 'videos', 'images' array field, 'fullVideo' and 'gridFrame'
app.post('/save', upload.any(), (req, res) => {
  try {
    let images = req.body.images; // array of base64 photos
    let gridFrame = req.body.gridFrame; // the composited photo strip
    const frameType = req.body.frameType;
    const videoFiles = req.files ? req.files.filter(f => f.fieldname === 'videos') : [];
    const fullVideoFile = req.files ? req.files.find(f => f.fieldname === 'fullVideo') : null;

    if (!images) {
      return res.status(400).json({ error: 'Invalid payload: missing images' });
    }
    if (!Array.isArray(images)) {
      images = [images];
    }

    const sessionDirName = `session_${Date.now()}`;
    const sessionDir = path.join(baseUploadsDir, sessionDirName);
    fs.mkdirSync(sessionDir, { recursive: true });

    const savedFiles = [];

    // 1. Save Raw Images
    images.forEach((base64String, index) => {
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `raw_photo_${index + 1}.jpg`; 
      fs.writeFileSync(path.join(sessionDir, filename), buffer);
      savedFiles.push(filename);
    });

    // 2. Save Grid Frame Photo
    if (gridFrame) {
      const gridData = gridFrame.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(sessionDir, 'grid_frame.jpg'), Buffer.from(gridData, 'base64'));
      savedFiles.push('grid_frame.jpg');
    }

    // 3. Save Raw Videos
    const videoPaths = [];
    videoFiles.forEach((vFile, idx) => {
      const vPath = path.join(sessionDir, `raw_video_${idx + 1}.webm`);
      fs.writeFileSync(vPath, vFile.buffer);
      savedFiles.push(`raw_video_${idx + 1}.webm`);
      videoPaths.push(vPath);
    });

    // Save Full Video
    if (fullVideoFile) {
      fs.writeFileSync(path.join(sessionDir, 'raw_video.webm'), fullVideoFile.buffer);
      savedFiles.push('raw_video.webm');
    }

    // 4. Generate Video Grid Frame via FFMPEG
    if (videoPaths.length === 3 && gridFrame) {
      const ffmpeg = require('fluent-ffmpeg');
      const gridVideoPath = path.join(sessionDir, 'video_grid_frame.webm');
      const gridFramePath = path.join(sessionDir, 'grid_frame.jpg');

      console.log('Generating FFMPEG video grid...');
      ffmpeg()
        .input(gridFramePath) // [0:v]
        .input(videoPaths[0]) // [1:v]
        .input(videoPaths[1]) // [2:v]
        .input(videoPaths[2]) // [3:v]
        .complexFilter([
          // Max fit equivalent crop for 600x400
          "[1:v]scale='max(600,a*400)':'max(400,600/a)',crop=600:400[vid1]",
          "[2:v]scale='max(600,a*400)':'max(400,600/a)',crop=600:400[vid2]",
          "[3:v]scale='max(600,a*400)':'max(400,600/a)',crop=600:400[vid3]",
          "[0:v][vid1]overlay=40:120[tmp1]",
          "[tmp1][vid2]overlay=40:560[tmp2]",
          "[tmp2][vid3]overlay=40:1000[out]"
        ])
        .outputOptions(['-map [out]'])
        .save(gridVideoPath)
        .on('end', () => console.log('Video grid successfully created: ' + gridVideoPath))
        .on('error', (err) => console.error('FFMPEG generation error:', err));
      
      savedFiles.push('video_grid_frame.webm');
    }

    console.log(`Successfully saved session to ${sessionDirName} (${savedFiles.length} outputs).`);
    res.status(200).json({ message: 'Session saved successfully', files: savedFiles, session: sessionDirName });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening at http://localhost:${PORT}`);
});
