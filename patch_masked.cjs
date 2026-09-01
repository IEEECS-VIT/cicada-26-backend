const fs = require('fs');
let content = fs.readFileSync('src/controllers/user/userChallengeController.ts', 'utf8');

// Inside viewMaskedAsset:
// const assets = fullChallenge.assets || [];
// const asset = assets[assetIndex];

content = content.replace(
  `        const assets = fullChallenge.assets || [];
        const asset = assets[assetIndex];`,
  `        const allAssets = fullChallenge.assets || [];
        const filteredAssets = challengeService.filterAssetsBySet(allAssets, team.assigned_asset_set ?? null, challengeService.hashTeamId(team.id));
        const asset = filteredAssets[assetIndex];`
);

fs.writeFileSync('src/controllers/user/userChallengeController.ts', content);
