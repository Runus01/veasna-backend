const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const ExcelJS = require('exceljs');
const { authenticateToken } = require('./auth');

// GET /api/export/referrals-by-date?date=YYYY-MM-DD&format=...
router.get('/referrals-by-date', authenticateToken, async (req, res) => {
    const { date, format } = req.query; // Expects a date and format

    if (!date) {
        return res.status(400).json({ error: 'A visit date is required.' });
    }

    try {
        const query = `
            SELECT 
                r.referral_date, r.referral_type, r.illness, r.duration, r.reason,
                p.english_name, p.date_of_birth, p.sex,
                v.queue_no
            FROM referral r
            JOIN visits v ON r.visit_id = v.id
            JOIN patients p ON v.patient_id = p.id
            WHERE v.visit_date = $1
            ORDER BY p.english_name, v.created_at;
        `;
        const { rows: referrals } = await db.query(query, [date]);

        if (referrals.length === 0) {
            return res.status(404).json({ error: `No referrals found for date: ${date}` });
        }

        const formattedDate = new Date(date).toLocaleDateString();

        if (format === 'pdf') {
            // --- PDF Generation (one patient per page) ---
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            for (const referral of referrals) {
                const page = pdfDoc.addPage();
                const { height } = page.getSize();
                const marginLeft = 50;
                let y = height - 70;
            
                const calculateAge = dob => {
                    const birthDate = new Date(dob);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    return age;
                };
            
                const lineHeight = 18;
            
                // Title
                page.drawText('Referral Letter', { x: marginLeft, y, font: boldFont, size: 20 });
                y -= 40;
            
                // Date
                page.drawText(`Date: ${new Date(referral.referral_date).toLocaleDateString()}`, { x: marginLeft, y, font, size: 12 });
                y -= 40;
            
                // Greeting
                page.drawText('To whom it may concern,', { x: marginLeft, y, font, size: 12 });
                y -= 40;
            
                // Patient details
                const age = calculateAge(referral.date_of_birth);
                const patientLines = [
                    `Patient Name: ${referral.english_name}`,
                    `Gender: ${referral.sex}`,
                    `Age: ${age}`,
                    `Address: ${referral.address || 'N/A'}`
                ];
                for (const line of patientLines) {
                    page.drawText(line, { x: marginLeft, y, font, size: 12 });
                    y -= lineHeight;
                }
            
                y -= 30;
            
                // Illness paragraph
                page.drawText(
                    `The patient above has been suffering from ${referral.illness} for ${referral.duration}.`,
                    { x: marginLeft, y, font, size: 12 }
                );
                y -= 40;
            
                // Reason paragraph (wrap text)
                const reason = `Reason for referral:\n${referral.reason}`;
                const wrappedReason = reason.split('\n');
                for (const line of wrappedReason) {
                    page.drawText(line, { x: marginLeft, y, font, size: 12 });
                    y -= lineHeight;
                }
            
                y -= 40;
            
                // Closing
                page.drawText('Thank you.', { x: marginLeft, y, font, size: 12 });
                y -= 30;
            
                // Signature
                page.drawText(`${referral.username || 'Referring Doctor'}`, { x: marginLeft, y, font: boldFont, size: 12 });
            }
            

            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Referrals_${date}.pdf"`);
            res.send(Buffer.from(pdfBytes));

        } else if (format === 'excel') {
            // --- Excel Generation ---
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Referrals for ${formattedDate}`);

            worksheet.columns = [
                { header: 'Patient Name', key: 'patient_name', width: 25 },
                { header: 'Queue No.', key: 'queue_no', width: 15 },
                { header: 'Referral Date', key: 'referral_date', width: 15 },
                { header: 'Referral Type', key: 'referral_type', width: 20 },
                { header: 'Illness', key: 'illness', width: 25 },
                { header: 'Duration', key: 'duration', width: 20 },
                { header: 'Reason', key: 'reason', width: 50 },
            ];

            referrals.forEach(r => {
                worksheet.addRow({
                    patient_name: r.english_name,
                    queue_no: r.queue_no,
                    referral_date: new Date(r.referral_date),
                    referral_type: r.referral_type,
                    illness: r.illness,
                    duration: r.duration,
                    reason: r.reason,
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Referrals_${date}.xlsx"`);
            await workbook.xlsx.write(res);
            res.end();

        } else {
            res.status(400).json({ error: 'Invalid format. Use "pdf" or "excel".' });
        }

    } catch (err) {
        console.error('Error generating referral export:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;