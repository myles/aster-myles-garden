// The API's request and response shapes. They guard the routes' input and
// output, and the OpenAPI document is generated from them, so the
// document can't drift from what the routes accept and return.
//
// Every object is strict: a plain z.object silently strips keys it doesn't
// declare, so a formatter that drifts from its schema would go unnoticed.
// `.meta({ id })` names a schema as an OpenAPI component; give it once,
// here, since calling `.meta()` again makes a copy without the id.

import { z } from "astro/zod";

import {
  AspectQuality,
  AspectRank,
  AspectSet,
  AspectType,
  DEFAULT_ASPECT_SETTINGS,
  OrbSize,
} from "@/lib/astrology/aspects";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { Body } from "@/lib/astrology/bodies";
import {
  DEFAULT_HOUSE_SYSTEM,
  HOUSE_COUNT,
  HouseSystem,
} from "@/lib/astrology/houses";
import { SIGNS } from "@/lib/astrology/zodiac";
import { isTimeZone } from "@/lib/time";

const MAX_LATITUDE_DEGREES = 90;
const MAX_LONGITUDE_DEGREES = 180;
const MAX_PLACE_NAME_CHARS = 80;
const MAX_QUERY_CHARS = 100;

export const DEFAULT_PLACES_LIMIT = 8;
export const MAX_PLACES_LIMIT = 25;

/** 24-hour wall-clock time, "00:00" to "23:59". */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const signSchema = z
  .enum(SIGNS.map((sign) => sign.name))
  .meta({ id: "Sign", description: "A zodiac sign." });

const bodySchema = z
  .enum(Body)
  .meta({ id: "Body", description: "A planet or point." });

const houseSystemSchema = z.enum(HouseSystem).meta({
  id: "HouseSystem",
  description: "How the sky is divided into the 12 houses.",
});

const aspectSetSchema = z.enum(AspectSet).meta({
  id: "AspectSet",
  description:
    "Which aspects to find: the major ones only, or the minor ones too " +
    "(semi-sextile, semi-square, sesquiquadrate and quincunx).",
});

const orbSizeSchema = z.enum(OrbSize).meta({
  id: "OrbSize",
  description:
    "How wide every orb is: tight is three quarters of standard, wide " +
    "is a quarter more.",
});

const ayanamsaSchema = z.enum(Ayanamsa).meta({
  id: "Ayanamsa",
  description:
    "Which ayanamsa a sidereal chart is measured with: how far the " +
    "sidereal zodiac is set back from the tropical one.",
});

const houseNumberSchema = z.int().min(1).max(HOUSE_COUNT);

const longitudeDescription =
  "Ecliptic longitude, in degrees, 0 to 360: tropical, or sidereal when " +
  "the chart has an ayanamsa.";
const labelDescription = "The longitude as degrees within its sign.";

export const chartRequestSchemaV1 = z
  .strictObject({
    date: z.iso.date().meta({
      description: "The birth date, as YYYY-MM-DD.",
      examples: ["1990-05-15"],
    }),
    time: z
      .string()
      .regex(TIME_PATTERN, "Expected a 24-hour time, as HH:MM")
      .optional()
      .meta({
        description:
          "The local clock time at the birthplace, as 24-hour HH:MM. " +
          "Do not convert it to UTC. Leave it out when the birth time " +
          "isn't known: the chart is then cast for local noon, without " +
          "houses or angles.",
        examples: ["14:30"],
      }),
    latitude: z
      .number()
      .min(-MAX_LATITUDE_DEGREES)
      .max(MAX_LATITUDE_DEGREES)
      .meta({
        description: "The birthplace's latitude, in decimal degrees.",
        examples: [43.7064],
      }),
    longitude: z
      .number()
      .min(-MAX_LONGITUDE_DEGREES)
      .max(MAX_LONGITUDE_DEGREES)
      .meta({
        description:
          "The birthplace's longitude, in decimal degrees, east positive.",
        examples: [-79.4163],
      }),
    timeZone: z
      .string()
      .refine(isTimeZone, "Expected an IANA time zone, e.g. America/Toronto")
      .meta({
        description:
          "The birthplace's IANA time zone. Its historical offset, " +
          "daylight saving included, is applied for the birth date.",
        examples: ["America/Toronto"],
      }),
    houseSystem: houseSystemSchema.default(DEFAULT_HOUSE_SYSTEM),
    aspectSet: aspectSetSchema.default(DEFAULT_ASPECT_SETTINGS.aspectSet),
    orbSize: orbSizeSchema.default(DEFAULT_ASPECT_SETTINGS.orbSize),
    ayanamsa: ayanamsaSchema.optional().meta({
      description:
        "For the sidereal zodiac, the ayanamsa to measure it with. Leave " +
        "it out for the tropical zodiac.",
      examples: [Ayanamsa.Lahiri],
    }),
    placeName: z
      .string()
      .trim()
      .max(MAX_PLACE_NAME_CHARS)
      .optional()
      .meta({
        description: "A name for the birthplace, shown by the share link.",
        examples: ["Toronto"],
      }),
  })
  .meta({ id: "ChartRequest", description: "Birth details for a chart." });

