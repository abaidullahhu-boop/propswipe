# PropSwipeRealty - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Database**: Set up a PostgreSQL database (recommended: Neon)

## Step 1: Set up Database

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string (it will look like: `postgresql://username:password@hostname/database`)

### Option B: Other PostgreSQL providers
- Supabase
- Railway
- PlanetScale
- Any PostgreSQL-compatible database

## Step 2: Deploy to Vercel

### Method 1: Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel

# Set environment variables
vercel env add DATABASE_URL
# Paste your database connection string when prompted

# Deploy with environment variables
vercel --prod
```

### Method 2: GitHub Integration
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: Leave as is
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

## Step 3: Environment Variables

In your Vercel dashboard, go to your project settings and add:

```
DATABASE_URL=your_postgresql_connection_string
NODE_ENV=production
```

## Step 4: Database Migration

After deployment, you need to run the database migration:

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push
```

## Step 5: Test Your Deployment

1. Visit your Vercel URL
2. Test the login functionality
3. Upload a property (admin)
4. Browse properties (user)
5. Test the like/save functionality

## Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Check your `DATABASE_URL` environment variable
   - Ensure your database allows connections from Vercel's IP ranges

2. **Build Failures**
   - Check the build logs in Vercel dashboard
   - Ensure all dependencies are in `package.json`

3. **Static Files Not Loading**
   - Check that the build output is in `dist/public`
   - Verify the `vercel.json` configuration

### Environment Variables Checklist:
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NODE_ENV` - Set to `production`

## Project Structure for Vercel

```
PropSwipeRealty/
├── vercel.json          # Vercel configuration
├── package.json         # Dependencies and scripts
├── server/              # Backend API
├── client/              # React frontend
├── shared/              # Shared types
└── dist/                # Build output (created during build)
    ├── index.js         # Server bundle
    └── public/          # Static frontend files
```

## Additional Notes

- The app uses Neon serverless PostgreSQL which works well with Vercel
- Static files are served from `dist/public`
- API routes are handled by the Express server
- The build process creates both frontend and backend bundles
