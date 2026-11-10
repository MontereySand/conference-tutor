const figures = [
  "M18 50C24 15 55 13 47 39S20 76 37 83 85 70 80 46 49 27 51 54 78 82 87 62M23 34l8-8m44 56 8-6",
  "M19 78C17 44 31 24 39 30s-3 46 11 43 4-50 17-46 17 28 13 49M25 20l10 5m33 60 9 4",
  "M16 36c17-19 25-9 19 8S17 77 31 81 50 56 53 39 72 19 79 31 67 56 63 69 70 87 84 74M19 90l8-4m52-64 5 9",
  "M22 22c-5 15 8 22 21 26s24 10 18 19-28 5-26-7 22-19 38-9 9 23-5 32M17 59l8 4m47-37 8-5",
  "M19 76c16 6 20-12 16-25s-8-27 3-29 11 29 20 30 11-28 20-25 4 36-12 51M24 26l7 8m42 51 9-4",
  "M18 39c11-19 26-15 27-3s-12 19-16 30 6 19 17 12 4-26 15-31 20 4 19 20M22 23l9 1m37 4 8-6m5 58 7-3",
  "M20 71c7-24 20-10 24-28S31 21 28 30s15 19 27 13 18-19 24-8-7 18-19 23-7 22 8 21M18 26l5 9m60 35 5 8",
  "M19 51c8-20 20-31 29-24s-6 18-12 28 0 25 11 24 8-18 15-22 16 1 21 15M22 78l7 6m45-58 7 7",
  "M22 24c18 4 19 23 9 33s-9 23 3 23 16-22 26-25 16 9 21 22M20 40l9-5m35-14 3 10m9 8 8-2",
  "M17 65c16 15 25 5 22-11s-6-29 7-30 5 24 17 25 17-11 21 1-12 24-22 30M20 27l8-5m19 62 7 5",
  "M20 30c10 17 21 15 28 3s17-13 19-3-10 20-21 24-17 18-8 25 21-3 24-14 12-13 20-6M17 82l8-3m52-54 7 7",
  "M20 77c-2-17 8-25 19-19s19 12 24 0-7-20-15-15-5 18 5 23 22 2 28-9M22 26l7 8m13-14 4 8m26 54 8-4",
];

export function ProfileArt({ profileId, label, className }: { profileId: string; label: string; className?: string }) {
  const index = Array.from(profileId).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % figures.length;
  return <svg className={className} viewBox="0 0 100 110" width="100%" height="100%" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
    <path d={figures[index]} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
