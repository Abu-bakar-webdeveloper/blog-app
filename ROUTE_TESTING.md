# Blog App API Route Testing Guide

Use this guide to manually test all backend routes with successful, failure, auth, and permission scenarios.

## Base Setup

- Base URL: `http://localhost:3000`
- API prefix: `/api`
- Auth header for protected routes:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Recommended test accounts:

- Regular user: created with `POST /api/auth/register`
- Admin user: create through seed/database or update role to `ADMIN`
- Inactive user: set `isActive=false` in database to test inactive-token behavior

Useful placeholders:

- `<USER_TOKEN>`: JWT for a normal user
- `<ADMIN_TOKEN>`: JWT for an admin user
- `<BLOG_ID>`: published blog id
- `<UNPUBLISHED_BLOG_ID>`: unpublished blog id
- `<BLOG_SLUG>`: blog slug generated from title
- `<COMMENT_ID>`: comment id
- `<REPORT_ID>`: report id
- `<USER_ID>`: user id

## Global Routes

### `GET /health`

Scenarios:

- Returns server status with `status`, `timestamp`, and `environment`.
- Works without auth.

Expected success:

- Status: `200`
- Body contains `status: "OK"`

### Unknown Route

Example: `GET /api/does-not-exist`

Scenarios:

- Unknown API route returns route-not-found error.
- Any unsupported method/path should be rejected.

Expected error:

- Status: `404`
- Body contains `success: false` and `error: "Route not found"`

## Auth Routes

### `POST /api/auth/register`

Body:

```json
{
  "email": "user1@example.com",
  "password": "Password123",
  "username": "user1",
  "name": "User One",
  "bio": "Test bio",
  "avatar": "https://example.com/avatar.png"
}
```

Scenarios:

- Register with valid `email`, `password`, and `username`.
- Register with only required fields.
- Missing `email`.
- Missing `password`.
- Missing `username`.
- Duplicate email.
- Duplicate username.
- Invalid email format, if database or Prisma validation catches it.

Expected success:

- Status: `201`
- Body contains `success: true`, user data, and token.

Expected errors:

- Missing required fields: `400`
- Duplicate email/username: `400`

### `POST /api/auth/login`

Body:

```json
{
  "email": "user1@example.com",
  "password": "Password123"
}
```

Scenarios:

- Login with valid credentials.
- Missing `email`.
- Missing `password`.
- Wrong password.
- Non-existing email.
- Inactive user.

Expected success:

- Status: `200`
- Body contains `success: true`, user data, and token.

Expected errors:

- Missing required fields: `400`
- Invalid credentials or inactive user: `401`

### `GET /api/auth/profile`

Scenarios:

- Valid user token returns current profile.
- Missing token.
- Invalid token.
- Expired token.
- Token for inactive/deleted user.

Expected success:

- Status: `200`
- Body contains current user data.

Expected errors:

- Missing token: `401`
- Invalid/expired token: `401`
- Inactive/deleted user: `401`

### `PUT /api/auth/profile`

Body:

```json
{
  "name": "Updated Name",
  "bio": "Updated bio",
  "avatar": "https://example.com/new-avatar.png"
}
```

Scenarios:

- Update name only.
- Update bio only.
- Update avatar URL.
- Send empty body.
- Missing token.
- Invalid token.

Expected success:

- Status: `200`
- Body contains `message: "Profile updated successfully"`.

Expected errors:

- Missing/invalid token: `401`
- Invalid update data: `400`

## Blog Routes

### `GET /api/blogs`

Query examples:

```http
GET /api/blogs?page=1&limit=10
GET /api/blogs?type=TECHNOLOGY
GET /api/blogs?tags=node
GET /api/blogs?search=redis
GET /api/blogs?featured=true
GET /api/blogs?startDate=2026-01-01&endDate=2026-12-31
GET /api/blogs?sortBy=createdAt&sortOrder=asc
GET /api/blogs?includeUnpublished=true
```

Scenarios:

