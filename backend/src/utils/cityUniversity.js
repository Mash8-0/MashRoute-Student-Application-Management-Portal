const CITY_UNIVERSITY_INTAKES_2026 = [
  'February 2026',
  'March 2026',
  'April 2026',
  'May 2026',
  'June 2026',
  'July 2026',
  'August 2026',
  'September 2026',
  'October 2026',
  'November 2026',
  'December 2026',
];

const CITY_CAMPUSES = {
  PJ: 'Petaling Jaya Campus',
  CJ: 'Cyberjaya Campus',
  JB: 'Johor Bahru Campus',
};

const CITY_PROGRAMMES = [
  { level: 'Foundation', name: 'Foundation in Business', campusCodes: ['PJ'] },
  { level: 'Foundation', name: 'Foundation in Arts (Communication)', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Arts (English)', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Arts (Graphic Design & Multimedia)', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Arts (Build Environment)', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Arts (Fashion Design)', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Science', campusCodes: ['CJ'] },
  { level: 'Foundation', name: 'Foundation in Information Technology', campusCodes: ['CJ'] },

  { level: 'Diploma', name: 'Diploma in Accounting', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Business Management', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Human Resource Management', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Office Management', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Islamic Banking', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Management', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Culinary Arts', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Hotel Management', campusCodes: ['PJ'] },
  { level: 'Diploma', name: 'Diploma in Business', campusCodes: ['JB'] },
  { level: 'Diploma', name: 'Diploma in Early Childhood Education', campusCodes: ['CJ', 'JB'] },
  { level: 'Diploma', name: 'Diploma in Fashion Design', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Graphic Design', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Mass Communication', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma Corporate Communication', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Information Technology', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Medical Lab Technology', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Nursing', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Occupational Safety & Health', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Environmental Health', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Civil Engineering', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Mechanical Engineering', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Architectural Technology', campusCodes: ['CJ'] },
  { level: 'Diploma', name: 'Diploma in Interior Design', campusCodes: ['CJ'] },

  { level: 'Bachelor', name: 'Bachelor of Business Administration (Hons)', campusCodes: ['PJ'] },
  { level: 'Bachelor', name: 'Bachelor of Engineering Management (Hons)', campusCodes: ['PJ'] },
  { level: 'Bachelor', name: 'Bachelor of Accounting (Hons)', campusCodes: ['PJ'] },
  { level: 'Bachelor', name: 'Bachelor of Science (Hons) Accounting & Finance', campusCodes: ['PJ'] },
  { level: 'Bachelor', name: 'Bachelor of Hospitality Management (Hons) (Single Award)', campusCodes: ['PJ'] },
  { level: 'Bachelor', name: 'Bachelor of Business Administration (Honours)', campusCodes: ['JB'] },
  { level: 'Bachelor', name: 'Bachelor of Education (Early Childhood Education) Honours', campusCodes: ['CJ', 'JB'] },
  { level: 'Bachelor', name: 'Bachelor of Fashion Design Technology (Honours)', campusCodes: ['JB'] },
  { level: 'Bachelor', name: 'Bachelor of Information Technology (Honours)', campusCodes: ['JB'] },
  { level: 'Bachelor', name: 'Bachelor of Graphic Design (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Fashion Design (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Multimedia (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Communication (Hons) Corporate Communication', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Communication (Hons) Mass Communication', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Communication (Hons) Journalism', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Animation', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Game Design', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Information Technology (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor in Software Engineering', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Computer Science (Artificial Intelligence) (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Computer Science (Cyber Security) (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Occupational Safety & Health (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Biomedical Sciences (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Environmental Health (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Nursing', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Applied Psychology (Hons)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Education (Hons) in Teaching English as a Second Language (TESL)', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Civil Engineering with Honours', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Mechanical Engineering with Honours', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Science (Hons) Architectural Design', campusCodes: ['CJ'] },
  { level: 'Bachelor', name: 'Bachelor of Interior Design (Hons)', campusCodes: ['CJ'] },

  { level: 'Master', name: 'Master of Business Administration (MBA)', campusCodes: ['PJ', 'JB'] },
  { level: 'Master', name: 'Master of Science in Business Administration (By Research) (MSCBA)', campusCodes: ['PJ'] },
  { level: 'Master', name: 'Master of Education (MED)', campusCodes: ['CJ', 'JB'] },
  { level: 'Master', name: 'Master of Information Technology (MIT)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Accounting (MACC)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Architecture (M.ARC)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Mechanical Engineering (MME)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Sport Studies (MSS) By Research', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Creative Industries and Communication (MCIC)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master of Architecture Project Management (MAPM)', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master in Artificial Intelligence', campusCodes: ['CJ'] },
  { level: 'Master', name: 'Master in Cybersecurity', campusCodes: ['CJ'] },

  { level: 'PhD', name: 'Doctor of Business Administration (DBA)', campusCodes: ['PJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Business Administration (PhDBA)', campusCodes: ['PJ', 'JB'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Education (PhD Edu)', campusCodes: ['CJ', 'JB'] },
  { level: 'PhD', name: 'Doctor of Education (DE)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Design (PhD Design)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Information Technology (PhD IT)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Sport Studies (PhD SS)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Performing Art (PhD PA)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Built Environment (PhD BE)', campusCodes: ['CJ'] },
  { level: 'PhD', name: 'Doctor of Philosophy in Engineering', campusCodes: ['CJ'] },
];

function cityProgrammeCourses() {
  return CITY_PROGRAMMES.map((course) => ({
    level: course.level,
    name: course.name,
    campusCodes: course.campusCodes,
    campuses: course.campusCodes.map((code) => CITY_CAMPUSES[code]),
    displayName: `${course.name} — ${course.campusCodes.join(' / ')}`,
  }));
}

function isCityUniversityName(name) {
  return /city university malaysia/i.test(String(name || ''));
}

function normalizeCampusInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  return CITY_CAMPUSES[upper] || raw;
}

module.exports = {
  CITY_CAMPUSES,
  CITY_PROGRAMMES,
  CITY_UNIVERSITY_INTAKES_2026,
  cityProgrammeCourses,
  isCityUniversityName,
  normalizeCampusInput,
};
