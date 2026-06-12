const DEFAULT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const configured = import.meta.env.VITE_MAPLIBRE_STYLE_URL ?? '';

/** Free demo tiles when MapTiler key is not configured yet. */
export const MAP_STYLE_URL =
  configured.length === 0 || configured.includes('REPLACE_ME') ? DEFAULT_STYLE : configured;
