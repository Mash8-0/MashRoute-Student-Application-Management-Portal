export const CITY_CAMPUSES = {
  PJ: 'Petaling Jaya Campus',
  CJ: 'Cyberjaya Campus',
  JB: 'Johor Bahru Campus',
};

export function isCityUniversityName(name) {
  return /city university malaysia/i.test(String(name || ''));
}

export function campusLabel(course) {
  const codes = Array.isArray(course?.campusCodes) ? course.campusCodes : [];
  return codes.length ? `${course.name} — ${codes.join(' / ')}` : course?.displayName || course?.name;
}

export function courseCampuses(course) {
  if (Array.isArray(course?.campuses) && course.campuses.length) return course.campuses;
  if (Array.isArray(course?.campusCodes)) return course.campusCodes.map((code) => CITY_CAMPUSES[code]).filter(Boolean);
  return [];
}
