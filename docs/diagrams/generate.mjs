/**
 * Генератор диаграмм раздела 2.6 ТЗ.
 *
 * Читает описание из diagrams.mjs и выпускает для каждой диаграммы:
 *   · .drawio — редактируемый исходник для diagrams.net;
 *   · .svg    — готовое изображение для вставки в пояснительную записку.
 *
 * Запуск: node docs/diagrams/generate.mjs
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIAGRAMS, PALETTE } from './diagrams.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));

const FONT = 'Arial, Helvetica, sans-serif';
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const TITLE_HEIGHT = 44;

const escapeXml = (text) =>
  text.replace(/[<>&"']/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char],
  );

const colorOf = (node) => PALETTE[node.color] ?? PALETTE.plain;

/* ------------------------------------------------------------------ */
/*  Геометрия соединений                                              */
/* ------------------------------------------------------------------ */

const centerOf = (node) => ({ x: node.x + node.w / 2, y: node.y + node.h / 2 });

/**
 * Точка пересечения отрезка «центр→центр» с границей прямоугольника.
 * Стрелки благодаря этому упираются в рамку блока, а не в его середину.
 */
const borderPoint = (node, towards) => {
  const c = centerOf(node);
  const dx = towards.x - c.x;
  const dy = towards.y - c.y;
  if (dx === 0 && dy === 0) return c;

  const halfW = node.w / 2 + 2;
  const halfH = node.h / 2 + 2;
  // Масштаб до ближайшей из вертикальных и горизонтальных граней
  const scaleX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return { x: c.x + dx * scale, y: c.y + dy * scale };
};

/* ------------------------------------------------------------------ */
/*  Отрисовка SVG                                                     */
/* ------------------------------------------------------------------ */

const renderShape = (node) => {
  const { fill, stroke } = colorOf(node);
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="1.5"`;

  switch (node.shape) {
    case 'rounded':
      return `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="12" ry="12" ${common}/>`;

    case 'db': {
      // Цилиндр: корпус плюс верхний эллипс
      const ry = 12;
      const { x, y, w, h } = node;
      return [
        `<path d="M ${x} ${y + ry} L ${x} ${y + h - ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry}" ${common}/>`,
        `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" ${common}/>`,
      ].join('\n    ');
    }

    case 'note':
      return `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="4" ry="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="6 3"/>`;

    case 'entity': {
      // Сущность ER: заголовок отделён линией от списка атрибутов
      const headerHeight = 30;
      return [
        `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="4" ry="4" ${common}/>`,
        `<line x1="${node.x}" y1="${node.y + headerHeight}" x2="${node.x + node.w}" y2="${node.y + headerHeight}" stroke="${stroke}" stroke-width="1.5"/>`,
      ].join('\n    ');
    }

    default:
      return `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="4" ry="4" ${common}/>`;
  }
};

const renderLabel = (node) => {
  const lines = node.label.split('\n');
  const { stroke } = colorOf(node);

  if (node.shape === 'entity') {
    // Заголовок по центру шапки, атрибуты — слева под ней
    const [title, , ...attributes] = lines;
    const rows = [
      `<text x="${node.x + node.w / 2}" y="${node.y + 20}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="bold" fill="${stroke}">${escapeXml(title)}</text>`,
    ];
    attributes.forEach((attribute, index) => {
      const isKey = attribute.startsWith('PK') || attribute.startsWith('FK');
      rows.push(
        `<text x="${node.x + 12}" y="${node.y + 50 + index * 15}" font-family="${FONT}" font-size="11" ${isKey ? 'font-weight="bold"' : ''} fill="#263238">${escapeXml(attribute)}</text>`,
      );
    });
    return rows.join('\n    ');
  }

  const startY =
    node.y + node.h / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2 + 4;
  return lines
    .map((line, index) => {
      const bold = index === 0 && lines.length > 1 && node.shape !== 'note';
      return `<text x="${node.x + node.w / 2}" y="${startY + index * LINE_HEIGHT}" text-anchor="middle" font-family="${FONT}" font-size="${FONT_SIZE}" ${bold ? 'font-weight="bold"' : ''} fill="#263238">${escapeXml(line)}</text>`;
    })
    .join('\n    ');
};

