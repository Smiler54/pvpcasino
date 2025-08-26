// Security utilities for input validation and sanitization

/**
 * Enhanced input sanitization to prevent XSS attacks
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove HTML tags more thoroughly
  let sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters and escape entities
  sanitized = sanitized.replace(/[<>&"'`]/g, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/onload/gi, '');
  sanitized = sanitized.replace(/onerror/gi, '');
  
  // Trim whitespace and limit length
  return sanitized.trim().substring(0, 1000);
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validates username format
 */
export const validateUsername = (username: string): boolean => {
  // Allow alphanumeric, underscores, hyphens, 3-20 characters
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * Validates amount inputs for financial operations
 */
export const validateAmount = (amount: number): boolean => {
  return !isNaN(amount) && isFinite(amount) && amount > 0 && amount <= 100000;
};

/**
 * Rate limiting helper for client-side usage
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

/**
 * Enhanced content filtering for inappropriate language and suspicious patterns
 */
const bannedWords = [
  'spam', 'scam', 'hack', 'cheat', 'exploit', 
  'bot', 'script', 'automated', 'casino-bot',
  'money laundering', 'fraud', 'fake', 'phishing'
];

const suspiciousPatterns = [
  /\b\d{16}\b/, // Credit card numbers
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /password\s*[:=]\s*\w+/i, // Password sharing
  /admin\s*[:=]\s*\w+/i, // Admin credentials
  /(\w+\.)+\w+\/[^\s]*\.(exe|zip|rar)/i // Suspicious file links
];

export const filterContent = (message: string): { filtered: string; flagged: boolean } => {
  let filtered = message;
  let flagged = false;
  
  // Check for suspicious patterns
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(filtered)) {
      flagged = true;
      filtered = filtered.replace(pattern, '[REDACTED]');
    }
  });
  
  // Filter banned words
  bannedWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    if (regex.test(filtered)) {
      flagged = true;
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }
  });
  
  return { filtered, flagged };
};

/**
 * Enhanced security headers for comprehensive protection
 */
export const getSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.supabase.co;",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Permitted-Cross-Domain-Policies': 'none'
});

/**
 * IP-based rate limiting for enhanced security
 */
export class IPRateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number; blocked: boolean }> = new Map();
  
  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000, // 1 minute
    private blockDurationMs: number = 300000 // 5 minutes
  ) {}
  
  isAllowed(ip: string): { allowed: boolean; remainingAttempts?: number; blockTimeRemaining?: number } {
    const now = Date.now();
    const record = this.attempts.get(ip);
    
    if (!record) {
      this.attempts.set(ip, { count: 1, lastAttempt: now, blocked: false });
      return { allowed: true, remainingAttempts: this.maxAttempts - 1 };
    }
    
    // Check if IP is currently blocked
    if (record.blocked && (now - record.lastAttempt) < this.blockDurationMs) {
      const blockTimeRemaining = this.blockDurationMs - (now - record.lastAttempt);
      return { allowed: false, blockTimeRemaining };
    }
    
    // Reset if block period has expired
    if (record.blocked && (now - record.lastAttempt) >= this.blockDurationMs) {
      record.blocked = false;
      record.count = 0;
    }
    
    // Reset count if window has passed
    if ((now - record.lastAttempt) >= this.windowMs) {
      record.count = 0;
    }
    
    record.count++;
    record.lastAttempt = now;
    
    if (record.count > this.maxAttempts) {
      record.blocked = true;
      return { allowed: false, blockTimeRemaining: this.blockDurationMs };
    }
    
    return { allowed: true, remainingAttempts: this.maxAttempts - record.count };
  }
  
  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

/**
 * Input validation for different data types
 */
export const validateInput = {
  amount: (amount: any): { valid: boolean; error?: string } => {
    if (typeof amount !== 'number') {
      return { valid: false, error: 'Amount must be a number' };
    }
    if (isNaN(amount) || !isFinite(amount)) {
      return { valid: false, error: 'Amount must be a valid number' };
    }
    if (amount <= 0) {
      return { valid: false, error: 'Amount must be positive' };
    }
    if (amount > 100000) {
      return { valid: false, error: 'Amount exceeds maximum allowed' };
    }
    return { valid: true };
  },
  
  text: (text: any, minLength = 1, maxLength = 1000): { valid: boolean; error?: string } => {
    if (typeof text !== 'string') {
      return { valid: false, error: 'Text must be a string' };
    }
    if (text.length < minLength) {
      return { valid: false, error: `Text must be at least ${minLength} characters` };
    }
    if (text.length > maxLength) {
      return { valid: false, error: `Text must be no more than ${maxLength} characters` };
    }
    return { valid: true };
  },
  
  uuid: (id: any): { valid: boolean; error?: string } => {
    if (typeof id !== 'string') {
      return { valid: false, error: 'ID must be a string' };
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return { valid: false, error: 'Invalid ID format' };
    }
    return { valid: true };
  }
};