- Get first page with default pagination.
- Use custom `page` and `limit`.
- Filter by valid blog type: `SCIENCE`, `TECHNOLOGY`, `GENERAL`, `EDUCATION`, `ENTERTAINMENT`, `HEALTH`, `BUSINESS`, `SPORTS`.
- Filter by tag.
- Search title/content/excerpt.
- Filter featured blogs.
- Filter by date range.
- Sort ascending and descending.
- Use invalid `sortBy` field.
- Use invalid blog type.
- Use `includeUnpublished=true` as admin.
- Use `includeUnpublished=true` without admin token. Note: this route is public, so current implementation only applies admin behavior when `req.user` exists, but no auth middleware runs here.

Expected success:

- Status: `200`
- Body contains `blogs`, `pagination`, and `filters`.

Expected errors:

- Invalid enum/filter/order field may return `500` from Prisma.

### `GET /api/blogs/:id`

Examples:

```http
GET /api/blogs/<BLOG_ID>
GET /api/blogs/<BLOG_SLUG>
```

Scenarios:

- Get published blog by id.
- Get published blog by slug.
- Get non-existing blog.
- Get unpublished blog without token.
- Get unpublished blog as non-admin/non-author.
- Get unpublished blog as admin or author. Note: current route is public and does not run auth middleware before this controller, so `req.user` is normally unavailable.

Expected success:

- Status: `200`
- Body contains blog, author, comments, and counts.

Expected errors:

- Not found: `404`
- Unpublished without permission: `403`

### `POST /api/blogs`

Auth: admin only.

Body:

```json
{
  "title": "My Test Blog",
  "content": "Long blog content",
  "excerpt": "Short summary",
  "type": "TECHNOLOGY",
  "tags": "node,express,api",
  "isPublished": "true",
  "isFeatured": "false",
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/sample.jpg"
}
```

Scenarios:

- Admin creates published blog.
- Admin creates draft blog with `isPublished: "false"`.
- Admin creates featured blog.
- Admin creates blog with tags as comma-separated string.
- Admin creates blog with tags as array.
- Admin creates blog without optional fields.
- Missing title.
- Missing content.
- Duplicate title that generates same slug.
- Invalid blog type.
- Normal user tries to create blog.
- Missing token.

Expected success:

- Status: `201`
- Body contains `message: "Blog created successfully"`.

Expected errors:

- Missing required fields: `400`
- Duplicate title: `400`
- Invalid enum value: `400`
- Normal user: `403`
- Missing/invalid token: `401`

### `PUT /api/blogs/:id`

Auth: admin only.

Body:

```json
{
  "title": "Updated Blog Title",
  "content": "Updated content",
  "excerpt": "Updated summary",
  "type": "BUSINESS",
  "tags": "business,startup",
  "isPublished": "true",
  "isFeatured": "true",
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/new-sample.jpg"
}
```

Scenarios:

- Admin updates title.
- Admin updates content.
- Admin updates tags.
- Admin publishes a draft.
- Admin marks featured/unfeatured.
- Admin changes image URL.
- Admin sends `imageUrl: null` to remove image.
- Update non-existing blog.
- Update title to duplicate another blog slug.
- Invalid blog type.
- Normal user tries to update.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "Blog updated successfully"`.

Expected errors:

- Duplicate title/non-existing/invalid data: `400`
- Normal user: `403`
- Missing/invalid token: `401`

### `DELETE /api/blogs/:id`

Auth: admin only.

Scenarios:

- Admin deletes existing blog.
- Admin deletes blog with comments, likes, and reports.
- Delete non-existing blog.
- Normal user tries to delete.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "Blog deleted successfully"`.

Expected errors:

- Non-existing blog: `400`
- Normal user: `403`
- Missing/invalid token: `401`

### `GET /api/blogs/stats/dashboard`

Auth: admin only.

Scenarios:

- Admin gets dashboard stats.
- Normal user tries to get stats.
- Missing token.

Expected success:

- Status: `200`
- Body contains total blogs, published blogs, views, likes, comments, type breakdown, and recent blogs.

Expected errors:

- Normal user: `403`
- Missing/invalid token: `401`

## Comment Routes

### `GET /api/blogs/:blogId/comments`

Query examples:

```http
GET /api/blogs/<BLOG_ID>/comments?page=1&limit=10
```

Scenarios:

- Get comments for a blog.
- Test pagination.
- Blog with no comments.
- Non-existing blog id.

Expected success:

- Status: `200`
- Body contains `comments` and `pagination`.

### `POST /api/blogs/:blogId/comments`

Auth: user or admin.

Body:

