CREATE TYPE user_role AS ENUM ('participant', 'admin');

CREATE TABLE users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email VARCHAR(255) UNIQUE NOT NULL,
 display_name VARCHAR(255),
 register_no VARCHAR(100) UNIQUE,
 role user_role DEFAULT 'participant' NOT NULL,
 team_id UUID,
 joined_team_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(255) NOT NULL UNIQUE,
 leader_id UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
 invite_code VARCHAR(100) UNIQUE NOT NULL,
 is_disqualified BOOLEAN DEFAULT FALSE NOT NULL
);

ALTER TABLE users ADD CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE CASCADE ON DELETE SET NULL;
