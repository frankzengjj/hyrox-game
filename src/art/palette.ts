/** A material in three shades for cylinder-style shading. */
export interface Tone {
  base: string;
  light: string;
  shadow: string;
}

export interface Kit {
  skin: Tone;
  shirt: Tone;
  shorts: Tone;
  shoe: Tone;
  accent: string;
  sock: string;
  sole: string;
  hair: string;
}

export const PLAYER_KIT: Kit = {
  skin: { base: '#b87a50', light: '#d99d70', shadow: '#7f4f2e' },
  shirt: { base: '#24272d', light: '#3d424c', shadow: '#111215' },
  shorts: { base: '#1a1c20', light: '#2f333a', shadow: '#0a0b0d' },
  shoe: { base: '#434852', light: '#707885', shadow: '#23262b' },
  accent: '#ffd400',
  sock: '#ececec',
  sole: '#f2f2f2',
  hair: '#22170f',
};

export const STEEL: Tone = { base: '#8d939c', light: '#c9ced6', shadow: '#4d525a' };
export const MACHINE: Tone = { base: '#1d2025', light: '#3b4049', shadow: '#0c0d10' };
