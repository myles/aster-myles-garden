export enum Body {
  Sun = "sun",
  Moon = "moon",
  Mercury = "mercury",
  Venus = "venus",
  Mars = "mars",
  Jupiter = "jupiter",
  Saturn = "saturn",
  Uranus = "uranus",
  Neptune = "neptune",
  Pluto = "pluto",
  NorthNode = "northNode",
}

export enum BodyKind {
  Planet = "planet",
  Point = "point",
}

type BodyInfo = {
  name: string;
  glyph: string;
  kind: BodyKind;
};

// U+FE0E asks for the text glyph, so platforms don't swap in emoji.
export const BODY_INFO: Record<Body, BodyInfo> = {
  [Body.Sun]: { name: "Sun", glyph: "☉︎", kind: BodyKind.Planet },
  [Body.Moon]: { name: "Moon", glyph: "☽︎", kind: BodyKind.Planet },
  [Body.Mercury]: { name: "Mercury", glyph: "☿︎", kind: BodyKind.Planet },
  [Body.Venus]: { name: "Venus", glyph: "♀︎", kind: BodyKind.Planet },
  [Body.Mars]: { name: "Mars", glyph: "♂︎", kind: BodyKind.Planet },
  [Body.Jupiter]: { name: "Jupiter", glyph: "♃︎", kind: BodyKind.Planet },
  [Body.Saturn]: { name: "Saturn", glyph: "♄︎", kind: BodyKind.Planet },
  [Body.Uranus]: { name: "Uranus", glyph: "♅︎", kind: BodyKind.Planet },
  [Body.Neptune]: { name: "Neptune", glyph: "♆︎", kind: BodyKind.Planet },
  [Body.Pluto]: { name: "Pluto", glyph: "♇︎", kind: BodyKind.Planet },
  [Body.NorthNode]: {
    name: "North Node",
    glyph: "☊︎",
    kind: BodyKind.Point,
  },
};

export const BODIES = Object.values(Body);
