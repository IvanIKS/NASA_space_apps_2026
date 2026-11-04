// NASA SVS CGI Moon Kit (https://svs.gsfc.nasa.gov/4720), equirectangular, centered on 0° lon.
// Same MOON_ME frame the backend uses, so lat/lon map 1:1 onto these images.
export const TEXTURES = {
  color: "/textures/lroc_color_2k.jpg",
  elevation: "/textures/ldem_3_8bit.jpg",
} as const;

export const ACCENT_COLOR = "#f5a000";
