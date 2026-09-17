import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Qafzly Backend API',
            version: '1.2.0',
            description: `
API documentation for the Qafzly gamified EdTech platform (Arabic/Egyptian market).

**Base URL:** \`http://localhost:3000/v1\`

**Authentication:** Bearer JWT. Use the **Authorize** button to set the token from \`POST /auth/login\`.

**Response envelope:** Every endpoint returns \`{ success, data, message, errors, meta }\`.

**Rate limiting:** Auth endpoints are limited to 10 req/min per IP per endpoint. All other endpoints are limited to 100 req/min per user (or IP for anonymous). Health checks and \`/api-docs\` are excluded.

**Idempotency:** \`POST /payments/requests\` supports an optional \`Idempotency-Key\` header — repeated requests with the same key within 24h return the original response.

**Pagination:** List endpoints accept \`page\` (default 1) and \`limit\` (default 20) and return pagination in \`meta\`.

**Sprint 12 contract changes:**
- Slide completion: submit \`{ answer }\` only. Correctness is computed server-side.
- Checkpoint completion: submit \`{ selfReflectionAnswer }\` only.
- Community responses: \`author\` (not \`user\`), plus \`userVote\` for authenticated callers.
- Parent dashboard: \`POST /parents/me/children\` accepts \`email\` or \`childId\`.
            `.trim(),
        },
        servers: [
            {
                url: 'http://localhost:3000/v1',
                description: 'Development server',
            },
        ],
        tags: [
            { name: 'Auth', description: 'Registration, login, token management' },
            { name: 'User', description: 'Current user profile and privacy' },
            { name: 'Admin', description: 'Admin user management and system notifications' },
            { name: 'Categories', description: 'Course categories' },
            { name: 'Paths', description: 'Learning paths' },
            { name: 'Modules', description: 'Path modules' },
            { name: 'Lessons', description: 'Lessons, lock status, PDF, warm-up' },
            { name: 'Slides', description: 'Interactive slides (Sprint 10/12)' },
            { name: 'Quest', description: 'Mini-quest checkpoints (Sprint 10/12)' },
            { name: 'Boss Battle', description: 'Module boss battles (Sprint 10/12)' },
            { name: 'Enrollment', description: 'Path enrollment' },
            { name: 'Progress', description: 'Lesson and path progress' },
            { name: 'Gamification', description: 'XP, levels, badges, leaderboards, streaks, quests' },
            { name: 'Payments', description: 'Manual payments (Vodafone Cash / InstaPay)' },
            { name: 'Forum', description: 'Community forum' },
            { name: 'Admin Moderation', description: 'Forum moderation' },
            { name: 'Notifications', description: 'In-app notifications' },
            { name: 'Search', description: 'Global and scoped search' },
            { name: 'Recommendations', description: 'Path recommendations' },
            { name: 'Parent', description: 'Parent dashboard' },
            { name: 'Certificates', description: 'Certificate issuance and verification' },
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
            // =====================================================================
            // AUTH
            // =====================================================================
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Register new user',
                    description:
                        'Creates a user, their gamification profile (`UserStats`), and assigns active daily quests — all inside a transaction. Registration role can be `STUDENT` (default) or `PARENT`; `ADMIN` cannot be self-assigned.',
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
                                        language: { type: 'string', enum: ['ar', 'en'], default: 'ar' },
                                        learningGoal: { type: 'string' },
                                        skillLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], default: 'BEGINNER' },
                                        role: { type: 'string', enum: ['STUDENT', 'PARENT'], default: 'STUDENT' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'User created. Returns `{ user, accessToken, refreshToken }`.' },
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
                        '200': { description: 'Returns `{ user, accessToken, refreshToken }`.' },
                        '401': { description: 'Invalid credentials' },
                        '423': { description: 'Account locked (5 failed attempts → 15 min lockout)' },
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
                        '200': { description: 'Returns `{ accessToken }`.' },
                        '401': { description: 'Invalid or expired refresh token' },
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
                    description: 'Always returns 200 even if the email is not registered (no enumeration).',
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
                        '401': { description: 'Invalid or expired token' },
                    },
                },
            },

            // =====================================================================
            // USER
            // =====================================================================
            '/users/me': {
                get: {
                    tags: ['User'],
                    summary: 'Get current user profile',
                    description: 'Includes gamification summary and progress stats.',
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
                    responses: { '200': { description: 'Profile updated' } },
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
                    responses: { '200': { description: 'Profile updated' } },
                },
                delete: {
                    tags: ['User'],
                    summary: 'Soft delete account',
                    responses: { '200': { description: 'Account deleted (soft)' } },
                },
            },
            '/users/me/privacy': {
                get: {
                    tags: ['User'],
                    summary: 'Get privacy settings',
                    responses: { '200': { description: 'Privacy settings retrieved' } },
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
                    responses: { '200': { description: 'Privacy settings updated' } },
                },
            },
            '/users/me/avatar': {
                post: {
                    tags: ['User'],
                    summary: 'Upload avatar',
                    description: 'Local disk in dev; S3 migration pending (AWS-gated).',
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
                    responses: { '200': { description: 'Avatar uploaded' } },
                },
                delete: {
                    tags: ['User'],
                    summary: 'Remove avatar',
                    responses: { '200': { description: 'Avatar removed' } },
                },
            },

            // =====================================================================
            // ADMIN USER MANAGEMENT
            // =====================================================================
            '/admin/users': {
                get: {
                    tags: ['Admin'],
                    summary: 'List users',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'role', in: 'query', schema: { type: 'string', enum: ['STUDENT', 'PARENT', 'ADMIN'] } },
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
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'User details' },
                        '404': { description: 'User not found' },
                    },
                },
                put: {
                    tags: ['Admin'],
                    summary: 'Update user',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        role: { type: 'string', enum: ['STUDENT', 'PARENT', 'ADMIN'] },
                                        isActive: { type: 'boolean' },
                                        isEmailVerified: { type: 'boolean' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'User updated' } },
                },
            },
            '/admin/users/{id}/suspend': {
                post: {
                    tags: ['Admin'],
                    summary: 'Suspend user',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { reason: { type: 'string' } },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'User suspended' } },
                },
            },
            '/admin/users/{id}/activate': {
                post: {
                    tags: ['Admin'],
                    summary: 'Activate user',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'User activated' } },
                },
            },
            '/admin/users/{id}/role': {
                post: {
                    tags: ['Admin'],
                    summary: 'Change user role',
                    // [FIXED S12] Added note about dedicated validation schema
                    description: 'Uses a dedicated `changeUserRoleSchema`. Role is required; malformed payloads are rejected with 400.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['role'],
                                    properties: {
                                        role: { type: 'string', enum: ['STUDENT', 'PARENT', 'ADMIN'] },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Role changed' },
                        '400': { description: 'Invalid role' },
                    },
                },
            },

            // =====================================================================
            // CATEGORIES
            // =====================================================================
            '/categories': {
                get: {
                    tags: ['Categories'],
                    summary: 'List categories',
                    security: [],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'parentId', in: 'query', schema: { type: 'string', format: 'uuid' } },
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
                                        parentId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Category created' },
                        '403': { description: 'Forbidden' },
                    },
                },
            },
            '/categories/{id}': {
                get: {
                    tags: ['Categories'],
                    summary: 'Get category by ID with children and published paths',
                    security: [],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Category details' },
                        '404': { description: 'Not found' },
                    },
                },
                put: {
                    tags: ['Categories'],
                    summary: 'Update category (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
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
                                        parentId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Category updated' } },
                },
                delete: {
                    tags: ['Categories'],
                    summary: 'Soft-delete category (admin)',
                    description: 'Sets child categories\' parent to null and removes path links.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Category deleted' } },
                },
            },

            // =====================================================================
            // PATHS
            // =====================================================================
            '/paths': {
                get: {
                    tags: ['Paths'],
                    summary: 'List public paths',
                    security: [],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] } },
                        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                        // [FIXED S12] Correctly documented — string enum, not coerce.boolean
                        { name: 'isFeatured', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter by featured status. Omit to return both.' },
                        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'price', 'title'], default: 'createdAt' } },
                        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
                    ],
                    responses: { '200': { description: 'List of paths' } },
                },
                post: {
                    tags: ['Paths'],
                    summary: 'Create path (admin)',
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
                                        categoryId: { type: 'string', format: 'uuid' },
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
                    responses: {
                        '201': { description: 'Path created' },
                        '403': { description: 'Forbidden' },
                    },
                },
            },
            '/paths/admin/list': {
                get: {
                    tags: ['Paths'],
                    summary: 'List all paths (admin, includes unpublished)',
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'difficulty', in: 'query', schema: { type: 'string' } },
                        { name: 'isPublished', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                        { name: 'isFeatured', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                    ],
                    responses: { '200': { description: 'List of all paths' } },
                },
            },
            '/paths/{id}': {
                get: {
                    tags: ['Paths'],
                    summary: 'Get path by ID',
                    // [FIXED S12] optionalAuth now used — admin bypass works
                    description:
                        'Uses `optionalAuth` — admins with a valid Bearer token see unpublished paths through this endpoint. Anonymous callers get 404 for unpublished paths.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Path details (with nested modules[].lessons[])' },
                        '404': { description: 'Not found (or unpublished and caller is not admin)' },
                    },
                },
                put: {
                    tags: ['Paths'],
                    summary: 'Update path (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
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
                                        categoryId: { type: 'string', format: 'uuid' },
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
                    responses: { '200': { description: 'Path updated' } },
                },
                delete: {
                    tags: ['Paths'],
                    summary: 'Soft-delete path (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Path deleted' } },
                },
            },
            '/paths/{id}/publish': {
                post: {
                    tags: ['Paths'],
                    summary: 'Publish/unpublish path (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
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

            // =====================================================================
            // MODULES
            // =====================================================================
            '/modules': {
                get: {
                    tags: ['Modules'],
                    summary: 'List modules for a path',
                    parameters: [
                        { name: 'pathId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
                        // [NEW S12] isPublished filter was previously undocumented
                        { name: 'isPublished', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Admin-only. Default: only published modules for public callers.' },
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
                                    required: ['pathId', 'title'],
                                    properties: {
                                        pathId: { type: 'string', format: 'uuid' },
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
                    summary: 'Get module by ID with lessons',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Module details' },
                        '404': { description: 'Not found' },
                    },
                },
                put: {
                    tags: ['Modules'],
                    summary: 'Update module (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
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
                    description: 'Cascade deletes lessons.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Module deleted' } },
                },
            },

            // =====================================================================
            // LESSONS
            // =====================================================================
            '/lessons': {
                get: {
                    tags: ['Lessons'],
                    summary: 'List lessons for a module',
                    // [FIXED S12] Now uses optionalAuth — each lesson carries isAccessible
                    description:
                        'Uses `optionalAuth`. Each lesson carries an `isAccessible: boolean` flag computed per caller: preview lessons are always accessible; non-preview lessons require an active enrollment in the parent path, or an ADMIN role.',
                    security: [],
                    parameters: [
                        { name: 'moduleId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: {
                        '200': { description: 'List of lessons with isAccessible flag' },
                        '404': { description: 'Module not found' },
                    },
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
                                        moduleId: { type: 'string', format: 'uuid' },
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
                                        // [NEW S12] lesson-completion XP
                                        completionXpAward: { type: 'integer', default: 10, description: 'XP awarded when the lesson transitions to completed. Default 10. Idempotent per user.' },
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
                    description:
                        'Uses `optionalAuth`. Enforces access control: (1) anyone if `isPreview=true`, (2) enrolled users in the parent path, (3) admins. Otherwise 403. Response includes `lockStatus` and `access.reason` (`preview` | `enrolled` | `admin`).',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Lesson details with lockStatus and access.reason' },
                        '403': { description: 'يجب الاشتراك في هذه الدورة للوصول إلى الدرس' },
                        '404': { description: 'Lesson not found or unpublished' },
                    },
                },
                put: {
                    tags: ['Lessons'],
                    summary: 'Update lesson (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
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
                                        completionXpAward: { type: 'integer' },
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
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Lesson deleted' } },
                },
            },
            '/lessons/{id}/lock-status': {
                get: {
                    tags: ['Lessons'],
                    summary: 'Get lesson lock status for current user',
                    description:
                        'Lock is based on the previous lesson in the same module. The wait is the previous lesson\'s `lockDurationHours`. A parent override (`ChildSettings.lockOverrideEnabled`) can disable or adjust it.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': {
                            description: 'Returns `{ isLocked, remainingSeconds, message }`',
                        },
                        '401': { description: 'Unauthorized' },
                        '404': { description: 'Lesson not found' },
                    },
                },
            },
            '/lessons/{id}/pdf-url': {
                get: {
                    tags: ['Lessons'],
                    summary: 'Get signed PDF URL',
                    description: 'S3 signed URL, 5-minute expiry (300s). Refetch when the URL is >4 minutes old or on iframe error.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Returns `{ url, expiresIn: 300 }`' } },
                },
            },
            '/lessons/{id}/pdf': {
                post: {
                    tags: ['Lessons'],
                    summary: 'Upload PDF for lesson (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        content: {
                            'multipart/form-data': {
                                schema: { type: 'object', properties: { pdf: { type: 'string', format: 'binary' } } },
                            },
                        },
                    },
                    responses: { '200': { description: 'PDF uploaded' } },
                },
                delete: {
                    tags: ['Lessons'],
                    summary: 'Delete PDF for lesson (admin)',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'PDF deleted' } },
                },
            },
            '/lessons/{id}/recharge-status': {
                get: {
                    tags: ['Lessons'],
                    summary: 'Get recharge status for current user (XP boost window)',
                    description:
                        'Separate from `lock-status`. Both timers are driven by the previous lesson\'s `completedAt`. Recharge boosts XP by `Lesson.rechargeBoostMultiplier` (default 2×) when the next lesson is started within `Lesson.rechargeBoostWindowHours` (default 24h).',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': {
                            description: 'Returns `{ isRecharging, remainingSeconds, rechargeMessageAr, rechargeMessageEn, xpBoostAvailable, xpBoostMultiplier, xpBoostWindowHours, xpBoostExpiresInSeconds }`',
                        },
                    },
                },
            },
            // [NEW S12] Warm-up completion endpoint
            '/lessons/{lessonId}/warmup/complete': {
                post: {
                    tags: ['Lessons'],
                    summary: 'Submit warm-up riddle answer (Sprint 12)',
                    description:
                        'Awards XP once per user per lesson. Server evaluates the answer against `Lesson.warmUpJson.answerAr` using Arabic normalization. Wrong answer still marks complete but awards 0 XP (no second chance). Duplicate → 400. Lesson without `warmUpJson` → 404.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['answer'],
                                    properties: {
                                        answer: { type: 'string', minLength: 1, description: 'The raw text answer. Arabic normalization is applied server-side.' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Returns `{ lessonId, warmUpCompleted: true, isCorrect, xpEarned }`',
                        },
                        '400': { description: 'تم إكمال تمرين الإحماء بالفعل / الإجابة مطلوبة' },
                        '404': { description: 'لا يوجد تمرين إحماء لهذا الدرس' },
                    },
                },
            },

            // =====================================================================
            // SLIDES
            // =====================================================================
            '/lessons/{lessonId}/slides': {
                get: {
                    tags: ['Slides'],
                    summary: 'List slides for a lesson',
                    // [FIXED S12] optionalAuth (was incorrectly documented as security: [])
                    description:
                        'Uses `optionalAuth`. Returns slides ordered by `order ASC`. Each slide includes a `completed: boolean` flag when the caller is authenticated.',
                    security: [],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: { '200': { description: 'List of slides' } },
                },
                post: {
                    tags: ['Slides'],
                    summary: 'Create a slide (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        slideType: { type: 'string', enum: ['INFO', 'QUIZ', 'DRAG_DROP', 'TRUE_FALSE', 'FILL_BLANK'] },
                                        titleAr: { type: 'string' },
                                        titleEn: { type: 'string' },
                                        bodyAr: { type: 'string' },
                                        bodyEn: { type: 'string' },
                                        questionAr: { type: 'string' },
                                        questionEn: { type: 'string' },
                                        optionsJson: { type: 'array', items: { type: 'string' } },
                                        correctIndex: { type: 'integer' },
                                        explanationAr: { type: 'string' },
                                        explanationEn: { type: 'string' },
                                        instructionAr: { type: 'string' },
                                        instructionEn: { type: 'string' },
                                        itemsJson: { type: 'array', items: { type: 'object' } },
                                        statementAr: { type: 'string' },
                                        statementEn: { type: 'string' },
                                        correctAnswer: { type: 'boolean' },
                                        sentenceAr: { type: 'string' },
                                        sentenceEn: { type: 'string' },
                                        acceptedAnswersJson: { type: 'array', items: { type: 'string' } },
                                        xpAward: { type: 'integer', minimum: 0, maximum: 50, default: 5 },
                                        order: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Slide created' } },
                },
            },
            '/lessons/{lessonId}/slides/reorder': {
                post: {
                    tags: ['Slides'],
                    summary: 'Reorder slides (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['orderedSlideIds'],
                                    properties: {
                                        orderedSlideIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Slides reordered' } },
                },
            },
            '/lessons/{lessonId}/slides/{slideId}': {
                put: {
                    tags: ['Slides'],
                    summary: 'Update a slide (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'slideId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { type: 'object' },
                            },
                        },
                    },
                    responses: { '200': { description: 'Slide updated' } },
                },
                delete: {
                    tags: ['Slides'],
                    summary: 'Delete a slide (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'slideId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: { '200': { description: 'Slide deleted' } },
                },
            },
            // [FIXED S12] The complete-slide endpoint body was rewritten. `isCorrect` is NO LONGER accepted.
            '/lessons/{lessonId}/slides/{slideId}/complete': {
                post: {
                    tags: ['Slides'],
                    summary: 'Complete a slide',
                    description: `Submit only the user's answer. The server computes correctness and returns \`isCorrect\`.

**⚠️ Sprint 12 breaking change:** \`isCorrect\` is **rejected** by \`.strict()\` validation (400 if sent). Correctness is computed server-side by \`answerEvaluation.service.ts\`.

**Answer shape per slide type:**
- INFO: \`{}\` (or omitted)
- QUIZ: \`{ "index": 2 }\`
- TRUE_FALSE: \`{ "value": true }\`
- FILL_BLANK: \`{ "text": "الطوبة" }\` — Arabic normalization applied (tashkeel, alef/yeh/teh variants stripped)
- DRAG_DROP: \`{ "items": [{ "label": "...", "correctZone": "..." }] }\` — order-insensitive

**Response:** \`{ slideId, completed: true, isCorrect, xpEarned }\`

Duplicate completion → 400.`,

                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'slideId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    requestBody: {
                        required: false,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        answer: {
                                            type: 'object',
                                            nullable: true,
                                            description: 'Type-specific. See the endpoint description for the exact shape per slide type.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Slide completed with computed `isCorrect` and `xpEarned`' },
                        '400': { description: 'تم إكمال هذه الشريحة بالفعل OR validation error (e.g., `isCorrect` provided)' },
                        '404': { description: 'الشريحة غير موجودة' },
                    },
                },
            },

            // =====================================================================
            // QUEST CHECKPOINTS
            // =====================================================================
            '/lessons/{lessonId}/checkpoints': {
                get: {
                    tags: ['Quest'],
                    summary: 'List quest checkpoints for a lesson',
                    description: 'Uses `optionalAuth`. Each checkpoint includes a `completed: boolean` flag when the caller is authenticated.',
                    security: [],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'List of checkpoints' } },
                },
                post: {
                    tags: ['Quest'],
                    summary: 'Create a quest checkpoint (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['titleAr', 'taskAr'],
                                    properties: {
                                        titleAr: { type: 'string' },
                                        titleEn: { type: 'string' },
                                        taskAr: { type: 'string' },
                                        taskEn: { type: 'string' },
                                        hintAr: { type: 'string' },
                                        hintEn: { type: 'string' },
                                        xpAward: { type: 'integer', minimum: 0, maximum: 100, default: 15 },
                                        order: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Checkpoint created' } },
                },
            },
            '/lessons/{lessonId}/checkpoints/reorder': {
                post: {
                    tags: ['Quest'],
                    summary: 'Reorder quest checkpoints (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['orderedCheckpointIds'],
                                    properties: {
                                        orderedCheckpointIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Checkpoints reordered' } },
                },
            },
            '/lessons/{lessonId}/checkpoints/{checkpointId}': {
                put: {
                    tags: ['Quest'],
                    summary: 'Update a quest checkpoint (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'checkpointId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { type: 'object' },
                            },
                        },
                    },
                    responses: { '200': { description: 'Checkpoint updated' } },
                },
                delete: {
                    tags: ['Quest'],
                    summary: 'Delete a quest checkpoint (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'checkpointId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: { '200': { description: 'Checkpoint deleted' } },
                },
            },
            // [FIXED S12] The complete-checkpoint endpoint body was rewritten. `completed` is NO LONGER accepted.
            '/lessons/{lessonId}/checkpoints/{checkpointId}/complete': {
                post: {
                    tags: ['Quest'],
                    summary: 'Complete a quest checkpoint',
                    description: `Submit only a self-reflection answer. The server treats a non-empty answer as completion.

**⚠️ Sprint 12 breaking change:** the \`completed\` boolean is **rejected** by \`.strict()\` validation. Submitting a non-empty \`selfReflectionAnswer\` IS the completion signal.

**Response:** \`{ checkpointId, completed: true, xpEarned, questCompleted, nextCheckpoint }\`
- \`questCompleted: true\` means ALL checkpoints for the lesson are done
- \`nextCheckpoint\` is a slim object \`{ id, titleAr, order }\` or \`null\`

Empty/whitespace answer → 400. Duplicate → 400.`,

                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'checkpointId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        selfReflectionAnswer: {
                                            type: 'string',
                                            description: 'Must be non-empty (whitespace-only is rejected).',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Checkpoint completed' },
                        '400': { description: 'يجب تقديم إجابة غير فارغة OR تم إكمال نقطة التحقق بالفعل OR validation error' },
                        '404': { description: 'نقطة التحقق غير موجودة' },
                    },
                },
            },

            // =====================================================================
            // BOSS BATTLE
            // =====================================================================
            '/modules/{moduleId}/boss-battle': {
                post: {
                    tags: ['Boss Battle'],
                    summary: 'Create boss battle (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['titleAr', 'narrativeAr', 'monsterNameAr', 'questions'],
                                    properties: {
                                        titleAr: { type: 'string' },
                                        titleEn: { type: 'string' },
                                        narrativeAr: { type: 'string' },
                                        narrativeEn: { type: 'string' },
                                        monsterNameAr: { type: 'string' },
                                        monsterNameEn: { type: 'string' },
                                        victoryBonusPerfect: { type: 'integer', default: 50 },
                                        victoryBonusGood: { type: 'integer', default: 30 },
                                        victoryBonusFair: { type: 'integer', default: 15 },
                                        victoryBonusRetry: { type: 'integer', default: 5 },
                                        questions: {
                                            type: 'array',
                                            minItems: 3,
                                            items: {
                                                type: 'object',
                                                required: ['questionAr', 'optionsAr', 'correctIndex'],
                                                properties: {
                                                    questionAr: { type: 'string' },
                                                    questionEn: { type: 'string' },
                                                    optionsAr: { type: 'array', items: { type: 'string' } },
                                                    optionsEn: { type: 'array', items: { type: 'string' } },
                                                    correctIndex: { type: 'integer' },
                                                    explanationAr: { type: 'string' },
                                                    explanationEn: { type: 'string' },
                                                    xpAward: { type: 'integer', default: 10 },
                                                    order: { type: 'integer' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Boss battle created' } },
                },
                get: {
                    tags: ['Boss Battle'],
                    summary: 'Get boss battle for module',
                    description: 'Accessible any time (no lesson-completion gate). Questions in the response do NOT include `correctIndex`.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Boss battle details with `{ ...battle, questions: [...], completed, lastScore, lastVictoryLevel }`' },
                        '404': { description: 'لا توجد معركة زعيم لهذه الوحدة' },
                    },
                },
            },
            '/modules/{moduleId}/boss-battle/{battleId}': {
                put: {
                    tags: ['Boss Battle'],
                    summary: 'Update boss battle (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'battleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
                    responses: { '200': { description: 'Boss battle updated' } },
                },
                delete: {
                    tags: ['Boss Battle'],
                    summary: 'Delete boss battle (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'battleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: { '200': { description: 'Boss battle deleted' } },
                },
            },
            '/modules/{moduleId}/boss-battle/submit': {
                post: {
                    tags: ['Boss Battle'],
                    summary: 'Submit boss battle answers',
                    description: `Submit once per lifetime (unique constraint on \`(userId, bossBattleId)\`). Duplicate → 400.

**Victory tiers:** \`legend\` (≥80%), \`warrior\` (≥60%), \`trainee\` (≥40%), \`retry\` (<40%).

**Sprint 12:** each tier awards a persistent \`UserBadge\` (أسطورة المدينة / محارب المدينة / متدرب المدينة / مش هستسلم). The \`badgesEarned\` array in the response is backed by real DB rows.

**Response includes:** \`score\`, \`totalQuestions\`, \`scorePercent\`, \`xpEarned\`, \`victoryLevel\`, \`victoryLabelAr\`, \`totalXp\`, \`newLevel\`, \`badgesEarned\`.`,

                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['answers'],
                                    properties: {
                                        answers: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                required: ['questionId', 'selectedIndex'],
                                                properties: {
                                                    questionId: { type: 'string', format: 'uuid' },
                                                    selectedIndex: { type: 'integer' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Boss battle submitted with computed victory tier and awarded badges' },
                        '400': { description: 'لقد قمت بالفعل بتقديم هذه المعركة OR يجب الإجابة على جميع الأسئلة' },
                        '404': { description: 'لا توجد معركة زعيم لهذه الوحدة' },
                    },
                },
            },

            // =====================================================================
            // ENROLLMENT
            // =====================================================================
            '/enrollments/paths/{pathId}/enroll': {
                post: {
                    tags: ['Enrollment'],
                    summary: 'Enroll current user in a path',
                    parameters: [{ name: 'pathId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '201': { description: 'Enrolled successfully' },
                        '401': { description: 'Unauthorized' },
                        '404': { description: 'Path not found' },
                    },
                },
                delete: {
                    tags: ['Enrollment'],
                    summary: 'Unenroll from a path',
                    parameters: [{ name: 'pathId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Unenrolled' } },
                },
            },
            '/enrollments/me/enrollments': {
                get: {
                    tags: ['Enrollment'],
                    summary: 'List current user\'s active enrollments',
                    description: 'Each enrollment includes `progress` (0–100), `pathTitleAr`/`pathTitleEn`, `featuredImage`, `difficulty`, and a `currentLesson` object (or `null`) with `{ id, titleAr, moduleNameAr }`.',
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'List of enrollments' } },
                },
            },
            '/enrollments/paths/{pathId}/enrollments': {
                get: {
                    tags: ['Enrollment'],
                    summary: 'List enrolled users for a path (admin)',
                    parameters: [
                        { name: 'pathId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'List of enrollments' } },
                },
            },

            // =====================================================================
            // PROGRESS
            // =====================================================================
            '/progress/lessons/{lessonId}': {
                post: {
                    tags: ['Progress'],
                    summary: 'Update lesson progress',
                    description:
                        'On first transition to `completed: true`, the server (all non-blocking): (1) awards `Lesson.completionXpAward` XP once per user, (2) updates the streak (same-day no-op / yesterday +1 / gap > 1 day → reset), (3) attempts certificate auto-issue if this was the last published lesson in the path.',
                    parameters: [{ name: 'lessonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        completed: { type: 'boolean' },
                                        timeSpent: { type: 'integer', description: 'Seconds' },
                                        quizScore: { type: 'integer', minimum: 0, maximum: 100 },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Progress updated' } },
                },
            },
            '/progress/paths/{pathId}': {
                get: {
                    tags: ['Progress'],
                    summary: 'Get path progress summary for current user',
                    parameters: [{ name: 'pathId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Returns `{ pathId, totalLessons, completedLessons, progressPercent, modules[] }`' },
                    },
                },
            },

            // =====================================================================
            // GAMIFICATION
            // =====================================================================
            '/gamification/me': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get current user gamification profile',
                    description:
                        'Returns `{ userId, totalXp, level, currentLevelXp, nextLevelXp, rank, badges[], currentStreak, longestStreak, totalLessonsCompleted, totalPathsCompleted }`.\n\n**Level formula:** `threshold(N) = 50·N·(N-1)`. Worked example: 1250 XP → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`.',
                    responses: { '200': { description: 'Gamification profile' } },
                },
            },
            '/gamification/users/{userId}': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get gamification profile for any user',
                    parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Gamification profile' } },
                },
            },
            '/gamification/xp/history': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get XP history for current user',
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'XP history' } },
                },
            },
            '/gamification/levels': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get level definitions (1–50)',
                    security: [],
                    responses: {
                        '200': { description: 'Returns `[{ level, xpRequired, xpToNext, xpNextLevel }]`' },
                    },
                },
            },
            '/gamification/badges': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get all badge definitions',
                    security: [],
                    responses: { '200': { description: 'List of badges (each with `nameAr` + `nameEn`)' } },
                },
            },
            '/gamification/me/badges': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get current user earned badges',
                    responses: { '200': { description: 'Earned badges' } },
                },
            },
            '/gamification/users/{userId}/badges': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get badges earned by any user',
                    parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Earned badges' } },
                },
            },
            '/gamification/leaderboard': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get leaderboard',
                    parameters: [
                        { name: 'scope', in: 'query', schema: { type: 'string', enum: ['global', 'path'], default: 'global' } },
                        { name: 'pathId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Required when `scope=path`' },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: {
                        '200': { description: 'Global entries: `{ userId, fullName, displayName, avatarUrl, totalXp, level, rank }`. Path entries: `{ userId, fullName, completedLessons, rank }`.' },
                    },
                },
            },
            '/gamification/me/streak': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get current streak info',
                    responses: {
                        '200': { description: 'Returns `{ currentStreak, longestStreak, streakFreezeAvailable, lastActivityDate, lastStreakFreezeAt }`' },
                    },
                },
            },
            '/gamification/daily-quests': {
                get: {
                    tags: ['Gamification'],
                    summary: 'Get active daily quests with user progress',
                    responses: {
                        '200': { description: 'Each quest includes `id`, `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`, `xpAward`, `target`, `progress`, `completed`, `completedAt`.' },
                    },
                },
            },
            '/gamification/daily-quests/{questId}/complete': {
                post: {
                    tags: ['Gamification'],
                    summary: 'Complete a daily quest and earn XP',
                    parameters: [{ name: 'questId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Returns `{ questId, xpAwarded }`' },
                        '409': { description: 'المهمة مكتملة بالفعل' },
                    },
                },
            },
            '/gamification/me/streak/freeze': {
                post: {
                    tags: ['Gamification'],
                    summary: 'Use a streak freeze',
                    responses: {
                        '200': { description: 'Streak frozen successfully' },
                        '400': { description: 'لا يوجد تجميد متاح' },
                        '404': { description: 'User not found' },
                    },
                },
            },

            // =====================================================================
            // PAYMENTS
            // =====================================================================
            '/payments/requests': {
                post: {
                    tags: ['Payments'],
                    summary: 'Create a payment request (manual flow)',
                    description:
                        'Returns payment instructions (reference code, Vodafone Cash & InstaPay numbers) for the given path. Supports the optional `Idempotency-Key` header — repeated requests with the same key within 24h return the original response. Fail-open on Redis outage.',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: 'Idempotency-Key',
                            in: 'header',
                            required: false,
                            schema: { type: 'string', maxLength: 255 },
                            description: 'Optional. A unique key per payment request. Prevents duplicate requests from network retries or double-taps.',
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['pathId'],
                                    properties: {
                                        pathId: { type: 'string', format: 'uuid' },
                                        paymentMethod: { type: 'string', enum: ['vodafone_cash', 'instapay', 'bank_transfer'], default: 'vodafone_cash' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Returns `{ requestId, referenceCode, amount, currency, expiresAt, instructions[] }`' },
                        '404': { description: 'Path not found' },
                        '409': { description: 'Already enrolled' },
                    },
                },
                get: {
                    tags: ['Payments'],
                    summary: 'List current user payment requests',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] } },
                    ],
                    responses: { '200': { description: 'List of payment requests' } },
                },
            },
            '/payments/requests/{id}/mark-sent': {
                post: {
                    tags: ['Payments'],
                    summary: 'Mark payment as sent by user',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { userNotes: { type: 'string' } },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Status updated' } },
                },
            },
            '/payments/admin/requests': {
                get: {
                    tags: ['Payments'],
                    summary: 'List all payment requests (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: { '200': { description: 'List of payment requests' } },
                },
            },
            '/payments/admin/requests/{id}/activate': {
                post: {
                    tags: ['Payments'],
                    summary: 'Activate payment request (admin)',
                    description:
                        'Creates a `Purchase` row and an `Enrollment` with `expiresAt = now + subscriptionDurationMonths`, then sends the activation email. The `Subscription` model was removed in Sprint 12 — `Enrollment.expiresAt` is the source of truth.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        subscriptionDurationMonths: { type: 'integer', enum: [1, 3, 12], default: 1 },
                                        adminNotes: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Payment request activated — enrollment created' } },
                },
            },
            '/payments/admin/requests/{id}/reject': {
                post: {
                    tags: ['Payments'],
                    summary: 'Reject payment request (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['reason'],
                                    properties: { reason: { type: 'string' } },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Payment request rejected' } },
                },
            },

            // =====================================================================
            // CERTIFICATES (Sprint 11) — [NEW S12]
            // =====================================================================
            '/certificates/me': {
                get: {
                    tags: ['Certificates'],
                    summary: 'List current user\'s certificates',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'List of certificates' } },
                },
            },
            '/certificates/verify/{code}': {
                get: {
                    tags: ['Certificates'],
                    summary: 'Public certificate verification by code',
                    security: [],
                    parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'Format: QFLZ-XXXX-XXXX' }],
                    responses: {
                        '200': {
                            description:
                                'Valid: `{ valid: true, certificate: { certificateCode, recipientName, pathTitle, issuedAt, revokedAt: null, revokedReason: null } }`. Not found: `{ valid: false, reason: "NOT_FOUND" }`. Revoked: `{ valid: false, reason: "REVOKED", certificate: { ... } }`.',
                        },
                    },
                },
            },
            '/certificates/{id}': {
                get: {
                    tags: ['Certificates'],
                    summary: 'Get certificate by ID (owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Certificate details' },
                        '403': { description: 'Not owner or admin' },
                        '404': { description: 'Certificate not found' },
                    },
                },
            },
            '/certificates/{id}/download': {
                get: {
                    tags: ['Certificates'],
                    summary: 'Get download URL for the certificate PDF (owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Returns `{ downloadUrl, fileName }`' },
                        '403': { description: 'Not owner or admin' },
                        '404': { description: 'Certificate not found or PDF not yet generated' },
                    },
                },
            },
            '/certificates/admin/issue': {
                post: {
                    tags: ['Certificates'],
                    summary: 'Manually issue a certificate (admin)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['userId', 'pathId'],
                                    properties: {
                                        userId: { type: 'string', format: 'uuid' },
                                        pathId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Certificate issued' },
                        '409': { description: 'Certificate already exists for this user+path' },
                    },
                },
            },
            '/certificates/admin/{id}/revoke': {
                post: {
                    tags: ['Certificates'],
                    summary: 'Revoke a certificate (admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['reason'],
                                    properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Certificate revoked' },
                        '409': { description: 'Already revoked' },
                    },
                },
            },

            // =====================================================================
            // FORUM
            // =====================================================================
            '/forum/categories': {
                get: {
                    tags: ['Forum'],
                    summary: 'List forum categories',
                    description:
                        'Default filter: active categories only. Pass `?isActive=false` to fetch inactive ones (admin views).\n\nEach category includes `postCount` — the number of published, non-deleted posts.',
                    security: [],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                    ],
                    responses: {
                        '200': { description: 'List of categories, each with `id, nameAr, nameEn, slug, descriptionAr, descriptionEn, displayOrder, isActive, postCount, createdAt, updatedAt`' },
                    },
                },
            },
            '/forum/posts': {
                get: {
                    tags: ['Forum'],
                    summary: 'List forum posts',
                    // [FIXED S12] document new fields
                    description:
                        'Uses `optionalAuth`. Each post includes `author` (not `user`) and a per-user `userVote` (`"up" | "down" | null`). Sorting is deterministic — `createdAt DESC` is always the tie-breaker.',
                    security: [],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'pathId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'lessonId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['published', 'hidden', 'deleted'] } },
                        { name: 'search', in: 'query', schema: { type: 'string' } },
                        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'upvotes', 'viewCount'], default: 'createdAt' } },
                        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
                    ],
                    responses: { '200': { description: 'List of posts' } },
                },
                post: {
                    tags: ['Forum'],
                    summary: 'Create new post',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['title', 'content'],
                                    properties: {
                                        title: { type: 'string', minLength: 3, maxLength: 255 },
                                        content: { type: 'string', minLength: 10 },
                                        categoryId: { type: 'string', format: 'uuid' },
                                        pathId: { type: 'string', format: 'uuid' },
                                        lessonId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Returns the created post with `author` + `category` included (Sprint 12)' },
                    },
                },
            },
            '/forum/posts/{id}': {
                get: {
                    tags: ['Forum'],
                    summary: 'Get post by ID (increments view count)',
                    // [FIXED S12] optionalAuth now used; response includes userVote
                    description:
                        'Uses `optionalAuth`. Includes `author`, `userVote`, and (for authenticated callers) `path` and `lesson` relations. Increments `viewCount` on every call.',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Post details' },
                        '404': { description: 'Not found, deleted, or hidden (and caller is not owner/admin)' },
                    },
                },
                put: {
                    tags: ['Forum'],
                    summary: 'Update post (owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        content: { type: 'string' },
                                        categoryId: { type: 'string', format: 'uuid', nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Post updated' },
                        '403': { description: 'غير مصرح لك بتعديل هذا المنشور' },
                    },
                },
                delete: {
                    tags: ['Forum'],
                    summary: 'Delete post (soft; owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Post soft-deleted (sets `deletedAt` + `status: deleted`)' } },
                },
            },
            '/forum/posts/{postId}/comments': {
                get: {
                    tags: ['Forum'],
                    summary: 'List comments for a post',
                    // [FIXED S12] nesting clarified
                    description:
                        'Returns top-level comments (filtered by `parentCommentId: null`) with their direct `replies`. **2-level threading only** — replies-to-replies appear as top-level comments with a non-null `parentCommentId`. Each comment includes `author`, `userVote`, `isBestAnswer`, `isEdited`.',
                    security: [],
                    parameters: [
                        { name: 'postId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'List of top-level comments with nested replies' } },
                },
                post: {
                    tags: ['Forum'],
                    summary: 'Add comment to post',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['content'],
                                    properties: {
                                        content: { type: 'string', minLength: 1 },
                                        parentCommentId: { type: 'string', format: 'uuid' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Comment created with `author` included (Sprint 12)' },
                        '422': { description: 'المنشور مغلق ولا يمكن إضافة تعليقات' },
                    },
                },
            },
            '/forum/comments/{id}': {
                put: {
                    tags: ['Forum'],
                    summary: 'Update comment (owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['content'],
                                    properties: { content: { type: 'string' } },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Comment updated (sets `isEdited: true`)' } },
                },
                delete: {
                    tags: ['Forum'],
                    summary: 'Delete comment (soft; owner or admin)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Comment soft-deleted' } },
                },
            },
            '/forum/posts/{id}/upvote': {
                post: {
                    tags: ['Forum'],
                    summary: 'Upvote a post (toggle)',
                    description: 'Same-type vote removes it. Opposite-type vote replaces it.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Returns `null`. Refetch the post to see updated counts.' } },
                },
            },
            '/forum/posts/{id}/downvote': {
                post: {
                    tags: ['Forum'],
                    summary: 'Downvote a post (toggle)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Returns `null`. Refetch the post.' } },
                },
            },
            '/forum/comments/{id}/upvote': {
                post: {
                    tags: ['Forum'],
                    summary: 'Upvote a comment (toggle)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Voted' } },
                },
            },
            '/forum/comments/{id}/downvote': {
                post: {
                    tags: ['Forum'],
                    summary: 'Downvote a comment (toggle)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Voted' } },
                },
            },
            '/forum/posts/{id}/mark-answer': {
                post: {
                    tags: ['Forum'],
                    summary: 'Mark a comment as best answer (post owner only)',
                    description: 'Sets the comment\'s `isBestAnswer: true` and the post\'s `isSolved: true`. Marking a new comment auto-unmarks the previous one. There is no `bestAnswerId` field — find the best answer client-side: `comments.find(c => c.isBestAnswer)?.id`.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['commentId'],
                                    properties: { commentId: { type: 'string', format: 'uuid' } },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Updated post object with `isSolved: true`' },
                        '403': { description: 'فقط صاحب المنشور يمكنه تحديد أفضل إجابة' },
                    },
                },
            },
            '/forum/search': {
                get: {
                    tags: ['Forum'],
                    summary: 'Search posts by title/content (ILIKE)',
                    description: 'For ranked, language-aware search with filters, use `GET /search/forum` (canonical for the Community search box).',
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    ],
                    responses: { '200': { description: 'Search results (post list shape)' } },
                },
            },
            // [NEW S12] Forum reporting endpoints
            '/forum/posts/{id}/report': {
                post: {
                    tags: ['Forum'],
                    summary: 'Report a post',
                    description: 'Creates a `ForumReport` row and increments the post\'s `flaggedCount` atomically. Duplicate report by same user → 409. Self-report → 400.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['reason'],
                                    properties: {
                                        reason: { type: 'string', enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'off-topic', 'other'] },
                                        details: { type: 'string', maxLength: 500 },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Report submitted — returns the `ForumReport` object' },
                        '400': { description: 'لا يمكنك الإبلاغ عن منشورك الخاص OR reason invalid' },
                        '404': { description: 'المنشور غير موجود' },
                        '409': { description: 'لقد قمت بالإبلاغ عن هذا المنشور بالفعل' },
                    },
                },
            },
            '/forum/comments/{id}/report': {
                post: {
                    tags: ['Forum'],
                    summary: 'Report a comment',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['reason'],
                                    properties: {
                                        reason: { type: 'string', enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'off-topic', 'other'] },
                                        details: { type: 'string', maxLength: 500 },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Report submitted' },
                        '400': { description: 'لا يمكنك الإبلاغ عن تعليقك الخاص' },
                        '404': { description: 'التعليق غير موجود' },
                        '409': { description: 'لقد قمت بالإبلاغ عن هذا التعليق بالفعل' },
                    },
                },
            },

            // =====================================================================
            // ADMIN MODERATION
            // =====================================================================
            '/admin/forum/reports': {
                get: {
                    tags: ['Admin Moderation'],
                    summary: 'List forum reports (moderation queue)',
                    // [FIXED S12] Response shape changed — now ForumReport objects
                    description:
                        'Returns `ForumReport` objects with embedded `reporter`, `post`, and `comment`. Previously returned raw posts filtered by `flaggedCount > 0`.',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'resolved', 'dismissed'], default: 'pending' } },
                    ],
                    responses: { '200': { description: 'List of pending reports with full context' } },
                },
            },
            '/admin/forum/reports/{id}/resolve': {
                post: {
                    tags: ['Admin Moderation'],
                    summary: 'Resolve a report',
                    description: 'Marks the report resolved and decrements the parent post\'s `flaggedCount`. Duplicate resolve → 409.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: {
                        '200': { description: 'Report resolved' },
                        '409': { description: 'تمت معالجة هذا البلاغ بالفعل' },
                    },
                },
            },
            '/admin/forum/posts/{id}/hide': {
                post: {
                    tags: ['Admin Moderation'],
                    summary: 'Hide a post',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Post hidden (`status: hidden`)' } },
                },
            },
            '/admin/forum/posts/{id}/unhide': {
                post: {
                    tags: ['Admin Moderation'],
                    summary: 'Unhide a post',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Post unhidden (`status: published`)' } },
                },
            },
            '/admin/forum/comments/{id}/hide': {
                post: {
                    tags: ['Admin Moderation'],
                    summary: 'Hide a comment',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Comment hidden' } },
                },
            },
            '/admin/forum/comments/{id}/unhide': {
                post: {
                    tags: ['Admin Moderation'],
                    summary: 'Unhide a comment',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Comment unhidden' } },
                },
            },

            // =====================================================================
            // NOTIFICATIONS
            // =====================================================================
            '/notifications': {
                get: {
                    tags: ['Notifications'],
                    summary: 'List current user notifications',
                    // [FIXED S12] boolean params documented as string enum
                    description: 'Boolean filters accept `"true"`/`"false"` as strings. Omit a filter to include both values.',
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                        { name: 'isRead', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                        { name: 'isArchived', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                        { name: 'isDismissed', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
                        { name: 'type', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: { '200': { description: 'List of notifications' } },
                },
            },
            '/notifications/unread/count': {
                get: {
                    tags: ['Notifications'],
                    summary: 'Get unread notification count',
                    responses: { '200': { description: 'Returns `{ count }`' } },
                },
            },
            '/notifications/read-all': {
                post: {
                    tags: ['Notifications'],
                    summary: 'Mark all notifications as read',
                    responses: { '200': { description: 'Returns `{ count }`' } },
                },
            },
            '/notifications/{id}/read': {
                post: {
                    tags: ['Notifications'],
                    summary: 'Mark a notification as read',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Notification marked as read' } },
                },
            },
            '/notifications/{id}/archive': {
                post: {
                    tags: ['Notifications'],
                    summary: 'Archive a notification',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Notification archived' } },
                },
            },
            '/notifications/{id}/dismiss': {
                post: {
                    tags: ['Notifications'],
                    summary: 'Dismiss a notification',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Notification dismissed' } },
                },
            },
            '/notifications/{id}': {
                delete: {
                    tags: ['Notifications'],
                    summary: 'Delete a notification',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Notification deleted' } },
                },
            },
            '/notifications/device/register': {
                post: {
                    tags: ['Notifications'],
                    summary: 'Register a device for push notifications',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['deviceToken', 'deviceType'],
                                    properties: {
                                        deviceToken: { type: 'string' },
                                        deviceType: { type: 'string', enum: ['ios', 'android', 'web'] },
                                        deviceId: { type: 'string' },
                                        deviceModel: { type: 'string' },
                                        osVersion: { type: 'string' },
                                        appVersion: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Device registered' } },
                },
            },
            '/notifications/device/{id}': {
                delete: {
                    tags: ['Notifications'],
                    summary: 'Unregister a device',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Device unregistered' } },
                },
            },
            '/admin/notifications': {
                post: {
                    tags: ['Admin'],
                    summary: 'Send system notification to users',
                    description: 'Requires either `allUsers: true` or a non-empty `userIds` array. Email sending is best-effort via SES.',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['type', 'title', 'body'],
                                    properties: {
                                        allUsers: { type: 'boolean', default: false },
                                        userIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                                        type: { type: 'string' },
                                        title: { type: 'string' },
                                        body: { type: 'string' },
                                        link: { type: 'string', nullable: true },
                                        iconUrl: { type: 'string', nullable: true },
                                        imageUrl: { type: 'string', nullable: true },
                                        metadata: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Returns `{ count }`' } },
                },
            },

            // =====================================================================
            // SEARCH
            // =====================================================================
            '/search': {
                get: {
                    tags: ['Search'],
                    summary: 'Global search across paths, forum posts, and users',
                    security: [],
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'language', in: 'query', schema: { type: 'string', enum: ['ar', 'en'] } },
                        { name: 'type', in: 'query', schema: { type: 'string', enum: ['path', 'forum', 'user'] } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
                    ],
                    responses: { '200': { description: 'Combined results — keys present depend on `type`' } },
                },
            },
            '/search/paths': {
                get: {
                    tags: ['Search'],
                    summary: 'Search paths only (full-text ranked)',
                    security: [],
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'language', in: 'query', schema: { type: 'string', enum: ['ar', 'en'] } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] } },
                        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
                    ],
                    responses: { '200': { description: 'Path search results' } },
                },
            },
            '/search/forum': {
                get: {
                    tags: ['Search'],
                    summary: 'Search forum posts only (full-text ranked) — canonical for community search',
                    security: [],
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'language', in: 'query', schema: { type: 'string', enum: ['ar', 'en'] } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'pathId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
                    ],
                    responses: { '200': { description: 'Forum search results' } },
                },
            },
            '/search/users': {
                get: {
                    tags: ['Search'],
                    summary: 'Search users only',
                    security: [],
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
                    ],
                    responses: { '200': { description: 'User search results' } },
                },
            },

            // =====================================================================
            // RECOMMENDATIONS
            // =====================================================================
            '/recommendations/paths': {
                get: {
                    tags: ['Recommendations'],
                    summary: 'Personalized path recommendations',
                    parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 20 } }],
                    responses: { '200': { description: 'Recommended paths' } },
                },
            },
            '/recommendations/popular': {
                get: {
                    tags: ['Recommendations'],
                    summary: 'Popular paths (by enrollment count)',
                    security: [],
                    parameters: [
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 20 } },
                        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                        { name: 'difficulty', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: { '200': { description: 'Popular paths list' } },
                },
            },
            '/recommendations/trending': {
                get: {
                    tags: ['Recommendations'],
                    summary: 'Trending paths (recent enrollment activity)',
                    security: [],
                    parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 20 } }],
                    responses: { '200': { description: 'Trending paths list' } },
                },
            },
            '/recommendations/related/{pathId}': {
                get: {
                    tags: ['Recommendations'],
                    summary: 'Related paths (co-enrollment)',
                    security: [],
                    parameters: [
                        { name: 'pathId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 20 } },
                    ],
                    responses: { '200': { description: 'Related paths list' } },
                },
            },

            // =====================================================================
            // PARENT
            // =====================================================================
            '/parents/me/overview': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get parent overview',
                    description: 'Returns `{ totalChildren, totalXP, children[], lastActiveChild }`. Note: `level` is at `children[i].stats.level`, not top-level. `stats` may be `null` for very new users.',
                    responses: { '200': { description: 'Overview data' } },
                },
            },
            // [FIXED S12] Now accepts childId OR email
            '/parents/me/children': {
                post: {
                    tags: ['Parent'],
                    summary: 'Link a child to the parent',
                    description:
                        'Accepts EITHER `childId` (uuid) OR `email`. Exactly one required. The email path resolves to a `STUDENT` user. Self-link and non-`STUDENT` targets are rejected.',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    additionalProperties: false,
                                    oneOf: [
                                        { required: ['childId'] },
                                        { required: ['email'] },
                                    ],
                                    properties: {
                                        childId: { type: 'string', format: 'uuid' },
                                        email: { type: 'string', format: 'email' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Child linked successfully — returns `{ id, fullName, email, parentId }`' },
                        '400': { description: 'قدم واحداً فقط من childId أو email / لا يمكنك ربط نفسك / المستخدم المحدد ليس طالبًا' },
                        '404': { description: 'لا يوجد مستخدم بهذا البريد الإلكتروني' },
                        '409': { description: 'هذا الطفل مرتبط بالفعل بمستخدم آخر' },
                    },
                },
                get: {
                    tags: ['Parent'],
                    summary: 'List children for the parent',
                    security: [{ bearerAuth: [] }],
                    responses: { '200': { description: 'List of children (with `avatarUrl` and `stats`)' } },
                },
            },
            '/parents/me/children/{childId}': {
                delete: {
                    tags: ['Parent'],
                    summary: 'Unlink a child from the parent',
                    description: 'Also deletes any associated `ChildSettings` row.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Child unlinked' } },
                },
            },
            '/parents/me/children/{childId}/progress': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get progress summary for a child',
                    description: 'Returns `{ childId, totalLessonsCompleted, totalTimeSpent, progress[] }` where each progress row includes `lesson.title`, `lesson.module.title`, and `lesson.module.path.title`.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Progress summary' } },
                },
            },
            '/parents/me/children/{childId}/performance': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get performance (quiz scores & challenges) for a child',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Performance data' } },
                },
            },
            '/parents/me/children/{childId}/time-tracking': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get time tracking for a child',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Time tracking data' } },
                },
            },
            // [FIXED S12] Documented as returning a FLAT shape
            '/parents/me/children/{childId}/settings': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get settings for a child',
                    description:
                        'Returns a **flat shape** `{ lockOverrideEnabled, customLockDurationHours }` regardless of whether a `ChildSettings` row exists. When absent, defaults are `{ lockOverrideEnabled: false, customLockDurationHours: null }`. No `id`, `parentId`, `createdAt`, or `updatedAt` are returned.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    responses: { '200': { description: 'Child settings (flat shape)' } },
                },
                put: {
                    tags: ['Parent'],
                    summary: 'Update settings for a child',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'childId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        lockOverrideEnabled: { type: 'boolean' },
                                        customLockDurationHours: { type: 'integer', minimum: 0, maximum: 24, nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Returns the same flat shape' } },
                },
            },
            // [FIXED S12] Now aggregates across children; subscriptions key removed
            '/parents/me/billing': {
                get: {
                    tags: ['Parent'],
                    summary: 'Get aggregated billing information',
                    description:
                        'Aggregates `Purchase` rows across the parent **and all linked children**. Each purchase includes `user: { id, fullName, email }` so the UI can show who paid. The `subscriptions` key was removed in Sprint 12 (Subscription model deprecated).',
                    responses: {
                        '200': { description: 'Returns `{ purchases: [...] }` (no `subscriptions` key)' },
                    },
                },
            },
        },
    },
    apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);