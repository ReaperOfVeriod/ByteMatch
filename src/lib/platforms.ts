/** Platform ids as projects report them (decomp.dev used the same short ids) and their display names. */
export const PLATFORMS: Record<string, string> = {
  "3ds": "Nintendo 3DS",
  dc: "Dreamcast",
  gba: "Game Boy Advance",
  gbc: "Game Boy Color",
  gb: "Game Boy",
  gc: "GameCube",
  n64: "Nintendo 64",
  nds: "Nintendo DS",
  pc: "PC",
  ps: "PlayStation",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
  ps3: "PlayStation 3",
  psp: "PSP",
  saturn: "Saturn",
  snes: "Super Nintendo",
  switch: "Nintendo Switch",
  wii: "Wii",
  wiiu: "Wii U",
  xbox: "Xbox",
  x360: "Xbox 360",
};

export const platformName = (id: string | null | undefined) => (id ? (PLATFORMS[id.toLowerCase()] ?? id) : null);
