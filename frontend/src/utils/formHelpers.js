import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Common Zod schemas for reuse across forms
 */
export const commonSchemas = {
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  password: z
    .string()
    .min(1, 'Password is required')
    .refine(
      password => {
        if (!password) return false;
        if (password.length < 8) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/\d/.test(password)) return false;
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
        return true;
      },
      {
        message:
          'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character (!@#$%^&*(),.?":{}|<>)',
      }
    ),
  latitude: z.preprocess(
    val => {
      // Handle empty string, null, undefined
      if (val === '' || val === null || val === undefined) return '';
      // Convert number to string if needed
      return String(val);
    },
    z
      .string()
      .min(1, 'Latitude is required')
      .refine(
        val => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -90 && num <= 90;
        },
        { message: 'Latitude must be between -90 and 90' }
      )
  ),
  longitude: z.preprocess(
    val => {
      // Handle empty string, null, undefined
      if (val === '' || val === null || val === undefined) return '';
      // Convert number to string if needed
      return String(val);
    },
    z
      .string()
      .min(1, 'Longitude is required')
      .refine(
        val => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -180 && num <= 180;
        },
        { message: 'Longitude must be between -180 and 180' }
      )
  ),
  url: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Optional - empty is valid
        // First check if it's a valid URL format
        try {
          // eslint-disable-next-line no-undef
          const url = new URL(val);
          // Only allow http:// and https:// protocols
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false; // Not a valid URL format
        }
      },
      { message: 'Please enter a valid URL starting with http:// or https://' }
    )
    .or(z.literal('')),
  phone: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Optional
        // Remove whitespace
        let cleaned = val.replace(/\s+/g, '');
        if (cleaned === '') return true; // Empty after trimming is valid

        // Convert '00' prefix to '+'
        if (cleaned.startsWith('00')) {
          cleaned = `+${cleaned.substring(2)}`;
        }
        // Add '+' if missing (but only if it doesn't start with '00')
        else if (!cleaned.startsWith('+')) {
          cleaned = `+${cleaned}`;
        }

        // Check for non-digit characters (except leading '+')
        const afterPlus = cleaned.substring(1);
        if (!/^\d+$/.test(afterPlus)) {
          return false;
        }
        // Validate international format: ^\+[1-9]\d{1,14}$
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(cleaned);
      },
      {
        message:
          'Phone number must be in international format: +[1-9][digits] (e.g., +3012345678). Must start with + followed by a non-zero digit and 1-14 more digits.',
      }
    )
    .or(z.literal('')),
  // Diving center specific schemas
  divingCenterName: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  divingCenterDescription: z.string().min(1, 'Description is required'),
  country: z
    .string()
    .max(100, 'Country must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  region: z.string().max(100, 'Region must be at most 100 characters').optional().or(z.literal('')),
  city: z.string().max(100, 'City must be at most 100 characters').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  // Dive site specific schemas
  diveSiteName: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  maxDepth: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Optional
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 200;
      },
      { message: 'Maximum depth must be between 0 and 200 meters' }
    )
    .or(z.number().min(0).max(1000).optional()),
  shoreDirection: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Optional
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 360;
      },
      { message: 'Shore direction must be between 0 and 360 degrees' }
    )
    .or(z.number().min(0).max(360).optional())
    .or(z.literal('')),
  distance: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Optional
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0;
      },
      { message: 'Distance must be a positive number' }
    )
    .or(z.number().min(0).optional())
    .or(z.literal('')),
};

/**
 * Dive site schema for creation and editing
 */
