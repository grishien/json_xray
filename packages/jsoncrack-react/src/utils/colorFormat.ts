const HEX_CODE_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const RGB_PATTERN = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
const RGBA_PATTERN = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0\.\d+)\s*\)$/;

export const isColorFormat = (colorString: string) => {
  return (
    HEX_CODE_PATTERN.test(colorString) ||
    RGB_PATTERN.test(colorString) ||
    RGBA_PATTERN.test(colorString)
  );
};
