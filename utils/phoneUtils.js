/**
 * Formats a phone number to international format for Vonage API
 * 
 * @param {string} phone - The phone number to format
 * @returns {string} - The formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove any non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If already has a plus, return as is (assumes already formatted)
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For Indian numbers (10 digits), add +91
  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }
  
  // If longer than 10 digits, assume it already has country code but add +
  if (digitsOnly.length > 10) {
    return `+${digitsOnly}`;
  }
  
  // Default, just add plus (might not be correct for all numbers)
  return `+${digitsOnly}`;
}

module.exports = {
  formatPhoneNumber
}; 