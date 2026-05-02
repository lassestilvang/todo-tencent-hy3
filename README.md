# TaskFlow - Daily Task Planner

A modern, professional daily task planner built with Next.js 16, React 19, and Tailwind CSS.

## Features

- **Task Management**: Create, edit, and delete tasks with ease
- **Smart Organization**: Organize tasks by lists, labels, and priorities
- **Date-Based Views**: Today, Next 7 Days, Upcoming, and All Tasks views
- **Subtasks**: Break down complex tasks into manageable subtasks
- **Attachments**: Add attachments to tasks
- **Reminders**: Set reminders for important tasks
- **Search**: Full-text search across all tasks
- **Dark Mode**: Built-in theme toggle with next-themes
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4, Radix UI
- **State Management**: React Hook Form with Zod validation
- **Database**: LowDB for local JSON storage
- **Fonts**: Geist Sans & Mono via next/font
- **Icons**: Lucide React

## Getting Started

First, install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── api/         # API routes
│   ├── task/        # Task detail pages
│   └── ...          # Other route segments
├── components/       # React components
├── lib/             # Utility functions and database
└── types/           # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
