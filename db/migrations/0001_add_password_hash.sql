-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make it required for new users (but allow NULL for existing users)
-- Update existing users with a placeholder if needed
UPDATE users SET password_hash = '' WHERE password_hash IS NULL;

-- Now make it NOT NULL
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
