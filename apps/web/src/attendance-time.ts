/** Format device-local wall time without applying a browser timezone conversion. */
export function attendanceTime(value:string){const parts=value.match(/T([01]\d|2[0-3]):([0-5]\d)/);if(!parts)return '—';const hour=Number(parts[1]);return `${hour%12||12}:${parts[2]} ${hour<12?'AM':'PM'}`;}
