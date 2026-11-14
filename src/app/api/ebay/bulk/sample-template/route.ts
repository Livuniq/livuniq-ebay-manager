import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  try {
    let format = 'xlsx';
    try {
      const url = new URL(request.url);
      format = url.searchParams.get('format') || 'xlsx';
    } catch {
      // fallback
    }

    const userExcelPath = path.join(process.cwd(), 'public', 'data.xlsx');

    if (fs.existsSync(userExcelPath)) {
      const fileBuf = fs.readFileSync(userExcelPath);

      if (format === 'csv') {
        const wb = XLSX.read(fileBuf, { type: 'buffer' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const csvOutput = XLSX.utils.sheet_to_csv(firstSheet);
        return new NextResponse(csvOutput, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="data.csv"',
          },
        });
      }

      return new NextResponse(fileBuf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="data.xlsx"',
        },
      });
    }

    // Fallback template
    const sampleData = [
      {
        LOT: 31,
        CATEGORY: 'engagement ring',
        SKU: 'P831',
        Certified: 'IGI',
        GOLD_KT: '14k',
        GOLD_COLOR: 'Yellow',
        GOLD_WEIGHT: 2.6,
        CENTER_DIAMOND_CLARITY: 'VS1',
        CENTER_DIAMOND_COLOR: 'F',
        CENTER_STONE_SHAPE: 'MARQUISE',
        CENTER_STONE_WEIGHT: 1.5,
        SIDE_STONE_SHAPE: 'MARQUISE + ROUND',
        SIDE_STONE_WEIGHT: 0.42,
        SIDE_STONE_COLOR_CLARITY: 'F-G / VVS-VS',
        SETTING: 'as shown in picture',
        TOTAL_DIAMOND_PCS: 40,
        COST_USD: 849,
        SELLING_PRICE_USD: 1066.82,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RING');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csvOutput, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="data.csv"',
        },
      });
    }

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="data.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating sample template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
