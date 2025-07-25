const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const JSZip = require('jszip');

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });
fs.mkdir('uploads', { recursive: true }).catch(console.error);

// --- API Endpoint for Processing PDFs ---
app.post('/api/process-pdf', upload.array('pdfFiles', 10), async (req, res) => {
    const tool = req.body.tool;
    console.log(`Processing request for tool: ${tool}`);

    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    try {
        let responseBytes;
        let responseFilename = 'processed.pdf';
        let responseContentType = 'application/pdf';

        // --- PDF Processing Logic ---
        switch (tool) {
            case 'Compress PDF':
                const compressBytes = await fs.readFile(req.files[0].path);
                const compressDoc = await PDFDocument.load(compressBytes);
                responseBytes = await compressDoc.save();
                console.log('Applying basic re-save "compression"...');
                break;

            case 'Merge PDF':
                const mergedPdf = await PDFDocument.create();
                for (const file of req.files) {
                    const pdfBytes = await fs.readFile(file.path);
                    const pdfDoc = await PDFDocument.load(pdfBytes);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                responseBytes = await mergedPdf.save();
                console.log('Merging multiple PDFs...');
                break;
            
            case 'Split PDF':
                const splitBytes = await fs.readFile(req.files[0].path);
                const splitDoc = await PDFDocument.load(splitBytes);
                const pageCount = splitDoc.getPageCount();

                if (pageCount <= 1) {
                    // Agar sirf ek page hai, to error bhej dein
                    throw new Error("Cannot split a PDF with only one page. Please upload a multi-page document.");
                }

                console.log(`PDF has ${pageCount} pages. Creating ZIP file...`);
                const zip = new JSZip();
                for (let i = 0; i < pageCount; i++) {
                    const newDoc = await PDFDocument.create();
                    const [copiedPage] = await newDoc.copyPages(splitDoc, [i]);
                    newDoc.addPage(copiedPage);
                    const singlePageBytes = await newDoc.save();
                    zip.file(`page_${i + 1}.pdf`, singlePageBytes);
                }

                responseBytes = await zip.generateAsync({ type: 'nodebuffer' });
                responseFilename = 'split_pages.zip';
                responseContentType = 'application/zip';
                break;

            case 'Rotate PDF':
                const rotateBytes = await fs.readFile(req.files[0].path);
                const rotateDoc = await PDFDocument.load(rotateBytes);
                const pages = rotateDoc.getPages();
                pages.forEach(page => {
                    page.setRotation(page.getRotation().angle + 90);
                });
                responseBytes = await rotateDoc.save();
                console.log('Rotating PDF by 90 degrees...');
                break;
            
            case 'Protect PDF':
                const protectBytes = await fs.readFile(req.files[0].path);
                const protectDoc = await PDFDocument.load(protectBytes);
                protectDoc.setTitle('Protected Document');
                protectDoc.setAuthor('PDF-Tool');
                responseBytes = await protectDoc.save();
                console.log('Protecting PDF by changing metadata...');
                break;

            case 'Edit PDF': 
                const editBytes = await fs.readFile(req.files[0].path);
                const editDoc = await PDFDocument.load(editBytes);
                const helveticaFont = await editDoc.embedFont(StandardFonts.Helvetica);
                const editPages = editDoc.getPages();
                editPages.forEach(page => {
                    page.drawText('Edited by PDF-Tool', {
                        x: page.getWidth() / 2 - 100,
                        y: page.getHeight() / 2,
                        font: helveticaFont,
                        size: 50,
                        color: rgb(0.95, 0.1, 0.1),
                        opacity: 0.5,
                    });
                });
                responseBytes = await editDoc.save();
                console.log('Editing PDF: adding watermark...');
                break;

            // Placeholder cases for advanced tools
            default:
                console.log(`Tool '${tool}' not implemented or requires advanced libraries. Returning original file.`);
                responseBytes = await fs.readFile(req.files[0].path);
                break;
        }

        // --- Send the Result Back ---
        res.setHeader('Content-Type', responseContentType);
        res.setHeader('Content-Disposition', `attachment; filename=${responseFilename}`);
        res.send(responseBytes);

    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).send(`An error occurred: ${error.message}`);
    } finally {
        if (req.files) {
            for (const file of req.files) {
                await fs.unlink(file.path).catch(err => console.error("Error deleting temp file:", err));
            }
        }
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running successfully on http://localhost:${PORT}`);
    console.log("📂 Serving frontend from the 'public' directory.");
    console.log("🚀 Open http://localhost:3000 in your browser to use the app.");
});