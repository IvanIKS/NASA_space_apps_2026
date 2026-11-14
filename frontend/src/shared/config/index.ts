// NASA SVS CGI Moon Kit (https://svs.gsfc.nasa.gov/4720), equirectangular, centered on 0° lon.
// Same MOON_ME frame the backend uses, so lat/lon map 1:1 onto these images.
export const TEXTURES = {
  color: "/textures/lroc_color_2k.jpg",
  elevation: "/textures/ldem_3_8bit.jpg",
} as const;

export const ACCENT_COLOR = "#f5a000";

/** How many points can be compared at once; the colours below are one per slot. */
export const MAX_POINTS = 4;
/** Pin / chip / chart colour per point slot, picked to stay apart on the grey regolith. */
export const POINT_COLORS = ["#f5a000", "#55aaff", "#7ed957", "#ff7ab6"] as const;
