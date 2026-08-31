#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const carsDir = path.join(here, 'data', 'cars');
const outputDir = path.join(here, 'analysis');

const round = (value, digits = 4) => Number(value.toFixed(digits));
const ratio = (a, b) => b === 0 ? null : a / b;

function metricsFor(car) {
  const guides = car.views?.side?.guides;
  const v = guides?.vertical;
  const h = guides?.horizontal;
  const w = guides?.wheels;
  if (!v || !h || !w) return null;

  const length = v.trunk.offsetX - v.head.offsetX;
  const height = h.ground.offsetY - h.top.offsetY;
  const wheelbase = w.rear.offsetX - w.front.offsetX;
  if (length <= 0 || height <= 0 || wheelbase <= 0) return null;

  return {
    id: car.id,
    name: car.name.trim(),
    style: car.style || '',
    cardWidth: car.cardWidth ?? null,
    lengthPx: round(length, 2),
    heightPx: round(height, 2),
    lengthHeight: round(ratio(length, height)),
    clearanceShareOfHeight: round(ratio(h.ground.offsetY - h.bottom.offsetY, height)),
    lowerBodyShareOfHeight: round(ratio(h.bottom.offsetY - h.center.offsetY, height)),
    cabinHeightShare: round(ratio(h.center.offsetY - h.top.offsetY, height)),
    hoodShare: round(ratio(v.cab1.offsetX - v.head.offsetX, length)),
    cabinShare: round(ratio(v.cab2.offsetX - v.cab1.offsetX, length)),
    rearShare: round(ratio(v.trunk.offsetX - v.cab2.offsetX, length)),
    wheelbaseShare: round(ratio(wheelbase, length)),
    frontOverhangShare: round(ratio(w.front.offsetX - v.head.offsetX, length)),
    rearOverhangShare: round(ratio(v.trunk.offsetX - w.rear.offsetX, length)),
    centerFromFront: round(ratio(v.center.offsetX - v.head.offsetX, length)),
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(a, b) {
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0));
}

function cluster(rows, keys, count = 4) {
  const stats = keys.map(key => {
    const values = rows.map(row => row[key]);
    const avg = mean(values);
    const deviation = Math.sqrt(mean(values.map(value => (value - avg) ** 2))) || 1;
    return { avg, deviation };
  });
  const points = rows.map(row => keys.map((key, i) => (row[key] - stats[i].avg) / stats[i].deviation));

  // Deterministic farthest-point seeds keep reports stable between runs.
  const centroids = [points[0].slice()];
  while (centroids.length < Math.min(count, points.length)) {
    let best = 0;
    let bestDistance = -1;
    points.forEach((point, index) => {
      const nearest = Math.min(...centroids.map(centroid => distance(point, centroid)));
      if (nearest > bestDistance) {
        best = index;
        bestDistance = nearest;
      }
    });
    centroids.push(points[best].slice());
  }

  let assignments = [];
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const next = points.map(point => {
      const distances = centroids.map(centroid => distance(point, centroid));
      return distances.indexOf(Math.min(...distances));
    });
    if (next.every((value, i) => value === assignments[i])) break;
    assignments = next;
    centroids.forEach((centroid, clusterIndex) => {
      const members = points.filter((_, i) => assignments[i] === clusterIndex);
      if (!members.length) return;
      centroid.forEach((_, dimension) => {
        centroid[dimension] = mean(members.map(member => member[dimension]));
      });
    });
  }

  const groups = centroids.map((centroid, index) => {
    const members = rows.filter((_, rowIndex) => assignments[rowIndex] === index);
    return {
      cluster: index + 1,
      count: members.length,
      centroid: Object.fromEntries(keys.map((key, i) => [key, round(centroid[i] * stats[i].deviation + stats[i].avg)])),
      cars: members.map(member => member.id),
    };
  });
  return { assignments, groups };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const files = fs.readdirSync(carsDir).filter(file => file.endsWith('.json')).sort();
const rows = [];
const skipped = [];
for (const file of files) {
  const car = JSON.parse(fs.readFileSync(path.join(carsDir, file), 'utf8'));
  const metrics = metricsFor(car);
  if (metrics) rows.push(metrics);
  else skipped.push(car.id || file);
}

const clusterKeys = ['hoodShare', 'cabinShare', 'rearShare', 'wheelbaseShare', 'frontOverhangShare', 'rearOverhangShare'];
const clustered = cluster(rows, clusterKeys, 4);
rows.forEach((row, index) => { row.cluster = clustered.assignments[index] + 1; });

const result = {
  generatedAt: new Date().toISOString(),
  source: path.relative(here, carsDir),
  method: {
    normalization: 'all horizontal distances are divided by head-to-trunk length; lengthHeight uses ground-to-top height',
    clustering: `deterministic k-means, k=4, standardized features: ${clusterKeys.join(', ')}`,
    note: 'clusters are geometric evidence, not final product taxonomy',
  },
  quality: {
    analyzed: rows.length,
    skipped,
    note: 'height is a relative side-view proportion; repeated canvas values are valid when the markup intentionally uses the same convenient scale',
  },
  clusters: clustered.groups,
  cars: rows,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'proportions.json'), `${JSON.stringify(result, null, 2)}\n`);

const headers = Object.keys(rows[0]);
const csv = [headers.join(','), ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'proportions.csv'), `${csv}\n`);

console.log(`Analyzed ${rows.length} cars; skipped ${skipped.length}.`);
console.log(`Wrote ${path.relative(process.cwd(), path.join(outputDir, 'proportions.json'))}`);
console.log(`Wrote ${path.relative(process.cwd(), path.join(outputDir, 'proportions.csv'))}`);
