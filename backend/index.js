const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Seed Templates
const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir);
}
const configPath = path.join(templatesDir, 'config.json');
if (!fs.existsSync(configPath)) {
  const defaultTemplates = [
    {
      "id": "strip-3",
      "name": "Classic Strip",
      "image": "strip.png",
      "width": 600,
      "height": 1800,
      "slots": [
        {"x": 50, "y": 50, "w": 500, "h": 375},
        {"x": 50, "y": 475, "w": 500, "h": 375},
        {"x": 50, "y": 900, "w": 500, "h": 375}
      ]
    },
    {
      "id": "grid-2x2",
      "name": "Square Grid",
      "image": "grid.png",
      "width": 1200,
      "height": 1200,
      "slots": [
        {"x": 50, "y": 50, "w": 525, "h": 525},
        {"x": 625, "y": 50, "w": 525, "h": 525},
        {"x": 50, "y": 625, "w": 525, "h": 525},
        {"x": 625, "y": 625, "w": 525, "h": 525}
      ]
    }
  ];
  fs.writeFileSync(configPath, JSON.stringify(defaultTemplates, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/templates', express.static(templatesDir));

app.get('/api/frames', (req, res) => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json(config);
});

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
    if (videoPaths.length > 0 && gridFrame) {
      const ffmpeg = require('fluent-ffmpeg');
      const gridVideoPath = path.join(sessionDir, 'video_grid_frame.webm');
      const gridFramePath = path.join(sessionDir, 'grid_frame.jpg');

      console.log('Generating Dynamic FFMPEG video grid...');
      let command = ffmpeg().input(gridFramePath); // [0:v]
      videoPaths.forEach(vp => {
        command = command.input(vp); // [1:v], [2:v], ...
      });

      const configPathLocal = path.join(__dirname, 'templates', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPathLocal, 'utf8'));
      const template = config.find(t => t.id === frameType);

      if (template) {
         let filterString = [];
         
         videoPaths.forEach((vp, idx) => {
            const slot = template.slots[idx];
            if (slot) {
               // max(W,a*H):max(H,W/a),crop=W:H
               filterString.push(`[${idx+1}:v]scale='max(${slot.w},a*${slot.h})':'max(${slot.h},${slot.w}/a)',crop=${slot.w}:${slot.h}[vid${idx+1}]`);
            }
         });
         
         let lastOverlay = '[0:v]';
         videoPaths.forEach((vp, idx) => {
            const slot = template.slots[idx];
            if (slot) {
               const nextTarget = (idx === videoPaths.length - 1) ? '[out]' : `[tmp${idx+1}]`;
               filterString.push(`${lastOverlay}[vid${idx+1}]overlay=${slot.x}:${slot.y}${nextTarget}`);
               lastOverlay = `[tmp${idx+1}]`;
            }
         });

         command.complexFilter(filterString)
            .outputOptions(['-map [out]'])
            .save(gridVideoPath)
            .on('end', () => console.log('Video grid successfully created: ' + gridVideoPath))
            .on('error', (err) => console.error('FFMPEG generation error:', err));
         
         savedFiles.push('video_grid_frame.webm');
      }
    }

    console.log(`Successfully saved session to ${sessionDirName} (${savedFiles.length} outputs).`);
    res.status(200).json({ message: 'Session saved successfully', files: savedFiles, session: sessionDirName });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.post('/api/templates', upload.single('image'), (req, res) => {
  try {
    const configData = JSON.parse(req.body.config);
    const imageFile = req.file;

    if (!imageFile || !configData) {
      return res.status(400).json({ error: 'Missing image or config' });
    }

    const filename = `template_${Date.now()}.png`;
    const imagePath = path.join(__dirname, 'templates', filename);
    fs.writeFileSync(imagePath, imageFile.buffer);

    configData.image = filename;

    const templatesConfPath = path.join(__dirname, 'templates', 'config.json');
    let templatesArray = [];
    if (fs.existsSync(templatesConfPath)) {
      templatesArray = JSON.parse(fs.readFileSync(templatesConfPath, 'utf8'));
    }
    
    // Remove if existing ID matched (overwrite feature)
    templatesArray = templatesArray.filter(t => t.id !== configData.id);
    templatesArray.push(configData);
    
    fs.writeFileSync(templatesConfPath, JSON.stringify(templatesArray, null, 2));
    console.log(`[Admin] Custom Template ${configData.id} saved.`);
    res.status(200).json({ message: 'Template saved successfully' });
  } catch (error) {
    console.error('Template save error:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening at http://localhost:${PORT}`);
});

// Cleanup routines checking 12-hour expiration mapped onto target uploads folder
setInterval(() => {
  const cutoff = Date.now() - (12 * 60 * 60 * 1000); // 12 hours
  if (fs.existsSync(baseUploadsDir)) {
    const folders = fs.readdirSync(baseUploadsDir);
    for (const folder of folders) {
      if (folder.startsWith('session_')) {
        const folderPath = path.join(baseUploadsDir, folder);
        const stats = fs.statSync(folderPath);
        if (stats.mtimeMs < cutoff) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`[Cleanup] Deleted old session: ${folder}`);
        }
      }
    }
  }
}, 60 * 10 * 1000); // run every 10 minutes to verify