export type ChartRequestV1 = z.infer<typeof chartRequestSchemaV1>;

const placedBodySchemaV1 = z
  .strictObject({
    body: bodySchema,
    name: z.string().meta({ examples: ["Sun"] }),
    longitude: z.number().meta({ description: longitudeDescription }),
    latitude: z
      .number()
      .meta({ description: "Ecliptic latitude, in degrees." }),
    speed: z.number().meta({
      description:
        "Change in longitude, in degrees per day. Negative when retrograde.",
    }),
    sign: signSchema,
    label: z
      .string()
      .meta({ description: labelDescription, examples: ["24° 21′ Taurus"] }),
    isRetrograde: z.boolean(),
    house: houseNumberSchema.optional().meta({
      description: "The house the body is in. Absent without a birth time.",
    }),
    possibleSigns: z
      .array(signSchema)
      .optional()
      .meta({
        description:
          "Only without a birth time: every sign the body is in at some " +
          "point on the birth date. Two signs means it changed sign that day.",
      }),
  })
  .meta({ id: "PlacedBody" });

export type PlacedBodyV1 = z.infer<typeof placedBodySchemaV1>;

const angleSchemaV1 = z
  .strictObject({
    longitude: z.number().meta({ description: longitudeDescription }),
    sign: signSchema,
    label: z.string().meta({ description: labelDescription }),
  })
  .meta({ id: "Angle" });

const cuspSchemaV1 = z
  .strictObject({
    house: houseNumberSchema,
    longitude: z.number().meta({ description: longitudeDescription }),
    sign: signSchema,
    label: z.string().meta({ description: labelDescription }),
  })
  .meta({ id: "HouseCusp" });

const housesSchemaV1 = z
  .strictObject({
    cusps: z
      .array(cuspSchemaV1)
      .length(HOUSE_COUNT)
      .meta({ description: "The 12 house cusps, first house first." }),
    ascendant: angleSchemaV1,
    midheaven: angleSchemaV1,
  })
  .meta({ id: "Houses" });

const aspectSchemaV1 = z
  .strictObject({
    first: bodySchema,
    second: bodySchema,
    type: z.enum(AspectType).meta({ id: "AspectType" }),
    quality: z.enum(AspectQuality).meta({ id: "AspectQuality" }),
    rank: z.enum(AspectRank).meta({ id: "AspectRank" }),
    orbDegrees: z.number().meta({
      description: "How far the separation is from exact, in degrees.",
    }),
  })
  .meta({ id: "Aspect" });

export type AspectV1 = z.infer<typeof aspectSchemaV1>;

export const chartSchemaV1 = z
  .strictObject({
    bornAt: z.iso.datetime().meta({
      description: "The birth moment in UTC.",
      examples: ["1990-05-15T18:30:00.000Z"],
    }),
    julianDay: z.number().meta({ description: "The birth moment, as UT." }),
    isTimeKnown: z.boolean(),
    houseSystem: houseSystemSchema.meta({
      description: "The house system asked for.",
    }),
    effectiveHouseSystem: houseSystemSchema.optional().meta({
      description:
        "The house system the houses were cast with. Porphyry inside " +
        "the polar circles, where Placidus and Koch can't be cast; " +
        "otherwise the one asked for. Absent without a birth time.",
    }),
    aspectSet: aspectSetSchema,
    orbSize: orbSizeSchema,
    ayanamsa: ayanamsaSchema.optional().meta({
      description: "The ayanamsa asked for. Absent for the tropical zodiac.",
    }),
    ayanamsaDegrees: z
      .number()
      .optional()
      .meta({
        description:
          "In a sidereal chart: how far behind the tropical zodiac it " +
          "is at the birth moment, in degrees. Every longitude is " +
          "already moved back by this.",
        examples: [23.7],
      }),
    bodies: z.array(placedBodySchemaV1),
    houses: housesSchemaV1.optional().meta({
      description: "Absent without a birth time.",
    }),
    aspects: z.array(aspectSchemaV1).meta({
      description:
        "Aspects between the planets, tightest first: the major ones, " +
        "and the minor ones too when aspectSet is all.",
    }),
    shareUrl: z.url().meta({
      description:
        "A link that draws this chart on the site. The details ride in " +
        "its # fragment, which browsers never send to a server.",
    }),
  })
  .meta({ id: "Chart", description: "A natal chart." });

