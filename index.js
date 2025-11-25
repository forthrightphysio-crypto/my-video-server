const express = require('express');
const { google } = require('googleapis');
const app = express();
const port = 3000;

// Load your service account JSON
const SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

app.get('/video/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const range = req.headers.range;

    try {
        const file = await drive.files.get({ fileId, fields: 'size, mimeType' });
        const fileSize = parseInt(file.data.size, 10);
        const contentType = file.data.mimeType;

        if (range) {
            // Parse range
            const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
            const start = Number(range.replace(/\D/g, ""));
            const end = Math.min(start + CHUNK_SIZE, fileSize - 1);

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
            });

            const stream = drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
            );

            stream.then(r => r.data.pipe(res)).catch(err => res.status(500).send(err.message));

        } else {
            // No range header, send the full file
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
            });

            const stream = drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            stream.then(r => r.data.pipe(res)).catch(err => res.status(500).send(err.message));
        }

    } catch (err) {
        console.error(err);
        res.status(500).send('Error streaming video');
    }
});

app.get('/health', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // allow all origins
    res.status(200).json({ status: 'OK', message: 'Project is live' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

