import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Qafzly Backend API',
            version: '1.0.0',
            description: 'API documentation for Qafzly gamified EdTech platform',
        },
        servers: [
            {
                url: 'http://localhost:3000/v1',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        paths: {
        // Authentication endpoints
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register new user',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password', 'fullName'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string', minLength: 8 },
                                    fullName: { type: 'string', minLength: 2 },
                                    country: { type: 'string', maxLength: 2 },
                                    language: { type: 'string', enum: ['ar', 'en'] },
                                    learningGoal: { type: 'string' },
                                    skillLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'User created successfully' },
                    '400': { description: 'Validation error' },
                    '409': { description: 'Email already exists' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login with email/password',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                            type: 'object',
                            required: ['email', 'password'],
                            properties: {
                                email: { type: 'string', format: 'email' },
                                password: { type: 'string' },
                            },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Login successful' },
                    '401': { description: 'Invalid credentials' },
                    '423': { description: 'Account locked' },
                },
            },
        },
        '/auth/refresh': {
            post: {
            tags: ['Auth'],
            summary: 'Refresh access token',
            security: [],
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    required: ['refreshToken'],
                    properties: {
                        refreshToken: { type: 'string' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'New access token' },
                '401': { description: 'Invalid refresh token' },
            },
            },
        },
        '/auth/logout': {
            post: {
            tags: ['Auth'],
            summary: 'Logout (invalidate refresh token)',
            responses: {
                '200': { description: 'Logout successful' },
            },
            },
        },
        '/auth/forgot-password': {
            post: {
            tags: ['Auth'],
            summary: 'Request password reset email',
            security: [],
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Email sent if user exists' },
            },
            },
        },
        '/auth/reset-password': {
            post: {
            tags: ['Auth'],
            summary: 'Reset password with token',
            security: [],
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    required: ['token', 'newPassword'],
                    properties: {
                        token: { type: 'string' },
                        newPassword: { type: 'string', minLength: 8 },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Password reset successful' },
                '401': { description: 'Invalid token' },
            },
            },
        },
        // User profile endpoints
        '/users/me': {
            get: {
            tags: ['User'],
            summary: 'Get current user profile',
            responses: {
                '200': { description: 'User profile retrieved' },
                '401': { description: 'Unauthorized' },
            },
            },
            put: {
            tags: ['User'],
            summary: 'Full update profile',
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    properties: {
                        fullName: { type: 'string' },
                        displayName: { type: 'string' },
                        bio: { type: 'string' },
                        country: { type: 'string', maxLength: 2 },
                        language: { type: 'string', enum: ['ar', 'en'] },
                        timezone: { type: 'string' },
                        learningGoal: { type: 'string' },
                        skillLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
                        isPublic: { type: 'boolean' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Profile updated' },
            },
            },
            patch: {
            tags: ['User'],
            summary: 'Partial update profile',
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    properties: {
                        fullName: { type: 'string' },
                        displayName: { type: 'string' },
                        bio: { type: 'string' },
                        country: { type: 'string' },
                        language: { type: 'string' },
                        timezone: { type: 'string' },
                        learningGoal: { type: 'string' },
                        skillLevel: { type: 'string' },
                        isPublic: { type: 'boolean' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Profile updated' },
            },
            },
            delete: {
            tags: ['User'],
            summary: 'Soft delete account',
            responses: {
                '200': { description: 'Account deleted' },
            },
            },
        },
        '/users/me/privacy': {
            get: {
            tags: ['User'],
            summary: 'Get privacy settings',
            responses: {
                '200': { description: 'Privacy settings retrieved' },
            },
            },
            put: {
            tags: ['User'],
            summary: 'Update privacy settings',
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    properties: {
                        profileVisibility: { type: 'string', enum: ['public', 'private', 'followers'] },
                        showProgress: { type: 'boolean' },
                        showBadges: { type: 'boolean' },
                        allowMessages: { type: 'string', enum: ['everyone', 'followers', 'none'] },
                        emailNotifications: { type: 'boolean' },
                        pushNotifications: { type: 'boolean' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Privacy settings updated' },
            },
            },
        },
        '/users/me/avatar': {
            post: {
            tags: ['User'],
            summary: 'Upload avatar',
            requestBody: {
                required: true,
                content: {
                'multipart/form-data': {
                    schema: {
                    type: 'object',
                    properties: {
                        avatar: { type: 'string', format: 'binary' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Avatar uploaded' },
            },
            },
            delete: {
            tags: ['User'],
            summary: 'Remove avatar',
            responses: {
                '200': { description: 'Avatar removed' },
            },
            },
        },
        // Admin user management endpoints
        '/admin/users': {
            get: {
            tags: ['Admin'],
            summary: 'List users',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'role', in: 'query', schema: { type: 'string', enum: ['STUDENT', 'INSTRUCTOR', 'ADMIN'] } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'suspended', 'deleted'] } },
            ],
            responses: {
                '200': { description: 'List of users' },
                '403': { description: 'Forbidden' },
            },
            },
        },
        '/admin/users/{id}': {
            get: {
            tags: ['Admin'],
            summary: 'Get user by ID',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                '200': { description: 'User details' },
                '404': { description: 'User not found' },
            },
            },
            put: {
            tags: ['Admin'],
            summary: 'Update user',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    properties: {
                        role: { type: 'string', enum: ['STUDENT', 'INSTRUCTOR', 'ADMIN'] },
                        isActive: { type: 'boolean' },
                        isEmailVerified: { type: 'boolean' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'User updated' },
            },
            },
        },
        '/admin/users/{id}/suspend': {
            post: {
            tags: ['Admin'],
            summary: 'Suspend user',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    properties: {
                        reason: { type: 'string' },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'User suspended' },
            },
            },
        },
        '/admin/users/{id}/activate': {
            post: {
            tags: ['Admin'],
            summary: 'Activate user',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                '200': { description: 'User activated' },
            },
            },
        },
        '/admin/users/{id}/role': {
            post: {
            tags: ['Admin'],
            summary: 'Change user role',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                'application/json': {
                    schema: {
                    type: 'object',
                    required: ['role'],
                    properties: {
                        role: { type: 'string', enum: ['STUDENT', 'INSTRUCTOR', 'ADMIN'] },
                    },
                    },
                },
                },
            },
            responses: {
                '200': { description: 'Role changed' },
            },
            },
        },
        },
    },
    apis: [], // We're defining paths manually, no need for JSDoc comments in routes
};

export const swaggerSpec = swaggerJsdoc(options);