```json
{
  "content": "This is a test comment."
}
```

Scenarios:

- Authenticated user comments on published blog.
- Admin comments on published blog.
- Missing `content`.
- Empty content string.
- Comment on unpublished blog.
- Comment on non-existing blog.
- Missing token.

Expected success:

- Status: `201`
- Body contains `message: "Comment added successfully"`.

Expected errors:

- Missing content: `400`
- Blog not found/unpublished: `400`
- Missing/invalid token: `401`

### `PUT /api/blogs/:blogId/comments/:commentId`

Auth: comment owner.

Body:

```json
{
  "content": "Updated test comment."
}
```

Scenarios:

- Owner updates own active comment.
- Non-owner tries to update comment.
- Admin tries to update another user's comment. Current service only allows owner.
- Missing `content`.
- Update inactive/deleted comment.
- Non-existing comment.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "Comment updated successfully"`.

Expected errors:

- Missing content: `400`
- Non-owner/not found/inactive: `400`
- Missing/invalid token: `401`

### `DELETE /api/blogs/:blogId/comments/:commentId`

Auth: comment owner or admin.

Scenarios:

- Owner deletes own comment.
- Admin deletes any comment.
- Non-owner tries to delete comment.
- Delete non-existing comment.
- Delete already deleted comment.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "Comment deleted successfully"`.

Expected errors:

- Non-owner/not found: `400`
- Missing/invalid token: `401`

## Like Routes

### `GET /api/blogs/:blogId/likes/count`

Scenarios:

- Get likes count for blog with likes.
- Get likes count for blog with no likes.
- Get likes count for non-existing blog.

Expected success:

- Status: `200`
- Body contains `data.count`.

### `POST /api/blogs/:blogId/likes`

Auth: user or admin.

Scenarios:

- Like published blog for the first time.
- Call same route again to unlike.
- Like again after unliking.
- Like unpublished blog.
- Like non-existing blog.
- Missing token.

Expected success:

- Status: `200`
- First toggle body contains `message: "Blog liked"` and `liked: true`.
- Second toggle body contains `message: "Blog unliked"` and `liked: false`.

Expected errors:

- Blog not found/unpublished: `400`
- Missing/invalid token: `401`

### `GET /api/blogs/:blogId/likes/check`

Auth: user or admin.

Scenarios:

- Check liked blog.
- Check unliked blog.
- Check after toggling unlike.
- Check non-existing blog.
- Missing token.

Expected success:

- Status: `200`
- Body contains `data.liked`.

Expected errors:

- Missing/invalid token: `401`

## Report Routes

### `POST /api/blogs/:blogId/reports`

Auth: user or admin.

Body:

```json
{
  "reason": "SPAM",
  "description": "This blog contains spam links."
}
```

Scenarios:

- Report existing blog with reason and description.
- Report existing blog with only reason.
- Missing `reason`.
- Report non-existing blog.
- Same user reports same blog twice while first report is `PENDING`.
- Same user reports again after previous report status is changed.
- Missing token.

Expected success:

- Status: `201`
- Body contains `message: "Blog reported successfully"`.

Expected errors:

- Missing reason: `400`
- Blog not found: `400`
- Duplicate pending report: `400`
- Missing/invalid token: `401`

### `GET /api/reports`

Auth: admin only.

Query examples:

```http
GET /api/reports?page=1&limit=10
GET /api/reports?status=PENDING
GET /api/reports?status=RESOLVED
```

Scenarios:

- Admin gets all reports.
- Admin filters by `PENDING`, `REVIEWED`, `RESOLVED`, `DISMISSED`.
- Admin tests pagination.
- Admin uses invalid status filter.
- Normal user tries to get reports.
- Missing token.

Expected success:

- Status: `200`
- Body contains `reports` and `pagination`.

Expected errors:

- Normal user: `403`
- Missing/invalid token: `401`
- Invalid enum status may return `500` from Prisma.

### `PUT /api/reports/:reportId/status`

Auth: admin only.

Body:

```json
{
  "status": "RESOLVED"
}
```

Scenarios:

