const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller?.path || ffmpegInstaller;

const app = express();
const PORT = 3001;

const uploadDir = path.join(__dirname, 'tmp_uploads');
const outputDir = path.join(__dirname, 'tmp_outputs');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file
let envPrepared = false;

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

function ensureFfmpeg() {
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
        const error = new Error('未能加载 ffmpeg，可运行 npm install 重新安装依赖。');
        error.code = 'FFMPEG_NOT_FOUND';
        throw error;
    }
}

async function prepareEnvironment() {
    if (envPrepared) return;
    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });
    envPrepared = true;
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, args, { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        proc.once('error', reject);
        proc.once('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
            }
        });
    });
}

async function cleanup(paths) {
    await Promise.all(paths.map(async (target) => {
        if (!target) return;
        try {
            await fs.promises.unlink(target);
        } catch (err) {
            // ignore
        }
    }));
}

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'music_express 已启动，端口 3001。'
    });
});

app.post('/convert/m4a-to-mp3', async (req, res) => {
    try {
        ensureFfmpeg();
        await prepareEnvironment();

        const { fileName, fileData } = req.body || {};
        if (!fileName || !fileData) {
            return res.status(400).json({ success: false, message: '缺少文件名或文件数据。' });
        }

        const ext = path.extname(fileName).toLowerCase();
        if (ext !== '.m4a') {
            return res.status(400).json({ success: false, message: '请选择扩展名为 .m4a 的文件。' });
        }

        const payload = fileData.includes(',') ? fileData.split(',').pop() : fileData;
        let buffer;
        try {
            buffer = Buffer.from(payload, 'base64');
        } catch {
            return res.status(400).json({ success: false, message: '文件数据不是有效的 Base64 编码。' });
        }

        if (!buffer.length) {
            return res.status(400).json({ success: false, message: '无法解析上传的文件内容。' });
        }
        if (buffer.length > MAX_FILE_SIZE) {
            return res.status(400).json({ success: false, message: '文件超过 100MB，无法处理。' });
        }

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const inputPath = path.join(uploadDir, `${uniqueId}.m4a`);
        const outputPath = path.join(outputDir, `${uniqueId}.mp3`);

        await fs.promises.writeFile(inputPath, buffer);

        try {
            await runFfmpeg(['-y', '-i', inputPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', outputPath]);
        } catch (err) {
            await cleanup([inputPath, outputPath]);
            return res.status(500).json({ success: false, message: 'FFmpeg 转换失败。', detail: err.message });
        }

        const mp3Buffer = await fs.promises.readFile(outputPath);
        await cleanup([inputPath, outputPath]);

        const safeName = (path.basename(fileName, ext).replace(/[^a-zA-Z0-9_\-]/g, '_') || 'audio') + '.mp3';
        return res.json({
            success: true,
            message: '转换成功！',
            fileName: safeName,
            fileData: mp3Buffer.toString('base64')
        });
    } catch (error) {
        console.error('单文件转换失败', error);
        return res.status(500).json({
            success: false,
            message: error.code === 'FFMPEG_NOT_FOUND' ? error.message : '服务器内部错误，请稍后重试。',
            detail: error.message
        });
    }
});

app.post('/convert/ogg-to-mp3', async (req, res) => {
    try {
        ensureFfmpeg();
        await prepareEnvironment();

        const { fileName, fileData } = req.body || {};
        if (!fileName || !fileData) {
            return res.status(400).json({ success: false, message: '缺少文件名或文件数据。' });
        }

        const ext = path.extname(fileName).toLowerCase();
        if (ext !== '.ogg') {
            return res.status(400).json({ success: false, message: '请选择扩展名为 .ogg 的文件。' });
        }

        const payload = fileData.includes(',') ? fileData.split(',').pop() : fileData;
        let buffer;
        try {
            buffer = Buffer.from(payload, 'base64');
        } catch {
            return res.status(400).json({ success: false, message: '文件数据不是有效的 Base64 编码。' });
        }

        if (!buffer.length) {
            return res.status(400).json({ success: false, message: '无法解析上传的文件内容。' });
        }
        if (buffer.length > MAX_FILE_SIZE) {
            return res.status(400).json({ success: false, message: '文件超过 100MB，无法处理。' });
        }

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const inputPath = path.join(uploadDir, `${uniqueId}.ogg`);
        const outputPath = path.join(outputDir, `${uniqueId}.mp3`);

        await fs.promises.writeFile(inputPath, buffer);

        try {
            await runFfmpeg(['-y', '-i', inputPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', outputPath]);
        } catch (err) {
            await cleanup([inputPath, outputPath]);
            return res.status(500).json({ success: false, message: 'FFmpeg 转换失败。', detail: err.message });
        }

        const mp3Buffer = await fs.promises.readFile(outputPath);
        await cleanup([inputPath, outputPath]);

        const safeName = (path.basename(fileName, ext).replace(/[^a-zA-Z0-9_\-]/g, '_') || 'audio') + '.mp3';
        return res.json({
            success: true,
            message: '转换成功！',
            fileName: safeName,
            fileData: mp3Buffer.toString('base64')
        });
    } catch (error) {
        console.error('OGG 转换失败', error);
        return res.status(500).json({
            success: false,
            message: error.code === 'FFMPEG_NOT_FOUND' ? error.message : '服务器内部错误，请稍后重试。',
            detail: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`music_express server running on http://localhost:${PORT}`);
});