export type ChartV1 = z.infer<typeof chartSchemaV1>;

const instantSchema = z.iso.datetime().meta({
  description: "A moment in UTC.",
  examples: ["2026-11-18T15:00:00.000Z"],
});

export const transitsRequestSchemaV1 = z
  .strictObject({
    natal: chartRequestSchemaV1,
    at: z.iso
      .datetime({ offset: true })
      .optional()
      .meta({
        description:
          "The moment to show the sky for, as an ISO 8601 date and time " +
          "with a UTC offset or Z. Seconds are dropped, as a share link " +
          "drops them. Leave it out for now.",
        examples: ["2026-11-18T10:00:00-05:00"],
      }),
  })
  .meta({
    id: "TransitsRequest",
    description: "A natal chart, and the moment to set the sky against it.",
  });

export type TransitsRequestV1 = z.infer<typeof transitsRequestSchemaV1>;

const transitTimingSchemaV1 = z
  .strictObject({
    entersOrb: instantSchema.optional().meta({
      description:
        "When the transit came into orb. Absent when that's more than " +
        "five years before `at`.",
    }),
    exact: z.array(instantSchema).meta({
      description:
        "Every moment the transit is exact while in orb, in order. Up to " +
        "three, as a planet turns retrograde and back; none when it turns " +
        "before reaching exact.",
    }),
    leavesOrb: instantSchema.optional().meta({
      description:
        "When the transit leaves orb. Absent when that's more than five " +
        "years after `at`.",
    }),
  })
  .meta({
    id: "TransitTiming",
    description: "When a transit is in orb and when it's exact, to the minute.",
  });

const timedAspectSchemaV1 = aspectSchemaV1
  .extend({ timing: transitTimingSchemaV1 })
  .meta({
    id: "TimedAspect",
    description:
      "An aspect from a natal body (`first`) to a transiting one " +
      "(`second`), with its timing.",
  });

export const transitsSchemaV1 = z
  .strictObject({
    natal: chartSchemaV1,
    at: instantSchema.meta({ description: "The moment shown, in UTC." }),
    maxOrbDegrees: z.number().meta({
      description:
        "The widest orb a transit is found within, whatever the natal " +
        "chart's orb size: transits use tighter orbs than a natal chart.",
      examples: [2],
    }),
    bodies: z.array(placedBodySchemaV1).meta({
      description:
        "Where each body is at `at`. `house` is the natal house it's " +
        "crossing, absent when the natal chart has no birth time.",
    }),
    aspects: z.array(timedAspectSchemaV1).meta({
      description: "Aspects from the natal bodies to the transiting ones.",
    }),
    shareUrl: z.url().meta({
      description: "A link that draws these transits on the site.",
    }),
  })
  .meta({
    id: "Transits",
    description: "The sky at a moment, against a natal chart.",
  });

export type TransitsV1 = z.infer<typeof transitsSchemaV1>;

export const placesQuerySchemaV1 = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(MAX_QUERY_CHARS)
    .meta({
      description:
        "A place name. Text after a comma narrows by region or country.",
      examples: ["london, canada"],
    }),
  limit: z.coerce
    .number<string>()
    .int()
    .min(1)
    .max(MAX_PLACES_LIMIT)
    .default(DEFAULT_PLACES_LIMIT)
    .meta({ description: "The most places to return." }),
});

export const placeSchemaV1 = z
  .strictObject({
    id: z.int().meta({ description: "GeoNames ID.", examples: [6058560] }),
    name: z.string().meta({ examples: ["London"] }),
    region: z.string().meta({ examples: ["Ontario"] }),
    country: z.string().meta({ examples: ["Canada"] }),
    label: z.string().meta({ examples: ["London, Ontario, Canada"] }),
    latitude: z.number(),
    longitude: z.number(),
    timeZone: z.string().meta({ examples: ["America/Toronto"] }),
  })
  .meta({ id: "Place", description: "A GeoNames city." });

export type PlaceV1 = z.infer<typeof placeSchemaV1>;

export const placesPageSchemaV1 = z
  .strictObject({
    next: z.null().meta({ description: "Always null: not paginated." }),
    previous: z.null().meta({ description: "Always null: not paginated." }),
    count: z.int().min(0),
    result: z.array(placeSchemaV1).meta({
      description: "Most populous first; prefix matches before the rest.",
    }),
  })
  .meta({ id: "PlacesPage" });

export const errorSchemaV1 = z
  .strictObject({
    error: z.string().meta({ examples: ["latitude: Too big"] }),
  })
  .meta({ id: "Error" });

/**
 * One line per problem, naming the field and the rule it broke. Zod's
 * messages describe the rule, not the value, so nothing submitted is
 * repeated back.
 */
export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "body";
      return `${field}: ${issue.message}`;
    })
    .join("; ");
}
