-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  neighborhood TEXT,
  plot_id varchar,
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  price DECIMAL(12, 2) NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms DECIMAL(3, 1) NOT NULL,
  square_feet INTEGER NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  video_status TEXT NOT NULL DEFAULT 'ready',
  duration_seconds INTEGER,
  filesize_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create saved_properties table
CREATE TABLE IF NOT EXISTS saved_properties (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  saved_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create property_dislikes table
CREATE TABLE IF NOT EXISTS property_dislikes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  disliked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  contact_method TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create saved_filters table
CREATE TABLE IF NOT EXISTS saved_filters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create property_reports table
CREATE TABLE IF NOT EXISTS property_reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create property_audit_logs table
CREATE TABLE IF NOT EXISTS property_audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  actor_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  meta_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create property_watch_events table
CREATE TABLE IF NOT EXISTS property_watch_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  watched_seconds INTEGER NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create dismissed_areas table
CREATE TABLE IF NOT EXISTS dismissed_areas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_properties_user_id ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_property_id ON saved_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_property_dislikes_user_id ON property_dislikes(user_id);
CREATE INDEX IF NOT EXISTS idx_property_dislikes_property_id ON property_dislikes(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_property_reports_property_id ON property_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_property_watch_events_property_id ON property_watch_events(property_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_areas_user_id ON dismissed_areas(user_id);
