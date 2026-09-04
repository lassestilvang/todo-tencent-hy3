# TaskFlow

A modern, feature-rich todo application built with Next.js 16, React 19, and Drizzle ORM.

## Features

- **Natural Language Input** - Type tasks naturally: "Buy groceries tomorrow 5pm #personal !high ~30m"
- **Task Management** - Create, edit, delete, and organize tasks
- **Lists & Labels** - Organize tasks with custom lists and labels
- **Calendar Integration** - Sync with Google Calendar
- **Push Notifications** - Web push notifications for reminders
- **Share Links** - Share lists with others via secure links
- **Focus Mode** - Pomodoro timer with customizable settings
- **Task Templates** - Create reusable task templates
- **Data Export/Import** - Backup and restore your data
- **Webhooks** - External integrations with HMAC signature verification
- **Workspaces** - Team collaboration with roles and permissions
- **Real-time Activity** - Live workspace activity stream over server-sent events
- **Presence Indicators** - See which devices are active in a workspace
- **Offline Mode** - Mutations made offline are queued and synced on reconnect
- **Workflow Automation** - Visual builder with triggers, conditions, and actions
- **Reminders** - Due reminders delivered as toasts

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** SQLite via Drizzle ORM
- **State:** React Hooks
- **Notifications:** Web Push API
- **Testing:** Jest + React Testing Library

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/taskflow.git
cd taskflow

# Install dependencies
npm install

# Set up the database
npm run db:push

# Start the development server
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   ├── list/[id]/          # List pages
│   ├── task/[id]/          # Task pages
│   └── settings/           # Settings pages
├── components/             # React components
├── lib/                    # Business logic
│   ├── tasks.ts            # Task operations
│   ├── nlp.ts              # Natural language parser
│   ├── calendar.ts         # Calendar integration
│   ├── push-notifications.ts # Push notifications
│   ├── webhooks.ts         # Webhook handling
│   ├── share.ts            # Share link management
│   ├── workspaces.ts       # Workspace management
│   └── templates.ts        # Task templates
├── test/                   # Test files
└── types/                  # TypeScript types
```

## API Documentation

### Authentication

Some endpoints require authentication via Bearer token:

```
Authorization: Bearer <your-api-key>
```

### Endpoints

#### Export Data
`GET /api/export` - Export all application data as JSON

#### Import Data
`POST /api/import` - Restore application data from JSON

#### Task Templates
- `GET /api/templates` - Get all templates
- `POST /api/templates` - Create a template
- `GET /api/templates/{id}` - Get a template
- `PUT /api/templates/{id}` - Update a template
- `DELETE /api/templates/{id}` - Delete a template

#### Push Notifications
- `POST /api/push/send` - Send push notification (requires API key)

#### Workspace Activity
- `GET /api/workspaces/{workspaceId}/activity` - Recent workspace activity
- `GET /api/workspaces/{workspaceId}/events` - Live activity stream (SSE)

#### Presence
- `GET /api/presence?workspaceId={id}` - Active devices in a workspace
- `POST /api/presence` - Send a presence heartbeat

#### Reminders
- `GET /api/reminders` - Deliver reminders that are due

See `openapi.yaml` for complete API documentation.

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ci` - Run tests with CI configuration
- `npm run db:push` - Push database schema changes

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Security

This application implements several security best practices:

- **Timing-safe comparisons** for password and signature verification
- **API key authentication** for sensitive endpoints
- **Input validation** using Zod schemas
- **Secure defaults** for all configuration
- **Error handling** that doesn't leak sensitive information

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request