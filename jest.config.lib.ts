import config from './jest.config';

config.moduleNameMapper = {
  '^@fp8proj/(.*)$': '<rootDir>/lib/$1',
};

export default config;
