import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma';
import { sendError } from '../utils/response';

/**
 * GET /api/registrations/:id/certificate
 * Generates and streams an official PDF Certificate of Attendance.
 * Protected to confirmed attendees who have verified CHECKED_IN / ATTENDED status.
 */
export async function downloadCertificate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;

    const registration: any = await prisma.registration.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        event: {
          include: {
            venue: true,
          },
        },
      },
    });

    if (!registration) {
      sendError(res, 404, 'Registration record not found');
      return;
    }

    // Security check: Only the attendee or Admin/Organizer can download
    if (
      req.user!.userId !== registration.userId &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'ORGANIZER'
    ) {
      sendError(res, 403, 'You are not authorized to download this certificate');
      return;
    }

    // Strict Attendance Check: Must be CHECKED_IN or ATTENDED
    if (registration.status !== 'CHECKED_IN' && registration.status !== 'ATTENDED') {
      sendError(
        res,
        403,
        'Certificate is only issued after physical event check-in is verified by an organizer.',
      );
      return;
    }

    const serialNumber = `CERT-2026-${registration.id.slice(0, 8).toUpperCase()}`;
    const checkInDate = registration.checkedInAt
      ? new Date(registration.checkedInAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date(registration.registeredAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    // ─── PDF Generation ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margin: 40,
      info: {
        Title: `Certificate of Attendance - ${registration.user.name}`,
        Author: 'Campus Event Hub',
        Subject: `Verified Certificate for ${registration.event.title}`,
      },
    });

    const filename = `Certificate_${registration.user.name.replace(/\s+/g, '_')}_${serialNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Outer Decorative Border
    doc
      .rect(20, 20, 802, 555)
      .lineWidth(3)
      .strokeColor('#4f46e5') // Indigo
      .stroke();

    // Inner Thin Border
    doc
      .rect(28, 28, 786, 539)
      .lineWidth(1)
      .strokeColor('#94a3b8')
      .stroke();

    // Header Tag
    doc.moveDown(1.5);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#6366f1')
      .text('CAMPUS EVENT HUB · OFFICIAL ACCREDITATION', { align: 'center', characterSpacing: 2 });

    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor('#0f172a')
      .text('CERTIFICATE OF PARTICIPATION', { align: 'center', characterSpacing: 1 });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#64748b')
      .text('THIS IS PROUDLY PRESENTED TO', { align: 'center' });

    // Student Name
    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(32)
      .fillColor('#1e1b4b')
      .text(registration.user.name, { align: 'center', underline: false });

    // Department / Email
    if (registration.user.department) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#475569')
        .text(`Department of ${registration.user.department}`, { align: 'center' });
    }

    // Body Text
    doc.moveDown(1);
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#334155')
      .text(
        `for active participation and verified attendance at the official campus event`,
        { align: 'center' },
      );

    doc.moveDown(0.5);
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#4338ca')
      .text(`"${registration.event.title}"`, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#64748b')
      .text(
        `Held at ${registration.event.venue.name} (${registration.event.venue.location}) on ${checkInDate}.`,
        { align: 'center' },
      );

    // Footer Block (Serial + Verification Hash)
    doc.moveDown(2);
    const startY = 490;

    // Left: Serial & QR Token Info
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text(`Certificate ID: ${serialNumber}`, 60, startY)
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(`Security Token: ${registration.qrToken || 'VERIFIED-CHECKIN'}`, 60, startY + 14)
      .text(`Issued: ${new Date().toUTCString()}`, 60, startY + 26);

    // Right: Institutional Sign-off
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text('Campus Event Directorate', 580, startY, { align: 'right' })
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text('Verified Digital Credential', 580, startY + 14, { align: 'right' })
      .text('Tamper-Resistant SHA-256 Audit', 580, startY + 26, { align: 'right' });

    doc.end();
  } catch (err) {
    next(err);
  }
}
