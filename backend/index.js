const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');

const PORT = 3000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const SESSION_EXPIRY_MS = 12 * 60 * 60 * 1000;
const BASE64_IMAGE_PREFIX = /^data:image\/\w+;base64,/;

const log = {
  info: (msg) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`),
};

const templatesDir = path.join(__dirname, 'templates');
const configPath = path.join(templatesDir, 'config.json');
const baseUploadsDir = path.join(__dirname, 'uploads');

function initializeDirectories() {
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir);
  }
  if (!fs.existsSync(configPath)) {
    const defaultTemplates = [
      {
        id: 'strip-3',
        name: 'Classic Strip',
        image: 'strip.png',
        width: 600,
        height: 1800,
        slots: [
          { x: 50, y: 50, w: 500, h: 375 },
          { x: 50, y: 475, w: 500, h: 375 },
          { x: 50, y: 900, w: 500, h: 375 }
        ]
      },
      {
        id: 'grid-2x2',
        name: 'Square Grid',
        image: 'grid.png',
        width: 1200,
        height: 1200,
        slots: [
          { x: 50, y: 50, w: 525, h: 525 },
          { x: 625, y: 50, w: 525, h: 525 },
          { x: 50, y: 625, w: 525, h: 525 },
          { x: 625, y: 625, w: 525, h: 525 }
        ]
      }
    ];
    fs.writeFileSync(configPath, JSON.stringify(defaultTemplates, null, 2));
  }
  if (!fs.existsSync(baseUploadsDir)) {
    fs.mkdirSync(baseUploadsDir);
  }
}
initializeDirectories();

function handleGetFrames(req, res) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(config);
  } catch (error) {
    log.error(`handleGetFrames: ${error}`);
    res.status(500).json({ error: 'Failed to read templates' });
  }
}

async function handleSave(req, res) {
  try {
    let { images, gridFrame, frameType } = req.body;
    const videoFiles = req.files ? req.files.filter(f => f.fieldname === 'videos') : [];
    const fullVideoFile = req.files ? req.files.find(f => f.fieldname === 'fullVideo') : null;

    if (!images || (Array.isArray(images) && images.length === 0)) {
      return res.status(400).json({ error: 'images must be a non-empty array' });
    }
    if (!frameType || typeof frameType !== 'string') {
      return res.status(400).json({ error: 'frameType must be a non-empty string' });
    }
    
    if (!Array.isArray(images)) images = [images];

    const sessionDirName = `session_${Date.now()}`;
    const sessionDir = path.join(baseUploadsDir, sessionDirName);
    fs.mkdirSync(sessionDir, { recursive: true });

    const savedFiles = [];

    images.forEach((base64String, index) => {
      const base64Data = base64String.replace(BASE64_IMAGE_PREFIX, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `raw_photo_${index + 1}.jpg`; 
      fs.writeFileSync(path.join(sessionDir, filename), buffer);
      savedFiles.push(filename);
    });

    if (gridFrame) {
      const gridData = gridFrame.replace(BASE64_IMAGE_PREFIX, '');
      fs.writeFileSync(path.join(sessionDir, 'grid_frame.jpg'), Buffer.from(gridData, 'base64'));
      savedFiles.push('grid_frame.jpg');
    }

    const videoPaths = [];
    videoFiles.forEach((vFile, idx) => {
      const vPath = path.join(sessionDir, `raw_video_${idx + 1}.webm`);
      fs.writeFileSync(vPath, vFile.buffer);
      savedFiles.push(`raw_video_${idx + 1}.webm`);
      videoPaths.push(vPath);
    });

    if (fullVideoFile) {
      fs.writeFileSync(path.join(sessionDir, 'raw_video.webm'), fullVideoFile.buffer);
      savedFiles.push('raw_video.webm');
    }

    if (videoPaths.length > 0 && gridFrame) {
      const gridVideoPath = path.join(sessionDir, 'video_grid_frame.webm');
      const gridFramePath = path.join(sessionDir, 'grid_frame.jpg');

      log.info('Generating Dynamic FFMPEG video grid...');
      let command = ffmpeg().input(gridFramePath);
      videoPaths.forEach(vp => { command = command.input(vp); });

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const template = config.find(t => t.id === frameType);

      if (template) {
         const filterString = [];
         videoPaths.forEach((vp, idx) => {
            const slot = template.slots[idx];
            if (slot) {
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
            .on('end', () => log.info('Video grid successfully created: ' + gridVideoPath))
            .on('error', (err) => log.error('FFMPEG generation error: ' + err));
         
         savedFiles.push('video_grid_frame.webm');
      }
    }

    log.info(`Successfully saved session to ${sessionDirName} (${savedFiles.length} outputs).`);
    res.status(200).json({ message: 'Session saved successfully', files: savedFiles, session: sessionDirName });
  } catch (error) {
    log.error(`handleSave: ${error}`);
    res.status(500).json({ error: 'Failed to save session' });
  }
}

async function handleSaveTemplate(req, res) {
  try {
    const imageFile = req.file;
    if (!imageFile) return res.status(400).json({ error: 'Missing image' });
    
    if (!req.body.config) return res.status(400).json({ error: 'Missing config' });
    let configData;
    try {
      configData = JSON.parse(req.body.config);
    } catch (e) {
      log.error(`handleSaveTemplate parse: ${e}`);
      return res.status(400).json({ error: 'Config must be valid JSON' });
    }

    if (!configData.id || !configData.name || !Array.isArray(configData.slots)) {
       return res.status(400).json({ error: 'Config must contain id, name, and slots array' });
    }

    const filename = `template_${Date.now()}.png`;
    const imagePath = path.join(templatesDir, filename);
    fs.writeFileSync(imagePath, imageFile.buffer);

    configData.image = filename;

    let templatesArray = [];
    if (fs.existsSync(configPath)) {
      templatesArray = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    templatesArray = templatesArray.filter(t => t.id !== configData.id);
    templatesArray.push(configData);
    
    fs.writeFileSync(configPath, JSON.stringify(templatesArray, null, 2));
    log.info(`Custom Template ${configData.id} saved.`);
    res.status(200).json({ message: 'Template saved successfully' });
  } catch (error) {
    log.error(`handleSaveTemplate: ${error}`);
    res.status(500).json({ error: 'Failed to save template' });
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/templates', express.static(templatesDir));

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/frames', handleGetFrames);
app.post('/save', upload.any(), handleSave);
app.post('/api/templates', upload.single('image'), handleSaveTemplate);

app.listen(PORT, () => {
  log.info(`Backend server listening at http://localhost:${PORT}`);
});

setInterval(() => {
  const cutoff = Date.now() - SESSION_EXPIRY_MS;
  if (fs.existsSync(baseUploadsDir)) {
    const folders = fs.readdirSync(baseUploadsDir);
    for (const folder of folders) {
      if (folder.startsWith('session_')) {
        const folderPath = path.join(baseUploadsDir, folder);
        const stats = fs.statSync(folderPath);
        if (stats.mtimeMs < cutoff) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          log.info(`Deleted old session: ${folder}`);
        }
      }
    }
  }
}, CLEANUP_INTERVAL_MS);
