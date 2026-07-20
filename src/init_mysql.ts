import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function initDB() {
  console.log('Connecting to MySQL Server to initialize database...');
  
  // Connect without database selected first to create it
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    const dbName = process.env.DB_NAME || 'cicada_2067';
    console.log(`Ensuring database '${dbName}' exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    
    // Switch to the database
    await connection.query(`USE \`${dbName}\``);

    console.log('Creating tables based on schema_v2...');

    // TEAMS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        leader_id VARCHAR(36),
        invite_code VARCHAR(100) UNIQUE NOT NULL,
        is_disqualified BOOLEAN DEFAULT FALSE NOT NULL
      )
    `);

    // USERS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        register_no VARCHAR(100) UNIQUE,
        role ENUM('participant', 'admin') DEFAULT 'participant' NOT NULL,
        team_id VARCHAR(36),
        joined_team_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE CASCADE ON DELETE SET NULL
      )
    `);

    // NOTE: Because users references teams, and teams references users (leader_id), 
    // we have to add the foreign key on teams AFTER users is created to avoid circular dependency errors on setup.
    // However, since leader_id in teams isn't strictly enforced with a foreign key right now in this quick script, 
    // we'll just add it explicitly.
    try {
      await connection.query(`
        ALTER TABLE teams ADD CONSTRAINT fk_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
      `);
      console.log('Added foreign key for team leader.');
    } catch (e: any) {
      // If it already exists, ignore
      if (e.code !== 'ER_DUP_KEYNAME') {
        // Just log it
      }
    }

    console.log('Database initialization complete!');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await connection.end();
  }
}

initDB();
