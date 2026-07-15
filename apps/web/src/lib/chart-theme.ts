'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  grid: string;
  tick: string;
}

// SVG presentation attributes don't resolve CSS var(), so Recharts needs
// concrete color strings. These fallbacks match the light-theme tokens and are
// replaced with the live computed values after mount (and on theme switches).
const LIGHT_FALLBACK: ChartColors = {
  chart1: 'hsl(152 42% 34%)',
  chart2: 'hsl(40 85% 52%)',
  chart3: 'hsl(18 65% 52%)',
  chart4: 'hsl(150 20% 60%)',
  chart5: 'hsl(205 30% 48%)',
  grid: 'hsl(45 15% 87%)',
  tick: 'hsl(160 8% 42%)',
};

function read(style: CSSStyleDeclaration, name: string, fallback: string) {
  const value = style.getPropertyValue(name).trim();
  return value ? `hsl(${value})` : fallback;
}

function readAll(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  return {
    chart1: read(style, '--chart-1', LIGHT_FALLBACK.chart1),
    chart2: read(style, '--chart-2', LIGHT_FALLBACK.chart2),
    chart3: read(style, '--chart-3', LIGHT_FALLBACK.chart3),
    chart4: read(style, '--chart-4', LIGHT_FALLBACK.chart4),
    chart5: read(style, '--chart-5', LIGHT_FALLBACK.chart5),
    grid: read(style, '--border', LIGHT_FALLBACK.grid),
    tick: read(style, '--muted-foreground', LIGHT_FALLBACK.tick),
  };
}

/** Resolved chart palette that tracks the active theme. */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(LIGHT_FALLBACK);

  useEffect(() => {
    // next-themes flips the <html> class in the provider's own effect, which runs
    // AFTER this child effect — reading immediately would see the outgoing theme.
    // Watching the class attribute catches the flip (and system-theme changes) reliably.
    setColors(readAll());
    const observer = new MutationObserver(() => setColors(readAll()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [resolvedTheme]);

  return colors;
}
