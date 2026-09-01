import { config } from 'dotenv';
config();
import { ChallengeRepository } from './src/repositories/challengeRepository.js';

async function run() {
  const repo = new ChallengeRepository();
  const rounds = await repo.getRounds();
  console.log(JSON.stringify(rounds, null, 2));
}
run();
