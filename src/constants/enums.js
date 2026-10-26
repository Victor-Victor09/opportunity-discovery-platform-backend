const USER_ROLES = Object.freeze({
  STUDENT: 'student',
  PROVIDER: 'provider',
  ADMIN: 'admin',
});

const OPPORTUNITY_TYPES = Object.freeze({
  WORKSHOP: 'workshop',
  BOOTCAMP: 'bootcamp',
  SEMINAR: 'seminar',
  TRAINING: 'training',
  SCHOLARSHIP: 'scholarship',
  INTERNSHIP: 'internship',
});

const DELIVERY_FORMATS = Object.freeze({
  REMOTE: 'remote',
  ONSITE: 'on-site',
  HYBRID: 'hybrid',
});

module.exports = {
  USER_ROLES,
  OPPORTUNITY_TYPES,
  DELIVERY_FORMATS,
};
