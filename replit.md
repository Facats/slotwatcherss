# Discord Bot Slot Management System

## Overview
This is a full-stack web application for managing Discord bot slot assignments with different shop tier levels. The system provides a dashboard for administrators to manage user slots, track ping usage, and monitor expiration dates. It integrates with Discord.js to provide automated bot functionality for slot management and ping monitoring.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Bot Framework**: Discord.js for Discord integration
- **Session Management**: PostgreSQL session store with connect-pg-simple
- **Build System**: ESBuild for production builds, TSX for development

### Data Layer
- **Database Schema**: 
  - Users table for Discord user information
  - Slots table for shop slot assignments with expiration tracking
  - Ping usage table for rate limiting enforcement
- **Shop Types**: Tiered system (level1-4, partnered) with different durations and ping limits
- **ORM**: Drizzle with PostgreSQL adapter for type-safe queries

### API Design
- RESTful endpoints for CRUD operations on slots and users
- Real-time statistics endpoint for dashboard metrics
- Ping usage tracking with cooldown enforcement
- Bot integration endpoints for automated slot management

### Discord Integration
- **Bot Commands**: Slash commands for slot management
- **Automated Monitoring**: Ping usage tracking and expiration notifications
- **Permission Management**: Role-based access control
- **Event Handling**: Message monitoring for @everyone usage detection

## External Dependencies

### Database & Infrastructure
- **Neon Database**: PostgreSQL hosting (configured via @neondatabase/serverless)
- **Drizzle Kit**: Database migrations and schema management

### Discord Services
- **Discord.js**: Official Discord API library for bot functionality
- **Discord API**: Real-time messaging, slash commands, and user management

### Development & Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundling for production

### UI & Component Libraries
- **Radix UI**: Unstyled, accessible component primitives
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **TanStack Table**: Advanced table functionality

### Validation & Forms
- **Zod**: TypeScript-first schema validation
- **React Hook Form**: Performant form library with validation