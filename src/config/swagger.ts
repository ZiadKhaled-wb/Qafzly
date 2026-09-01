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
        // Category endpoints
        '/categories': {
        get: {
            tags: ['Categories'],
            summary: 'List categories',
            security: [],
            parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'parentId', in: 'query', schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'List of categories' } },
        },
        post: {
            tags: ['Categories'],
            summary: 'Create category (admin)',
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                    name: { type: 'string' },
                    nameEn: { type: 'string' },
                    description: { type: 'string' },
                    parentId: { type: 'string' },
                    },
                },
                },
            },
            },
            responses: { '201': { description: 'Category created' }, '403': { description: 'Forbidden' } },
        },
        },
        '/categories/{id}': {
        get: {
            tags: ['Categories'],
            summary: 'Get category by ID',
            security: [],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Category details' }, '404': { description: 'Not found' } },
        },
        put: {
            tags: ['Categories'],
            summary: 'Update category (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                    name: { type: 'string' },
                    nameEn: { type: 'string' },
                    description: { type: 'string' },
                    parentId: { type: 'string' },
                    },
                },
                },
            },
            },
            responses: { '200': { description: 'Category updated' } },
        },
        delete: {
            tags: ['Categories'],
            summary: 'Delete category (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Category deleted' } },
        },
        },
        // Course endpoints
        '/courses': {
        get: {
            tags: ['Courses'],
            summary: 'List public courses',
            security: [],
            parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'categoryId', in: 'query', schema: { type: 'string' } },
            { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] } },
            { name: 'minPrice', in: 'query', schema: { type: 'number' } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
            { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
            { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'price', 'title'], default: 'createdAt' } },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
            ],
            responses: { '200': { description: 'List of courses' } },
        },
        post: {
            tags: ['Courses'],
            summary: 'Create course (admin)',
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    required: ['title', 'description'],
                    properties: {
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    description: { type: 'string' },
                    descriptionEn: { type: 'string' },
                    categoryId: { type: 'string' },
                    difficulty: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] },
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    featuredImage: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    prerequisites: { type: 'array', items: { type: 'string' } },
                    estimatedDuration: { type: 'integer' },
                    },
                },
                },
            },
            },
            responses: { '201': { description: 'Course created' }, '403': { description: 'Forbidden' } },
        },
        },
        '/courses/admin/list': {
        get: {
            tags: ['Courses'],
            summary: 'List all courses (admin, includes unpublished)',
            parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'categoryId', in: 'query', schema: { type: 'string' } },
            { name: 'difficulty', in: 'query', schema: { type: 'string' } },
            { name: 'isPublished', in: 'query', schema: { type: 'boolean' } },
            { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: { '200': { description: 'List of all courses' } },
        },
        },
        '/courses/{id}': {
        get: {
            tags: ['Courses'],
            summary: 'Get course by ID (public, only published unless admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Course details' }, '404': { description: 'Not found' } },
        },
        put: {
            tags: ['Courses'],
            summary: 'Update course (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    description: { type: 'string' },
                    descriptionEn: { type: 'string' },
                    categoryId: { type: 'string' },
                    difficulty: { type: 'string' },
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    featuredImage: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    prerequisites: { type: 'array', items: { type: 'string' } },
                    estimatedDuration: { type: 'integer' },
                    isPublished: { type: 'boolean' },
                    isFeatured: { type: 'boolean' },
                    },
                },
                },
            },
            },
            responses: { '200': { description: 'Course updated' } },
        },
        delete: {
            tags: ['Courses'],
            summary: 'Soft-delete course (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Course deleted' } },
        },
        },
        '/courses/{id}/publish': {
        post: {
            tags: ['Courses'],
            summary: 'Publish/unpublish course (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    required: ['publish'],
                    properties: { publish: { type: 'boolean' } },
                },
                },
            },
            },
            responses: { '200': { description: 'Publish status updated' } },
        },
        },
        // Module endpoints
        '/modules': {
        get: {
            tags: ['Modules'],
            summary: 'List modules for a course (public)',
            parameters: [
            { name: 'courseId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of modules' } },
        },
        post: {
            tags: ['Modules'],
            summary: 'Create module (admin)',
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    required: ['courseId', 'title'],
                    properties: {
                    courseId: { type: 'string' },
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    description: { type: 'string' },
                    order: { type: 'integer' },
                    isPublished: { type: 'boolean' },
                    },
                },
                },
            },
            },
            responses: { '201': { description: 'Module created' } },
        },
        },
        '/modules/{id}': {
        get: {
            tags: ['Modules'],
            summary: 'Get module by ID (public, only published unless admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Module details' }, '404': { description: 'Not found' } },
        },
        put: {
            tags: ['Modules'],
            summary: 'Update module (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    description: { type: 'string' },
                    order: { type: 'integer' },
                    isPublished: { type: 'boolean' },
                    },
                },
                },
            },
            },
            responses: { '200': { description: 'Module updated' } },
        },
        delete: {
            tags: ['Modules'],
            summary: 'Delete module (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Module deleted' } },
        },
        },
        // Lesson endpoints
        '/lessons': {
        get: {
            tags: ['Lessons'],
            summary: 'List lessons for a module (public)',
            parameters: [
            { name: 'moduleId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of lessons' } },
        },
        post: {
            tags: ['Lessons'],
            summary: 'Create lesson (admin)',
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    required: ['moduleId', 'title'],
                    properties: {
                    moduleId: { type: 'string' },
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    content: { type: 'string' },
                    contentEn: { type: 'string' },
                    contentType: { type: 'string', enum: ['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED'] },
                    videoUrl: { type: 'string' },
                    videoDuration: { type: 'integer' },
                    hasQuiz: { type: 'boolean' },
                    order: { type: 'integer' },
                    isPreview: { type: 'boolean' },
                    isPublished: { type: 'boolean' },
                    estimatedTime: { type: 'integer' },
                    },
                },
                },
            },
            },
            responses: { '201': { description: 'Lesson created' } },
        },
        },
        '/lessons/{id}': {
        get: {
            tags: ['Lessons'],
            summary: 'Get lesson by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Lesson details' }, '404': { description: 'Not found' } },
        },
        put: {
            tags: ['Lessons'],
            summary: 'Update lesson (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                    title: { type: 'string' },
                    titleEn: { type: 'string' },
                    content: { type: 'string' },
                    contentEn: { type: 'string' },
                    contentType: { type: 'string', enum: ['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED'] },
                    videoUrl: { type: 'string' },
                    videoDuration: { type: 'integer' },
                    hasQuiz: { type: 'boolean' },
                    order: { type: 'integer' },
                    isPreview: { type: 'boolean' },
                    isPublished: { type: 'boolean' },
                    estimatedTime: { type: 'integer' },
                    },
                },
                },
            },
            },
            responses: { '200': { description: 'Lesson updated' } },
        },
        delete: {
            tags: ['Lessons'],
            summary: 'Delete lesson (admin)',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Lesson deleted' } },
        },
        },
        // Enrollment endpoints
        '/enrollments/courses/{courseId}/enroll': {
        post: {
            tags: ['Enrollment'],
            summary: 'Enroll current user in a course',
            parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '201': { description: 'Enrolled successfully' }, '401': { description: 'Unauthorized' }, '404': { description: 'Course not found' } },
        },
        delete: {
            tags: ['Enrollment'],
            summary: 'Unenroll from a course',
            parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Unenrolled' } },
        },
        },
        '/enrollments/me/enrollments': {
        get: {
            tags: ['Enrollment'],
            summary: 'Get current user enrollments',
            parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of enrollments' } },
        },
        },
        '/enrollments/courses/{courseId}/enrollments': {
        get: {
            tags: ['Enrollment'],
            summary: 'Get enrollments for a course (admin)',
            parameters: [
            { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'List of enrollments' } },
        },
        },
        // Progress endpoints
        '/progress/lessons/{lessonId}': {
        post: {
            tags: ['Progress'],
            summary: 'Update lesson progress',
            parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
            required: true,
            content: {
                'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                    completed: { type: 'boolean' },
                    timeSpent: { type: 'integer' },
                    quizScore: { type: 'integer' },
                    },
                },
                },
            },
            },
            responses: { '200': { description: 'Progress updated' } },
        },
        },
        '/progress/courses/{courseId}': {
        get: {
            tags: ['Progress'],
            summary: 'Get course progress for current user',
            parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Progress summary' } },
        },
        },
    },
    },
    apis: [], // We're defining paths manually, no need for JSDoc comments in routes
};

export const swaggerSpec = swaggerJsdoc(options);