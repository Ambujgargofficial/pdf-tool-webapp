// server.js - The Backend "Engine"

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// --- Middleware ---
// Enable CORS for all routes, allowing your frontend to communicate with this server
app.use(cors());

// Serve static files (your index.html, css, js) from the 'public' directory
app.use(express.static('public'));

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });
// Ensure the 'uploads' directory exists
fs.mkdir('uploads', { recursive: true }).catch(console.error);


// --- API Endpoint for Processing PDFs ---
// This is the URL your frontend will send the file to
app.post('/api/process-pdf', upload.single('pdfFile'), async (req, res) => {
    // The 'tool' comes from the frontend form data
    const tool = req.body.tool; 
    console.log(`Processing request for tool: ${tool}`);

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;

    try {
        const existingPdfBytes = await fs.readFile(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        let modifiedPdfBytes;

        // --- PDF Processing Logic ---
        // This is where you would add cases for each tool
        switch (tool) {
            case 'Compress PDF':
                // Note: pdf-lib doesn't have true compression. Re-saving can sometimes reduce size.
                // For real compression, a tool like Ghostscript would be needed on the server.
                console.log('Applying basic re-save "compression"...');
                modifiedPdfBytes = await pdfDoc.save();
                break;
            
            case 'Split PDF':
                // Example: Return only the first page
                console.log('Splitting PDF: returning first page...');
                const newDoc = await PDFDocument.create();
                const [firstPage] = await newDoc.copyPages(pdfDoc, [0]);
                newDoc.addPage(firstPage);
                modifiedPdfBytes = await newDoc.save();
                break;

            // Add other cases for 'Merge PDF', 'Rotate PDF', etc. here
            
            default:
                // If no tool matches, just return the original file
                console.log(`Tool '${tool}' not implemented, returning original.`);
                modifiedPdfBytes = await pdfDoc.save();
                break;
        }

        // --- Send the Result Back ---
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=processed_${req.file.originalname}`);
        res.send(Buffer.from(modifiedPdfBytes));

    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).send('An error occurred while processing the PDF.');
    } finally {
        // --- Clean Up ---
        // Delete the temporary file from the 'uploads' folder
        await fs.unlink(filePath);
    }
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running successfully on http://localhost:${PORT}`);
    console.log("📂 Serving frontend from the 'public' directory.");
    console.log("🚀 Open http://localhost:3000 in your browser to use the app.");
});