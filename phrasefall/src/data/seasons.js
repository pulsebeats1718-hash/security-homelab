/**
 * The four seasons. The world follows the player's own calendar, using the
 * meteorological seasons the Met Office uses: spring March–May, summer June–August,
 * autumn September–November, winter December–February. Players in the southern
 * hemisphere (guessed from their time zone) get the opposite season. Settings can
 * pin a season instead (settings.season: 'auto' or a season id).
 *
 *   autumn  colourful leaves falling          winter  snow
 *   spring  flowers growing, blossom          summer  the beach, sunglasses and rubber rings
 */
export const SEASONS = [
  { id: 'spring', name: 'Spring', months: [2, 3, 4], blurb: 'Flowers growing and blossom in the air' },
  { id: 'summer', name: 'Summer', months: [5, 6, 7], blurb: 'Sand, deckchairs and sunglasses' },
  { id: 'autumn', name: 'Autumn', months: [8, 9, 10], blurb: 'Red and golden leaves falling' },
  { id: 'winter', name: 'Winter', months: [11, 0, 1], blurb: 'Snowfall and a snowman' },
];

export const getSeason = (id) => SEASONS.find((s) => s.id === id) ?? SEASONS[2];

// temperate places south of the equator, by IANA time zone
const SOUTH =
  /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Norfolk)$|^America\/(Argentina\/.+|Santiago|Punta_Arenas|Montevideo|Sao_Paulo|Asuncion)$|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane)$|^Indian\/(Antananarivo|Mauritius|Reunion)$|^Atlantic\/(Stanley|South_Georgia)$/;

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

/** 'north' or 'south', from an IANA time zone (default: this device's). */
export const hemisphere = (tz = timeZone()) => (SOUTH.test(tz) ? 'south' : 'north');

/** The season on a date in a hemisphere. */
export function seasonFor(date = new Date(), hemi = hemisphere()) {
  let i = SEASONS.findIndex((s) => s.months.includes(date.getMonth()));
  if (hemi === 'south') i = (i + 2) % SEASONS.length;
  return SEASONS[i].id;
}

/** The season to show: the one pinned in Settings, otherwise today's. */
export const currentSeason = (setting = 'auto', date = new Date()) => (SEASONS.some((s) => s.id === setting) ? setting : seasonFor(date));
