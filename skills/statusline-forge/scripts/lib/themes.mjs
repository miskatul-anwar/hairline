// Named palettes over semantic roles. Segments only ever ask for a role.

export const ROLES = ["accent", "text", "muted", "ok", "warn", "hot", "info", "branch", "dirty"];

export const THEMES = {
  dusk: {
    summary: "Muted, low-contrast pastels for dark terminals (default)",
    accent: [180, 167, 255], text: [205, 210, 225], muted: [95, 100, 120], ok: [130, 200, 150],
    warn: [235, 190, 120], hot: [240, 120, 130], info: [130, 170, 235], branch: [125, 200, 190], dirty: [235, 190, 120],
  },
  ember: {
    summary: "Warm ambers and rust for dark terminals",
    accent: [255, 170, 100], text: [230, 215, 200], muted: [120, 100, 90], ok: [170, 200, 120],
    warn: [250, 200, 90], hot: [235, 90, 70], info: [220, 160, 130], branch: [200, 180, 120], dirty: [250, 200, 90],
  },
  glacier: {
    summary: "Cool blues and teals for dark terminals",
    accent: [120, 200, 255], text: [210, 225, 235], muted: [90, 110, 130], ok: [110, 210, 190],
    warn: [240, 210, 130], hot: [245, 110, 140], info: [150, 180, 255], branch: [100, 220, 220], dirty: [240, 210, 130],
  },
  vivid: {
    summary: "Saturated, high-energy colours",
    accent: [200, 120, 255], text: [240, 240, 240], muted: [130, 130, 150], ok: [80, 230, 120],
    warn: [255, 200, 0], hot: [255, 70, 90], info: [70, 170, 255], branch: [0, 220, 200], dirty: [255, 200, 0],
  },
  paper: {
    summary: "Dark ink for light terminal backgrounds",
    accent: [100, 60, 180], text: [40, 45, 60], muted: [130, 135, 150], ok: [30, 130, 70],
    warn: [170, 110, 0], hot: [190, 30, 50], info: [30, 90, 180], branch: [0, 120, 120], dirty: [170, 110, 0],
  },
  contrast: {
    summary: "Maximum legibility, bright primaries",
    accent: [255, 255, 255], text: [255, 255, 255], muted: [170, 170, 170], ok: [0, 255, 0],
    warn: [255, 255, 0], hot: [255, 0, 0], info: [0, 200, 255], branch: [0, 255, 255], dirty: [255, 255, 0],
  },
  mono: {
    summary: "No hues: bold for emphasis, dim for secondary",
    accent: "bold", text: null, muted: "dim", ok: null, warn: "bold", hot: "bold", info: null, branch: null, dirty: "bold",
  },
};
