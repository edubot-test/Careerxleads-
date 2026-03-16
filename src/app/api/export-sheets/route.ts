import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const targetSheetId = process.env.GOOGLE_SHEETS_ID;

export async function POST(req: Request) {
  try {
    const { leads } = await req.json();

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !targetSheetId) {
      console.log('No Google credentials found or Sheet ID missing.');
      return NextResponse.json({ error: 'Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEETS_ID.' }, { status: 503 });
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ── Check if "Leads" tab exists, if not use the first sheet ──
    let sheetName = 'Leads';
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: targetSheetId });
      const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === 'Leads');
      if (!sheetExists) {
        sheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
        console.log(`"Leads" tab not found. Using "${sheetName}" instead.`);
      }
    } catch (e) {
      console.error('Error fetching spreadsheet info:', e);
    }

    // ── Guardrail 8: Duplicate Prevention ──
    let existingUrls = new Set<string>();
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetSheetId,
        range: `${sheetName}!C:C`, 
      });
      const rows = response.data.values;
      if (rows) {
        rows.flat().forEach(url => {
          if (url) existingUrls.add(url.toString().trim());
        });
      }
    } catch (e) {
      console.log(`Could not read existing leads from ${sheetName}.`);
    }

    const newLeads = leads.filter((l: any) => !existingUrls.has((l.linkedinUrl || '').trim()));

    if (newLeads.length === 0) {
      return NextResponse.json({ success: true, exportedCount: 0, message: 'No new leads to export.' });
    }

    const rowsToAppend = newLeads.map((l: any) => [
      new Date().toISOString(),          // A: Timestamp
      l.name        || '',               // B: Name
      l.linkedinUrl || '',               // C: LinkedIn URL
      l.university  || '',               // D: University
      l.fieldOfStudy || '',             // E: Field
      l.graduationYear || '',           // F: Grad Year
      l.email       || '',               // G: Email
      l.qualityScore ?? l.intentScore ?? '', // H: Quality Score
      (l.outreachMessage || '').replace(/\n/g, ' '), // I: Outreach (no newlines in Sheets)
      l.status      || 'new',            // J: Status
      l.reviewFlag  || 'approved',       // K: Review Flag
    ]);

    // ── Append to the determined sheet ──
    await sheets.spreadsheets.values.append({
      spreadsheetId: targetSheetId,
      range: `${sheetName}!A:K`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAppend
      }
    });

    return NextResponse.json({ 
      success: true, 
      exportedCount: newLeads.length,
      totalSent: leads.length,
      duplicatesFound: leads.length - newLeads.length
    });

  } catch (error: any) {
    console.error('Error exporting to Google Sheets:', error);
    return NextResponse.json({ 
      error: 'Failed to export to Google Sheets',
      details: error.message 
    }, { status: 500 });
  }
}
