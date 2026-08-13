// Reference data for university profiles (countries, cities, course catalog).

export const COUNTRIES = [
  'Malaysia', 'Australia', 'United Kingdom', 'Canada', 'United States',
  'New Zealand', 'Ireland', 'Germany', 'Singapore', 'United Arab Emirates',
  'China', 'Japan', 'South Korea', 'Turkey', 'Cyprus', 'Other',
];

// Common cities per country (used as dropdown suggestions; custom values allowed).
export const CITIES_BY_COUNTRY = {
  Malaysia: ['Kuala Lumpur', 'Selangor', 'Cyberjaya', 'Penang', 'Johor Bahru', 'Nilai', 'Subang Jaya', 'Putrajaya'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Glasgow', 'Edinburgh', 'Coventry'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton', 'Winnipeg'],
  'United States': ['New York', 'Los Angeles', 'Boston', 'Chicago', 'San Francisco', 'Seattle', 'Houston'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin'],
  Ireland: ['Dublin', 'Cork', 'Galway', 'Limerick'],
  Germany: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne'],
  Singapore: ['Singapore'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  China: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'],
  Japan: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
  'South Korea': ['Seoul', 'Busan', 'Incheon'],
  Turkey: ['Istanbul', 'Ankara', 'Izmir'],
  Cyprus: ['Nicosia', 'Famagusta', 'Kyrenia'],
};

export const COURSE_LEVELS = ['Foundation', 'Diploma', 'Bachelor', 'Master', 'PhD'];

// Display labels (stored value stays as COURSE_LEVELS above).
export const LEVEL_LABELS = {
  Foundation: 'Foundation',
  Diploma: 'Diploma',
  Bachelor: 'Bachelor / Degree',
  Master: 'Master',
  PhD: 'PhD',
};

// Common programs per level — most universities offer some of these.
// Used as quick-pick chips; custom programs can also be added.
export const COMMON_COURSES = {
  Foundation: [
    'Foundation in Science',
    'Foundation in Arts',
    'Foundation in Business',
    'Foundation in IT',
    'Foundation in Engineering',
  ],
  Diploma: [
    'Diploma in Culinary Arts',
    'Diploma in IT',
    'Diploma in Computer Science',
    'Diploma in Business Administration',
    'Diploma in Accounting',
    'Diploma in Hospitality Management',
    'Diploma in Engineering',
    'Diploma in Graphic Design',
  ],
  Bachelor: [
    'Bachelor in Computer Science',
    'Bachelor in Business Administration',
    'Bachelor in Information Technology',
    'Bachelor in Accounting & Finance',
    'Bachelor in Engineering',
    'Bachelor in Hospitality Management',
    'Bachelor in Marketing',
    'Bachelor in Psychology',
    'Bachelor in Law',
  ],
  Master: [
    'Master in Business Administration (MBA)',
    'Master in Computer Science',
    'Master in Information Technology',
    'Master in Engineering',
    'Master in Finance',
    'Master in Data Science',
  ],
  PhD: [
    'PhD in Business',
    'PhD in Computer Science',
    'PhD in Engineering',
    'PhD in Science',
  ],
};
