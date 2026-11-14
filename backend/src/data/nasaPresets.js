/**
 * NASA Satellite Imagery Catalog & Presets
 * Verified NASA satellite sources with public domain NASA imagery.
 */

export const NASA_PRESETS = [
  {
    id: "epic-earth",
    title: "NASA DSCOVR EPIC: Planet Earth",
    mission: "DSCOVR (Deep Space Climate Observatory)",
    organization: "NASA Goddard Space Flight Center",
    date: "Direct Satellite Feed",
    description: "Full-disc natural-color Earth observation from the DSCOVR spacecraft. Use this as a secondary image-sonification example; visible color and brightness are treated as image properties, not direct measurements of ocean depth or cloud properties.",
    imageUrl: "/images/nasa_epic_earth_hires.jpg",
    fullUrl: "/images/nasa_epic_earth_hires.jpg",
    credit: "NASA DSCOVR / EPIC Team",
    tags: ["Deep Space", "Full Disc", "Oceans", "Atmosphere"]
  },
  {
    id: "hurricane-florence",
    title: "Hurricane Florence Eye & Spirals",
    mission: "ISS Expedition 56 / Earth Observation",
    organization: "NASA / International Space Station",
    date: "2018-09-12",
    description: "Astronaut photograph of Hurricane Florence over the Atlantic. The sonifier maps visible image patterns only; it does not calculate wind speed, storm intensity, or cloud density.",
    imageUrl: "https://images-assets.nasa.gov/image/iss056e187424/iss056e187424~medium.jpg",
    fullUrl: "https://images-assets.nasa.gov/image/iss056e187424/iss056e187424~orig.jpg",
    credit: "NASA / ISS Crew",
    tags: ["Atmosphere", "Storm", "Clouds", "Vortex"]
  },
  {
    id: "aurora-australis",
    title: "Aurora Australis Over Southern Ocean",
    mission: "ISS Expedition 23",
    organization: "NASA Astronaut Photography",
    date: "2010-05-24",
    description: "Astronaut photograph showing auroral emissions. The sonifier maps visible color balance and brightness; it does not measure geomagnetic energy or atmospheric composition.",
    imageUrl: "https://images-assets.nasa.gov/image/iss023e058440/iss023e058440~medium.jpg",
    fullUrl: "https://images-assets.nasa.gov/image/iss023e058440/iss023e058440~orig.jpg",
    credit: "NASA Astronaut Crew",
    tags: ["Aurora", "Atmosphere", "Ionosphere", "Space"]
  }
];