- Admin updates status to `PENDING`.
- Admin updates status to `REVIEWED`.
- Admin updates status to `RESOLVED`.
- Admin updates status to `DISMISSED`.
- Missing `status`.
- Invalid status.
- Non-existing report id.
- Normal user tries to update.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "Report status updated successfully"`.

Expected errors:

- Missing/invalid status: `400`
- Non-existing report: `400`
- Normal user: `403`
- Missing/invalid token: `401`

### `GET /api/reports/stats`

Auth: admin only.

Scenarios:

- Admin gets report stats.
- Normal user tries to get stats.
- Missing token.

Expected success:

- Status: `200`
- Body contains total reports, status counts, and reason breakdown.

Expected errors:

- Normal user: `403`
- Missing/invalid token: `401`

## User Routes

### `GET /api/users/:userId/profile`

Scenarios:

- Get public profile for active user.
- Get profile for user with published blogs.
- Get profile for user with no blogs.
- Get non-existing user.
- Get inactive user.

Expected success:

- Status: `200`
- Body contains public user profile, counts, and recent published blogs.

Expected errors:

- User not found/inactive: `404`

### `GET /api/users/profile`

Auth: user or admin.

Scenarios:

- Get own profile with valid token.
- Missing token.
- Invalid token.

Expected success:

- Status: `200`
- Body contains current user profile.

Expected errors:

- Missing/invalid token: `401`

### `GET /api/users/likes`

Auth: user or admin.

Query example:

```http
GET /api/users/likes?page=1&limit=10
```

Scenarios:

- Get current user's liked blogs.
- User with no liked blogs.
- Test pagination.
- Missing token.

Expected success:

- Status: `200`
- Body contains liked blogs and pagination.

Expected errors:

- Missing/invalid token: `401`

### `GET /api/users/comments`

Auth: user or admin.

Query example:

```http
GET /api/users/comments?page=1&limit=10
```

Scenarios:

- Get current user's active comments.
- User with no comments.
- Ensure soft-deleted comments do not appear.
- Test pagination.
- Missing token.

Expected success:

- Status: `200`
- Body contains comments and pagination.

Expected errors:

- Missing/invalid token: `401`

### `GET /api/users/:userId/likes`

Auth: user or admin.

Scenarios:

- Get another user's liked blogs.
- Get likes for user with no likes.
- Get likes for non-existing user id. Current service may return empty results.
- Missing token.

Expected success:

- Status: `200`
- Body contains liked blogs and pagination.

Expected errors:

- Missing/invalid token: `401`

### `GET /api/users/:userId/comments`

Auth: user or admin.

Scenarios:

- Get another user's active comments.
- Get comments for user with no comments.
- Get comments for non-existing user id. Current service may return empty results.
- Missing token.

Expected success:

- Status: `200`
- Body contains comments and pagination.

Expected errors:

- Missing/invalid token: `401`

### `GET /api/users`

Auth: admin only.

Query example:

```http
GET /api/users?page=1&limit=10
```

Scenarios:

- Admin gets all users.
- Admin tests pagination.
- Normal user tries to get users.
- Missing token.

Expected success:

- Status: `200`
- Body contains users and pagination.

Expected errors:

- Normal user: `403`
- Missing/invalid token: `401`

### `PUT /api/users/:id`

Auth: admin only.

Body:

```json
{
  "name": "Updated User",
  "bio": "Updated by admin",
  "role": "ADMIN",
  "isActive": true
}
```

Scenarios:

- Admin updates user name.
- Admin updates user bio.
- Admin changes user role to `ADMIN`.
- Admin changes user role to `USER`.
- Admin deactivates user with `isActive: false`.
- Admin reactivates user with `isActive: true`.
- Invalid role.
- Non-existing user.
- Normal user tries to update another user.
- Missing token.

Expected success:

- Status: `200`
- Body contains `message: "User updated successfully"`.

Expected errors:

- Invalid role/non-existing user: `400`
- Normal user: `403`
- Missing/invalid token: `401`

## Upload Routes

### `GET /api/upload/config`

Scenarios:

- Get upload config without auth.
- Verify `api_secret` is not exposed.
- Verify allowed formats and max file size.

Expected success:

- Status: `200`
- Body contains `max_file_size`, `allowed_formats`, `cloud_name`, and `api_key`.

### `POST /api/upload/signature`

Auth: user or admin.

Body examples:

```json
{
  "purpose": "blog"
}
```

```json
{
  "purpose": "avatar"
}
```

```json
{
  "purpose": "featured"
}
```

```json
{
  "purpose": "custom",
  "folder": "blog_app/custom",
  "tags": "test,manual"
}
```

Scenarios:

- Generate blog image signature.
- Generate avatar signature.
- Generate featured image signature.
- Generate custom signature with folder and tags.
- Generate default signature with empty body.
- Missing token.
- Invalid token.

Expected success:

- Status: `200`
- Body contains signature data, `upload_url`, and `upload_method`.

Expected errors:

- Missing/invalid token: `401`
- Cloudinary config missing: likely `500`

### `POST /api/upload/verify`

Auth: user or admin.

Body:

```json
{
  "public_id": "blog_app/uploads/test",
  "version": "1234567890",
  "signature": "cloudinary-signature"
}
```

Scenarios:

- Verify valid Cloudinary signature.
- Verify invalid signature.
- Missing `public_id`.
- Missing `version`.
- Missing `signature`.
- Missing token.

Expected success:

- Status: `200`
- Body contains `data.isValid`.

Expected errors:

- Missing required fields: `400`
- Missing/invalid token: `401`

### `POST /api/upload/webhook`

Body:

```json
{
  "notification_type": "upload",
  "public_id": "blog_app/uploads/test",
  "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "context": {
    "user_id": "<USER_ID>"
  }
}
```

Headers:

```http
x-cld-signature: <signature>
x-cld-timestamp: <timestamp>
```

Scenarios:

- Webhook with required Cloudinary headers.
- Missing `x-cld-signature`.
- Missing `x-cld-timestamp`.
- Malformed body.

Expected success:

- Status: `200`
- Body contains `success: true`.

Expected errors:

- Missing signature/timestamp: `400`
- Processing failure: `500`

## Cross-Route Test Flows

### Happy Path User Flow

1. Register user with `POST /api/auth/register`.
2. Login with `POST /api/auth/login`.
3. Read published blogs with `GET /api/blogs`.
4. Read one blog with `GET /api/blogs/:id`.
5. Like blog with `POST /api/blogs/:blogId/likes`.
6. Check like with `GET /api/blogs/:blogId/likes/check`.
7. Add comment with `POST /api/blogs/:blogId/comments`.
8. Update own comment with `PUT /api/blogs/:blogId/comments/:commentId`.
9. Delete own comment with `DELETE /api/blogs/:blogId/comments/:commentId`.
10. Report blog with `POST /api/blogs/:blogId/reports`.
11. Get own likes with `GET /api/users/likes`.
12. Get own comments with `GET /api/users/comments`.

### Admin Flow

1. Login as admin with `POST /api/auth/login`.
2. Create blog with `POST /api/blogs`.
3. Update blog with `PUT /api/blogs/:id`.
4. Get blog stats with `GET /api/blogs/stats/dashboard`.
5. Get all users with `GET /api/users`.
6. Update user role/status with `PUT /api/users/:id`.
7. Get all reports with `GET /api/reports`.
8. Update report status with `PUT /api/reports/:reportId/status`.
9. Get report stats with `GET /api/reports/stats`.
10. Delete blog with `DELETE /api/blogs/:id`.

### Auth and Permission Regression Flow

Test every protected route with:

- No `Authorization` header.
- `Authorization: Bearer invalid-token`.
- A valid user token on admin-only routes.
- A valid admin token on admin-only routes.
- A token for a user that has been set to inactive.

Expected patterns:

- Missing token: `401 Authentication required`
- Invalid/expired token: `401 Invalid or expired token`
- Inactive user: `401 User not found or inactive`
- User on admin-only route: `403 Insufficient permissions`

## Notes From Current Implementation

- `GET /api/blogs` and `GET /api/blogs/:id` check `req.user` in the controller, but these routes do not run authentication middleware. Admin-only behavior for `includeUnpublished` and viewing unpublished blogs may not work unless auth is added before those public controllers.
- `GET /api/blogs/:id` treats 25-character values as CUID ids and everything else as slug.
- `isPublished` and `isFeatured` are compared to the string `"true"` in create/update blog requests.
- Comment update is owner-only. Admin can delete any comment but cannot update another user's comment with the current service logic.
- Some invalid query values, such as bad Prisma enum values or invalid `sortBy`, may surface as `500` instead of `400`.
