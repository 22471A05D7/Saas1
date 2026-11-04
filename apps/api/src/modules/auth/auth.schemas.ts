import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(72, 'Password must be at most 72 characters long'); // bcrypt's input limit

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your full name').max(255),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(255),
    password,
    confirmPassword: z.string(),
    organizationName: z.string().trim().min(2, 'Please enter your organization name').max(255),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
