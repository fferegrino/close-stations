/** Official TfL line colours, keyed by TfL line id. */
const LINE_COLORS: Record<string, string> = {
  // Underground
  bakerloo: '#B36305',
  central: '#E32017',
  circle: '#FFD300',
  district: '#00782A',
  'hammersmith-city': '#F3A9BB',
  jubilee: '#A0A5A9',
  metropolitan: '#9B0056',
  northern: '#000000',
  piccadilly: '#003688',
  victoria: '#0098D4',
  'waterloo-city': '#95CDBA',
  // Elizabeth line
  elizabeth: '#60399E',
  // DLR
  dlr: '#00A4A7',
  // Overground named lines (plus legacy id)
  'london-overground': '#EE7C0E',
  liberty: '#61686B',
  lioness: '#FFA600',
  mildmay: '#0077AD',
  suffragette: '#5BA829',
  weaver: '#823A62',
  windrush: '#DC241F',
  // Trams
  tram: '#84B817',
}

/** Colour used for lines without an official TfL colour (national rail operators). */
const FALLBACK_COLOR = '#4B5563'

export function lineColor(lineId: string): string {
  return LINE_COLORS[lineId] ?? FALLBACK_COLOR
}

/** Pick black or white text for readability against the line colour. */
export function lineTextColor(lineId: string): string {
  const hex = lineColor(lineId).slice(1)
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Perceived luminance (ITU-R BT.601)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 160 ? '#08060d' : '#fff'
}