export const diveSiteSchema = z.object({
  name: commonSchemas.diveSiteName,
  description: z.string().min(1, 'Description is required').or(z.literal('')),
  latitude: commonSchemas.latitude,
  longitude: commonSchemas.longitude,
  country: commonSchemas.country,
  region: commonSchemas.region,
  access_instructions: z.string().optional().or(z.literal('')),
  difficulty_code: z.preprocess(
    val => (val === '' || val === null || val === undefined ? null : val),
    z
      .union([
        z.enum(['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']),
        z.null(),
      ])
      .optional()
  ),
  marine_life: z.string().optional().or(z.literal('')),
  safety_information: z.string().optional().or(z.literal('')),
  max_depth: commonSchemas.maxDepth,
  shore_direction: commonSchemas.shoreDirection,
  shore_direction_confidence: z.string().optional().or(z.literal('')),
  shore_direction_method: z.string().optional().or(z.literal('')),
  shore_direction_distance_m: commonSchemas.distance,
});

/**
 * Profile/User schema
 */
export const profileSchema = z.object({
  username: commonSchemas.username,
  name: z.string().optional().or(z.literal('')),
  email: commonSchemas.email,
  number_of_dives: z.preprocess(
    val => {
      if (val === '' || val === null || val === undefined) return 0;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    },
    z.number().min(0, 'Number of dives cannot be negative')
  ),
  buddy_visibility: z.enum(['public', 'private']).default('public'),
});

/**
 * Certification schema
 */
export const certificationSchema = z.object({
  diving_organization_id: z.union([z.string(), z.number()]).refine(val => val !== '', {
    message: 'Please select an organization',
  }),
  certification_level: z.string().min(1, 'Certification level is required'),
});

/**
 * Change password schema
 */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: commonSchemas.password,
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine(data => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

/**
 * Individual dive schema (for use in trip dives array)
 */
const tripDiveSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(), // Temporary ID for new dives
  dive_number: z.number().min(1, 'Dive number must be at least 1'),
  dive_site_id: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .nullable()
    .transform(val => (val === '' || val === null ? null : Number(val))),
  dive_time: z
    .string()
    .optional()
    .nullable()
    .refine(val => !val || val === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: 'Please enter a valid time in HH:MM format',
    })
    .or(z.literal('')),
  dive_duration: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true; // Optional
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 1440;
      },
      { message: 'Dive duration must be between 1 and 1440 minutes' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),
  dive_description: z.string().optional().nullable().or(z.literal('')),
});

/**
 * Trip form schemas
 */
export const tripSchemas = {
  dive: tripDiveSchema,
  trip: z.object({
    diving_center_id: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .nullable()
      .transform(val => (val === '' || val === null ? null : Number(val))),
    trip_date: z.string().min(1, 'Trip date is required'),
    trip_time: z
      .string()
      .optional()
      .nullable()
      .refine(val => !val || val === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
        message: 'Please enter a valid time in HH:MM format',
      })
      .or(z.literal('')),
    trip_duration: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        val => {
          if (!val || val === '' || val === null) return true; // Optional
          const num = typeof val === 'string' ? parseInt(val, 10) : val;
          return !isNaN(num) && num >= 1 && num <= 1440;
        },
        { message: 'Trip duration must be between 1 and 1440 minutes' }
      )
      .transform(val => {
        if (!val || val === '' || val === null) return null;
        return typeof val === 'string' ? parseInt(val, 10) : val;
      }),
    trip_difficulty_code: z
      .union([
        z.enum(['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']),
        z.literal(''),
        z.null(),
      ])
      .optional()
      .nullable()
      .transform(val => (val === '' || val === null || val === undefined ? null : val)),
    trip_price: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        val => {
          if (!val || val === '' || val === null) return true; // Optional
          const num = typeof val === 'string' ? parseFloat(val) : val;
          return !isNaN(num) && num >= 0;
        },
        { message: 'Trip price must be a positive number' }
      )
      .transform(val => {
        if (!val || val === '' || val === null) return null;
        return typeof val === 'string' ? parseFloat(val) : val;
      }),
    trip_currency: z
      .string()
      .length(3, 'Currency must be exactly 3 characters')
      .regex(/^[A-Z]{3}$/, 'Currency must be 3 uppercase letters (e.g., EUR, USD)')
      .default('EUR'),
    group_size_limit: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        val => {
          if (!val || val === '' || val === null) return true; // Optional
          const num = typeof val === 'string' ? parseInt(val, 10) : val;
          return !isNaN(num) && num >= 1;
        },
        { message: 'Group size limit must be at least 1' }
      )
      .transform(val => {
        if (!val || val === '' || val === null) return null;
        return typeof val === 'string' ? parseInt(val, 10) : val;
      }),
    current_bookings: z
      .union([z.string(), z.number()])
      .default(0)
      .transform(val => {
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    trip_description: z.string().optional().nullable().or(z.literal('')),
    special_requirements: z.string().optional().nullable().or(z.literal('')),
    trip_status: z
      .enum(['scheduled', 'confirmed', 'cancelled', 'completed'], {
        errorMap: () => ({ message: 'Invalid trip status' }),
      })
      .default('scheduled'),
    dives: z.array(tripDiveSchema).default([]),
  }),
};

