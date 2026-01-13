const ANSII_COLORS = {
  // Standard colors
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,

  // Bright colors
  "bright-black": 90,
  "bright-red": 91,
  "bright-green": 92,
  "bright-yellow": 93,
  "bright-blue": 94,
  "bright-magenta": 95,
  "bright-cyan": 96,
  "bright-white": 97,
}

const ANSII_STYLES = {
  bold: 1,
  dim: 2,        // Grayed/faded text
  italic: 3,
  underline: 4,
  blink: 5,      // Blinking text (rarely supported)
  inverse: 7,    // Swap foreground/background
  hidden: 8,     // Hidden text
  strikethrough: 9,
}


// TO COME 
export class Colors {
  
  protected static getString(joiner: string, value: any[]) {
    return value.map(v => {
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(v);
      if (typeof v === "boolean") return String(v);

      if ("toString" in v && typeof v.toString === "function") {
        return v.toString();
      }

      if (typeof v === "object") {
        return JSON.stringify(v);
      }

      return String(v);
    }).join(joiner);
  }

  // You can also combine styles and colors
  private static colorWrap(color: keyof typeof ANSII_COLORS, value: any[]) {
    return this.wrap([ANSII_COLORS[color]], value);
  }
  private static wrap(codes: number[], value: any[]) {
    if (!process.stdout.isTTY) return this.getString(" ", value);
    const codeStr = codes.join(';');
    return `\x1b[${codeStr}m${this.getString(" ", value)}\x1b[0m`
  }

  // Color methods
  static black(...value: any[]) {
    return this.colorWrap("black", value);
  }
  static red(...value: any[]) {
    return this.colorWrap("red", value);
  }
  static green(...value: any[]) {
    return this.colorWrap("green", value);
  }
  static yellow(...value: any[]) {
    return this.colorWrap("yellow", value);
  }
  static blue(...value: any[]) {
    return this.colorWrap("blue", value);
  }
  static magenta(...value: any[]) {
    return this.colorWrap("magenta", value);
  }
  static cyan(...value: any[]) {
    return this.colorWrap("cyan", value);
  }
  static white(...value: any[]) {
    return this.colorWrap("white", value);
  }
  static brightBlack(...value: any[]) {
    return this.colorWrap("bright-black", value);
  }
  static brightRed(...value: any[]) {
    return this.colorWrap("bright-red", value);
  }
  static brightGreen(...value: any[]) {
    return this.colorWrap("bright-green", value);
  }
  static brightYellow(...value: any[]) {
    return this.colorWrap("bright-yellow", value);
  }
  static brightBlue(...value: any[]) {
    return this.colorWrap("bright-blue", value);
  }
  static brightMagenta(...value: any[]) {
    return this.colorWrap("bright-magenta", value);
  }
  static brightCyan(...value: any[]) {
    return this.colorWrap("bright-cyan", value);
  }
  static brightWhite(...value: any[]) {
    return this.colorWrap("bright-white", value);
  }

  // Style methods
  static bold(...value: any[]) {
    return this.wrap([ANSII_STYLES.bold], value);
  }
  static dim(...value: any[]) {
    return this.wrap([ANSII_STYLES.dim], value);
  }
  static italic(...value: any[]) {
    return this.wrap([ANSII_STYLES.italic], value);
  }
  static underline(...value: any[]) {
    return this.wrap([ANSII_STYLES.underline], value);
  }
  static strikethrough(...value: any[]) {
    return this.wrap([ANSII_STYLES.strikethrough], value);
  }
  static inverse(...value: any[]) {
    return this.wrap([ANSII_STYLES.inverse], value);
  }

  // [Symbol.toPrimitive]() {
  //   return this.toString();
  // }
}
