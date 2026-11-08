export interface MissionProfile {
  launchDate: string;
  purpose: string;
  image?: string;
  imageCredit?: string;
  missionSource: string;
  dataLabel?: string;
  dataUrl?: string;
  dataNote?: string;
}

// Only include narrative facts and spacecraft images tied to ISRO mission pages.
// Satellites without a reviewed profile use their SATCAT launch date when available.
export const MISSION_PROFILES: Record<string, MissionProfile> = {
  'ASTROSAT': {
    launchDate: '2015-09-28',
    purpose: 'India’s first dedicated multi-wavelength space observatory. It observes celestial sources in visible, ultraviolet, soft X-ray and hard X-ray bands.',
    image: 'https://www.isro.gov.in/media_isro/image/Highlights/Astrosat/slider1_0_large.png.webp',
    imageCredit: 'ISRO',
    missionSource: 'https://www.isro.gov.in/AstroSat.html',
    dataLabel: 'AstroBrowse science archive',
    dataUrl: 'https://astrobrowse.issdc.gov.in/astro_archive/archive/Home.jsp',
    dataNote: 'Processed science observations are archived here; account or registration may be required. This is not a live spacecraft telemetry feed.',
  },
  'NISAR': {
    launchDate: '2025-07-30',
    purpose: 'NASA–ISRO radar observatory that measures changes in land, ice and ecosystems using L-band and S-band synthetic aperture radar.',
    image: 'https://www.isro.gov.in/media_isro/image/index/NISAR/Picture1.jpg.webp',
    imageCredit: 'ISRO / NASA',
    missionSource: 'https://www.isro.gov.in/NISARSatellite.html',
    dataLabel: 'NISAR Earth-observation products',
    dataUrl: 'https://bhoonidhi.nrsc.gov.in/NISAR/',
    dataNote: 'Publicly released processed SAR products are available through Bhoonidhi; product availability and download access depend on the portal. These are Earth-observation products, not engineering telemetry.',
  },
  'INSAT-3DS': {
    launchDate: '2024-02-17',
    purpose: 'Meteorological satellite for weather observation, land and ocean surface monitoring, and data relay and search-and-rescue support.',
    image: 'https://www.isro.gov.in/media_isro/image/insat_3ds_sdsc.png',
    imageCredit: 'ISRO',
    missionSource: 'https://www.isro.gov.in/ISRO_EN/GSLV-F14_INSAT-3DS_mission.html',
    dataLabel: 'MOSDAC INSAT-3DS data',
    dataUrl: 'https://mosdac.gov.in/insat-3ds?language=en',
    dataNote: 'MOSDAC provides published meteorological imagery and products. Product time and access are shown by the source portal.',
  },
  'CARTOSAT-3': {
    launchDate: '2019-11-27',
    purpose: 'High-resolution Earth-imaging satellite supporting urban and rural planning, infrastructure development, and coastal land-use mapping.',
    image: 'https://www.isro.gov.in/media_isro/image/media/Missions/Spacecraft/resized/cartosat3_large.png.webp',
    imageCredit: 'ISRO',
    missionSource: 'https://www.isro.gov.in/Cartosat_3.html',
    dataLabel: 'Bhoonidhi Earth-observation archive',
    dataUrl: 'https://bhoonidhi.nrsc.gov.in/',
    dataNote: 'Processed imagery/products may be available through Bhoonidhi; access varies by product.',
  },
  'EOS-6 (OCEANSAT-3)': {
    launchDate: '2022-11-26',
    purpose: 'Ocean-observation mission for ocean colour and wind-vector continuity, with sea-surface-temperature and additional optical measurements.',
    image: 'https://www.isro.gov.in/media_isro/image/index/PSLVC54/EOS_06/image1.jpg.webp',
    imageCredit: 'ISRO',
    missionSource: 'https://new1.isro.gov.in/ISRO_EN/EOS_06.html',
    dataLabel: 'Bhoonidhi Earth-observation archive',
    dataUrl: 'https://bhoonidhi.nrsc.gov.in/',
    dataNote: 'Processed ocean-colour, wind and related products may be available from the source archive.',
  },
  'GSAT-30': {
    launchDate: '2020-01-17',
    purpose: 'Geostationary communications satellite providing C-band and Ku-band services to India and parts of Asia and Australia.',
    image: 'https://www.isro.gov.in/media_isro/image/media/Missions/Spacecraft/resized/gsat-30_deployed_large.png.webp',
    imageCredit: 'ISRO',
    missionSource: 'https://www.isro.gov.in/ISRO_EN/GSAT_30.html',
  },
};

export function missionProfile(objectName: string): MissionProfile | undefined {
  return MISSION_PROFILES[objectName.trim().toUpperCase()];
}