const renderEdge = (edge, byId) => {
  const source = byId.get(edge.from);
  const target = byId.get(edge.to);
  if (!source || !target) {
    throw new Error(`Связь ссылается на несуществующий блок: ${edge.from} → ${edge.to}`);
  }

  // Промежуточные точки позволяют обвести связь вокруг чужих блоков там,
  // где прямая линия прошла бы сквозь них
  const via = edge.via ?? [];
  const start = borderPoint(source, via[0] ?? centerOf(target));
  const end = borderPoint(target, via[via.length - 1] ?? centerOf(source));
  const dash = edge.dashed ? ' stroke-dasharray="6 4"' : '';

  const points = [start, ...via, end];
  const path = points
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');

  const parts = [
    `<polyline points="${path}" fill="none" stroke="#546e7a" stroke-width="1.5"${dash} marker-end="url(#arrow)"/>`,
  ];

  if (edge.label) {
    // Подпись ставится у середины ломаной: для маршрута с точками —
    // рядом со средней точкой, иначе посередине прямой
    const anchorA = points[Math.floor((points.length - 1) / 2)];
    const anchorB = points[Math.ceil((points.length - 1) / 2)];
    const midX = (anchorA.x + anchorB.x) / 2;
    const midY = (anchorA.y + anchorB.y) / 2;
    const lines = edge.label.split('\n');
    const width = Math.max(...lines.map((line) => line.length)) * 5.6 + 10;
    const height = lines.length * 13 + 4;
    // Подложка под подписью, иначе текст сливается с линией связи
    parts.push(
      `<rect x="${(midX - width / 2).toFixed(1)}" y="${(midY - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height}" rx="3" fill="#ffffff" fill-opacity="0.92"/>`,
    );
    lines.forEach((line, index) => {
      const y = midY - height / 2 + 12 + index * 13;
      parts.push(
        `<text x="${midX.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#37474f">${escapeXml(line)}</text>`,
      );
    });
  }

  return parts.join('\n    ');
};

const toSvg = (diagram) => {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const height = diagram.height + TITLE_HEIGHT;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${diagram.width}" height="${height}" viewBox="0 0 ${diagram.width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#546e7a"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(0, ${TITLE_HEIGHT})">
    ${diagram.edges.map((edge) => renderEdge(edge, byId)).join('\n    ')}
    ${diagram.nodes.map((node) => `${renderShape(node)}\n    ${renderLabel(node)}`).join('\n    ')}
  </g>
  <text x="${diagram.width / 2}" y="26" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="bold" fill="#263238">${escapeXml(diagram.title)}</text>
</svg>
`;
};

/* ------------------------------------------------------------------ */
/*  Экспорт в формат draw.io                                          */
/* ------------------------------------------------------------------ */

const DRAWIO_SHAPES = {
  box: 'rounded=0;whiteSpace=wrap;html=1;',
  rounded: 'rounded=1;arcSize=20;whiteSpace=wrap;html=1;',
  db: 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;whiteSpace=wrap;html=1;',
  note: 'rounded=1;whiteSpace=wrap;html=1;dashed=1;align=left;spacingLeft=10;verticalAlign=middle;',
  entity: 'rounded=0;whiteSpace=wrap;html=1;align=left;spacingLeft=10;verticalAlign=top;spacingTop=4;',
};

const toDrawio = (diagram) => {
  const cells = [];

  diagram.nodes.forEach((node) => {
    const { fill, stroke } = colorOf(node);
    const style = `${DRAWIO_SHAPES[node.shape] ?? DRAWIO_SHAPES.box}fillColor=${fill};strokeColor=${stroke};fontSize=12;`;
    // draw.io переносит строки по <br>, поэтому \n заменяется тегом
    const label = escapeXml(node.label).replace(/\n/g, '&lt;br&gt;');
    cells.push(
      `        <mxCell id="${node.id}" value="${label}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" as="geometry"/>
        </mxCell>`,
    );
  });

  diagram.edges.forEach((edge, index) => {
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#546e7a;${edge.dashed ? 'dashed=1;' : ''}fontSize=10;`;
    const label = edge.label
      ? escapeXml(edge.label).replace(/\n/g, '&lt;br&gt;')
      : '';
    const waypoints = (edge.via ?? [])
      .map((point) => `            <mxPoint x="${point.x}" y="${point.y}"/>`)
      .join('\n');
    const geometry = waypoints
      ? `<mxGeometry relative="1" as="geometry">
          <Array as="points">
${waypoints}
          </Array>
        </mxGeometry>`
      : '<mxGeometry relative="1" as="geometry"/>';

    cells.push(
      `        <mxCell id="e${index}" value="${label}" style="${style}" edge="1" parent="1" source="${edge.from}" target="${edge.to}">
          ${geometry}
        </mxCell>`,
    );
  });

  return `<mxfile host="app.diagrams.net">
  <diagram name="${escapeXml(diagram.title)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" page="1" pageWidth="${diagram.width}" pageHeight="${diagram.height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
};

/* ------------------------------------------------------------------ */

for (const diagram of DIAGRAMS) {
  writeFileSync(join(OUT, `${diagram.file}.svg`), toSvg(diagram), 'utf-8');
  writeFileSync(join(OUT, `${diagram.file}.drawio`), toDrawio(diagram), 'utf-8');
  console.log('сформировано:', diagram.file, '(.svg, .drawio)');
}