/**
 * Create Dive form schema
 */
export const createDiveSchema = z.object({
  // Required fields
  dive_date: z.string().min(1, 'Dive date is required'),

  // Optional ID fields (transform to number or null)
  dive_site_id: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    }),

  diving_center_id: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    }),

  selected_route_id: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    }),

  // Optional text fields
  name: z.string().optional().nullable().or(z.literal('')),
  dive_information: z.string().optional().nullable().or(z.literal('')),
  gas_bottles_used: z.string().optional().nullable().or(z.literal('')),

  // Boolean field
  is_private: z.boolean().default(false),

  // Optional time field
  dive_time: z
    .string()
    .optional()
    .nullable()
    .refine(val => !val || val === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: 'Please enter a valid time in HH:MM format',
    })
    .or(z.literal('')),

  // Optional number fields with ranges
  duration: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 1440;
      },
      { message: 'Duration must be between 1 and 1440 minutes' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),

  max_depth: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num >= 0 && num <= 1000;
      },
      { message: 'Max depth must be between 0 and 1000 meters' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseFloat(val) : val;
    }),

  average_depth: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num >= 0 && num <= 1000;
      },
      { message: 'Average depth must be between 0 and 1000 meters' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseFloat(val) : val;
    }),

  visibility_rating: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 10;
      },
      { message: 'Visibility rating must be between 1 and 10' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),

  user_rating: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 10;
      },
      { message: 'User rating must be between 1 and 10' }
    )
    .transform(val => {
      if (!val || val === '' || val === null) return null;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    }),

  // Enum fields
  difficulty_code: z.preprocess(
    val => (val === '' || val === null || val === undefined ? null : val),
    z
      .union([
        z.enum(['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']),
        z.null(),
      ])
      .optional()
  ),

  suit_type: z
    .enum(['wet_suit', 'dry_suit', 'shortie', ''])
    .optional()
    .or(z.literal(''))
    .nullable(),
});

/**
 * Helper to create resolver with Zod schema
 */
export const createResolver = schema => zodResolver(schema);

/**
 * Helper to safely extract error message from React Hook Form/Zod errors
 * Handles various error formats: string, object with message/msg, arrays, Zod errors
 */
export const getErrorMessage = error => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  // Handle Zod error object structure
  if (error.message) return error.message;
  if (error.msg) return error.msg;
  // If it's an object with type/loc/msg/input/ctx (Zod error), try to extract message
  if (typeof error === 'object' && !Array.isArray(error)) {
    // Check for common Zod error properties
    if (error.message) return error.message;
    if (error.msg) return error.msg;
    // If it's a plain object without message, don't render it
    return 'Invalid value';
  }
  if (Array.isArray(error) && error.length > 0) {
    return getErrorMessage(error[0]);
  }
  return 'Invalid value';
};

/**
 * Helper to extract field errors from API response
 * Compatible with existing extractFieldErrors from api.js
 */
export const extractFormFieldErrors = error => {
  if (error?.response?.data?.detail && typeof error.response.data.detail === 'object') {
    return error.response.data.detail;
  }
  return {};
};
