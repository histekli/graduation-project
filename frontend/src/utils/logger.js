/**
 * Simple logger utility
 * Only logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};

export default logger;
