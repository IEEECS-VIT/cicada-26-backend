const fs = require('fs');

// 1. types/challenge.ts
let challengeTypes = fs.readFileSync('src/types/challenge.ts', 'utf8');
challengeTypes = challengeTypes.replace(/caption\?: string \| undefined;/g, "caption?: string | undefined;\n  asset_set?: number;");
fs.writeFileSync('src/types/challenge.ts', challengeTypes);

// 2. types/team.ts (or repositories/interfaces.ts)
let interfaces = fs.readFileSync('src/repositories/interfaces.ts', 'utf8');
interfaces = interfaces.replace(/points\?: number;/g, "points?: number;\n  assigned_asset_set?: number | null;");
fs.writeFileSync('src/repositories/interfaces.ts', interfaces);
