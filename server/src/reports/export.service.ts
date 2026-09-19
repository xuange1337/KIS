import { Injectable } from '@nestjs/common';
import { ExportFormat, ReportName } from '@crm/shared';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import { join } from 'path';
import { REPORT_DEFINITIONS } from './report-definitions';

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/**
 * Выгрузка отчётов в CSV / Excel / PDF (ТЗ п. 1.1, п. 2.3).
 * Колонки берутся из общего описания REPORT_DEFINITIONS,
 * поэтому все три формата дают одинаковый состав данных.
 */
@Injectable()
export class ExportService {
  /** Кириллица в PDF: pdfmake по умолчанию использует Roboto без русских глифов. */
  private readonly printer = new PdfPrinter({
    DejaVu: {
      normal: join(__dirname, 'fonts', 'DejaVuSans.ttf'),
      bold: join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'),
    },
  });

  async export(
    report: ReportName,
    format: ExportFormat,
    rows: Record<string, any>[],
    period: string,
  ): Promise<ExportResult> {
    const definition = REPORT_DEFINITIONS[report];
    const fileName = `${report}-${new Date().toISOString().slice(0, 10)}.${format}`;

    const buffer =
      format === 'pdf'
        ? await this.toPdf(definition.title, period, definition.columns, rows)
        : format === 'xlsx'
          ? await this.toXlsx(definition.title, definition.columns, rows)
          : this.toCsv(definition.columns, rows);

    return { buffer, contentType: CONTENT_TYPES[format], fileName };
  }

  /**
   * Обезвреживает значение, которое табличный процессор принял бы за формулу.
   *
   * Excel и LibreOffice выполняют содержимое ячейки, начинающееся с = + - @
   * или управляющего символа. В выгрузку попадают наименования клиентов и темы
   * активностей — то есть текст, который вводит пользователь: он мог бы
   * подставить формулу и выполнить её на машине руководителя, открывшего отчёт.
   */
  private neutralizeFormula(text: string): string {
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  private toCsv(
    columns: { header: string; value: (row: any) => string | number }[],
    rows: Record<string, any>[],
  ): Buffer {
    const escape = (value: string | number): string => {
      const text = this.neutralizeFormula(String(value ?? ''));
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const lines = [
      columns.map((column) => escape(column.header)).join(';'),
      ...rows.map((row) =>
        columns.map((column) => escape(column.value(row))).join(';'),
      ),
    ];

    // BOM нужен, чтобы Excel открыл файл в UTF-8, а не в кодировке системы
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf-8');
  }

  private async toXlsx(
    title: string,
    columns: {
      header: string;
      width: number;
      value: (row: any) => string | number;
    }[],
    rows: Record<string, any>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title.slice(0, 31));

    sheet.columns = columns.map((column) => ({
      header: column.header,
      width: column.width,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };

    rows.forEach((row) => {
      sheet.addRow(
        columns.map((column) => {
          const value = column.value(row);
          // Числа остаются числами, текст обезвреживается от формул
          return typeof value === 'number'
            ? value
            : this.neutralizeFormula(String(value ?? ''));
        }),
      );
    });

    const result = await workbook.xlsx.writeBuffer();
    return Buffer.from(result);
  }

  private toPdf(
    title: string,
    period: string,
    columns: {
      header: string;
      width: number;
      value: (row: any) => string | number;
    }[],
    rows: Record<string, any>[],
  ): Promise<Buffer> {
    const landscape = columns.length > 4;
    // Ширины колонок в описании заданы в символах, а pdfmake ждёт пункты,
    // поэтому распределяем доступную ширину страницы пропорционально
    const availableWidth = (landscape ? 842 : 595) - 60;
    const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map(
      (column) => (column.width / totalWeight) * availableWidth,
    );

    const document = this.printer.createPdfKitDocument({
      pageSize: 'A4',
      pageOrientation: landscape ? 'landscape' : 'portrait',
      pageMargins: [30, 40, 30, 40],
      defaultStyle: { font: 'DejaVu', fontSize: 9 },
      content: [
        { text: title, fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
        { text: period, fontSize: 9, color: '#666', margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths,
            body: [
              columns.map((column) => ({ text: column.header, bold: true })),
              ...rows.map((row) =>
                columns.map((column) => String(column.value(row) ?? '')),
              ),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.end();
    });
  }
}
